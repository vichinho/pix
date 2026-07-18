import type { RiotApiClient } from '../infrastructure/riot/riot-api-client.js';
import type { PlayerIdentity } from './get-player-profile.js';

/** Maestría de un campeón lista para la UI. */
export interface ChampionMasteryEntry {
  championId: number;
  level: number;
  points: number;
}

/**
 * Caso de uso: top campeones por maestría del jugador (champion-mastery-v4).
 * Resuelve puuid (account-v1) y devuelve los N con más puntos.
 */
export class GetChampionMasteryUseCase {
  constructor(private readonly riot: RiotApiClient) {}

  async execute(identity: PlayerIdentity, count = 8): Promise<ChampionMasteryEntry[]> {
    const account = await this.riot.getAccountByRiotId(identity.gameName, identity.tagLine);
    const masteries = await this.riot.getTopChampionMasteries(account.puuid, count);
    return masteries.map((m) => ({
      championId: m.championId,
      level: m.championLevel,
      points: m.championPoints,
    }));
  }
}
