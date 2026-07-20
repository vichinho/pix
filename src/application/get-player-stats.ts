import { computePlayerStats, type PlayerStats } from '../domain/player-stats.js';
import type { GetRecentMatchesUseCase } from './get-recent-matches.js';
import type { PlayerIdentity } from './get-player-profile.js';

/**
 * Caso de uso: resumen de rendimiento reciente del jugador (HU-05).
 * Obtiene el historial vía Riot API y lo agrega por campeón y por rol.
 */
export class GetPlayerStatsUseCase {
  constructor(private readonly recentMatches: GetRecentMatchesUseCase) {}

  async execute(identity: PlayerIdentity, count = 20): Promise<PlayerStats> {
    const matches = await this.recentMatches.execute(identity, count);
    return computePlayerStats(matches);
  }
}
