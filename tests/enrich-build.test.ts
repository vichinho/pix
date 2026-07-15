import { describe, it, expect } from 'vitest';
import { ChampionCatalog, type CatalogFetch } from '@/infrastructure/champions/champion-catalog.js';
import { SeedBuildProvider } from '@/infrastructure/champions/seed-build-provider.js';
import { enrichBuild } from '@/application/enrich-build.js';
import { summonerImageFile } from '@/infrastructure/champions/summoner-assets.js';

const championJson = {
  data: {
    Xerath: {
      key: '101', id: 'Xerath', name: 'Xerath', image: { full: 'Xerath.png' },
      tags: ['Mage'], info: { attack: 1, magic: 10, defense: 3 },
    },
  },
};

const itemJson = {
  data: {
    '6655': { name: "Luden's Companion", image: { full: '6655.png' } },
    '3020': { name: 'Sorcerer’s Shoes', image: { full: '3020.png' } },
    '4645': { name: 'Shadowflame', image: { full: '4645.png' } },
    '1056': { name: "Doran's Ring", image: { full: '1056.png' } },
    '2003': { name: 'Health Potion', image: { full: '2003.png' } },
    '4628': { name: 'Horizon Focus', image: { full: '4628.png' } },
    '3089': { name: "Rabadon's Deathcap", image: { full: '3089.png' } },
    '3135': { name: 'Void Staff', image: { full: '3135.png' } },
    '3157': { name: "Zhonya's Hourglass", image: { full: '3157.png' } },
  },
};

const xerathDetail = {
  data: {
    Xerath: {
      passive: { name: 'Mana Surge', image: { full: 'Xerath_P.png' } },
      spells: [
        { name: 'Arcanopulse', image: { full: 'XerathArcanopulseChargeUp.png' } },
        { name: 'Eye of Destruction', image: { full: 'XerathArcaneBarrage2.png' } },
        { name: 'Shocking Orb', image: { full: 'XerathMageSpear.png' } },
        { name: 'Rite of the Arcane', image: { full: 'XerathLocusOfPower2.png' } },
      ],
    },
  },
};

function catalogFetch(): CatalogFetch {
  return async (url: string) => {
    let body: unknown = {};
    if (url.includes('versions')) body = ['14.24.1'];
    else if (url.includes('/champion/Xerath.json')) body = xerathDetail;
    else if (url.includes('champion.json')) body = championJson;
    else if (url.includes('item.json')) body = itemJson;
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
}

describe('summonerImageFile', () => {
  it('mapea nombres ES/EN a archivos de icono', () => {
    expect(summonerImageFile('Flash')).toBe('SummonerFlash');
    expect(summonerImageFile('Ignite')).toBe('SummonerDot');
    expect(summonerImageFile('Curación')).toBe('SummonerHeal');
    expect(summonerImageFile('desconocido')).toBeNull();
  });
});

describe('enrichBuild', () => {
  it('resuelve iconos de ítems, hechizos y habilidades', async () => {
    const catalog = new ChampionCatalog({ fetchImpl: catalogFetch() });
    const build = new SeedBuildProvider().getBuild(101, 'MIDDLE')!;
    const enriched = await enrichBuild(build, catalog);

    // Ítems resueltos a nombre + icono.
    const luden = enriched.items.core.find((i) => i.id === 6655);
    expect(luden?.name).toBe("Luden's Companion");
    expect(luden?.icon).toContain('/img/item/6655.png');

    // Hechizos con icono.
    const flash = enriched.summoners.find((s) => s.name === 'Flash');
    expect(flash?.icon).toContain('/img/spell/SummonerFlash.png');

    // Habilidades (orden Q>W>E) con icono del campeón.
    expect(enriched.abilities.map((a) => a.letter)).toEqual(['Q', 'W', 'E']);
    expect(enriched.abilities[0]?.icon).toContain('/img/spell/XerathArcanopulseChargeUp.png');
    expect(enriched.passive?.icon).toContain('/img/passive/Xerath_P.png');
  });

  it('sin catálogo (CDN caído) deja iconos en null pero conserva estructura', async () => {
    const catalog = new ChampionCatalog({
      fetchImpl: async () => ({ ok: false, status: 503, text: async () => '' }),
    });
    const build = new SeedBuildProvider().getBuild(101, 'MIDDLE')!;
    const enriched = await enrichBuild(build, catalog);
    expect(enriched.items.core.length).toBeGreaterThan(0);
    expect(enriched.items.core[0]?.icon).toBeNull();
    expect(enriched.summoners[0]?.icon).toBeNull();
  });
});
