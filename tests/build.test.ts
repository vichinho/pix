import { describe, it, expect } from 'vitest';
import { FallbackBuildProvider, type BuildProvider } from '@/domain/build.js';
import { SeedBuildProvider } from '@/infrastructure/champions/seed-build-provider.js';
import { GetChampionBuildUseCase } from '@/application/get-champion-build.js';
import type { ChampionBuild, Role } from '@/domain/types.js';

describe('SeedBuildProvider', () => {
  const provider = new SeedBuildProvider();

  it('devuelve una build completa para un campeón cubierto', () => {
    const build = provider.getBuild(101, 'MIDDLE'); // Xerath
    expect(build).not.toBeNull();
    expect(build?.championName).toBe('Xerath');
    expect(build?.summonerSpells.length).toBeGreaterThan(0);
    expect(build?.runes.keystone).toBeTruthy();
    expect(build?.coreItems.length).toBeGreaterThan(0);
    expect(build?.skillOrder).toEqual(['Q', 'W', 'E']);
    expect(build?.source).toBe('curated');
  });

  it('sirve la build aunque el rol no coincida exactamente', () => {
    const build = provider.getBuild(950, 'TOP'); // Naafiri curada como MIDDLE
    expect(build?.championName).toBe('Naafiri');
  });

  it('devuelve null para un campeón no cubierto', () => {
    expect(provider.getBuild(999999, 'MIDDLE')).toBeNull();
  });

  it('entrega copias (no muta la seed)', () => {
    const a = provider.getBuild(101, 'MIDDLE')!;
    a.coreItems.push('HACK');
    const b = provider.getBuild(101, 'MIDDLE')!;
    expect(b.coreItems).not.toContain('HACK');
  });

  it('coveredChampionIds incluye el pool curado', () => {
    expect(provider.coveredChampionIds()).toEqual(
      expect.arrayContaining([101, 134, 950, 8, 902, 57, 63]),
    );
  });
});

describe('FallbackBuildProvider', () => {
  function stub(name: string, build: ChampionBuild | null): BuildProvider {
    return { name, getBuild: () => build };
  }
  const sample: ChampionBuild = {
    championId: 1,
    championName: 'X',
    role: 'MIDDLE' as Role,
    summonerSpells: ['Flash'],
    runes: { primaryStyle: 'a', keystone: 'k', primary: [], secondaryStyle: 'b', secondary: [], shards: [] },
    startingItems: [],
    coreItems: ['i'],
    situationalItems: [],
    skillOrder: ['Q'],
    source: 'ext',
    patch: '1',
  };

  it('usa el primer proveedor que responde', () => {
    const fb = new FallbackBuildProvider([stub('a', null), stub('b', sample)]);
    expect(fb.getBuild(1, 'MIDDLE')?.source).toBe('ext');
  });

  it('devuelve null si ninguno cubre', () => {
    const fb = new FallbackBuildProvider([stub('a', null), stub('b', null)]);
    expect(fb.getBuild(1, 'MIDDLE')).toBeNull();
  });
});

describe('GetChampionBuildUseCase', () => {
  it('delega en el proveedor', () => {
    const uc = new GetChampionBuildUseCase(new SeedBuildProvider());
    expect(uc.execute(134, 'MIDDLE')?.championName).toBe('Syndra');
    expect(uc.execute(999999, 'MIDDLE')).toBeNull();
  });
});
