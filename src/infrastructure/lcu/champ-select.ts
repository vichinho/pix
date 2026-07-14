import type { ChampSelectPhase, ChampSelectSnapshot, Role } from '../../domain/types.js';
import { LcuConnector, LcuHttpError } from './lcu-connector.js';
import { readLockfileCredentials, type LcuCredentials } from './lockfile.js';

/** Estructura parcial de /lol-champ-select/v1/session que consumimos. */
export interface ChampSelectSessionDto {
  localPlayerCellId?: number;
  myTeam?: Array<{
    cellId?: number;
    championId?: number;
    assignedPosition?: string;
  }>;
  actions?: Array<
    Array<{
      actorCellId?: number;
      championId?: number;
      type?: string; // "pick" | "ban" | "ten_bans_reveal" ...
      completed?: boolean;
    }>
  >;
  bans?: {
    myTeamBans?: number[];
    theirTeamBans?: number[];
  };
  timer?: {
    phase?: string;
  };
}

/** Traduce la posición asignada del LCU (minúsculas) a nuestro Role. */
export function mapAssignedPosition(position: string | undefined): Role {
  switch ((position ?? '').toLowerCase()) {
    case 'top':
      return 'TOP';
    case 'jungle':
      return 'JUNGLE';
    case 'middle':
    case 'mid':
      return 'MIDDLE';
    case 'bottom':
    case 'bot':
      return 'BOTTOM';
    case 'utility':
    case 'support':
      return 'UTILITY';
    default:
      return 'UNKNOWN';
  }
}

/** Traduce la fase del timer del LCU a nuestra ChampSelectPhase. */
export function mapChampSelectPhase(phase: string | undefined): ChampSelectPhase {
  switch ((phase ?? '').toUpperCase()) {
    case 'PLANNING':
      return 'PLANNING';
    case 'BAN_PICK':
      return 'BAN_PICK';
    case 'FINALIZATION':
      return 'FINALIZATION';
    case 'GAME_STARTING':
      return 'GAME_STARTING';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Convierte el DTO crudo del LCU en una instantánea centrada en el jugador local.
 * Extrae rol asignado, campeón elegido, si el pick está confirmado y los bans.
 */
export function parseChampSelectSession(dto: ChampSelectSessionDto): ChampSelectSnapshot {
  const localPlayerCellId = dto.localPlayerCellId ?? -1;

  const localMember = (dto.myTeam ?? []).find((m) => m.cellId === localPlayerCellId);
  const assignedRole = mapAssignedPosition(localMember?.assignedPosition);

  // La acción de pick del jugador local es la fuente autoritativa del campeón
  // elegido y de si está confirmado. El championId de myTeam sólo aparece al lockear.
  let selectedChampionId: number | null = null;
  let pickCompleted = false;
  for (const group of dto.actions ?? []) {
    for (const action of group) {
      if (action.type === 'pick' && action.actorCellId === localPlayerCellId) {
        if (typeof action.championId === 'number' && action.championId > 0) {
          selectedChampionId = action.championId;
        }
        pickCompleted = action.completed === true;
      }
    }
  }

  // Fallback: si no encontramos la acción pero myTeam ya tiene championId (lockeado).
  if (selectedChampionId === null && typeof localMember?.championId === 'number') {
    if (localMember.championId > 0) {
      selectedChampionId = localMember.championId;
    }
  }

  const bans = [
    ...(dto.bans?.myTeamBans ?? []),
    ...(dto.bans?.theirTeamBans ?? []),
  ].filter((id) => typeof id === 'number' && id > 0);

  return {
    phase: mapChampSelectPhase(dto.timer?.phase),
    assignedRole,
    localPlayerCellId,
    selectedChampionId,
    pickCompleted,
    bans,
  };
}

export interface ChampSelectReaderDeps {
  loadCredentials?: () => Promise<LcuCredentials | null>;
  connectorFactory?: (creds: LcuCredentials) => LcuConnector;
}

/**
 * Lee la sesión de champion select desde el LCU.
 * Devuelve null si el cliente está cerrado o no hay champ select activo (404).
 */
export class ChampSelectReader {
  private readonly loadCredentials: () => Promise<LcuCredentials | null>;
  private readonly connectorFactory: (creds: LcuCredentials) => LcuConnector;

  constructor(deps: ChampSelectReaderDeps = {}) {
    this.loadCredentials = deps.loadCredentials ?? readLockfileCredentials;
    this.connectorFactory = deps.connectorFactory ?? ((creds) => new LcuConnector(creds));
  }

  async getSession(): Promise<ChampSelectSnapshot | null> {
    const creds = await this.loadCredentials();
    if (!creds) return null;

    const connector = this.connectorFactory(creds);
    try {
      const dto = await connector.request<ChampSelectSessionDto>(
        '/lol-champ-select/v1/session',
      );
      return parseChampSelectSession(dto);
    } catch (err) {
      // 404 => no hay champ select activo; lo tratamos como "sin sesión".
      if (err instanceof LcuHttpError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }
}
