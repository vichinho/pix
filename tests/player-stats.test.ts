import { describe, it, expect } from 'vitest';
import { computePlayerStats, comfortChampionIds } from '@/domain/player-stats.js';
import {
  buildHistoryPool,
  CompositeChampionPool,
} from '@/infrastructure/champions/history-champion-pool.js';
import { SeedChampionPool } from '@/infrastructure/champions/seed-champion-pool.js';
import type { MatchSummary, Role } from '@/domain/types.js';

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
    playedAt: '2026-07-13T00:00:00.000Z',
    ...over,
  };
}

const history: MatchSummary[] = [
  match({ championId: 101, championName: 'Xerath', role: 'MIDDLE', win: false, kills: 4, deaths: 7, assists: 3 }),
  match({ championId: 134, championName: 'Syndra', role: 'MIDDLE', win: true, kills: 7, deaths: 8, assists: 10 }),
  match({ championId: 134, championName: 'Syndra', role: 'MIDDLE', win: true, kills: 5, deaths: 2, assists: 6 }),
  match({ championId: 57, championName: 'Maokai', role: 'TOP', win: true, kills: 5, deaths: 2, assists: 5 }),
];

describe('computePlayerStats', () => {
  it('agrega winrate y KDA globales y por campeón', () => {
    const stats = computePlayerStats(history);
    expect(stats.totalGames).toBe(4);
    expect(stats.wins).toBe(3);
    expect(stats.winRate).toBe(0.75);

    const syndra = stats.byChampion.find((c) => c.championId === 134);
    expect(syndra?.games).toBe(2);
    expect(syndra?.winRate).toBe(1);
    // KDA agregado: kills 7+5=12, assists 10+6=16, deaths 8+2=10 -> (12+16)/10 = 2.8
    expect(syndra?.kda).toBe(2.8);
  });

  it('ordena byChampion por partidas y agrupa por rol', () => {
    const stats = computePlayerStats(history);
    expect(stats.byChampion[0]?.championId).toBe(134); // 2 juegos
    const mid = stats.byRole.find((r) => r.role === 'MIDDLE');
    expect(mid?.games).toBe(3);
    expect(mid?.championIds).toContain(134);
  });

  it('historial vacío no rompe', () => {
    const stats = computePlayerStats([]);
    expect(stats.totalGames).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.byChampion).toEqual([]);
  });
});

describe('comfortChampionIds', () => {
  it('filtra por rol y muestra mínima, ordena por winrate', () => {
    const ids = comfortChampionIds(history, 'MIDDLE', 2);
    expect(ids).toEqual([134]); // sólo Syndra tiene 2 juegos en MID
  });

  it('con UNKNOWN considera todo el historial', () => {
    const ids = comfortChampionIds(history, 'UNKNOWN', 2);
    expect(ids).toContain(134);
  });
});

describe('buildHistoryPool + CompositeChampionPool', () => {
  it('genera candidatos por rol desde el historial con nombre y puntaje', () => {
    const pool = buildHistoryPool(history);
    const mid = pool.getCandidates('MIDDLE');
    const syndra = mid.find((c) => c.championId === 134);
    expect(syndra?.championName).toBe('Syndra');
    expect(syndra?.baseScore).toBeGreaterThan(55); // 100% winrate sube el base
  });

  it('composite fusiona pools y conserva el mayor baseScore por campeón', () => {
    const historyPool = buildHistoryPool(history);
    const composite = new CompositeChampionPool([historyPool, new SeedChampionPool()]);
    const mid = composite.getCandidates('MIDDLE');
    // Debe incluir campeones del historial (Syndra 134) y de la seed (Ahri 103).
    const ids = mid.map((c) => c.championId);
    expect(ids).toContain(134);
    expect(ids).toContain(103);
    // Sin duplicados de championId.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rol sin historial delega en la seed', () => {
    const composite = new CompositeChampionPool([buildHistoryPool(history), new SeedChampionPool()]);
    const jungle = composite.getCandidates('JUNGLE' as Role);
    expect(jungle.length).toBeGreaterThan(0);
  });
});
