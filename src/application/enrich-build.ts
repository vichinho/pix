import type { ChampionBuild, Role } from '../domain/types.js';
import type { ChampionCatalog } from '../infrastructure/champions/champion-catalog.js';
import { summonerImageFile, summonerDescription } from '../infrastructure/champions/summoner-assets.js';
import { SHARD_META } from '../infrastructure/champions/rune-ids.js';

export interface EnrichedIcon {
  name: string;
  icon: string | null;
  /** Descripción breve para el tooltip al pasar el ratón. */
  desc?: string;
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
  /** Las cuatro habilidades por tecla (Q/W/E/R) para la matriz de subida. */
  spells: Record<'Q' | 'W' | 'E' | 'R', EnrichedAbility | null>;
}

/**
 * Build enriquecida sin iconos (respaldo si el enriquecimiento falla por
 * completo). Conserva la forma que espera la UI para no romper el render.
 */
export function bareEnrichedBuild(build: ChampionBuild): EnrichedBuild {
  const items = (ids: number[]): EnrichedItem[] =>
    ids.map((id) => ({ id, name: `#${id}`, icon: null }));
  const rune = (id: number): EnrichedRune => ({ id, name: `#${id}`, icon: null });
  return {
    championId: build.championId,
    championName: build.championName,
    role: build.role,
    runes: {
      primaryStyle: { name: '', icon: null },
      secondaryStyle: { name: '', icon: null },
      keystone: rune(build.runes.keystoneId),
      primary: build.runes.primary.map(rune),
      secondary: build.runes.secondary.map(rune),
      shards: build.runes.shards.map(rune),
    },
    skillOrder: build.skillOrder,
    source: build.source,
    patch: build.patch,
    ...(build.notes ? { notes: build.notes } : {}),
    summoners: build.summonerSpells.map((name) => ({ name, icon: null })),
    items: { starting: items(build.startingItems), core: items(build.coreItems), situational: items(build.situationalItems) },
    passive: null,
    abilities: build.skillOrder.map((letter) => ({ letter, name: letter, icon: null })),
    spells: {
      Q: { letter: 'Q', name: 'Q', icon: null },
      W: { letter: 'W', name: 'W', icon: null },
      E: { letter: 'E', name: 'E', icon: null },
      R: { letter: 'R', name: 'R', icon: null },
    },
  };
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

  // Parche actual del juego, leído en vivo de Data Dragon (p. ej. "16.14").
  // Así la build siempre refleja el parche vigente sin etiquetas fijas.
  const patch = data?.version ? data.version.split('.').slice(0, 2).join('.') : build.patch;

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
        ...(it?.desc ? { desc: it.desc } : {}),
      };
    });

  const summoners: EnrichedIcon[] = build.summonerSpells.map((name) => {
    const file = summonerImageFile(name);
    const desc = summonerDescription(name);
    return { name, icon: file && spellBase ? `${spellBase}${file}.png` : null, ...(desc ? { desc } : {}) };
  });

  const spellByLetter = (letter: string) =>
    spells ? spells[letter as 'Q' | 'W' | 'E' | 'R'] : null;

  const abilityFor = (letter: string): EnrichedAbility => {
    const a = spellByLetter(letter);
    return {
      letter,
      name: a?.name ?? letter,
      icon: a && spellBase ? `${spellBase}${a.image}` : null,
      ...(a?.desc ? { desc: a.desc } : {}),
    };
  };
  const abilities: EnrichedAbility[] = build.skillOrder.map(abilityFor);
  const spellsByKey = {
    Q: abilityFor('Q'),
    W: abilityFor('W'),
    E: abilityFor('E'),
    R: abilityFor('R'),
  };

  const passive: EnrichedIcon | null = spells?.passive
    ? {
        name: spells.passive.name,
        icon: passiveBase ? `${passiveBase}${spells.passive.image}` : null,
        ...(spells.passive.desc ? { desc: spells.passive.desc } : {}),
      }
    : null;

  // Runas: resolvemos estilos, keystone, filas y fragmentos con su icono.
  const resolveRune = (id: number): EnrichedRune => {
    const r = catalog.getRuneSync(id);
    return { id, name: r?.name ?? `#${id}`, icon: r?.icon ?? null, ...(r?.desc ? { desc: r.desc } : {}) };
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
    patch,
    ...(build.notes ? { notes: build.notes } : {}),
    summoners,
    items: {
      starting: resolveItems(build.startingItems),
      core: resolveItems(build.coreItems),
      situational: resolveItems(build.situationalItems),
    },
    passive,
    abilities,
    spells: spellsByKey,
  };
}
