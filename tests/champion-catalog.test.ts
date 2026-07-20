import { describe, it, expect } from 'vitest';
import {
  ChampionCatalog,
  inferDamage,
  type CatalogFetch,
} from '@/infrastructure/champions/champion-catalog.js';
import {
  ArchetypeBuildProvider,
  CatalogArchetypeBuildProvider,
  resolveArchetype,
} from '@/infrastructure/champions/archetype-build-provider.js';
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
    Xerath: {
      key: '101', id: 'Xerath', name: 'Xerath', image: { full: 'Xerath.png' },
      tags: ['Mage'], info: { attack: 1, magic: 10, defense: 3 },
    },
    Ashe: {
      key: '22', id: 'Ashe', name: 'Ashe', image: { full: 'Ashe.png' },
      tags: ['Marksman'], info: { attack: 7, magic: 2, defense: 3 },
    },
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
    // El payload público no expone tags/damage, pero getMeta sí (uso interno).
    expect(catalog.getMeta(101)?.damage).toBe('AP');
    expect(catalog.getMeta(22)?.damage).toBe('AD');
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
    expect(b?.runes.keystoneId).toBe(8229); // Cometa Arcano
    expect(b?.summonerSpells).toContain('Flash');
  });

  it('usa runas AD para campeones AD', () => {
    const b = provider.getBuild(122, 'TOP'); // Darius = AD
    expect(b?.runes.primaryStyleId).toBe(8000); // Precisión
    expect(b?.runes.keystoneId).toBe(8010); // Conquistador
  });

  it('devuelve null si no hay metadatos del campeón', () => {
    expect(provider.getBuild(999999, 'MIDDLE')).toBeNull();
  });
});

describe('inferDamage', () => {
  it('clasifica por tags principales', () => {
    expect(inferDamage(['Marksman'])).toBe('AD');
    expect(inferDamage(['Mage'])).toBe('AP');
    expect(inferDamage(['Tank'])).toBe('NONE');
  });
  it('desempata fighters/assassins por attack vs magic', () => {
    expect(inferDamage(['Fighter'], { attack: 8, magic: 2 })).toBe('AD');
    expect(inferDamage(['Assassin'], { attack: 2, magic: 8 })).toBe('AP');
  });
});

describe('resolveArchetype', () => {
  it('mapea la clase principal del campeón', () => {
    expect(resolveArchetype(['Marksman'], 'AD')).toBe('MARKSMAN');
    expect(resolveArchetype(['Support', 'Mage'], 'AP')).toBe('ENCHANTER');
    expect(resolveArchetype(['Tank', 'Support'], 'NONE')).toBe('TANK');
    expect(resolveArchetype(['Assassin'], 'AD')).toBe('ASSASSIN_AD');
    expect(resolveArchetype(['Assassin'], 'AP')).toBe('ASSASSIN_AP');
    expect(resolveArchetype(['Mage'], 'AP')).toBe('MAGE');
    expect(resolveArchetype(['Fighter'], 'AD')).toBe('FIGHTER');
  });
  it('los magos con Support secundario construyen como magos, no enchantadores', () => {
    // Annie, Brand, Morgana, Lux… tienen 'Mage' como tag principal y 'Support'
    // secundario: deben ir build AP mago (ráfaga), no build de enchantador.
    expect(resolveArchetype(['Mage', 'Support'], 'AP')).toBe('MAGE');
    // Los enchantadores reales tienen 'Support' como tag principal.
    expect(resolveArchetype(['Support', 'Mage'], 'AP')).toBe('ENCHANTER');
  });
  it('cae al tipo de daño sin tags', () => {
    expect(resolveArchetype([], 'AP')).toBe('MAGE');
    expect(resolveArchetype([], 'AD')).toBe('FIGHTER');
  });
});

describe('CatalogArchetypeBuildProvider', () => {
  it('genera build genérica para cualquier campeón del catálogo', async () => {
    const catalog = new ChampionCatalog({
      fetchImpl: fetchOk((url) => (url.includes('versions') ? ['1.0.0'] : championJson)),
    });
    await catalog.getData(); // carga metadatos en memoria
    const provider = new CatalogArchetypeBuildProvider(catalog);
    const build = provider.getBuild(22, 'BOTTOM'); // Ashe = AD (Marksman)
    expect(build?.championName).toBe('Ashe');
    expect(build?.runes.primaryStyleId).toBe(8000); // Precisión
    expect(build?.summonerSpells).toContain('Curación');
  });

  it('devuelve null si el catálogo no está cargado', () => {
    const provider = new CatalogArchetypeBuildProvider(new ChampionCatalog());
    expect(provider.getBuild(22, 'BOTTOM')).toBeNull();
  });
});
