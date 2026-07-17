/**
 * IDs de runas (perks), estilos y fragmentos de Data Dragon. Referenciar por ID
 * permite resolver icono y nombre desde runesReforged.json de forma fiable.
 */

export const STYLE = {
  PRECISION: 8000,
  DOMINATION: 8100,
  SORCERY: 8200,
  RESOLVE: 8400,
  INSPIRATION: 8300,
} as const;

export const KEYSTONE = {
  ARCANE_COMET: 8229,
  CONQUEROR: 8010,
  AFTERSHOCK: 8439,
  SUMMON_AERY: 8214,
  ELECTROCUTE: 8112,
  PRESS_THE_ATTACK: 8005,
  LETHAL_TEMPO: 8008,
  GRASP_OF_THE_UNDYING: 8437,
  FLEET_FOOTWORK: 8021,
  DARK_HARVEST: 8128,
} as const;

export const RUNE = {
  // Sorcery
  MANAFLOW_BAND: 8226,
  TRANSCENDENCE: 8210,
  SCORCH: 8237,
  GATHERING_STORM: 8236,
  ABSOLUTE_FOCUS: 8233,
  // Precision
  TRIUMPH: 9111,
  PRESENCE_OF_MIND: 8009,
  LEGEND_ALACRITY: 9104,
  COUP_DE_GRACE: 8014,
  LAST_STAND: 8299,
  // Domination
  SUDDEN_IMPACT: 8143,
  ULTIMATE_HUNTER: 8106,
  TREASURE_HUNTER: 8135,
  // Resolve
  FONT_OF_LIFE: 8463,
  BONE_PLATING: 8473,
  OVERGROWTH: 8451,
  SECOND_WIND: 8444,
  // Inspiration
  BISCUIT_DELIVERY: 8321,
  COSMIC_INSIGHT: 8347,
  MAGICAL_FOOTWEAR: 8304,
} as const;

/** Fragmentos (stat shards). Uno por fila (ofensivo / flexible / defensivo). */
export const SHARD = {
  ADAPTIVE: 5008,
  ATTACK_SPEED: 5005,
  ABILITY_HASTE: 5007,
  MOVE_SPEED: 5010,
  HEALTH_SCALING: 5001,
  HEALTH: 5011,
  TENACITY: 5013,
  ARMOR: 5002,
  MAGIC_RES: 5003,
} as const;

/** Metadatos de fragmentos: nombre e icono (no vienen en runesReforged.json). */
export const SHARD_META: Record<number, { name: string; file: string }> = {
  5008: { name: 'Fuerza Adaptativa', file: 'StatModsAdaptiveForceIcon.png' },
  5005: { name: 'Velocidad de Ataque', file: 'StatModsAttackSpeedIcon.png' },
  5007: { name: 'Aceleración de Habilidad', file: 'StatModsCDRScalingIcon.png' },
  5010: { name: 'Velocidad de Movimiento', file: 'StatModsMovementSpeedIcon.png' },
  5001: { name: 'Vida (escalable)', file: 'StatModsHealthScalingIcon.png' },
  5011: { name: 'Vida', file: 'StatModsHealthPlusIcon.png' },
  5013: { name: 'Tenacidad', file: 'StatModsTenacityIcon.png' },
  5002: { name: 'Armadura', file: 'StatModsArmorIcon.png' },
  5003: { name: 'Resistencia Mágica', file: 'StatModsMagicResIcon.png' },
};
