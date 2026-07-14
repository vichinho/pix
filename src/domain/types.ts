/**
 * Contratos internos compartidos entre backend y (futuro) frontend.
 * Reflejan los contratos descritos en la especificación del producto.
 */

/** Estados generales del cliente de League of Legends. */
export type ClientState =
  | 'DISCONNECTED'
  | 'NONE'
  | 'LOBBY'
  | 'MATCHMAKING'
  | 'READY_CHECK'
  | 'CHAMP_SELECT'
  | 'IN_GAME'
  | 'POST_GAME'
  | 'UNKNOWN';

/** Roles / líneas soportados. */
export type Role = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY' | 'UNKNOWN';

/** Resumen mínimo del invocador local. */
export interface SummonerSummary {
  gameName: string;
  tagLine: string;
  summonerLevel?: number;
  profileIconId?: number;
}

/** Contrato: estado del cliente (GET /api/client/status). */
export interface ClientStatus {
  connected: boolean;
  clientState: ClientState;
  summoner: SummonerSummary | null;
  lastUpdated: string;
}

/** Fase de la sesión de champion select. */
export type ChampSelectPhase =
  | 'PLANNING'
  | 'BAN_PICK'
  | 'FINALIZATION'
  | 'GAME_STARTING'
  | 'UNKNOWN';

/**
 * Instantánea de la sesión de champion select, centrada en el jugador local.
 * Contrato: GET /api/champ-select/session.
 */
export interface ChampSelectSnapshot {
  /** Fase actual de la selección. */
  phase: ChampSelectPhase;
  /** Rol/línea asignado al jugador local (UNKNOWN si es blind/no asignado). */
  assignedRole: Role;
  /** cellId del jugador local dentro de la sesión. */
  localPlayerCellId: number;
  /** Campeón elegido/hovering por el jugador local (null si aún no elige). */
  selectedChampionId: number | null;
  /** ¿El pick del jugador local está confirmado (locked in)? */
  pickCompleted: boolean;
  /** championIds baneados en la partida (ambos equipos). */
  bans: number[];
}

/** Recomendación individual de campeón. */
export interface ChampionRecommendation {
  championId: number;
  championName: string;
  score: number;
  reason: string;
}

/** Contrato: recomendaciones (GET /api/recommendations?role=TOP). */
export interface RecommendationsResponse {
  role: Role;
  recommendations: ChampionRecommendation[];
}

/** Contrato: build del campeón (GET /api/builds). */
export interface ChampionBuild {
  championId: number;
  championName: string;
  role: Role;
  patch: string;
  runes: number[];
  summonerSpells: number[];
  coreItems: number[];
  situationalItems: number[];
  skillOrder: string[];
}
