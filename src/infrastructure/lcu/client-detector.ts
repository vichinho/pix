import type { ClientState, SummonerSummary } from '../../domain/types.js';
import { LcuConnector } from './lcu-connector.js';
import { readLockfileCredentials, type LcuCredentials } from './lockfile.js';

/**
 * Fases del gameflow que expone el LCU en
 * GET /lol-gameflow/v1/gameflow-phase
 */
export type GameflowPhase =
  | 'None'
  | 'Lobby'
  | 'Matchmaking'
  | 'CheckedIntoTournament'
  | 'ReadyCheck'
  | 'ChampSelect'
  | 'GameStart'
  | 'InProgress'
  | 'Reconnect'
  | 'WaitingForStats'
  | 'PreEndOfGame'
  | 'EndOfGame'
  | 'TerminatedInError';

/** Traduce la fase cruda del LCU a nuestro estado de dominio. */
export function mapGameflowPhase(phase: string): ClientState {
  switch (phase) {
    case 'None':
      return 'NONE';
    case 'Lobby':
      return 'LOBBY';
    case 'Matchmaking':
    case 'CheckedIntoTournament':
      return 'MATCHMAKING';
    case 'ReadyCheck':
      return 'READY_CHECK';
    case 'ChampSelect':
      return 'CHAMP_SELECT';
    case 'GameStart':
    case 'InProgress':
    case 'Reconnect':
      return 'IN_GAME';
    case 'WaitingForStats':
    case 'PreEndOfGame':
    case 'EndOfGame':
      return 'POST_GAME';
    default:
      return 'UNKNOWN';
  }
}

/** Respuesta parcial de /lol-summoner/v1/current-summoner. */
interface CurrentSummonerDto {
  gameName?: string;
  displayName?: string;
  tagLine?: string;
  summonerLevel?: number;
  profileIconId?: number;
}

/**
 * Servicio de detección del cliente de LoL.
 *
 * Es tolerante a fallos: si el cliente está cerrado o el lockfile no está
 * disponible, `getStatus()` devuelve un estado desconectado en lugar de lanzar.
 */
export interface ClientDetectorDeps {
  loadCredentials?: () => Promise<LcuCredentials | null>;
  connectorFactory?: (creds: LcuCredentials) => LcuConnector;
}

export class ClientDetector {
  private readonly loadCredentials: () => Promise<LcuCredentials | null>;
  private readonly connectorFactory: (creds: LcuCredentials) => LcuConnector;

  constructor(deps: ClientDetectorDeps = {}) {
    this.loadCredentials = deps.loadCredentials ?? readLockfileCredentials;
    this.connectorFactory = deps.connectorFactory ?? ((creds) => new LcuConnector(creds));
  }

  /** ¿Está el cliente abierto (existe lockfile parseable)? */
  async isClientOpen(): Promise<boolean> {
    return (await this.loadCredentials()) !== null;
  }

  /** Obtiene la fase actual del gameflow, o null si no hay cliente. */
  async getGameflowPhase(): Promise<ClientState | null> {
    const creds = await this.loadCredentials();
    if (!creds) return null;
    const connector = this.connectorFactory(creds);
    const phase = await connector.request<string>('/lol-gameflow/v1/gameflow-phase');
    return mapGameflowPhase(phase);
  }

  /** Obtiene el invocador actual, o null si no está disponible. */
  async getCurrentSummoner(): Promise<SummonerSummary | null> {
    const creds = await this.loadCredentials();
    if (!creds) return null;
    return this.getCurrentSummonerFrom(this.connectorFactory(creds));
  }

  /**
   * Estado consolidado del cliente. Nunca lanza por causa del cliente:
   * agrupa la desconexión y los fallos parciales en un `ClientStatus` coherente.
   */
  async getStatus(): Promise<{
    connected: boolean;
    clientState: ClientState;
    summoner: SummonerSummary | null;
  }> {
    const creds = await this.loadCredentials();
    if (!creds) {
      return { connected: false, clientState: 'DISCONNECTED', summoner: null };
    }

    const connector = this.connectorFactory(creds);
    let clientState: ClientState = 'UNKNOWN';
    let summoner: SummonerSummary | null = null;

    try {
      const phase = await connector.request<string>('/lol-gameflow/v1/gameflow-phase');
      clientState = mapGameflowPhase(phase);
    } catch {
      clientState = 'UNKNOWN';
    }

    try {
      summoner = await this.getCurrentSummonerFrom(connector);
    } catch {
      summoner = null;
    }

    return { connected: true, clientState, summoner };
  }

  private async getCurrentSummonerFrom(
    connector: LcuConnector,
  ): Promise<SummonerSummary | null> {
    const dto = await connector.request<CurrentSummonerDto>(
      '/lol-summoner/v1/current-summoner',
    );
    const gameName = dto.gameName ?? dto.displayName ?? '';
    if (gameName.length === 0) return null;
    return {
      gameName,
      tagLine: dto.tagLine ?? '',
      ...(dto.summonerLevel !== undefined ? { summonerLevel: dto.summonerLevel } : {}),
      ...(dto.profileIconId !== undefined ? { profileIconId: dto.profileIconId } : {}),
    };
  }
}
