import { describe, it, expect } from 'vitest';
import { GetPersonalizedRecommendationsUseCase } from '@/application/get-personalized-recommendations.js';
import { SeedChampionPool } from '@/infrastructure/champions/seed-champion-pool.js';
import type { GetRecentMatchesUseCase } from '@/application/get-recent-matches.js';
import type { MatchSummary } from '@/domain/types.js';

function match(over: Partial<MatchSummary>): MatchSummary {
  return {
    matchId: 'M',
    queueId: 420,
    championId: 1,
    championName: 'Annie',
    role: 'MIDDLE',
    kills: 1,
    deaths: 1,
    assists: 1,
    win: true,
    durationSec: 1200,
    championLevel: 11,
    items: [0,0,0,0,0,0,0],
    summonerSpells: [4,7],
    cs: 150,
    gold: 10000,
    damage: 15000,
    visionScore: 20,
    playedAt: '2026-07-13T00:00:00.000Z',
    ...over,
  };
}

// Historial: el jugador domina Syndra (134) en MID, que NO está en el seed pool.
const midHistory: MatchSummary[] = [
  match({ championId: 134, championName: 'Syndra', role: 'MIDDLE', win: true }),
  match({ championId: 134, championName: 'Syndra', role: 'MIDDLE', win: true }),
  match({ championId: 101, championName: 'Xerath', role: 'MIDDLE', win: false }),
];

function fakeRecentMatches(matches: MatchSummary[]): GetRecentMatchesUseCase {
  return { execute: async () => matches } as unknown as GetRecentMatchesUseCase;
}

describe('GetPersonalizedRecommendationsUseCase', () => {
  it('incorpora los campeones del historial como candidatos con comfort', async () => {
    const uc = new GetPersonalizedRecommendationsUseCase(
      new SeedChampionPool(),
      fakeRecentMatches(midHistory),
    );
    const res = await uc.execute({ identity: { gameName: 'P', tagLine: 'LAS' }, role: 'MIDDLE', limit: 3 });

    expect(res.personalized).toBe(true);
    expect(res.basedOnGames).toBe(3);
    // Syndra (134) no está en la seed pero debe aparecer por el historial.
    const syndra = res.recommendations.find((r) => r.championId === 134);
    expect(syndra).toBeDefined();
    // Con 2 juegos y 100% winrate, Syndra es comfort y debería encabezar.
    expect(res.recommendations[0]?.championId).toBe(134);
    expect(res.recommendations[0]?.reason).toMatch(/comfort/);
  });

  it('sin historial se apoya sólo en el pool base', async () => {
    const uc = new GetPersonalizedRecommendationsUseCase(
      new SeedChampionPool(),
      fakeRecentMatches([]),
    );
    const res = await uc.execute({ identity: { gameName: 'P', tagLine: 'LAS' }, role: 'BOTTOM', limit: 3 });
    expect(res.recommendations).toHaveLength(3);
    expect(res.basedOnGames).toBe(0);
  });
});
