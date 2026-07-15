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
export type Role = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY' | 'ARAM' | 'UNKNOWN';

/** Resumen mínimo del invocador local. */
export interface SummonerSummary {
  gameName: string;
  tagLine: string;
  summonerLevel?: number;
  profileIconId?: number;
}

/** Entrada de liga para una cola clasificatoria. */
export interface RankedEntry {
  tier: string;        // IRON | BRONZE | SILVER | GOLD | PLATINUM | EMERALD | DIAMOND | MASTER | GRANDMASTER | CHALLENGER
  division: string;    // I | II | III | IV (vacío para Master+)
  leaguePoints: number;
  wins: number;
  losses: number;
}

/** Mejor liga histórica conocida. */
export interface PeakRank {
  tier: string;
  division: string;
  year?: number;  // año de la temporada (si lo tenemos)
}

/** Perfil del jugador resuelto vía Riot API (GET /api/player/profile). */
export interface PlayerProfile {
  puuid: string;
  gameName: string;
  tagLine: string;
  summonerLevel: number | null;
  profileIconId: number | null;
  region: string;
  /** Cola solo/dúo, null si no clasificado. */
  soloQueue: RankedEntry | null;
  /** Cola flex, null si no clasificado. */
  flexQueue: RankedEntry | null;
  /** Mejor liga histórica derivada de los datos actuales, null si sin datos. */
  peakRank: PeakRank | null;
}

/** Resumen de una partida reciente (GET /api/player/matches). */
export interface MatchSummary {
  matchId: string;
  queueId: number;
  championId: number;
  championName: string;
  role: Role;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  durationSec: number;
  playedAt: string;
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

/**
 * Categoría semántica del tipo de partida, derivada del queueId del cliente.
 */
export type GameQueueCategory =
  | 'CASUAL_SWIFTPLAY'
  | 'NORMAL_DRAFT'
  | 'RANKED_SOLO'
  | 'RANKED_FLEX'
  | 'ARAM'
  | 'CO_OP_VS_AI'
  | 'CLASH'
  | 'PRACTICE_TOOL'
  | 'CUSTOM'
  | 'OTHER'
  | 'UNKNOWN';

/**
 * Información del tipo de partida en curso o en preparación.
 * Contrato: GET /api/game/queue.
 */
export interface GameQueueInfo {
  queueId: number;
  category: GameQueueCategory;
  label: string;
  isRanked: boolean;
  isPracticeTool: boolean;
  isCustom: boolean;
  gameMode: string | null;
  mapId: number | null;
  rawName: string | null;
  rawType: string | null;
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

/** Página de runas referenciada por IDs de Data Dragon. */
export interface RuneSelection {
  primaryStyleId: number;
  secondaryStyleId: number;
  keystoneId: number;
  primary: number[];
  secondary: number[];
  shards: number[];
}

/** Contrato interno de build. */
export interface ChampionBuild {
  championId: number;
  championName: string;
  role: Role;
  summonerSpells: string[];
  runes: RuneSelection;
  startingItems: number[];
  coreItems: number[];
  situationalItems: number[];
  skillOrder: string[];
  source: string;
  patch: string;
  notes?: string;
}
