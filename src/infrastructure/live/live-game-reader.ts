import type { Role } from '../../domain/types.js';
import { mapTeamPosition } from '../riot/riot-api-client.js';
import { computeObjectives, type Objectives, type LiveEvent } from '../../domain/live-objectives.js';
import { LiveClient, type LiveClientConnector } from './live-client.js';

interface LivePlayerDto {
  championName?: string;
  rawChampionName?: string;
  summonerName?: string;
  riotId?: string;
  position?: string;
}

/** Campeón del jugador local en la partida en curso. */
export interface LiveActiveChampion {
  championName: string;
  /** id de Data Dragon extraído de rawChampionName (p.ej. "Xerath"), si existe. */
  ddragonId: string | null;
  role: Role;
}

/**
 * Extrae el id de Data Dragon de un rawChampionName tipo
 * "game_character_displayname_Xerath" → "Xerath".
 */
export function parseRawChampionId(raw: string | undefined): string | null {
  if (!raw) return null;
  const idx = raw.lastIndexOf('_');
  const id = idx >= 0 ? raw.slice(idx + 1) : raw;
  return id.length > 0 ? id : null;
}

export interface LiveGameReaderDeps {
  connectorFactory?: () => LiveClientConnector;
}

/**
 * Lee la Live Client API para conocer el campeón del jugador local en partida.
 * Devuelve null si no hay partida activa o la API no responde.
 */
export class LiveGameReader {
  private readonly connectorFactory: () => LiveClientConnector;

  constructor(deps: LiveGameReaderDeps = {}) {
    this.connectorFactory = deps.connectorFactory ?? (() => new LiveClient());
  }

  async getActiveChampion(): Promise<LiveActiveChampion | null> {
    const connector = this.connectorFactory();
    try {
      const activeName = await connector.request<string>('/liveclientdata/activeplayername');
      const players = await connector.request<LivePlayerDto[]>('/liveclientdata/playerlist');
      const me = (players ?? []).find(
        (p) => p.riotId === activeName || p.summonerName === activeName,
      );
      if (!me || !me.championName) return null;
      return {
        championName: me.championName,
        ddragonId: parseRawChampionId(me.rawChampionName),
        role: mapTeamPosition(me.position),
      };
    } catch {
      // Sin partida activa (conexión rechazada) o API no disponible.
      return null;
    }
  }

  /**
   * Estado de la partida en curso: tiempo, objetivos épicos y datos del jugador.
   * Devuelve null si no hay partida activa.
   */
  async getGameState(): Promise<LiveGameState | null> {
    const connector = this.connectorFactory();
    try {
      const data = await connector.request<AllGameDataDto>('/liveclientdata/allgamedata');
      const gameTime = Math.max(0, Math.floor(data.gameData?.gameTime ?? 0));
      const events = (data.events?.Events ?? []).map(
        (e): LiveEvent => ({ EventName: e.EventName, EventTime: e.EventTime }),
      );
      return {
        gameTime,
        gameMode: data.gameData?.gameMode ?? 'CLASSIC',
        objectives: computeObjectives(gameTime, events),
        player: {
          level: data.activePlayer?.level ?? 0,
          currentGold: Math.floor(data.activePlayer?.currentGold ?? 0),
        },
      };
    } catch {
      return null;
    }
  }
}

/** Estructura parcial de /liveclientdata/allgamedata. */
interface AllGameDataDto {
  activePlayer?: { level?: number; currentGold?: number };
  events?: { Events?: Array<{ EventName: string; EventTime: number }> };
  gameData?: { gameTime?: number; gameMode?: string };
}

/** Estado de la partida en curso. */
export interface LiveGameState {
  gameTime: number;
  /** Modo de juego (CLASSIC, ARAM, URF…). Determina si hay objetivos épicos. */
  gameMode: string;
  objectives: Objectives;
  player: { level: number; currentGold: number };
}
