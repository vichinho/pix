import { describe, it, expect } from 'vitest';
import { GetRecentMatchesUseCase } from '@/application/get-recent-matches.js';
import { RiotApiClient, type FetchLike } from '@/infrastructure/riot/riot-api-client.js';

/** Participante de prueba (solo los campos que usa el mapeo). */
function part(puuid: string, championId: number, win: boolean, teamPosition: string) {
  return { puuid, championId, championName: `C${championId}`, win, teamPosition, kills: 1, deaths: 1, assists: 1 };
}

/** Cliente Riot con respuestas fijas para account, ids y detalle de partida. */
function riotWith(match: unknown): RiotApiClient {
  const fetchImpl: FetchLike = async (url) => {
    let body: unknown = {};
    if (url.includes('by-riot-id')) body = { puuid: 'ME', gameName: 'Yo', tagLine: 'LAS' };
    else if (url.includes('/ids')) body = ['LA1_1'];
    else if (url.includes('/matches/LA1_1')) body = match;
    return { status: 200, ok: true, text: async () => JSON.stringify(body) };
  };
  return new RiotApiClient({ apiKey: 'k', platform: 'la1', region: 'americas', fetchImpl });
}

describe('GetRecentMatchesUseCase — enemigos y rival de línea', () => {
  it('extrae el equipo rival (resultado opuesto) y el rival de tu misma línea', async () => {
    const match = {
      metadata: { matchId: 'LA1_1' },
      info: {
        queueId: 420,
        gameDuration: 1800,
        gameCreation: 1_700_000_000_000,
        participants: [
          part('ME', 103, true, 'MIDDLE'),   // yo (mid, gané)
          part('A', 64, true, 'JUNGLE'),      // aliado
          part('E1', 84, false, 'MIDDLE'),    // rival de mi línea
          part('E2', 240, false, 'TOP'),      // rival
          part('E3', 412, false, 'UTILITY'),  // rival
        ],
      },
    };
    const matches = await new GetRecentMatchesUseCase(riotWith(match)).execute(
      { gameName: 'Yo', tagLine: 'LAS' },
      1,
    );
    const m = matches[0]!;
    expect(m.enemies.sort((a, b) => a - b)).toEqual([84, 240, 412]);
    expect(m.laneOpponentId).toBe(84);
  });

  it('sin teamPosition (p. ej. ARAM) no fija rival de línea pero sí enemigos', async () => {
    const match = {
      metadata: { matchId: 'LA1_1' },
      info: {
        queueId: 450,
        gameDuration: 1200,
        gameCreation: 1_700_000_000_000,
        participants: [
          part('ME', 1, false, ''),
          part('E1', 22, true, ''),
          part('E2', 51, true, ''),
        ],
      },
    };
    const matches = await new GetRecentMatchesUseCase(riotWith(match)).execute(
      { gameName: 'Yo', tagLine: 'LAS' },
      1,
    );
    const m = matches[0]!;
    expect(m.enemies.sort((a, b) => a - b)).toEqual([22, 51]);
    expect(m.laneOpponentId).toBeUndefined();
  });
});
