import type { BuildProvider } from '../../domain/build.js';
import type { ChampionTraitProvider, DamageType } from '../../domain/aram.js';
import type { ChampionBuild, Role, RuneSelection } from '../../domain/types.js';
import type { ChampionCatalog } from './champion-catalog.js';
import { ITEM } from './item-ids.js';
import { STYLE, KEYSTONE, RUNE, SHARD } from './rune-ids.js';

/** Arquetipo de build según la clase/subclase del campeón. */
export type BuildArchetype =
  | 'MARKSMAN'
  | 'ONHIT_MARKSMAN'
  | 'MAGE'
  | 'BATTLEMAGE'
  | 'ARTILLERY'
  | 'AP_ONHIT'
  | 'ASSASSIN_AD'
  | 'ASSASSIN_AP'
  | 'TANK'
  | 'FIGHTER'
  | 'SKIRMISHER'
  | 'ENCHANTER'
  | 'SUPPORT_TANK';

/**
 * Deriva el arquetipo de build a partir de tags (Data Dragon) y tipo de daño.
 *
 * Data Dragon lista los tags con el principal primero. Eso importa para
 * distinguir enchantadores de magos con toque de soporte: los enchantadores
 * reales (Soraka, Sona, Lulu, Nami…) tienen 'Support' como tag PRINCIPAL,
 * mientras que magos de ráfaga con 'Support' secundario (Annie, Brand, Morgana,
 * Lux, Zyra…) deben construir como magos AP, no como enchantadores.
 */
export function resolveArchetype(tags: string[], damage: DamageType): BuildArchetype {
  const primary = tags[0];
  if (tags.includes('Marksman')) return 'MARKSMAN';
  if (tags.includes('Assassin')) return damage === 'AP' ? 'ASSASSIN_AP' : 'ASSASSIN_AD';
  if (primary === 'Tank') return 'TANK';
  if (primary === 'Support') return 'ENCHANTER';
  if (tags.includes('Mage')) return 'MAGE';
  if (tags.includes('Tank')) return 'TANK';
  if (tags.includes('Support')) return 'ENCHANTER';
  if (tags.includes('Fighter')) return 'FIGHTER';
  if (damage === 'AD') return 'FIGHTER';
  return 'MAGE';
}

interface ArchetypeConfig {
  summoners: (role: Role) => string[];
  runes: RuneSelection;
  starting: number[];
  core: number[];
  situational: number[];
  skillOrder: string[];
}

const MAGE_SUMMONERS = (role: Role): string[] =>
  role === 'TOP' ? ['Flash', 'Teletransporte'] : ['Flash', 'Ignite'];

const CONFIGS: Record<BuildArchetype, ArchetypeConfig> = {
  MARKSMAN: {
    summoners: (role) => (role === 'BOTTOM' ? ['Flash', 'Curación'] : ['Flash', 'Barrera']),
    runes: {
      primaryStyleId: STYLE.PRECISION,
      keystoneId: KEYSTONE.PRESS_THE_ATTACK,
      primary: [RUNE.PRESENCE_OF_MIND, RUNE.LEGEND_ALACRITY, RUNE.COUP_DE_GRACE],
      secondaryStyleId: STYLE.INSPIRATION,
      secondary: [RUNE.MAGICAL_FOOTWEAR, RUNE.COSMIC_INSIGHT],
      shards: [SHARD.ATTACK_SPEED, SHARD.ADAPTIVE, SHARD.HEALTH],
    },
    starting: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    core: [ITEM.BERSERKERS_GREAVES, ITEM.INFINITY_EDGE, ITEM.PHANTOM_DANCER],
    situational: [ITEM.BLOODTHIRSTER, ITEM.LORD_DOMINIKS, ITEM.RUNAANS_HURRICANE, ITEM.GUARDIAN_ANGEL],
    skillOrder: ['Q', 'W', 'E'],
  },
  MAGE: {
    summoners: MAGE_SUMMONERS,
    runes: {
      primaryStyleId: STYLE.SORCERY,
      keystoneId: KEYSTONE.ARCANE_COMET,
      primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH],
      secondaryStyleId: STYLE.INSPIRATION,
      secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT],
      shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH],
    },
    starting: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    core: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situational: [ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF, ITEM.ZHONYAS_HOURGLASS],
    skillOrder: ['Q', 'W', 'E'],
  },
  ASSASSIN_AD: {
    summoners: () => ['Flash', 'Ignite'],
    runes: {
      primaryStyleId: STYLE.DOMINATION,
      keystoneId: KEYSTONE.ELECTROCUTE,
      primary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER, RUNE.ULTIMATE_HUNTER],
      secondaryStyleId: STYLE.PRECISION,
      secondary: [RUNE.TRIUMPH, RUNE.COUP_DE_GRACE],
      shards: [SHARD.ADAPTIVE, SHARD.ADAPTIVE, SHARD.HEALTH],
    },
    starting: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    core: [ITEM.ECLIPSE, ITEM.IONIAN_BOOTS, ITEM.YOUMUUS_GHOSTBLADE],
    situational: [ITEM.SERYLDAS_GRUDGE, ITEM.EDGE_OF_NIGHT, ITEM.DEATHS_DANCE],
    skillOrder: ['Q', 'E', 'W'],
  },
  ASSASSIN_AP: {
    summoners: () => ['Flash', 'Ignite'],
    runes: {
      primaryStyleId: STYLE.DOMINATION,
      keystoneId: KEYSTONE.ELECTROCUTE,
      primary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER, RUNE.ULTIMATE_HUNTER],
      secondaryStyleId: STYLE.SORCERY,
      secondary: [RUNE.TRANSCENDENCE, RUNE.SCORCH],
      shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH],
    },
    starting: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    core: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situational: [ITEM.RABADONS_DEATHCAP, ITEM.ZHONYAS_HOURGLASS, ITEM.VOID_STAFF],
    skillOrder: ['Q', 'E', 'W'],
  },
  TANK: {
    summoners: (role) =>
      role === 'TOP' ? ['Flash', 'Teletransporte'] : ['Flash', 'Ignite'],
    runes: {
      primaryStyleId: STYLE.RESOLVE,
      keystoneId: KEYSTONE.AFTERSHOCK,
      primary: [RUNE.FONT_OF_LIFE, RUNE.BONE_PLATING, RUNE.OVERGROWTH],
      secondaryStyleId: STYLE.INSPIRATION,
      secondary: [RUNE.MAGICAL_FOOTWEAR, RUNE.COSMIC_INSIGHT],
      shards: [SHARD.ABILITY_HASTE, SHARD.HEALTH_SCALING, SHARD.HEALTH],
    },
    starting: [ITEM.DORANS_SHIELD, ITEM.HEALTH_POTION],
    core: [ITEM.PLATED_STEELCAPS, ITEM.SUNFIRE_AEGIS, ITEM.LOCKET_SOLARI],
    situational: [ITEM.THORNMAIL, ITEM.SPIRIT_VISAGE, ITEM.KAENIC_ROOKERN, ITEM.FROZEN_HEART],
    skillOrder: ['Q', 'W', 'E'],
  },
  FIGHTER: {
    summoners: (role) =>
      role === 'TOP' ? ['Flash', 'Teletransporte'] : ['Flash', 'Ignite'],
    runes: {
      primaryStyleId: STYLE.PRECISION,
      keystoneId: KEYSTONE.CONQUEROR,
      primary: [RUNE.TRIUMPH, RUNE.LEGEND_ALACRITY, RUNE.LAST_STAND],
      secondaryStyleId: STYLE.RESOLVE,
      secondary: [RUNE.SECOND_WIND, RUNE.OVERGROWTH],
      shards: [SHARD.ADAPTIVE, SHARD.ADAPTIVE, SHARD.HEALTH],
    },
    starting: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    core: [ITEM.TRINITY_FORCE, ITEM.PLATED_STEELCAPS, ITEM.STERAKS_GAGE],
    situational: [ITEM.BLACK_CLEAVER, ITEM.DEATHS_DANCE, ITEM.SPIRIT_VISAGE, ITEM.GUARDIAN_ANGEL],
    skillOrder: ['Q', 'W', 'E'],
  },
  ENCHANTER: {
    summoners: () => ['Flash', 'Ignite'],
    runes: {
      primaryStyleId: STYLE.SORCERY,
      keystoneId: KEYSTONE.SUMMON_AERY,
      primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM],
      secondaryStyleId: STYLE.INSPIRATION,
      secondary: [RUNE.MAGICAL_FOOTWEAR, RUNE.COSMIC_INSIGHT],
      shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH],
    },
    starting: [ITEM.WORLD_ATLAS, ITEM.HEALTH_POTION],
    core: [ITEM.MOONSTONE_RENEWER, ITEM.IONIAN_BOOTS, ITEM.STAFF_OF_FLOWING_WATER],
    situational: [ITEM.ARDENT_CENSER, ITEM.REDEMPTION, ITEM.MIKAELS_BLESSING, ITEM.ECHOES_OF_HELIA],
    skillOrder: ['Q', 'E', 'W'],
  },
  ONHIT_MARKSMAN: {
    summoners: (role) => (role === 'BOTTOM' ? ['Flash', 'Curación'] : ['Flash', 'Barrera']),
    runes: {
      primaryStyleId: STYLE.PRECISION,
      keystoneId: KEYSTONE.LETHAL_TEMPO,
      primary: [RUNE.PRESENCE_OF_MIND, RUNE.LEGEND_ALACRITY, RUNE.COUP_DE_GRACE],
      secondaryStyleId: STYLE.DOMINATION,
      secondary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER],
      shards: [SHARD.ATTACK_SPEED, SHARD.ADAPTIVE, SHARD.HEALTH],
    },
    starting: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    core: [ITEM.KRAKEN_SLAYER, ITEM.BERSERKERS_GREAVES, ITEM.RUNAANS_HURRICANE],
    situational: [ITEM.GUINSOOS_RAGEBLADE, ITEM.INFINITY_EDGE, ITEM.BLADE_OF_THE_RUINED_KING, ITEM.BLOODTHIRSTER],
    skillOrder: ['Q', 'W', 'E'],
  },
  BATTLEMAGE: {
    summoners: MAGE_SUMMONERS,
    runes: {
      primaryStyleId: STYLE.SORCERY,
      keystoneId: KEYSTONE.ARCANE_COMET,
      primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM],
      secondaryStyleId: STYLE.INSPIRATION,
      secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT],
      shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH],
    },
    starting: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    core: [ITEM.RIFTMAKER, ITEM.SORCERERS_SHOES, ITEM.RYLAIS_SCEPTER],
    situational: [ITEM.LIANDRYS_TORMENT, ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF, ITEM.ZHONYAS_HOURGLASS],
    skillOrder: ['Q', 'W', 'E'],
  },
  ARTILLERY: {
    summoners: MAGE_SUMMONERS,
    runes: {
      primaryStyleId: STYLE.SORCERY,
      keystoneId: KEYSTONE.ARCANE_COMET,
      primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH],
      secondaryStyleId: STYLE.INSPIRATION,
      secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT],
      shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH],
    },
    starting: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    core: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situational: [ITEM.HORIZON_FOCUS, ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF, ITEM.ZHONYAS_HOURGLASS],
    skillOrder: ['Q', 'W', 'E'],
  },
  AP_ONHIT: {
    summoners: (role) => (role === 'TOP' ? ['Flash', 'Teletransporte'] : ['Flash', 'Ignite']),
    runes: {
      primaryStyleId: STYLE.SORCERY,
      keystoneId: KEYSTONE.ARCANE_COMET,
      primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM],
      secondaryStyleId: STYLE.PRECISION,
      secondary: [RUNE.PRESENCE_OF_MIND, RUNE.COUP_DE_GRACE],
      shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH],
    },
    starting: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    core: [ITEM.NASHOR_TOOTH, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situational: [ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF, ITEM.ZHONYAS_HOURGLASS, ITEM.DEMONIC_EMBRACE],
    skillOrder: ['Q', 'W', 'E'],
  },
  SKIRMISHER: {
    summoners: (role) => (role === 'TOP' ? ['Flash', 'Teletransporte'] : ['Flash', 'Ignite']),
    runes: {
      primaryStyleId: STYLE.PRECISION,
      keystoneId: KEYSTONE.CONQUEROR,
      primary: [RUNE.TRIUMPH, RUNE.LEGEND_ALACRITY, RUNE.LAST_STAND],
      secondaryStyleId: STYLE.RESOLVE,
      secondary: [RUNE.SECOND_WIND, RUNE.BONE_PLATING],
      shards: [SHARD.ATTACK_SPEED, SHARD.ADAPTIVE, SHARD.HEALTH],
    },
    starting: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    core: [ITEM.IMMORTAL_SHIELDBOW, ITEM.BERSERKERS_GREAVES, ITEM.INFINITY_EDGE],
    situational: [ITEM.BLADE_OF_THE_RUINED_KING, ITEM.DEATHS_DANCE, ITEM.GUARDIAN_ANGEL, ITEM.STERAKS_GAGE],
    skillOrder: ['Q', 'W', 'E'],
  },
  SUPPORT_TANK: {
    summoners: () => ['Flash', 'Ignite'],
    runes: {
      primaryStyleId: STYLE.RESOLVE,
      keystoneId: KEYSTONE.AFTERSHOCK,
      primary: [RUNE.FONT_OF_LIFE, RUNE.BONE_PLATING, RUNE.OVERGROWTH],
      secondaryStyleId: STYLE.INSPIRATION,
      secondary: [RUNE.MAGICAL_FOOTWEAR, RUNE.COSMIC_INSIGHT],
      shards: [SHARD.ABILITY_HASTE, SHARD.HEALTH_SCALING, SHARD.HEALTH],
    },
    starting: [ITEM.WORLD_ATLAS, ITEM.HEALTH_POTION],
    core: [ITEM.LOCKET_SOLARI, ITEM.PLATED_STEELCAPS, ITEM.KNIGHTS_VOW],
    situational: [ITEM.ZEKES_CONVERGENCE, ITEM.THORNMAIL, ITEM.FROZEN_HEART, ITEM.KAENIC_ROOKERN],
    skillOrder: ['Q', 'W', 'E'],
  },
};

/**
 * Arma una build sensata a partir de la clase del campeón (tags de Data Dragon)
 * y el tipo de daño. Cubre bien a cualquier campeón sin curación manual.
 */
export function buildGeneric(
  championId: number,
  championName: string,
  role: Role,
  damage: DamageType,
  tags: string[] = [],
): ChampionBuild {
  const archetype = resolveArchetype(tags, damage);
  const cfg = CONFIGS[archetype];
  return {
    championId,
    championName,
    role,
    summonerSpells: cfg.summoners(role),
    runes: cfg.runes,
    startingItems: cfg.starting,
    coreItems: cfg.core,
    situationalItems: cfg.situational,
    skillOrder: cfg.skillOrder,
    source: 'archetype',
    patch: 'genérico',
    notes: `Build genérica por clase (${archetype.toLowerCase()}). Ajústala según la partida.`,
  };
}

/** Etiqueta legible en español para cada arquetipo (para las notas). */
const ARCHETYPE_LABEL: Record<BuildArchetype, string> = {
  MARKSMAN: 'tirador (crítico)',
  ONHIT_MARKSMAN: 'tirador (on-hit)',
  MAGE: 'mago de ráfaga',
  BATTLEMAGE: 'mago de combate',
  ARTILLERY: 'mago de artillería',
  AP_ONHIT: 'híbrido AP on-hit',
  ASSASSIN_AD: 'asesino AD',
  ASSASSIN_AP: 'asesino AP',
  TANK: 'tanque',
  FIGHTER: 'luchador',
  SKIRMISHER: 'duelista',
  ENCHANTER: 'encantador',
  SUPPORT_TANK: 'soporte tanque',
};

/**
 * Arma la build a partir de un arquetipo EXPLÍCITO (clasificación por campeón),
 * en vez de inferirlo de los tags. Permite dar a cada campeón la build de su
 * subclase real (p. ej. Kai'Sa on-hit, Vladimir mago de combate).
 */
export function buildFromArchetype(
  championId: number,
  championName: string,
  role: Role,
  archetype: BuildArchetype,
): ChampionBuild {
  const cfg = CONFIGS[archetype];
  return {
    championId,
    championName,
    role,
    summonerSpells: cfg.summoners(role),
    runes: cfg.runes,
    startingItems: cfg.starting,
    coreItems: cfg.core,
    situationalItems: cfg.situational,
    skillOrder: cfg.skillOrder,
    source: 'classified',
    patch: 'meta',
    notes: `Build de ${ARCHETYPE_LABEL[archetype]} para ${championName}.`,
  };
}

/**
 * Proveedor de builds genéricas usando los metadatos de ARAM (tipo de daño).
 * Cubre los campeones presentes en ese dataset curado.
 */
export class ArchetypeBuildProvider implements BuildProvider {
  readonly name = 'archetype';

  constructor(private readonly traits: ChampionTraitProvider) {}

  getBuild(championId: number, role: Role): ChampionBuild | null {
    const t = this.traits.get(championId);
    if (!t) return null;
    return buildGeneric(championId, t.name, role, t.damage);
  }
}

/**
 * Proveedor de builds genéricas por CLASE usando el catálogo de Data Dragon:
 * cubre a cualquier campeón (una vez cargado el catálogo) con una build adecuada
 * a su clase (marksman/mago/asesino/tanque/luchador/enchantador).
 */
export class CatalogArchetypeBuildProvider implements BuildProvider {
  readonly name = 'catalog-archetype';

  constructor(private readonly catalog: ChampionCatalog) {}

  getBuild(championId: number, role: Role): ChampionBuild | null {
    const meta = this.catalog.getMeta(championId);
    if (!meta) return null;
    return buildGeneric(championId, meta.name, role, meta.damage, meta.tags);
  }
}

/**
 * Último recurso: build genérica para CUALQUIER championId aunque no haya
 * metadatos ni catálogo cargado. Garantiza que nunca falte una build en partida.
 */
export class DefaultBuildProvider implements BuildProvider {
  readonly name = 'default';

  getBuild(championId: number, role: Role): ChampionBuild {
    return buildGeneric(championId, `Campeón ${championId}`, role, 'MIXED');
  }
}
