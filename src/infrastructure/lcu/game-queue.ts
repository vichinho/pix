import type { GameQueueCategory, GameQueueInfo } from '../../domain/types.js';
import { LcuConnector, LcuHttpError } from './lcu-connector.js';
import { readLockfileCredentials, type LcuCredentials } from './lockfile.js';

/** Estructura parcial de /lol-gameflow/v1/session que consumimos. */
export interface GameflowSessionDto {
  phase?: string;
  gameData?: {
    isCustomGame?: boolean;
    queue?: {
      id?: number;
      mapId?: number;
      name?: string;
      shortName?: string;
      type?: string;
      gameMode?: string;
      category?: string;
      isRanked?: boolean;
    };
  };
  map?: {
    id?: number;
    gameMode?: string;
  };
}

/**
 * Mapa de queueId → categoría. Basado en los queueIds públicos de Riot.
 * https://static.developer.riotgames.com/docs/lol/queues.json
 */
const QUEUE_ID_CATEGORY: Record<number, GameQueueCategory> = {
  // Casual: se elige rol y campeón en la sala, sin fase de bloqueos.
  480: 'CASUAL_SWIFTPLAY', // Swiftplay
  490: 'CASUAL_SWIFTPLAY', // Quickplay (predecesor de Swiftplay)
  // Normal / "reclutamiento": champ select con picks y bans.
  400: 'NORMAL_DRAFT', // Normal Draft Pick
  430: 'NORMAL_DRAFT', // Normal Blind Pick (heredado)
  // Clasificatorias.
  420: 'RANKED_SOLO', // Ranked Solo/Dúo
  440: 'RANKED_FLEX', // Ranked Flex
  // ARAM (incluye variantes de evento sobre la Grieta Aullante).
  450: 'ARAM',
  100: 'ARAM', // ARAM (Butcher's Bridge, heredado)
  2400: 'ARAM', // ARAM: Mayhem (variante de evento)
  // Clash.
  700: 'CLASH',
  720: 'CLASH', // ARAM Clash
  // Cooperativo vs IA (bots).
  830: 'CO_OP_VS_AI',
  840: 'CO_OP_VS_AI',
  850: 'CO_OP_VS_AI',
  870: 'CO_OP_VS_AI',
  880: 'CO_OP_VS_AI',
  890: 'CO_OP_VS_AI',
};

const CATEGORY_LABELS: Record<GameQueueCategory, string> = {
  CASUAL_SWIFTPLAY: 'Casual (Swiftplay)',
  NORMAL_DRAFT: 'Normal (Reclutamiento)',
  RANKED_SOLO: 'Clasificatoria Solo/Dúo',
  RANKED_FLEX: 'Clasificatoria Flexible',
  ARAM: 'ARAM',
  CO_OP_VS_AI: 'Cooperativo vs IA',
  CLASH: 'Clash',
  PRACTICE_TOOL: 'Herramienta de práctica',
  CUSTOM: 'Partida personalizada',
  OTHER: 'Otra cola',
  UNKNOWN: 'Desconocido',
};

/** ¿El gameMode/tipo corresponde a la Herramienta de práctica? */
function isPracticeToolMode(gameMode: string | null, rawType: string | null): boolean {
  return gameMode === 'PRACTICETOOL' || rawType === 'PRACTICETOOL';
}

/** mapId de la Grieta Aullante (mapa de ARAM y sus variantes). */
const HOWLING_ABYSS_MAP_ID = 12;

/**
 * Heurística para reconocer ARAM y sus variantes de evento (p.ej. "ARAM: Mayhem"),
 * que usan queueIds rotativos no listados. Se apoya en el mapa y en el nombre.
 */
function isAramLike(gameMode: string | null, rawName: string | null, mapId: number | null): boolean {
  if (mapId === HOWLING_ABYSS_MAP_ID) return true;
  const haystack = `${gameMode ?? ''} ${rawName ?? ''}`.toUpperCase();
  return haystack.includes('ARAM');
}

/**
 * Clasifica la sesión de gameflow en un GameQueueInfo semántico.
 * Es puro y determinístico: apto para tests.
 */
export function classifyGameflowSession(dto: GameflowSessionDto): GameQueueInfo {
  const queue = dto.gameData?.queue ?? {};
  const queueId = queue.id ?? -1;
  const gameMode = queue.gameMode ?? dto.map?.gameMode ?? null;
  const rawType = queue.type ?? null;
  const rawName = queue.name && queue.name.length > 0 ? queue.name : null;
  const mapId = queue.mapId ?? dto.map?.id ?? null;
  const isCustomGame = dto.gameData?.isCustomGame === true;

  let category: GameQueueCategory;
  let isPracticeTool = false;
  let isCustom = false;

  if (isPracticeToolMode(gameMode, rawType)) {
    category = 'PRACTICE_TOOL';
    isPracticeTool = true;
    isCustom = true; // la herramienta de práctica es una custom bajo el capó
  } else if (queueId in QUEUE_ID_CATEGORY) {
    category = QUEUE_ID_CATEGORY[queueId]!;
    isCustom = isCustomGame;
  } else if (isAramLike(gameMode, rawName, mapId)) {
    // ARAM y sus variantes de evento con queueIds rotativos (p.ej. "ARAM: Mayhem").
    category = 'ARAM';
    isCustom = isCustomGame;
  } else if (isCustomGame || queueId === 0) {
    category = 'CUSTOM';
    isCustom = true;
  } else if (queueId > 0) {
    category = 'OTHER';
  } else {
    category = 'UNKNOWN';
  }

  const isRanked =
    category === 'RANKED_SOLO' || category === 'RANKED_FLEX' || queue.isRanked === true;

  return {
    queueId,
    category,
    label: CATEGORY_LABELS[category],
    isRanked,
    isPracticeTool,
    isCustom,
    gameMode,
    mapId,
    rawName,
    rawType,
  };
}

export interface GameQueueDetectorDeps {
  loadCredentials?: () => Promise<LcuCredentials | null>;
  connectorFactory?: (creds: LcuCredentials) => LcuConnector;
}

/**
 * Detecta el tipo de partida actual leyendo la sesión de gameflow del LCU.
 * Devuelve null si el cliente está cerrado o no hay sesión activa (404).
 */
export class GameQueueDetector {
  private readonly loadCredentials: () => Promise<LcuCredentials | null>;
  private readonly connectorFactory: (creds: LcuCredentials) => LcuConnector;

  constructor(deps: GameQueueDetectorDeps = {}) {
    this.loadCredentials = deps.loadCredentials ?? readLockfileCredentials;
    this.connectorFactory = deps.connectorFactory ?? ((creds) => new LcuConnector(creds));
  }

  async getQueueInfo(): Promise<GameQueueInfo | null> {
    const creds = await this.loadCredentials();
    if (!creds) return null;

    const connector = this.connectorFactory(creds);
    try {
      const dto = await connector.request<GameflowSessionDto>('/lol-gameflow/v1/session');
      // Fuera de un lobby/partida el cliente reporta phase "None" sin cola útil.
      if ((dto.phase ?? 'None') === 'None' && (dto.gameData?.queue?.id ?? -1) <= 0) {
        return null;
      }
      return classifyGameflowSession(dto);
    } catch (err) {
      if (err instanceof LcuHttpError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }
}
