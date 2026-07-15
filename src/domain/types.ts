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

/** Perfil del jugador resuelto vía Riot API (GET /api/player/profile). */
export interface PlayerProfile {
  puuid: string;
  gameName: string;
  tagLine: string;
  summonerLevel: number | null;
  profileIconId: number | null;
  region: string;
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
 * - CASUAL_SWIFTPLAY: eliges rol y campeón en la sala, sin fase de bloqueos (Swiftplay/Quickplay).
 * - NORMAL_DRAFT: normal/"reclutamiento", champ select con picks y bans.
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
  /** queueId de Riot (-1/0 si no aplica). */
  queueId: number;
  /** Categoría semántica clasificada. */
  category: GameQueueCategory;
  /** Etiqueta legible en español para la UI. */
  label: string;
  /** ¿Es una cola clasificatoria (solo/dúo o flex)? */
  isRanked: boolean;
  /** ¿Es la Herramienta de práctica? */
  isPracticeTool: boolean;
  /** ¿Es una partida personalizada (custom, no matchmaking)? */
  isCustom: boolean;
  /** gameMode reportado por el cliente (CLASSIC, ARAM, PRACTICETOOL, …). */
  gameMode: string | null;
  /** mapId de la partida. */
  mapId: number | null;
  /** Nombre localizado de la cola tal como lo reporta el cliente. */
  rawName: string | null;
  /** Tipo de cola crudo del cliente (p.ej. RANKED_SOLO_5x5). */
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

/** Página de runas referenciada por IDs de Data Dragon (se resuelven a
 * icono/nombre en la capa de API). */
export interface RuneSelection {
  primaryStyleId: number;
  secondaryStyleId: number;
  keystoneId: number;
  /** 3 runas del árbol primario (filas 1-3), en orden. */
  primary: number[];
  /** 2 runas del árbol secundario, en orden. */
  secondary: number[];
  /** 3 fragmentos (ofensivo, flexible, defensivo). */
  shards: number[];
}

/** Contrato interno de build: ítems como IDs de Data Dragon (se resuelven a
 * icono/nombre en la capa de API). */
export interface ChampionBuild {
  championId: number;
  championName: string;
  role: Role;
  summonerSpells: string[];
  runes: RuneSelection;
  startingItems: number[];
  coreItems: number[];
  situationalItems: number[];
  /** Prioridad de subida de habilidades, p.ej. ["Q", "E", "W"]. */
  skillOrder: string[];
  /** Origen de la build ("curated", nombre del proveedor externo, etc.). */
  source: string;
  /** Parche o versión de referencia de la build. */
  patch: string;
  /** Nota breve opcional para el jugador. */
  notes?: string;
}
