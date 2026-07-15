import { describe, it, expect } from 'vitest';
import {
  ChampionCatalog,
  type CatalogFetch,
} from '@/infrastructure/champions/champion-catalog.js';
import { ArchetypeBuildProvider } from '@/infrastructure/champions/archetype-build-provider.js';
import { SeedChampionTraitProvider } from '@/infrastructure/champions/champion-traits.js';

function fetchOk(bodyByUrl: (url: string) => unknown): CatalogFetch {
  return async (url: string) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(bodyByUrl(url)),
  });
}

const championJson = {
  data: {
    Xerath: { key: '101', id: 'Xerath', name: 'Xerath', image: { full: 'Xerath.png' } },
    Ahri: { key: '103', id: 'Ahri', name: 'Ahri', image: { full: 'Ahri.png' } },
  },
};

describe('ChampionCatalog', () => {
  it('carga versión y campeones y resuelve nombre', async () => {
    const catalog = new ChampionCatalog({
      fetchImpl: fetchOk((url) => (url.includes('versions') ? ['14.24.1', '14.23.1'] : championJson)),
    });
    const data = await catalog.getData();
    expect(data?.version).toBe('14.24.1');
    expect(data?.iconBase).toContain('/cdn/14.24.1/img/champion/');
    expect(data?.champions).toHaveLength(2);
    expect(await catalog.name(101)).toBe('Xerath');
  });

  it('devuelve null (degradación) si el CDN falla', async () => {
    const catalog = new ChampionCatalog({
      fetchImpl: async () => ({ ok: false, status: 503, text: async () => '' }),
    });
    expect(await catalog.getData()).toBeNull();
    expect(await catalog.name(101)).toBeNull();
  });

  it('cachea: no vuelve a pedir dentro del TTL', async () => {
    let calls = 0;
    const catalog = new ChampionCatalog({
      fetchImpl: async (url) => {
        calls += 1;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(url.includes('versions') ? ['1.0.0'] : championJson),
        };
      },
    });
    await catalog.getData();
    await catalog.getData();
    expect(calls).toBe(2); // versions + champion.json una sola vez
  });
});

describe('ArchetypeBuildProvider', () => {
  const provider = new ArchetypeBuildProvider(new SeedChampionTraitProvider());

  it('genera build genérica AP con runas y hechizos', () => {
    const b = provider.getBuild(101, 'MIDDLE'); // Xerath = AP
    expect(b).not.toBeNull();
    expect(b?.source).toBe('archetype');
    expect(b?.runes.keystone).toBe('Cometa Arcano');
    expect(b?.summonerSpells).toContain('Flash');
  });

  it('usa runas AD para campeones AD', () => {
    const b = provider.getBuild(122, 'TOP'); // Darius = AD
    expect(b?.runes.primaryStyle).toBe('Precisión');
  });

  it('devuelve null si no hay metadatos del campeón', () => {
    expect(provider.getBuild(999999, 'MIDDLE')).toBeNull();
  });
});
