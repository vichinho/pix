import type { BuildProvider } from '../../domain/build.js';
import type { ChampionBuild, Role } from '../../domain/types.js';
import { ITEM } from './item-ids.js';

/**
 * Builds curadas como fuente local (fallback). Enfocadas en el pool del jugador
 * y en picks comunes. Son un punto de partida legible y ajustable: los ítems y
 * runas pueden variar por parche, y la idea es complementar/reemplazar esto con
 * un proveedor externo más adelante (op.gg/u.gg u otra fuente).
 *
 * `patch` se marca como "curado" para dejar claro que no viene de una fuente en
 * vivo. Cada build indica su rol principal; se sirve aunque el rol pedido no
 * coincida exactamente (muchos campeones tienen una build dominante).
 */
const PATCH = 'curado';

type SeedBuild = Omit<ChampionBuild, 'source' | 'patch'>;

const BUILDS: SeedBuild[] = [
  {
    championId: 101,
    championName: 'Xerath',
    role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: {
      primaryStyle: 'Brujería',
      keystone: 'Cometa Arcano',
      primary: ['Flujo de Maná', 'Trascendencia', 'Chamuscar'],
      secondaryStyle: 'Inspiración',
      secondary: ['Galleta Mágica', 'Perspicacia Cósmica'],
      shards: ['Aceleración de Habilidad', 'PA Adaptativo', 'Vida'],
    },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.HORIZON_FOCUS, ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF, ITEM.ZHONYAS_HOURGLASS],
    skillOrder: ['Q', 'W', 'E'],
    notes: 'Poke a distancia; maximiza Q y castea desde lejos.',
  },
  {
    championId: 134,
    championName: 'Syndra',
    role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: {
      primaryStyle: 'Brujería',
      keystone: 'Cometa Arcano',
      primary: ['Flujo de Maná', 'Trascendencia', 'Chamuscar'],
      secondaryStyle: 'Inspiración',
      secondary: ['Botas Mágicas', 'Perspicacia Cósmica'],
      shards: ['Aceleración de Habilidad', 'PA Adaptativo', 'Vida'],
    },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LUDENS_COMPANION, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.RABADONS_DEATHCAP, ITEM.ZHONYAS_HOURGLASS, ITEM.VOID_STAFF],
    skillOrder: ['Q', 'W', 'E'],
    notes: 'Sube stacks de Q; combo E+Q para burst.',
  },
  {
    championId: 950,
    championName: 'Naafiri',
    role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: {
      primaryStyle: 'Precisión',
      keystone: 'Conquistador',
      primary: ['Triunfo', 'Leyenda: Presteza', 'Último Aliento'],
      secondaryStyle: 'Dominación',
      secondary: ['Impacto Súbito', 'Cazador Voraz'],
      shards: ['AD Adaptativo', 'AD Adaptativo', 'Vida'],
    },
    startingItems: [ITEM.DORANS_BLADE, ITEM.HEALTH_POTION],
    coreItems: [ITEM.ECLIPSE, ITEM.IONIAN_BOOTS, ITEM.SERYLDAS_GRUDGE],
    situationalItems: [ITEM.EDGE_OF_NIGHT, ITEM.DEATHS_DANCE, ITEM.YOUMUUS_GHOSTBLADE],
    skillOrder: ['Q', 'E', 'W'],
    notes: 'Asesina con jauría; usa E para engage y R para pelear.',
  },
  {
    championId: 8,
    championName: 'Vladimir',
    role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: {
      primaryStyle: 'Brujería',
      keystone: 'Cometa Arcano',
      primary: ['Cadena de Maná (Banda)', 'Trascendencia', 'Ardor'],
      secondaryStyle: 'Precisión',
      secondary: ['Presencia de Ánimo', 'Golpe de Gracia'],
      shards: ['Aceleración de Habilidad', 'PA Adaptativo', 'Vida'],
    },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.RIFTMAKER, ITEM.SORCERERS_SHOES, ITEM.ZHONYAS_HOURGLASS],
    situationalItems: [ITEM.RABADONS_DEATHCAP, ITEM.COSMIC_DRIVE, ITEM.VOID_STAFF],
    skillOrder: ['Q', 'E', 'W'],
    notes: 'Escala fuerte; usa W (poza) para esquivar habilidades clave.',
  },
  {
    championId: 902,
    championName: 'Milio',
    role: 'UTILITY',
    summonerSpells: ['Flash', 'Ignite'],
    runes: {
      primaryStyle: 'Brujería',
      keystone: 'Aery Invocada',
      primary: ['Flujo de Maná', 'Trascendencia', 'Concentración Absoluta'],
      secondaryStyle: 'Inspiración',
      secondary: ['Obsequio Mágico', 'Perspicacia Cósmica'],
      shards: ['Aceleración de Habilidad', 'PA Adaptativo', 'Vida'],
    },
    startingItems: [ITEM.WORLD_ATLAS, ITEM.HEALTH_POTION],
    coreItems: [ITEM.MOONSTONE_RENEWER, ITEM.IONIAN_BOOTS, ITEM.STAFF_OF_FLOWING_WATER],
    situationalItems: [ITEM.ARDENT_CENSER, ITEM.REDEMPTION, ITEM.MIKAELS_BLESSING],
    skillOrder: ['Q', 'E', 'W'],
    notes: 'Enchantador de rango; escuda y cura, R limpia CC.',
  },
  {
    championId: 57,
    championName: 'Maokai',
    role: 'UTILITY',
    summonerSpells: ['Flash', 'Ignite'],
    runes: {
      primaryStyle: 'Resolución',
      keystone: 'Choque Posterior (Aftershock)',
      primary: ['Demolición', 'Segundo Aliento', 'Sonrisa Cadavérica'],
      secondaryStyle: 'Inspiración',
      secondary: ['Hechizo Fantasma', 'Perspicacia Cósmica'],
      shards: ['Aceleración de Habilidad', 'Vida', 'Vida'],
    },
    startingItems: [ITEM.WORLD_ATLAS, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LOCKET_SOLARI, ITEM.PLATED_STEELCAPS, ITEM.KNIGHTS_VOW],
    situationalItems: [ITEM.ZEKES_CONVERGENCE, ITEM.FROZEN_HEART, ITEM.SUNFIRE_AEGIS],
    skillOrder: ['Q', 'E', 'W'],
    notes: 'Engage con W; buen frontline y CC.',
  },
  {
    championId: 63,
    championName: 'Brand',
    role: 'MIDDLE',
    summonerSpells: ['Flash', 'Ignite'],
    runes: {
      primaryStyle: 'Brujería',
      keystone: 'Cometa Arcano',
      primary: ['Flujo de Maná', 'Trascendencia', 'Chamuscar'],
      secondaryStyle: 'Precisión',
      secondary: ['Presencia de Ánimo', 'Golpe de Gracia'],
      shards: ['Aceleración de Habilidad', 'PA Adaptativo', 'Vida'],
    },
    startingItems: [ITEM.DORANS_RING, ITEM.HEALTH_POTION],
    coreItems: [ITEM.LIANDRYS_TORMENT, ITEM.SORCERERS_SHOES, ITEM.SHADOWFLAME],
    situationalItems: [ITEM.RYLAIS_SCEPTER, ITEM.RABADONS_DEATHCAP, ITEM.VOID_STAFF],
    skillOrder: ['W', 'Q', 'E'],
    notes: 'Daño en área y quemadura; encadena pasiva para stun.',
  },
];

/** Proveedor de builds basado en la seed curada local. */
export class SeedBuildProvider implements BuildProvider {
  readonly name = 'curated';
  private readonly byChampion: Map<number, ChampionBuild>;

  constructor(builds: SeedBuild[] = BUILDS) {
    this.byChampion = new Map(
      builds.map((b) => [b.championId, { ...b, source: 'curated', patch: PATCH }]),
    );
  }

  getBuild(championId: number, _role: Role): ChampionBuild | null {
    const build = this.byChampion.get(championId);
    if (!build) return null;
    // Copia profunda para que quien consuma no mute la seed.
    return {
      ...build,
      summonerSpells: [...build.summonerSpells],
      runes: {
        ...build.runes,
        primary: [...build.runes.primary],
        secondary: [...build.runes.secondary],
        shards: [...build.runes.shards],
      },
      startingItems: [...build.startingItems],
      coreItems: [...build.coreItems],
      situationalItems: [...build.situationalItems],
      skillOrder: [...build.skillOrder],
    };
  }

  /** championIds cubiertos por la seed (útil para UI/depuración). */
  coveredChampionIds(): number[] {
    return [...this.byChampion.keys()];
  }
}
