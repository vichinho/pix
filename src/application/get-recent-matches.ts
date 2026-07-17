import type { MatchSummary } from '../domain/types.js';
import { mapTeamPosition, type RiotApiClient, type RiotMatchDto } from '../infrastructure/riot/riot-api-client.js';
import type { PlayerIdentity } from './get-player-profile.js';

/**
 * Caso de uso: obtener el historial reciente del jugador vía Riot API.
 * Resuelve puuid (account-v1), lista de matchIds y detalle de cada partida
 * (match-v5), reduciendo cada una al participante del jugador.
 */
export class GetRecentMatchesUseCase {
  constructor(private readonly riot: RiotApiClient) {}

  async execute(identity: PlayerIdentity, count = 10): Promise<MatchSummary[]> {
    const account = await this.riot.getAccountByRiotId(identity.gameName, identity.tagLine);
    const matchIds = await this.riot.getMatchIdsByPuuid(account.puuid, count);

    const matches = await this.riot.getMatches(matchIds);
    return matches
      .map((match) => this.toSummary(match, account.puuid))
      .filter((m): m is MatchSummary => m !== null);
  }

  private toSummary(match: RiotMatchDto, puuid: string): MatchSummary | null {
    const me = match.info.participants.find((p) => p.puuid === puuid);
    if (!me) return null;

    const playedAtMs = match.info.gameEndTimestamp ?? match.info.gameCreation;
    return {
      matchId: match.metadata.matchId,
      queueId: match.info.queueId,
      championId: me.championId,
      championName: me.championName,
      championLevel: me.champLevel ?? 0,
      role: mapTeamPosition(me.teamPosition ?? me.individualPosition),
      kills: me.kills,
      deaths: me.deaths,
      assists: me.assists,
      win: me.win,
      durationSec: match.info.gameDuration,
      playedAt: new Date(playedAtMs).toISOString(),
      items: [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5, me.item6].map(
        (i) => i ?? 0,
      ),
      summonerSpells: [me.summoner1Id ?? 0, me.summoner2Id ?? 0],
      cs: (me.totalMinionsKilled ?? 0) + (me.neutralMinionsKilled ?? 0),
      gold: me.goldEarned ?? 0,
      damage: me.totalDamageDealtToChampions ?? 0,
      visionScore: me.visionScore ?? 0,
    };
  }
}
