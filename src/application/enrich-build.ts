import type { ChampionBuild, RuneSelection, Role } from '../domain/types.js';
import type { ChampionCatalog } from '../infrastructure/champions/champion-catalog.js';
import { summonerImageFile } from '../infrastructure/champions/summoner-assets.js';

export interface EnrichedIcon {
  name: string;
  icon: string | null;
}

export interface EnrichedItem extends EnrichedIcon {
  id: number;
}

export interface EnrichedAbility extends EnrichedIcon {
  letter: string;
}

/** Build con iconos resueltos (ítems, hechizos, habilidades) para la UI. */
export interface EnrichedBuild {
  championId: number;
  championName: string;
  role: Role;
  runes: RuneSelection;
  skillOrder: string[];
  source: string;
  patch: string;
  notes?: string;
  summoners: EnrichedIcon[];
  items: {
    starting: EnrichedItem[];
    core: EnrichedItem[];
    situational: EnrichedItem[];
  };
  passive: EnrichedIcon | null;
  /** Habilidades en orden de prioridad (con icono si está disponible). */
  abilities: EnrichedAbility[];
}

/**
 * Enriquece una build resolviendo iconos desde Data Dragon: ítems (por id),
 * hechizos de invocador (por nombre) y habilidades del campeón. Si algún dato
 * no está disponible, el icono queda en null y la UI muestra sólo el texto.
 */
export async function enrichBuild(
  build: ChampionBuild,
  catalog: ChampionCatalog,
): Promise<EnrichedBuild> {
  const data = await catalog.getData();
  await catalog.ensureItems();
  const spells = await catalog.getChampionSpells(build.championId);

  const itemBase = data?.itemIconBase ?? null;
  const spellBase = data?.spellIconBase ?? null;
  const passiveBase = data?.passiveIconBase ?? null;

  const resolveItems = (ids: number[]): EnrichedItem[] =>
    ids.map((id) => {
      const it = catalog.getItemSync(id);
      return {
        id,
        name: it?.name ?? `#${id}`,
        icon: it && itemBase ? `${itemBase}${it.image}` : null,
      };
    });

  const summoners: EnrichedIcon[] = build.summonerSpells.map((name) => {
    const file = summonerImageFile(name);
    return { name, icon: file && spellBase ? `${spellBase}${file}.png` : null };
  });

  const spellByLetter = (letter: string) =>
    spells ? spells[letter as 'Q' | 'W' | 'E' | 'R'] : null;

  const abilities: EnrichedAbility[] = build.skillOrder.map((letter) => {
    const a = spellByLetter(letter);
    return {
      letter,
      name: a?.name ?? letter,
      icon: a && spellBase ? `${spellBase}${a.image}` : null,
    };
  });

  const passive: EnrichedIcon | null = spells?.passive
    ? {
        name: spells.passive.name,
        icon: passiveBase ? `${passiveBase}${spells.passive.image}` : null,
      }
    : null;

  return {
    championId: build.championId,
    championName: build.championName,
    role: build.role,
    runes: build.runes,
    skillOrder: build.skillOrder,
    source: build.source,
    patch: build.patch,
    ...(build.notes ? { notes: build.notes } : {}),
    summoners,
    items: {
      starting: resolveItems(build.startingItems),
      core: resolveItems(build.coreItems),
      situational: resolveItems(build.situationalItems),
    },
    passive,
    abilities,
  };
}
