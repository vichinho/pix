import type { RecommendationsResponse, Role } from '../domain/types.js';
import { recommendChampions, type ChampionPool } from '../domain/recommendation.js';
import { comfortChampionIds } from '../domain/player-stats.js';
import {
  buildHistoryPool,
  CompositeChampionPool,
} from '../infrastructure/champions/history-champion-pool.js';
import type { GetRecentMatchesUseCase } from './get-recent-matches.js';
import type { PlayerIdentity } from './get-player-profile.js';
import type { ChampSelectReader } from '../infrastructure/lcu/champ-select.js';

export interface PersonalizedRecommendationRequest {
  identity: PlayerIdentity;
  /** Rol explícito; si se omite, se intenta detectar de champ select. */
  role?: Role;
  limit?: number;
  /** Cuántas partidas del historial considerar. */
  historyCount?: number;
}

/** Respuesta con metadatos de personalización. */
export interface PersonalizedRecommendationsResponse extends RecommendationsResponse {
  personalized: boolean;
  basedOnGames: number;
}

/**
 * Caso de uso: recomendaciones personalizadas combinando el pool base (meta) con
 * el historial del jugador. Los campeones que el jugador domina en ese rol
 * (suficiente muestra y buen winrate) entran como candidatos y reciben bono de
 * comfort. Detecta rol y excluye bans desde champ select si el rol no se entrega.
 */
export class GetPersonalizedRecommendationsUseCase {
  constructor(
    private readonly seedPool: ChampionPool,
    private readonly recentMatches: GetRecentMatchesUseCase,
    private readonly champSelectReader?: ChampSelectReader,
  ) {}

  async execute(
    req: PersonalizedRecommendationRequest,
  ): Promise<PersonalizedRecommendationsResponse> {
    let role: Role = req.role ?? 'UNKNOWN';
    let excludeChampionIds: number[] = [];

    if ((role === 'UNKNOWN' || req.role === undefined) && this.champSelectReader) {
      const session = await this.champSelectReader.getSession();
      if (session) {
        if (req.role === undefined) role = session.assignedRole;
        excludeChampionIds = session.bans;
      }
    }

    const matches = await this.recentMatches.execute(req.identity, req.historyCount ?? 20);
    const pool = new CompositeChampionPool([buildHistoryPool(matches), this.seedPool]);
    const comfort = comfortChampionIds(matches, role, 2);

    const recommendations = recommendChampions(
      pool,
      role,
      { excludeChampionIds, comfortChampionIds: comfort },
      req.limit ?? 5,
    );

    return { role, recommendations, personalized: true, basedOnGames: matches.length };
  }
}
