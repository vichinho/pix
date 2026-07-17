import { describe, it, expect } from 'vitest';
import { UggBuildProvider } from '@/infrastructure/champions/ugg-build-provider.js';

/**
 * Payload sintético con la forma posicional del overview de u.gg (v1.5):
 * json[region][rank][role] = [ runas, hechizos, iniciales, core, skills, opc... ]
 */
function overview() {
  return {
    '12': {
      '10': {
        '6': [
          // runas: [ _, _, [keystone, p1, p2, p3, s1, s2], [shards], primaryStyle, secondaryStyle ]
          [0, 0, [8112, 8126, 8138, 8135, 8009, 8014], [5008, 5008, 5001], 8100, 8000],
          // hechizos: [4=Flash, 32=Mark]
          [0, 0, [4, 32]],
          // ítems iniciales
          [0, 0, [1082, 2003]],
          // ítems core
          [0, 0, [6653, 3020, 3135]],
          // habilidades (1=Q,2=W,3=E,4=R)
          [0, 0, 0, [3, 1, 4, 2]],
          // opciones situacionales
          [0, 0, [3157]],
          [0, 0, [3089]],
          [0, 0, [3116]],
        ],
      },
    },
  };
}

describe('UggBuildProvider.parseOverview', () => {
  const provider = new UggBuildProvider();

  it('extrae runas, hechizos, ítems y habilidades del overview', () => {
    const build = provider.parseOverview(overview(), 1, 'ARAM');
    expect(build).not.toBeNull();
    expect(build!.summonerSpells).toEqual(['flash', 'mark']);
    expect(build!.runes.keystoneId).toBe(8112);
    expect(build!.runes.primary).toEqual([8126, 8138, 8135]);
    expect(build!.runes.secondary).toEqual([8009, 8014]);
    expect(build!.runes.shards).toEqual([5008, 5008, 5001]);
    expect(build!.coreItems).toEqual([6653, 3020, 3135]);
    expect(build!.startingItems).toEqual([1082, 2003]);
    expect(build!.situationalItems).toEqual([3157, 3089, 3116]);
    expect(build!.skillOrder).toEqual(['E', 'Q', 'W']);
    expect(build!.source).toBe('u.gg');
  });

  it('devuelve null ante un payload inesperado (fallback seguro)', () => {
    expect(provider.parseOverview({}, 1, 'ARAM')).toBeNull();
    expect(provider.parseOverview({ foo: 'bar' }, 1, 'MIDDLE')).toBeNull();
    expect(provider.parseOverview(null, 1, 'ARAM')).toBeNull();
  });

  it('getBuild cae a null si la red falla (no rompe la cadena)', async () => {
    const p = new UggBuildProvider({
      patch: '15_1',
      overviewVersion: '1.5.0',
      fetchImpl: (async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch,
    });
    expect(await p.getBuild(1, 'ARAM')).toBeNull();
  });
});
