import type { PlayerProfile, RankedEntry, PeakRank } from '../domain/types.js';
import { RiotApiError, type RiotApiClient, type RiotLeagueEntryDto } from '../infrastructure/riot/riot-api-client.js';

export interface PlayerIdentity {
  gameName: string;
  tagLine: string;
}

/**
 * Orden de tiers de menor a mayor para calcular el pico histórico.
 * (En la API actual no hay endpoint de historial; inferimos el pico
 * comparando solo/duo vs flex y tomando el más alto.)
 */
const TIER_ORDER: Record<string, number> = {
  IRON: 1, BRONZE: 2, SILVER: 3, GOLD: 4, PLATINUM: 5,
  EMERALD: 6, DIAMOND: 7, MASTER: 8, GRANDMASTER: 9, CHALLENGER: 10,
};
const DIVISION_ORDER: Record<string, number> = { IV: 1, III: 2, II: 3, I: 4 };

function entryWeight(e: RankedEntry): number {
  return (TIER_ORDER[e.tier.toUpperCase()] ?? 0) * 10 + (DIVISION_ORDER[e.division.toUpperCase()] ?? 0);
}

function dtoToEntry(dto: RiotLeagueEntryDto): RankedEntry {
  return {
    tier: dto.tier,
    division: dto.rank,
    leaguePoints: dto.leaguePoints,
    wins: dto.wins,
    losses: dto.losses,
  };
}

function derivePeak(solo: RankedEntry | null, flex: RankedEntry | null): PeakRank | null {
  const candidates = [solo, flex].filter((e): e is RankedEntry => e !== null);
  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) => entryWeight(a) >= entryWeight(b) ? a : b);
  return {
    tier: best.tier,
    division: best.division,
    year: new Date().getFullYear(), // único año disponible con la API actual
  };
}

/**
 * Caso de uso: resolver el perfil del jugador vía Riot API.
 * account-v1 (puuid) + summoner-v4 (nivel/icono/summonerId) + league-v4 (rango).
 * Las llamadas post-summoner son best-effort: si fallan no rompen el perfil.
 */
export class GetPlayerProfileUseCase {
  constructor(private readonly riot: RiotApiClient) {}

  async execute(identity: PlayerIdentity): Promise<PlayerProfile> {
    const account = await this.riot.getAccountByRiotId(identity.gameName, identity.tagLine);

    let summonerLevel: number | null = null;
    let profileIconId: number | null = null;
    let summonerId: string | null = null;

    try {
      const summoner = await this.riot.getSummonerByPuuid(account.puuid);
      summonerLevel = summoner.summonerLevel;
      profileIconId = summoner.profileIconId;
      summonerId    = summoner.id;
    } catch (err) {
      if (!(err instanceof RiotApiError) || err.status !== 404) throw err;
    }

    // Datos clasificatorios (best-effort: si falla devolvemos nulls).
    // Preferimos league-v4 by-puuid (no depende del summonerId encriptado que
    // Riot está deprecando); si no está disponible, caemos a by-summoner.
    let soloQueue: RankedEntry | null = null;
    let flexQueue: RankedEntry | null = null;

    let entries: RiotLeagueEntryDto[] | null = null;
    try {
      entries = await this.riot.getLeagueEntriesByPuuid(account.puuid);
    } catch {
      if (summonerId) {
        try {
          entries = await this.riot.getLeagueEntries(summonerId);
        } catch {
          // No rompemos el perfil si league-v4 falla por ambas vías.
        }
      }
    }
    if (Array.isArray(entries)) {
      for (const e of entries) {
        if (e.queueType === 'RANKED_SOLO_5x5') soloQueue = dtoToEntry(e);
        if (e.queueType === 'RANKED_FLEX_SR')  flexQueue = dtoToEntry(e);
      }
    }

    return {
      puuid: account.puuid,
      gameName: account.gameName,
      tagLine: account.tagLine,
      summonerLevel,
      profileIconId,
      region: this.riot.region,
      soloQueue,
      flexQueue,
      peakRank: derivePeak(soloQueue, flexQueue),
    };
  }
}
