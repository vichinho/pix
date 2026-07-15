import type { BuildProvider } from '../../domain/build.js';
import type { ChampionTraitProvider, DamageType } from '../../domain/aram.js';
import type { ChampionBuild, Role, RuneSelection } from '../../domain/types.js';

/**
 * Proveedor de builds genéricas por arquetipo: cuando no hay una build curada,
 * arma una sugerencia razonable a partir del tipo de daño del campeón (de los
 * metadatos de ARAM) y del rol. Da runas y hechizos sensatos para CUALQUIER
 * campeón que tenga metadatos, marcados como genéricos.
 */
export class ArchetypeBuildProvider implements BuildProvider {
  readonly name = 'archetype';

  constructor(private readonly traits: ChampionTraitProvider) {}

  getBuild(championId: number, role: Role): ChampionBuild | null {
    const t = this.traits.get(championId);
    if (!t) return null;

    return {
      championId,
      championName: t.name,
      role,
      summonerSpells: summonersFor(role, t.damage),
      runes: runesFor(t.damage),
      startingItems: startingFor(t.damage),
      coreItems: coreFor(t.damage),
      situationalItems: situationalFor(t.damage),
      skillOrder: ['Q', 'W', 'E'],
      source: 'archetype',
      patch: 'genérico',
      notes: 'Build genérica por arquetipo (sin datos curados específicos para este campeón).',
    };
  }
}

function summonersFor(role: Role, damage: DamageType): string[] {
  if (role === 'JUNGLE') return ['Flash', 'Castigo'];
  if (role === 'UTILITY') return ['Flash', 'Ignite'];
  if (role === 'BOTTOM') return ['Flash', 'Curación'];
  if (role === 'TOP') return ['Flash', 'Teletransporte'];
  // Mid/desconocido: encender por defecto para magos/asesinos.
  return damage === 'AP' || damage === 'MIXED' ? ['Flash', 'Ignite'] : ['Flash', 'Ignite'];
}

function runesFor(damage: DamageType): RuneSelection {
  if (damage === 'AP') {
    return {
      primaryStyle: 'Brujería',
      keystone: 'Cometa Arcano',
      primary: ['Flujo de Maná', 'Trascendencia', 'Chamuscar'],
      secondaryStyle: 'Inspiración',
      secondary: ['Galleta Mágica', 'Perspicacia Cósmica'],
      shards: ['Aceleración de Habilidad', 'PA Adaptativo', 'Vida'],
    };
  }
  if (damage === 'NONE') {
    return {
      primaryStyle: 'Resolución',
      keystone: 'Choque Posterior (Aftershock)',
      primary: ['Demolición', 'Segundo Aliento', 'Sonrisa Cadavérica'],
      secondaryStyle: 'Inspiración',
      secondary: ['Hechizo Fantasma', 'Perspicacia Cósmica'],
      shards: ['Aceleración de Habilidad', 'Vida', 'Vida'],
    };
  }
  // AD / MIXED
  return {
    primaryStyle: 'Precisión',
    keystone: 'Conquistador',
    primary: ['Triunfo', 'Leyenda: Presteza', 'Último Aliento'],
    secondaryStyle: 'Dominación',
    secondary: ['Impacto Súbito', 'Cazador Voraz'],
    shards: ['AD Adaptativo', 'AD Adaptativo', 'Vida'],
  };
}

function startingFor(damage: DamageType): string[] {
  if (damage === 'AP') return ['Anillo de Doran', 'Poción de Salud'];
  if (damage === 'NONE') return ['Reliquia del Escudo de Acero', 'Poción de Salud'];
  return ['Espada de Doran', 'Poción de Salud'];
}

function coreFor(damage: DamageType): string[] {
  if (damage === 'AP') return ['Botas de Hechicero', 'Objeto mítico AP'];
  if (damage === 'NONE') return ['Botas de Placas de Acero', 'Objeto de aguante'];
  return ['Botas de Movilidad Ionianas', 'Objeto mítico AD'];
}

function situationalFor(damage: DamageType): string[] {
  if (damage === 'AP')
    return ['Sombrero Mortal de Rabadon', 'Bastón del Vacío', 'Reloj de Arena de Zhonya'];
  if (damage === 'NONE') return ['Relicario del Sol Naciente', 'Redención', 'Corazón Helado'];
  return ['Rencor de Serylda', 'Danza de la Muerte', 'Filo de la Noche'];
}
