import { describe, it, expect } from 'vitest';
import {
  ClassifiedBuildProvider,
  CHAMPION_ARCHETYPE,
} from '@/infrastructure/champions/champion-archetypes.js';
import type { ChampionCatalog } from '@/infrastructure/champions/champion-catalog.js';
import { ITEM } from '@/infrastructure/champions/item-ids.js';

/** Catálogo mínimo que sólo resuelve getMeta por id → ddragonId/nombre. */
function fakeCatalog(map: Record<number, { ddragonId: string; name: string }>): ChampionCatalog {
  return {
    getMeta: (id: number) =>
      map[id] ? { name: map[id]!.name, ddragonId: map[id]!.ddragonId, tags: [], damage: 'AD' } : null,
  } as unknown as ChampionCatalog;
}

describe('ClassifiedBuildProvider', () => {
  it("da a Kai'Sa una build de tirador on-hit (Kraken)", () => {
    const p = new ClassifiedBuildProvider(fakeCatalog({ 145: { ddragonId: 'Kaisa', name: "Kai'Sa" } }));
    const b = p.getBuild(145, 'BOTTOM');
    expect(b).not.toBeNull();
    expect(b!.source).toBe('classified');
    expect(b!.coreItems).toContain(ITEM.KRAKEN_SLAYER);
    expect(b!.coreItems).toContain(ITEM.RUNAANS_HURRICANE);
  });

  it('da a Vladimir una build de mago de combate (Riftmaker)', () => {
    const p = new ClassifiedBuildProvider(fakeCatalog({ 8: { ddragonId: 'Vladimir', name: 'Vladimir' } }));
    const b = p.getBuild(8, 'MIDDLE');
    expect(b!.coreItems).toContain(ITEM.RIFTMAKER);
  });

  it('devuelve null si el campeón no está clasificado o no hay catálogo', () => {
    const p = new ClassifiedBuildProvider(fakeCatalog({}));
    expect(p.getBuild(99999, 'MIDDLE')).toBeNull();
  });

  it('la clasificación cubre un pool amplio de campeones', () => {
    // Verifica que al menos 140 campeones estén clasificados (cobertura total).
    expect(Object.keys(CHAMPION_ARCHETYPE).length).toBeGreaterThanOrEqual(140);
  });
});
