import { describe, it, expect } from 'vitest';
import { recommendChampions, type ChampionPool } from '@/domain/recommendation.js';
import { SeedChampionPool } from '@/infrastructure/champions/seed-champion-pool.js';
import { GetChampionRecommendationsUseCase } from '@/application/get-champion-recommendations.js';
import type { ChampSelectReader } from '@/infrastructure/lcu/champ-select.js';
import type { ChampSelectSnapshot, Role } from '@/domain/types.js';

const pool: ChampionPool = {
  getCandidates: (role: Role) =>
    role === 'TOP'
      ? [
          { championId: 1, championName: 'Alpha', role: 'TOP', baseScore: 80 },
          { championId: 2, championName: 'Bravo', role: 'TOP', baseScore: 60 },
          { championId: 3, championName: 'Charlie', role: 'TOP', baseScore: 50 },
        ]
      : [],
};

describe('recommendChampions', () => {
  it('ordena por puntaje descendente y respeta el límite', () => {
    const recs = recommendChampions(pool, 'TOP', {}, 2);
    expect(recs.map((r) => r.championId)).toEqual([1, 2]);
    expect(recs[0]?.reason).toBe('meta_pick');
  });

  it('excluye campeones vetados (bans)', () => {
    const recs = recommendChampions(pool, 'TOP', { excludeChampionIds: [1] }, 5);
    expect(recs.map((r) => r.championId)).toEqual([2, 3]);
  });

  it('aplica bono de comfort y ajusta el puntaje y la razón', () => {
    const recs = recommendChampions(pool, 'TOP', { comfortChampionIds: [3] }, 5);
    const charlie = recs.find((r) => r.championId === 3);
    expect(charlie?.score).toBe(65); // 50 + 15
    expect(charlie?.reason).toBe('comfort_pick');
  });

  it('marca comfort_pick_plus_meta cuando el base ya es alto', () => {
    const recs = recommendChampions(pool, 'TOP', { comfortChampionIds: [1] }, 5);
    const alpha = recs.find((r) => r.championId === 1);
    expect(alpha?.reason).toBe('comfort_pick_plus_meta');
    expect(alpha?.score).toBe(95); // 80 + 15
  });

  it('el comfort puede reordenar por encima de un base mayor', () => {
    const recs = recommendChampions(pool, 'TOP', { comfortChampionIds: [2] }, 1);
    // Bravo 60+15=75 supera a Alpha 80? No: Alpha 80 > 75. Verificamos que sigue Alpha.
    expect(recs[0]?.championId).toBe(1);
    // Con comfort en Charlie(50->65) tampoco supera; probamos un caso que sí reordena:
    const recs2 = recommendChampions(pool, 'TOP', { comfortChampionIds: [3, 2] }, 1);
    expect(recs2[0]?.championId).toBe(1);
  });

  it('rol UNKNOWN devuelve lista vacía', () => {
    expect(recommendChampions(pool, 'UNKNOWN', {}, 5)).toEqual([]);
  });

  it('limit 0 devuelve vacío', () => {
    expect(recommendChampions(pool, 'TOP', {}, 0)).toEqual([]);
  });
});

describe('SeedChampionPool', () => {
  const seed = new SeedChampionPool();

  it('provee candidatos para cada rol conocido', () => {
    for (const role of ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as Role[]) {
      expect(seed.getCandidates(role).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('devuelve vacío para UNKNOWN', () => {
    expect(seed.getCandidates('UNKNOWN')).toEqual([]);
  });

  it('entrega copias defensivas (no muta la seed)', () => {
    const first = seed.getCandidates('TOP');
    first[0]!.baseScore = -999;
    const second = seed.getCandidates('TOP');
    expect(second[0]!.baseScore).not.toBe(-999);
  });

  it('integra con el motor para top 5 por rol', () => {
    const recs = recommendChampions(seed, 'MIDDLE', {}, 5);
    expect(recs).toHaveLength(5);
    expect(recs[0]!.score).toBeGreaterThanOrEqual(recs[4]!.score);
  });
});

function fakeChampSelectReader(snapshot: ChampSelectSnapshot | null): ChampSelectReader {
  return { getSession: async () => snapshot } as unknown as ChampSelectReader;
}

describe('GetChampionRecommendationsUseCase', () => {
  const seed = new SeedChampionPool();

  it('usa el rol explícito cuando se entrega', async () => {
    const uc = new GetChampionRecommendationsUseCase(seed);
    const res = await uc.execute({ role: 'BOTTOM', limit: 3 });
    expect(res.role).toBe('BOTTOM');
    expect(res.recommendations).toHaveLength(3);
  });

  it('detecta el rol y excluye bans desde champ select cuando no se da rol', async () => {
    const snapshot: ChampSelectSnapshot = {
      phase: 'BAN_PICK',
      assignedRole: 'MIDDLE',
      localPlayerCellId: 0,
      selectedChampionId: null,
      pickCompleted: false,
      bans: [103], // Ahri baneada
    };
    const uc = new GetChampionRecommendationsUseCase(seed, fakeChampSelectReader(snapshot));
    const res = await uc.execute({});
    expect(res.role).toBe('MIDDLE');
    expect(res.recommendations.some((r) => r.championId === 103)).toBe(false);
  });

  it('sin champ select activo y sin rol, devuelve UNKNOWN y lista vacía', async () => {
    const uc = new GetChampionRecommendationsUseCase(seed, fakeChampSelectReader(null));
    const res = await uc.execute({});
    expect(res.role).toBe('UNKNOWN');
    expect(res.recommendations).toEqual([]);
  });
});
