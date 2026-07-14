import type { PlayerProfile } from '../domain/types.js';
import { RiotApiError, type RiotApiClient } from '../infrastructure/riot/riot-api-client.js';

export interface PlayerIdentity {
  gameName: string;
  tagLine: string;
}

/**
 * Caso de uso: resolver el perfil del jugador vía Riot API.
 * account-v1 (puuid) + summoner-v4 (nivel/ícono). Si summoner-v4 falla por
 * datos incompletos, se devuelve el perfil con nivel/ícono en null.
 */
export class GetPlayerProfileUseCase {
  constructor(private readonly riot: RiotApiClient) {}

  async execute(identity: PlayerIdentity): Promise<PlayerProfile> {
    const account = await this.riot.getAccountByRiotId(identity.gameName, identity.tagLine);

    let summonerLevel: number | null = null;
    let profileIconId: number | null = null;
    try {
      const summoner = await this.riot.getSummonerByPuuid(account.puuid);
      summonerLevel = summoner.summonerLevel;
      profileIconId = summoner.profileIconId;
    } catch (err) {
      if (!(err instanceof RiotApiError) || err.status !== 404) {
        throw err;
      }
    }

    return {
      puuid: account.puuid,
      gameName: account.gameName,
      tagLine: account.tagLine,
      summonerLevel,
      profileIconId,
      region: this.riot.region,
    };
  }
}
