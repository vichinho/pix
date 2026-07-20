import { LcuConnector, LcuHttpError } from './lcu-connector.js';
import { readLockfileCredentials, type LcuCredentials } from './lockfile.js';
import type { ChampSelectSessionDto } from './champ-select.js';

/** Integrante del equipo propio en la sesión de ARAM. */
export interface AramTeamMember {
  cellId: number;
  championId: number;
  isLocalPlayer: boolean;
}

/** Instantánea de la sesión de ARAM centrada en el equipo y la banca. */
export interface AramSessionSnapshot {
  /** ¿La sesión tiene banca (señal de que es ARAM)? */
  benchEnabled: boolean;
  localPlayerCellId: number;
  /** Campeones actuales del equipo propio. */
  team: AramTeamMember[];
  /** Campeones disponibles en la banca para intercambiar. */
  benchChampionIds: number[];
}

/** Convierte el DTO de champ select en una instantánea de ARAM. */
export function parseAramSession(dto: ChampSelectSessionDto): AramSessionSnapshot {
  const localPlayerCellId = dto.localPlayerCellId ?? -1;

  const team: AramTeamMember[] = (dto.myTeam ?? [])
    .filter((m) => typeof m.championId === 'number' && m.championId > 0)
    .map((m) => ({
      cellId: m.cellId ?? -1,
      championId: m.championId as number,
      isLocalPlayer: m.cellId === localPlayerCellId,
    }));

  const benchChampionIds = (dto.benchChampions ?? [])
    .map((b) => b.championId)
    .filter((id): id is number => typeof id === 'number' && id > 0);

  return {
    benchEnabled: dto.benchEnabled === true,
    localPlayerCellId,
    team,
    benchChampionIds,
  };
}

export interface AramReaderDeps {
  loadCredentials?: () => Promise<LcuCredentials | null>;
  connectorFactory?: (creds: LcuCredentials) => LcuConnector;
}

/**
 * Lee la sesión de champion select en modo ARAM (equipo + banca) desde el LCU.
 * Devuelve null si el cliente está cerrado o no hay champ select activo (404).
 */
export class AramReader {
  private readonly loadCredentials: () => Promise<LcuCredentials | null>;
  private readonly connectorFactory: (creds: LcuCredentials) => LcuConnector;

  constructor(deps: AramReaderDeps = {}) {
    this.loadCredentials = deps.loadCredentials ?? readLockfileCredentials;
    this.connectorFactory = deps.connectorFactory ?? ((creds) => new LcuConnector(creds));
  }

  async getSession(): Promise<AramSessionSnapshot | null> {
    const creds = await this.loadCredentials();
    if (!creds) return null;

    const connector = this.connectorFactory(creds);
    try {
      const dto = await connector.request<ChampSelectSessionDto>(
        '/lol-champ-select/v1/session',
      );
      return parseAramSession(dto);
    } catch (err) {
      if (err instanceof LcuHttpError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }
}
