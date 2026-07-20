import type { BuildProvider } from '../../domain/build.js';
import type { ChampionBuild, Role } from '../../domain/types.js';
import { ITEM } from './item-ids.js';
import { STYLE, KEYSTONE, RUNE, SHARD } from './rune-ids.js';

const PATCH = 'curado';

type SeedBuild = Omit<ChampionBuild, 'source' | 'patch'>;

const BUILDS: SeedBuild[] = [
  // ─── Modos normales ─────────────────────────────────────────────────────────
  {
    championId: 101, championName: 'Xerath', role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.HORIZON_FOCUS, ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF, ITEM.ZHONYAS_HOURGLASS],
    skillOrder: ['Q', 'W', 'E'],
    notes: 'Poke a distancia; maximiza Q y castea desde lejos.',
  },
  {
    championId: 134, championName: 'Syndra', role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.MAGICAL_FOOTWEAR, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.RABADONS_DEATHCAP, ITEM.ZHONYAS_HOURGLASS, ITEM.VOID_STAFF],
    skillOrder: ['Q', 'W', 'E'], notes: 'Sube stacks de Q; combo E+Q para burst.',
  },
  {
    championId: 950, championName: 'Naafiri', role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.PRECISION, keystoneId: KEYSTONE.CONQUEROR, primary: [RUNE.TRIUMPH, RUNE.LEGEND_ALACRITY, RUNE.LAST_STAND], secondaryStyleId: STYLE.DOMINATION, secondary: [RUNE.SUDDEN_IMPACT, RUNE.ULTIMATE_HUNTER], shards: [SHARD.ADAPTIVE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.ECLIPSE, ITEM.IONIAN_BOOTS, ITEM.SERYLDAS_GRUDGE],
    situationalItems: [ITEM.EDGE_OF_NIGHT, ITEM.DEATHS_DANCE, ITEM.YOUMUUS_GHOSTBLADE],
    skillOrder: ['Q', 'E', 'W'], notes: 'Asesina con jauría; usa E para engage y R para pelear.',
  },
  {
    championId: 8, championName: 'Vladimir', role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH], secondaryStyleId: STYLE.PRECISION, secondary: [RUNE.PRESENCE_OF_MIND, RUNE.COUP_DE_GRACE], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.RIFTMAKER, ITEM.SORCERERS_SHOES, ITEM.ZHONYAS_HOURGLASS],
    situationalItems: [ITEM.RABADONS_DEATHCAP, ITEM.COSMIC_DRIVE, ITEM.VOID_STAFF],
    skillOrder: ['Q', 'E', 'W'], notes: 'Escala fuerte; usa W (poza) para esquivar habilidades clave.',
  },
  {
    championId: 902, championName: 'Milio', role: 'UTILITY',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.SUMMON_AERY, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.MAGICAL_FOOTWEAR, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.WORLD_ATLAS, ITEM.HEALTH_POTION],
    coreItems: [ITEM.MOONSTONE_RENEWER, ITEM.IONIAN_BOOTS, ITEM.STAFF_OF_FLOWING_WATER],
    situationalItems: [ITEM.ARDENT_CENSER, ITEM.REDEMPTION, ITEM.MIKAELS_BLESSING],
    skillOrder: ['Q', 'E', 'W'], notes: 'Enchantador de rango; escuda y cura, R limpia CC.',
  },
  {
    championId: 57, championName: 'Maokai', role: 'UTILITY',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.RESOLVE, keystoneId: KEYSTONE.AFTERSHOCK, primary: [RUNE.FONT_OF_LIFE, RUNE.BONE_PLATING, RUNE.OVERGROWTH], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.MAGICAL_FOOTWEAR, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.HEALTH_SCALING, SHARD.HEALTH] },
    startingItems: [ITEM.WORLD_ATLAS, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LOCKET_SOLARI, ITEM.PLATED_STEELCAPS, ITEM.KNIGHTS_VOW],
    situationalItems: [ITEM.ZEKES_CONVERGENCE, ITEM.FROZEN_HEART, ITEM.SUNFIRE_AEGIS],
    skillOrder: ['Q', 'E', 'W'], notes: 'Engage con W; buen frontline y CC.',
  },
  {
    championId: 63, championName: 'Brand', role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH], secondaryStyleId: STYLE.PRECISION, secondary: [RUNE.PRESENCE_OF_MIND, RUNE.COUP_DE_GRACE], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LIANDRYS_TORMENT, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.RYLAIS_SCEPTER, ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF],
    skillOrder: ['W', 'Q', 'E'], notes: 'Daño en área y quemadura; encadena pasiva para stun.',
  },

  // ─── ARAM ────────────────────────────────────────────────────────────────────
  {
    championId: 29, championName: 'Twitch', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.DOMINATION, keystoneId: KEYSTONE.ELECTROCUTE, primary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER, RUNE.ULTIMATE_HUNTER], secondaryStyleId: STYLE.PRECISION, secondary: [RUNE.PRESENCE_OF_MIND, RUNE.COUP_DE_GRACE], shards: [SHARD.ATTACK_SPEED, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.KRAKEN_SLAYER, ITEM.BERSERKERS_GREAVES, ITEM.RUNAANS_HURRICANE],
    situationalItems: [ITEM.GUINSOOS_RAGEBLADE, ITEM.INFINITY_EDGE, ITEM.IMMORTAL_SHIELDBOW, ITEM.VOID_STAFF],
    skillOrder: ['Q', 'E', 'W'],
    notes: 'ARAM: usa Q para flanquear y activar Electrocute + Runaan\'s en peleas teamfight. E lleva la mayor parte del daño; maximiza primero.',
  },
  {
    championId: 99, championName: 'Lux', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.HORIZON_FOCUS, ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF, ITEM.ZHONYAS_HOURGLASS],
    skillOrder: ['E', 'Q', 'W'], notes: 'ARAM: poke con E y Q; R para ejecutar. Prioriza E para el escudo.',
  },
  {
    championId: 22, championName: 'Ashe', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.PRECISION, keystoneId: KEYSTONE.CONQUEROR, primary: [RUNE.TRIUMPH, RUNE.LEGEND_ALACRITY, RUNE.LAST_STAND], secondaryStyleId: STYLE.DOMINATION, secondary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER], shards: [SHARD.ATTACK_SPEED, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.KRAKEN_SLAYER, ITEM.BERSERKERS_GREAVES, ITEM.RUNAANS_HURRICANE],
    situationalItems: [ITEM.IMMORTAL_SHIELDBOW, ITEM.INFINITY_EDGE, ITEM.RFC],
    skillOrder: ['W', 'Q', 'E'], notes: 'ARAM: Runaan\'s aplica slow en área; R como peel o inicio de peleas.',
  },
  {
    championId: 222, championName: 'Jinx', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.PRECISION, keystoneId: KEYSTONE.CONQUEROR, primary: [RUNE.TRIUMPH, RUNE.LEGEND_ALACRITY, RUNE.LAST_STAND], secondaryStyleId: STYLE.DOMINATION, secondary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER], shards: [SHARD.ATTACK_SPEED, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.KRAKEN_SLAYER, ITEM.BERSERKERS_GREAVES, ITEM.RUNAANS_HURRICANE],
    situationalItems: [ITEM.IMMORTAL_SHIELDBOW, ITEM.INFINITY_EDGE, ITEM.GALEFORCE],
    skillOrder: ['Q', 'W', 'E'], notes: 'ARAM: muy fuerte en late; Q (minigun) en peleas cortas, cohetes para poke.',
  },
  {
    championId: 115, championName: 'Ziggs', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LIANDRYS_TORMENT, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.HORIZON_FOCUS, ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF],
    skillOrder: ['Q', 'W', 'E'], notes: 'ARAM: demoledor de torres y poke constante; W para escapar, E para zona.',
  },
  {
    championId: 37, championName: 'Sona', role: 'ARAM',
    summonerSpells: ['Flash', 'Clarity'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.MOONSTONE_RENEWER, ITEM.IONIAN_BOOTS, ITEM.STAFF_OF_FLOWING_WATER],
    situationalItems: [ITEM.ARDENT_CENSER, ITEM.SHURELYAS_BATTLESONG, ITEM.REDEMPTION],
    skillOrder: ['Q', 'W', 'E'], notes: 'ARAM: Clarity por alto consumo de maná; alterna Q/W según necesidad.',
  },
  {
    championId: 45, championName: 'Veigar', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.RABADONS_DEATHCAP],
    situationalItems: [ITEM.HORIZON_FOCUS, ITEM.SHADOWFLAME, ITEM.VOID_STAFF, ITEM.ZHONYAS_HOURGLASS],
    skillOrder: ['Q', 'W', 'E'], notes: 'ARAM: ideal para acumular AP con Q; jaula (E) es muy poderosa en pasillo único.',
  },
  {
    championId: 51, championName: 'Caitlyn', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.PRECISION, keystoneId: KEYSTONE.CONQUEROR, primary: [RUNE.TRIUMPH, RUNE.LEGEND_ALACRITY, RUNE.COUP_DE_GRACE], secondaryStyleId: STYLE.DOMINATION, secondary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER], shards: [SHARD.ATTACK_SPEED, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.GALEFORCE, ITEM.BERSERKERS_GREAVES, ITEM.RFC],
    situationalItems: [ITEM.INFINITY_EDGE, ITEM.IMMORTAL_SHIELDBOW, ITEM.KRAKEN_SLAYER],
    skillOrder: ['Q', 'E', 'W'], notes: 'ARAM: mayor rango base del juego; Q para poke, trampas bajo torres.',
  },
  {
    championId: 74, championName: 'Heimerdinger', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.NASHOR_TOOTH, ITEM.SORCERERS_SHOES, ITEM.DEMONIC_EMBRACE],
    situationalItems: [ITEM.RIFTMAKER, ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF, ITEM.ZHONYAS_HOURGLASS],
    skillOrder: ['Q', 'W', 'E'], notes: 'ARAM: torretas en zonas clave; R+W para burst instantáneo.',
  },
  {
    championId: 147, championName: 'Seraphine', role: 'ARAM',
    summonerSpells: ['Flash', 'Clarity'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.MOONSTONE_RENEWER, ITEM.SORCERERS_SHOES, ITEM.STAFF_OF_FLOWING_WATER],
    situationalItems: [ITEM.ARDENT_CENSER, ITEM.IMPERIAL_MANDATE, ITEM.REDEMPTION, ITEM.SHADOWFLAME],
    skillOrder: ['Q', 'E', 'W'], notes: 'ARAM: híbrido AP/enchanter; Q para poke, W para curar, R para CC masivo.',
  },
  {
    championId: 21, championName: 'Miss Fortune', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.DOMINATION, keystoneId: KEYSTONE.ELECTROCUTE, primary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER, RUNE.ULTIMATE_HUNTER], secondaryStyleId: STYLE.PRECISION, secondary: [RUNE.PRESENCE_OF_MIND, RUNE.COUP_DE_GRACE], shards: [SHARD.ADAPTIVE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF, ITEM.ZHONYAS_HOURGLASS],
    skillOrder: ['Q', 'W', 'E'], notes: 'ARAM: build AP para maximizar R (Bullet Time) en pasillo único.',
  },
  {
    championId: 63, championName: 'Brand', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH], secondaryStyleId: STYLE.PRECISION, secondary: [RUNE.PRESENCE_OF_MIND, RUNE.COUP_DE_GRACE], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LIANDRYS_TORMENT, ITEM.SORCERERS_SHOES, ITEM.RYLAIS_SCEPTER],
    situationalItems: [ITEM.SHADOWFLAME, ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF],
    skillOrder: ['W', 'Q', 'E'], notes: 'ARAM: Rylai\'s ralentiza con cada tick de daño; combo pasiva + E+W+Q.',
  },
  {
    championId: 30, championName: 'Karthus', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], secondaryStyleId: STYLE.DOMINATION, secondary: [RUNE.SUDDEN_IMPACT, RUNE.ULTIMATE_HUNTER], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LIANDRYS_TORMENT, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF, ITEM.RYLAIS_SCEPTER],
    skillOrder: ['Q', 'E', 'W'], notes: 'ARAM: Spam Q (Lay Waste) continuamente; R puede ganar peleas globalmente incluso muerto.',
  },
  {
    championId: 161, championName: "Vel'Koz", role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.HORIZON_FOCUS, ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF],
    skillOrder: ['Q', 'W', 'E'], notes: 'ARAM: Q para poke, W para zona, E para CC; R con true damage devastador en pasillo.',
  },
  {
    championId: 110, championName: 'Varus', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH], secondaryStyleId: STYLE.PRECISION, secondary: [RUNE.PRESENCE_OF_MIND, RUNE.COUP_DE_GRACE], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.HORIZON_FOCUS, ITEM.LIANDRYS_TORMENT, ITEM.VOID_STAFF],
    skillOrder: ['Q', 'W', 'E'], notes: 'ARAM: build AP para explotar stacks de Corruption (W); R inmoviliza a todo el equipo enemigo.',
  },
  {
    championId: 202, championName: 'Jhin', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.DOMINATION, keystoneId: KEYSTONE.ELECTROCUTE, primary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER, RUNE.ULTIMATE_HUNTER], secondaryStyleId: STYLE.PRECISION, secondary: [RUNE.PRESENCE_OF_MIND, RUNE.COUP_DE_GRACE], shards: [SHARD.ADAPTIVE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.GALEFORCE, ITEM.BERSERKERS_GREAVES, ITEM.INFINITY_EDGE],
    situationalItems: [ITEM.SHADOWFLAME, ITEM.RFC, ITEM.KRAKEN_SLAYER],
    skillOrder: ['Q', 'W', 'E'], notes: 'ARAM: 4.ª bala + trampas (E) = zona de control; R para remates de larga distancia.',
  },
  {
    championId: 81, championName: 'Ezreal', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], secondaryStyleId: STYLE.PRECISION, secondary: [RUNE.PRESENCE_OF_MIND, RUNE.COUP_DE_GRACE], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LUDENS_COMPANION, ITEM.IONIAN_BOOTS, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.HORIZON_FOCUS, ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF],
    skillOrder: ['Q', 'W', 'E'], notes: 'ARAM: build AP Ezreal; Q con pasiva de Luden\'s hace mucho daño en late; usa E para esquivar.',
  },
  {
    championId: 54, championName: 'Malphite', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], secondaryStyleId: STYLE.RESOLVE, secondary: [RUNE.BONE_PLATING, RUNE.OVERGROWTH], shards: [SHARD.ABILITY_HASTE, SHARD.HEALTH_SCALING, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.RIFTMAKER, ITEM.SORCERERS_SHOES, ITEM.DEMONIC_EMBRACE],
    situationalItems: [ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF, ITEM.ZHONYAS_HOURGLASS, ITEM.WARMOGS_ARMOR],
    skillOrder: ['E', 'W', 'Q'], notes: 'ARAM: build AP para explotar el alto ratio de R (Unstoppable Force); tankea por su pasiva.',
  },
  {
    championId: 32, championName: 'Amumu', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.RESOLVE, keystoneId: KEYSTONE.AFTERSHOCK, primary: [RUNE.FONT_OF_LIFE, RUNE.BONE_PLATING, RUNE.OVERGROWTH], secondaryStyleId: STYLE.SORCERY, secondary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE], shards: [SHARD.ABILITY_HASTE, SHARD.HEALTH_SCALING, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.SUNFIRE_AEGIS, ITEM.PLATED_STEELCAPS, ITEM.DEMONIC_EMBRACE],
    situationalItems: [ITEM.FROZEN_HEART, ITEM.FORCE_OF_NATURE, ITEM.WARMOGS_ARMOR],
    skillOrder: ['E', 'Q', 'W'], notes: 'ARAM: buen engage con Q (Bandage Toss); R inmoviliza al equipo entero. Engages repetidos con CDR.',
  },
  {
    championId: 90, championName: 'Malzahar', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LIANDRYS_TORMENT, ITEM.SORCERERS_SHOES, ITEM.DEMONIC_EMBRACE],
    situationalItems: [ITEM.RYLAIS_SCEPTER, ITEM.VOID_STAFF, ITEM.RABADONS_DEATHCAP],
    skillOrder: ['E', 'Q', 'W'], notes: 'ARAM: E (Malefic Visions) rebota entre enemigos apilados; R suprime a un objetivo.',
  },
  {
    championId: 16, championName: 'Soraka', role: 'ARAM',
    summonerSpells: ['Flash', 'Clarity'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.SUMMON_AERY, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.MOONSTONE_RENEWER, ITEM.IONIAN_BOOTS, ITEM.STAFF_OF_FLOWING_WATER],
    situationalItems: [ITEM.ARDENT_CENSER, ITEM.REDEMPTION, ITEM.MIKAELS_BLESSING],
    skillOrder: ['Q', 'E', 'W'], notes: 'ARAM: curación masiva sostenida; Clarity para no quedarte sin maná. R global salva peleas a distancia.',
  },
  {
    championId: 267, championName: 'Nami', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.SUMMON_AERY, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.MOONSTONE_RENEWER, ITEM.IONIAN_BOOTS, ITEM.IMPERIAL_MANDATE],
    situationalItems: [ITEM.STAFF_OF_FLOWING_WATER, ITEM.ARDENT_CENSER, ITEM.REDEMPTION],
    skillOrder: ['W', 'Q', 'E'], notes: 'ARAM: W rebota curando y dañando; Q (burbuja) tiene CC largo. R (Tidal Wave) desplaza a todo el equipo.',
  },
  {
    championId: 25, championName: 'Morgana', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.ARCANE_COMET, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LIANDRYS_TORMENT, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.RYLAIS_SCEPTER, ITEM.VOID_STAFF, ITEM.RABADONS_DEATHCAP],
    skillOrder: ['W', 'Q', 'E'], notes: 'ARAM: W (Black Shield) protege de CC; Q con 3 s de raíz es muy fuerte en pasillo sin escape.',
  },
  {
    championId: 117, championName: 'Lulu', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.SUMMON_AERY, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.MOONSTONE_RENEWER, ITEM.IONIAN_BOOTS, ITEM.ARDENT_CENSER],
    situationalItems: [ITEM.STAFF_OF_FLOWING_WATER, ITEM.REDEMPTION, ITEM.SHADOWFLAME],
    skillOrder: ['E', 'Q', 'W'], notes: 'ARAM: R + W en un carry = tanque instantáneo; E acelera y escuda; Q polimorfo para peel.',
  },
  {
    championId: 43, championName: 'Karma', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.SORCERY, keystoneId: KEYSTONE.SUMMON_AERY, primary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE, RUNE.SCORCH], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.BISCUIT_DELIVERY, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.MOONSTONE_RENEWER, ITEM.IONIAN_BOOTS, ITEM.STAFF_OF_FLOWING_WATER],
    situationalItems: [ITEM.IMPERIAL_MANDATE, ITEM.ARDENT_CENSER, ITEM.SHADOWFLAME],
    skillOrder: ['Q', 'E', 'W'], notes: 'ARAM: RQ para poke de larga distancia; RE da escudo + velocidad al equipo en teamfight.',
  },
  {
    championId: 82, championName: 'Mordekaiser', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.DOMINATION, keystoneId: KEYSTONE.ELECTROCUTE, primary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER, RUNE.ULTIMATE_HUNTER], secondaryStyleId: STYLE.SORCERY, secondary: [RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], shards: [SHARD.ADAPTIVE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.RIFTMAKER, ITEM.PLATED_STEELCAPS, ITEM.DEMONIC_EMBRACE],
    situationalItems: [ITEM.RYLAIS_SCEPTER, ITEM.FORCE_OF_NATURE, ITEM.RABADONS_DEATHCAP],
    skillOrder: ['E', 'Q', 'W'], notes: 'ARAM: muy difícil de matar; R mete al enemigo en un 1v1 donde tus escudos son aún más grandes.',
  },
  {
    championId: 14, championName: 'Sion', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.RESOLVE, keystoneId: KEYSTONE.AFTERSHOCK, primary: [RUNE.FONT_OF_LIFE, RUNE.BONE_PLATING, RUNE.OVERGROWTH], secondaryStyleId: STYLE.SORCERY, secondary: [RUNE.MANAFLOW_BAND, RUNE.TRANSCENDENCE], shards: [SHARD.ABILITY_HASTE, SHARD.HEALTH_SCALING, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_SHIELD, ITEM.HEALTH_POTION],
    coreItems: [ITEM.HEARTSTEEL, ITEM.PLATED_STEELCAPS, ITEM.SUNFIRE_AEGIS],
    situationalItems: [ITEM.WARMOGS_ARMOR, ITEM.FROZEN_HEART, ITEM.GARGOYLE_STONEPLATE],
    skillOrder: ['W', 'Q', 'E'], notes: 'ARAM: W acumula HP permanente; Q con carga completa aplasta peleas. Pasiva puede ganar peleas incluso muerto.',
  },
  {
    championId: 55, championName: 'Katarina', role: 'ARAM',
    summonerSpells: ['Flash', 'Mark'],
    runes: { primaryStyleId: STYLE.DOMINATION, keystoneId: KEYSTONE.ELECTROCUTE, primary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER, RUNE.ULTIMATE_HUNTER], secondaryStyleId: STYLE.SORCERY, secondary: [RUNE.TRANSCENDENCE, RUNE.GATHERING_STORM], shards: [SHARD.ADAPTIVE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.SHADOWFLAME, ITEM.SORCERERS_SHOES, ITEM.RABADONS_DEATHCAP],
    situationalItems: [ITEM.ZHONYAS_HOURGLASS, ITEM.VOID_STAFF, ITEM.COSMIC_DRIVE],
    skillOrder: ['E', 'Q', 'W'], notes: 'ARAM: resetea con cada kill; usa E para recoger dagas y rotar. R en medio del equipo es letal.',
  },

  // ─── Grieta — populares (por rol) ────────────────────────────────────────────
  {
    championId: 103, championName: 'Ahri', role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.DOMINATION, keystoneId: KEYSTONE.ELECTROCUTE, primary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER, RUNE.ULTIMATE_HUNTER], secondaryStyleId: STYLE.SORCERY, secondary: [RUNE.TRANSCENDENCE, RUNE.SCORCH], shards: [SHARD.ABILITY_HASTE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF, ITEM.ZHONYAS_HOURGLASS, ITEM.HORIZON_FOCUS],
    skillOrder: ['Q', 'W', 'E'], notes: 'Movilidad con R para asesinar y escapar; usa el encanto (E) antes del combo Q+W.',
  },
  {
    championId: 238, championName: 'Zed', role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.DOMINATION, keystoneId: KEYSTONE.ELECTROCUTE, primary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER, RUNE.ULTIMATE_HUNTER], secondaryStyleId: STYLE.PRECISION, secondary: [RUNE.TRIUMPH, RUNE.COUP_DE_GRACE], shards: [SHARD.ADAPTIVE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.ECLIPSE, ITEM.IONIAN_BOOTS, ITEM.YOUMUUS_GHOSTBLADE],
    situationalItems: [ITEM.SERYLDAS_GRUDGE, ITEM.EDGE_OF_NIGHT, ITEM.DEATHS_DANCE, ITEM.GUARDIAN_ANGEL],
    skillOrder: ['Q', 'E', 'W'], notes: 'Sombras (W) para poke con Q; guarda R para asesinar al carry enemigo.',
  },
  {
    championId: 157, championName: 'Yasuo', role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.PRECISION, keystoneId: KEYSTONE.LETHAL_TEMPO, primary: [RUNE.TRIUMPH, RUNE.LEGEND_ALACRITY, RUNE.LAST_STAND], secondaryStyleId: STYLE.RESOLVE, secondary: [RUNE.SECOND_WIND, RUNE.BONE_PLATING], shards: [SHARD.ATTACK_SPEED, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.IMMORTAL_SHIELDBOW, ITEM.BERSERKERS_GREAVES, ITEM.INFINITY_EDGE],
    situationalItems: [ITEM.BLOODTHIRSTER, ITEM.DEATHS_DANCE, ITEM.GUARDIAN_ANGEL, ITEM.PHANTOM_DANCER],
    skillOrder: ['Q', 'E', 'W'], notes: 'Sube Q para el tornado; usa E para moverte entre súbditos. R tras un caballero (knock-up).',
  },
  {
    championId: 777, championName: 'Yone', role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.PRECISION, keystoneId: KEYSTONE.LETHAL_TEMPO, primary: [RUNE.TRIUMPH, RUNE.LEGEND_ALACRITY, RUNE.LAST_STAND], secondaryStyleId: STYLE.RESOLVE, secondary: [RUNE.SECOND_WIND, RUNE.BONE_PLATING], shards: [SHARD.ATTACK_SPEED, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.IMMORTAL_SHIELDBOW, ITEM.BERSERKERS_GREAVES, ITEM.INFINITY_EDGE],
    situationalItems: [ITEM.BLOODTHIRSTER, ITEM.DEATHS_DANCE, ITEM.GUARDIAN_ANGEL, ITEM.PHANTOM_DANCER],
    skillOrder: ['Q', 'E', 'W'], notes: 'Acumula Q para el 3.º golpe con empuje; usa R para engage o para volver a tu cuerpo con W.',
  },
  {
    championId: 145, championName: "Kai'Sa", role: 'BOTTOM',
    summonerSpells: ['Flash', 'Curación'],
    runes: { primaryStyleId: STYLE.PRECISION, keystoneId: KEYSTONE.PRESS_THE_ATTACK, primary: [RUNE.PRESENCE_OF_MIND, RUNE.LEGEND_ALACRITY, RUNE.COUP_DE_GRACE], secondaryStyleId: STYLE.DOMINATION, secondary: [RUNE.SUDDEN_IMPACT, RUNE.TREASURE_HUNTER], shards: [SHARD.ATTACK_SPEED, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.KRAKEN_SLAYER, ITEM.BERSERKERS_GREAVES, ITEM.RUNAANS_HURRICANE],
    situationalItems: [ITEM.INFINITY_EDGE, ITEM.GUINSOOS_RAGEBLADE, ITEM.BLOODTHIRSTER, ITEM.GUARDIAN_ANGEL],
    skillOrder: ['Q', 'W', 'E'], notes: 'Evoluciona Q primero; usa R para saltar al objetivo marcado por tu pasiva.',
  },
  {
    championId: 412, championName: 'Thresh', role: 'UTILITY',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.RESOLVE, keystoneId: KEYSTONE.AFTERSHOCK, primary: [RUNE.FONT_OF_LIFE, RUNE.BONE_PLATING, RUNE.OVERGROWTH], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.MAGICAL_FOOTWEAR, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.HEALTH_SCALING, SHARD.HEALTH] },
    startingItems: [ITEM.WORLD_ATLAS, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LOCKET_SOLARI, ITEM.PLATED_STEELCAPS, ITEM.KNIGHTS_VOW],
    situationalItems: [ITEM.ZEKES_CONVERGENCE, ITEM.REDEMPTION, ITEM.THORNMAIL, ITEM.KAENIC_ROOKERN],
    skillOrder: ['Q', 'E', 'W'], notes: 'Gancho (Q) para iniciar; linterna (W) salva aliados. Prioriza Q para más daño y rango.',
  },
  {
    championId: 89, championName: 'Leona', role: 'UTILITY',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.RESOLVE, keystoneId: KEYSTONE.AFTERSHOCK, primary: [RUNE.FONT_OF_LIFE, RUNE.BONE_PLATING, RUNE.OVERGROWTH], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.MAGICAL_FOOTWEAR, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.HEALTH_SCALING, SHARD.HEALTH] },
    startingItems: [ITEM.WORLD_ATLAS, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LOCKET_SOLARI, ITEM.PLATED_STEELCAPS, ITEM.KNIGHTS_VOW],
    situationalItems: [ITEM.ZEKES_CONVERGENCE, ITEM.THORNMAIL, ITEM.FROZEN_HEART, ITEM.KAENIC_ROOKERN],
    skillOrder: ['E', 'W', 'Q'], notes: 'Engage con E; encadena Q (stun) + R. Aguanta con Aftershock al iniciar.',
  },
  {
    championId: 111, championName: 'Nautilus', role: 'UTILITY',
    summonerSpells: ['Flash', 'Ignite'],
    runes: { primaryStyleId: STYLE.RESOLVE, keystoneId: KEYSTONE.AFTERSHOCK, primary: [RUNE.FONT_OF_LIFE, RUNE.BONE_PLATING, RUNE.OVERGROWTH], secondaryStyleId: STYLE.INSPIRATION, secondary: [RUNE.MAGICAL_FOOTWEAR, RUNE.COSMIC_INSIGHT], shards: [SHARD.ABILITY_HASTE, SHARD.HEALTH_SCALING, SHARD.HEALTH] },
    startingItems: [ITEM.WORLD_ATLAS, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LOCKET_SOLARI, ITEM.PLATED_STEELCAPS, ITEM.KNIGHTS_VOW],
    situationalItems: [ITEM.ZEKES_CONVERGENCE, ITEM.THORNMAIL, ITEM.FROZEN_HEART, ITEM.GARGOYLE_STONEPLATE],
    skillOrder: ['Q', 'W', 'E'], notes: 'Gancho (Q) para iniciar; R bloquea al carry enemigo. Pasiva raíz encadena CC.',
  },
  {
    championId: 122, championName: 'Darius', role: 'TOP',
    summonerSpells: ['Flash', 'Teletransporte'],
    runes: { primaryStyleId: STYLE.PRECISION, keystoneId: KEYSTONE.CONQUEROR, primary: [RUNE.TRIUMPH, RUNE.LEGEND_ALACRITY, RUNE.LAST_STAND], secondaryStyleId: STYLE.RESOLVE, secondary: [RUNE.SECOND_WIND, RUNE.OVERGROWTH], shards: [SHARD.ADAPTIVE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.TRINITY_FORCE, ITEM.PLATED_STEELCAPS, ITEM.STERAKS_GAGE],
    situationalItems: [ITEM.DEATHS_DANCE, ITEM.BLACK_CLEAVER, ITEM.SPIRIT_VISAGE, ITEM.GUARDIAN_ANGEL],
    skillOrder: ['Q', 'W', 'E'], notes: 'Golpea con el borde exterior de Q para curarte; apila la pasiva y remata con R.',
  },
  {
    championId: 86, championName: 'Garen', role: 'TOP',
    summonerSpells: ['Flash', 'Teletransporte'],
    runes: { primaryStyleId: STYLE.PRECISION, keystoneId: KEYSTONE.CONQUEROR, primary: [RUNE.TRIUMPH, RUNE.LEGEND_ALACRITY, RUNE.LAST_STAND], secondaryStyleId: STYLE.RESOLVE, secondary: [RUNE.SECOND_WIND, RUNE.OVERGROWTH], shards: [SHARD.ADAPTIVE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.TRINITY_FORCE, ITEM.PLATED_STEELCAPS, ITEM.STERAKS_GAGE],
    situationalItems: [ITEM.DEATHS_DANCE, ITEM.FORCE_OF_NATURE, ITEM.THORNMAIL, ITEM.GUARDIAN_ANGEL],
    skillOrder: ['Q', 'E', 'W'], notes: 'Q para acelerar y silenciar; E para farmear y pelear. R ejecuta objetivos con poca vida.',
  },
  {
    championId: 266, championName: 'Aatrox', role: 'TOP',
    summonerSpells: ['Flash', 'Teletransporte'],
    runes: { primaryStyleId: STYLE.PRECISION, keystoneId: KEYSTONE.CONQUEROR, primary: [RUNE.TRIUMPH, RUNE.LEGEND_ALACRITY, RUNE.LAST_STAND], secondaryStyleId: STYLE.RESOLVE, secondary: [RUNE.SECOND_WIND, RUNE.OVERGROWTH], shards: [SHARD.ADAPTIVE, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.ECLIPSE, ITEM.PLATED_STEELCAPS, ITEM.STERAKS_GAGE],
    situationalItems: [ITEM.DEATHS_DANCE, ITEM.BLACK_CLEAVER, ITEM.SPIRIT_VISAGE, ITEM.GUARDIAN_ANGEL],
    skillOrder: ['Q', 'E', 'W'], notes: 'Acierta el tercer Q (centro) para máximo daño; usa W para atraer y E para reposicionar.',
  },
  {
    championId: 114, championName: 'Fiora', role: 'TOP',
    summonerSpells: ['Flash', 'Teletransporte'],
    runes: { primaryStyleId: STYLE.PRECISION, keystoneId: KEYSTONE.CONQUEROR, primary: [RUNE.TRIUMPH, RUNE.LEGEND_ALACRITY, RUNE.LAST_STAND], secondaryStyleId: STYLE.RESOLVE, secondary: [RUNE.SECOND_WIND, RUNE.OVERGROWTH], shards: [SHARD.ATTACK_SPEED, SHARD.ADAPTIVE, SHARD.HEALTH] },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.TRINITY_FORCE, ITEM.PLATED_STEELCAPS, ITEM.STERAKS_GAGE],
    situationalItems: [ITEM.DEATHS_DANCE, ITEM.SPIRIT_VISAGE, ITEM.GUARDIAN_ANGEL, ITEM.BLADE_OF_THE_RUINED_KING],
    skillOrder: ['Q', 'E', 'W'], notes: 'Usa Q para golpear los pétalos vitales; W bloquea una habilidad clave del rival.',
  },
];

/**
 * El proveedor prioriza la build con role='ARAM' si existe para ese campeón;
 * si no, devuelve la build normal. Esto evita que ARAM muestre builds de línea.
 */
export class SeedBuildProvider implements BuildProvider {
  readonly name = 'curated';
  private readonly byChampion: Map<number, ChampionBuild>;
  private readonly byChampionAram: Map<number, ChampionBuild>;

  constructor(builds: SeedBuild[] = BUILDS) {
    this.byChampion     = new Map();
    this.byChampionAram = new Map();
    for (const b of builds) {
      const full: ChampionBuild = { ...b, source: 'curated', patch: PATCH };
      if (b.role === 'ARAM') {
        this.byChampionAram.set(b.championId, full);
      } else {
        this.byChampion.set(b.championId, full);
      }
    }
  }

  getBuild(championId: number, role: Role): ChampionBuild | null {
    const isAram = role === 'ARAM';
    const src = isAram
      ? (this.byChampionAram.get(championId) ?? this.byChampion.get(championId))
      : (this.byChampion.get(championId) ?? this.byChampionAram.get(championId));
    if (!src) return null;
    return {
      ...src,
      summonerSpells: [...src.summonerSpells],
      runes: { ...src.runes, primary: [...src.runes.primary], secondary: [...src.runes.secondary], shards: [...src.runes.shards] },
      startingItems: [...src.startingItems],
      coreItems: [...src.coreItems],
      situationalItems: [...src.situationalItems],
      skillOrder: [...src.skillOrder],
    };
  }

  coveredChampionIds(): number[] {
    return [...new Set([...this.byChampion.keys(), ...this.byChampionAram.keys()])];
  }
}
