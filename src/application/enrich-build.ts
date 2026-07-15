import type { ChampionBuild, Role } from '../domain/types.js';
import type { ChampionCatalog } from '../infrastructure/champions/champion-catalog.js';
import { summonerImageFile } from '../infrastructure/champions/summoner-assets.js';
import { SHARD_META } from '../infrastructure/champions/rune-ids.js';

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

export interface EnrichedRune extends EnrichedIcon {
  id: number;
}

/** Página de runas resuelta, en el orden que muestra el cliente de LoL. */
export interface EnrichedRunes {
  primaryStyle: EnrichedIcon;
  secondaryStyle: EnrichedIcon;
  keystone: EnrichedRune;
  primary: EnrichedRune[];
  secondary: EnrichedRune[];
  shards: EnrichedRune[];
}

/** Build con iconos resueltos (ítems, hechizos, habilidades, runas) para la UI. */
export interface EnrichedBuild {
  championId: number;
  championName: string;
  role: Role;
  runes: EnrichedRunes;
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
  await catalog.ensureRunes();
  const spells = await catalog.getChampionSpells(build.championId);

  const itemBase = data?.itemIconBase ?? null;
  const spellBase = data?.spellIconBase ?? null;
  const passiveBase = data?.passiveIconBase ?? null;
  const shardBase = data?.shardIconBase ?? null;

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

  // Runas: resolvemos estilos, keystone, filas y fragmentos con su icono.
  const resolveRune = (id: number): EnrichedRune => {
    const r = catalog.getRuneSync(id);
    return { id, name: r?.name ?? `#${id}`, icon: r?.icon ?? null };
  };
  const resolveStyle = (id: number): EnrichedIcon => {
    const s = catalog.getRuneStyleSync(id);
    return { name: s?.name ?? `#${id}`, icon: s?.icon ?? null };
  };
  const resolveShard = (id: number): EnrichedRune => {
    const meta = SHARD_META[id];
    return {
      id,
      name: meta?.name ?? `#${id}`,
      icon: meta && shardBase ? `${shardBase}${meta.file}` : null,
    };
  };
  const runes: EnrichedRunes = {
    primaryStyle: resolveStyle(build.runes.primaryStyleId),
    secondaryStyle: resolveStyle(build.runes.secondaryStyleId),
    keystone: resolveRune(build.runes.keystoneId),
    primary: build.runes.primary.map(resolveRune),
    secondary: build.runes.secondary.map(resolveRune),
    shards: build.runes.shards.map(resolveShard),
  };

  return {
    championId: build.championId,
    championName: build.championName,
    role: build.role,
    runes,
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
