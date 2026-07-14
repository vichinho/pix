import { describe, it, expect } from 'vitest';
import {
  RiotApiClient,
  RiotApiError,
  mapTeamPosition,
  type FetchLike,
} from '@/infrastructure/riot/riot-api-client.js';
import { GetPlayerProfileUseCase } from '@/application/get-player-profile.js';
import { GetRecentMatchesUseCase } from '@/application/get-recent-matches.js';

/** Construye un fetch falso a partir de un mapa de url→respuesta. */
function fakeFetch(routes: Record<string, { status?: number; body: unknown }>): FetchLike {
  return async (url: string) => {
    // Coincidencia por substring para no depender del host exacto.
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) {
      return { status: 404, ok: false, text: async () => 'no route' };
    }
    const r = routes[key]!;
    const status = r.status ?? 200;
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(r.body),
    };
  };
}

function client(fetchImpl: FetchLike): RiotApiClient {
  return new RiotApiClient({ apiKey: 'k', platform: 'la1', region: 'americas', fetchImpl });
}

describe('mapTeamPosition', () => {
  it('normaliza posiciones de match-v5', () => {
    expect(mapTeamPosition('UTILITY')).toBe('UTILITY');
    expect(mapTeamPosition('bottom')).toBe('BOTTOM');
    expect(mapTeamPosition('')).toBe('UNKNOWN');
  });
});

describe('RiotApiClient', () => {
  it('lanza RiotApiError con status ante respuesta no OK', async () => {
    const c = client(fakeFetch({ 'by-riot-id': { status: 401, body: { status: { message: 'x' } } } }));
    await expect(c.getAccountByRiotId('a', 'b')).rejects.toBeInstanceOf(RiotApiError);
    await expect(c.getAccountByRiotId('a', 'b')).rejects.toMatchObject({ status: 401 });
  });

  it('codifica el Riot ID en la URL', async () => {
    let captured = '';
    const fetchImpl: FetchLike = async (url) => {
      captured = url;
      return { status: 200, ok: true, text: async () => JSON.stringify({ puuid: 'p', gameName: 'a b', tagLine: 'LAS' }) };
    };
    await client(fetchImpl).getAccountByRiotId('a b', 'LAS');
    expect(captured).toContain('/by-riot-id/a%20b/LAS');
    expect(captured).toContain('americas.api.riotgames.com');
  });
});

describe('RiotApiClient rate limiting y cache', () => {
  it('reintenta ante 429 respetando el intento y luego resuelve', async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls += 1;
      if (calls === 1) {
        return {
          status: 429,
          ok: false,
          text: async () => 'rate limited',
          headers: { get: (n) => (n === 'Retry-After' ? '0' : null) },
        };
      }
      return { status: 200, ok: true, text: async () => JSON.stringify(['LA1_1']) };
    };
    const c = new RiotApiClient({
      apiKey: 'k',
      platform: 'la1',
      region: 'americas',
      fetchImpl,
      sleepImpl: async () => {},
    });
    const ids = await c.getMatchIdsByPuuid('PUUID', 1);
    expect(ids).toEqual(['LA1_1']);
    expect(calls).toBe(2);
  });

  it('lanza 429 tras agotar los reintentos', async () => {
    const fetchImpl: FetchLike = async () => ({
      status: 429,
      ok: false,
      text: async () => 'rate limited',
      headers: { get: () => '0' },
    });
    const c = new RiotApiClient({
      apiKey: 'k',
      platform: 'la1',
      region: 'americas',
      fetchImpl,
      sleepImpl: async () => {},
      maxRetries: 2,
    });
    await expect(c.getMatchIdsByPuuid('PUUID', 1)).rejects.toMatchObject({ status: 429 });
  });

  it('cachea partidas: no repite fetch del mismo matchId', async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls += 1;
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ metadata: { matchId: 'LA1_1' }, info: {} }),
      };
    };
    const c = new RiotApiClient({ apiKey: 'k', platform: 'la1', region: 'americas', fetchImpl });
    await c.getMatch('LA1_1');
    await c.getMatch('LA1_1');
    expect(calls).toBe(1);
  });

  it('getMatches preserva el orden de los ids', async () => {
    const fetchImpl: FetchLike = async (url) => {
      const id = url.split('/matches/')[1] ?? '';
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ metadata: { matchId: id }, info: {} }),
      };
    };
    const c = new RiotApiClient({
      apiKey: 'k',
      platform: 'la1',
      region: 'americas',
      fetchImpl,
      matchConcurrency: 2,
    });
    const matches = await c.getMatches(['A', 'B', 'C', 'D', 'E']);
    expect(matches.map((m) => m.metadata.matchId)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

describe('GetPlayerProfileUseCase', () => {
  it('combina account-v1 y summoner-v4', async () => {
    const c = client(
      fakeFetch({
        'by-riot-id': { body: { puuid: 'PUUID', gameName: 'Player', tagLine: 'LAS' } },
        'by-puuid': { body: { puuid: 'PUUID', summonerLevel: 240, profileIconId: 29 } },
      }),
    );
    const profile = await new GetPlayerProfileUseCase(c).execute({ gameName: 'Player', tagLine: 'LAS' });
    expect(profile).toEqual({
      puuid: 'PUUID',
      gameName: 'Player',
      tagLine: 'LAS',
      summonerLevel: 240,
      profileIconId: 29,
      region: 'americas',
    });
  });

  it('tolera summoner-v4 404 devolviendo nivel/ícono null', async () => {
    const c = client(
      fakeFetch({
        'by-riot-id': { body: { puuid: 'PUUID', gameName: 'Player', tagLine: 'LAS' } },
        'summoners/by-puuid': { status: 404, body: {} },
      }),
    );
    const profile = await new GetPlayerProfileUseCase(c).execute({ gameName: 'Player', tagLine: 'LAS' });
    expect(profile.summonerLevel).toBeNull();
    expect(profile.profileIconId).toBeNull();
  });
});

describe('GetRecentMatchesUseCase', () => {
  it('reduce cada partida al participante del jugador', async () => {
    const match = {
      metadata: { matchId: 'LA1_1' },
      info: {
        queueId: 450,
        gameDuration: 1200,
        gameCreation: 1_700_000_000_000,
        gameEndTimestamp: 1_700_000_600_000,
        participants: [
          { puuid: 'OTHER', championId: 1, championName: 'Annie', kills: 0, deaths: 0, assists: 0, win: false },
          {
            puuid: 'PUUID',
            championId: 103,
            championName: 'Ahri',
            kills: 8,
            deaths: 3,
            assists: 10,
            win: true,
            teamPosition: 'MIDDLE',
          },
        ],
      },
    };
    const c = client(
      fakeFetch({
        'by-riot-id': { body: { puuid: 'PUUID', gameName: 'P', tagLine: 'LAS' } },
        '/ids?': { body: ['LA1_1'] },
        '/matches/LA1_1': { body: match },
      }),
    );
    const matches = await new GetRecentMatchesUseCase(c).execute({ gameName: 'P', tagLine: 'LAS' }, 5);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      matchId: 'LA1_1',
      championName: 'Ahri',
      role: 'MIDDLE',
      kills: 8,
      deaths: 3,
      assists: 10,
      win: true,
      queueId: 450,
      durationSec: 1200,
    });
    expect(matches[0]?.playedAt).toBe(new Date(1_700_000_600_000).toISOString());
  });
});
