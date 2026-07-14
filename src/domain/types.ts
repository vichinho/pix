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
