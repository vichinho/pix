/**
 * Análisis de composición para ARAM (normal o variantes de evento).
 *
 * Trabaja sobre metadatos curados por campeón (tipo de daño y arquetipos de
 * composición). Los campeones sin metadatos se cuentan como "desconocidos" y
 * se informa la cobertura para no dar veredictos engañosos.
 */

/** Tipo de daño predominante del campeón. */
export type DamageType = 'AD' | 'AP' | 'MIXED' | 'NONE';

/** Arquetipos relevantes para evaluar una composición. */
export type CompTrait =
  | 'FRONTLINE' // tanque / línea de frente que absorbe daño
  | 'ENGAGE' // inicia peleas
  | 'POKE' // desgaste a distancia
  | 'SUSTAIN' // se mantiene en carril/pelea (regeneración, drenaje)
  | 'HEALING' // cura/escuda al equipo
  | 'HARD_CC' // control de masas fuerte (aturdir, suprimir, etc.)
  | 'WAVECLEAR'; // limpieza de oleadas

/** Metadatos de un campeón para análisis de composición. */
export interface ChampionTraits {
  championId: number;
  name: string;
  damage: DamageType;
  traits: CompTrait[];
  /** Fuerza base en ARAM (0-100), usada como piso del puntaje de recomendación. */
  aramScore: number;
}

/** Provee metadatos por championId (dataset curado, Data Dragon, etc.). */
export interface ChampionTraitProvider {
  get(championId: number): ChampionTraits | null;
}

/** Carencias detectadas en una composición. */
export interface CompNeeds {
  needsAd: boolean;
  needsAp: boolean;
  needsFrontline: boolean;
  needsHealingOrSustain: boolean;
  needsEngage: boolean;
  needsHardCc: boolean;
}

/** Resultado del análisis de una composición. */
export interface CompAnalysis {
  adCount: number;
  apCount: number;
  frontlineCount: number;
  sustainCount: number;
  healingCount: number;
  engageCount: number;
  hardCcCount: number;
  pokeCount: number;
  /** Campeones sin metadatos (no evaluables). */
  unknownCount: number;
  /** ¿La composición está equilibrada en lo crítico? */
  balanced: boolean;
  /** Carencias legibles (en español) para mostrar al jugador. */
  missing: string[];
  /** Puntos fuertes destacables (en español). */
  strengths: string[];
  needs: CompNeeds;
}

function has(traits: ChampionTraits, trait: CompTrait): boolean {
  return traits.traits.includes(trait);
}

/**
 * Analiza una composición a partir de la lista de metadatos (null = desconocido).
 */
export function analyzeComp(members: Array<ChampionTraits | null>): CompAnalysis {
  const known = members.filter((m): m is ChampionTraits => m !== null);
  const unknownCount = members.length - known.length;

  const adCount = known.filter((m) => m.damage === 'AD' || m.damage === 'MIXED').length;
  const apCount = known.filter((m) => m.damage === 'AP' || m.damage === 'MIXED').length;
  const frontlineCount = known.filter((m) => has(m, 'FRONTLINE')).length;
  const healingCount = known.filter((m) => has(m, 'HEALING')).length;
  const sustainCount = known.filter((m) => has(m, 'SUSTAIN') || has(m, 'HEALING')).length;
  const engageCount = known.filter((m) => has(m, 'ENGAGE')).length;
  const hardCcCount = known.filter((m) => has(m, 'HARD_CC')).length;
  const pokeCount = known.filter((m) => has(m, 'POKE')).length;

  // Sesgo de daño: sólo lo evaluamos con muestra suficiente.
  const pureAd = known.filter((m) => m.damage === 'AD').length;
  const pureAp = known.filter((m) => m.damage === 'AP').length;
  const damageSkewAd = known.length >= 3 && apCount === 0 && pureAd >= 2;
  const damageSkewAp = known.length >= 3 && adCount === 0 && pureAp >= 2;

  const needs: CompNeeds = {
    needsAd: damageSkewAp,
    needsAp: damageSkewAd,
    needsFrontline: frontlineCount === 0,
    needsHealingOrSustain: sustainCount === 0,
    needsEngage: engageCount === 0,
    needsHardCc: hardCcCount === 0,
  };

  const missing: string[] = [];
  if (needs.needsAp) missing.push('daño mágico (equipo demasiado AD)');
  if (needs.needsAd) missing.push('daño físico (equipo demasiado AP)');
  if (needs.needsFrontline) missing.push('un frontline / tanque');
  if (needs.needsHealingOrSustain) missing.push('sustain o curación (clave en ARAM)');
  if (needs.needsHardCc) missing.push('control de masas (CC duro)');
  // El engage es deseable pero no crítico en ARAM (las peleas surgen solas):
  // se usa como bonus al recomendar, no como carencia en `missing`/`balanced`.

  const strengths: string[] = [];
  if (pokeCount >= 2) strengths.push('composición de poke fuerte');
  if (healingCount >= 2) strengths.push('mucha curación/escudos');
  if (frontlineCount >= 2) strengths.push('frontline sólido');
  if (hardCcCount >= 3) strengths.push('mucho control de masas');

  // El equilibrio se juzga sólo por lo crítico (daño, frontline, sustain, CC).
  const balanced =
    !needs.needsAp &&
    !needs.needsAd &&
    !needs.needsFrontline &&
    !needs.needsHealingOrSustain &&
    !needs.needsHardCc;

  return {
    adCount,
    apCount,
    frontlineCount,
    sustainCount,
    healingCount,
    engageCount,
    hardCcCount,
    pokeCount,
    unknownCount,
    balanced,
    missing,
    strengths,
    needs,
  };
}

/** Opción de campeón disponible, puntuada según cuánto ayuda al equipo. */
export interface AramChampionOption {
  championId: number;
  championName: string;
  fitScore: number;
  /** Huecos del equipo que este campeón ayudaría a cubrir (en español). */
  fillsGaps: string[];
}

const GAP_BONUS = {
  damage: 12,
  frontline: 15,
  healing: 15,
  sustain: 10,
  engage: 10,
  hardCc: 10,
} as const;

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Puntúa y ordena los campeones disponibles (banca + campeón actual) según la
 * fuerza base en ARAM más cuánto ayudan a cubrir las carencias del equipo.
 * `teamNeeds` deben provenir del análisis de los COMPAÑEROS (sin el slot propio).
 */
export function rankAramOptions(
  available: Array<ChampionTraits | null>,
  teamNeeds: CompNeeds,
  limit = 5,
): AramChampionOption[] {
  const options: AramChampionOption[] = [];

  for (const champ of available) {
    if (champ === null) continue;
    let score = champ.aramScore;
    const fillsGaps: string[] = [];

    const givesAd = champ.damage === 'AD' || champ.damage === 'MIXED';
    const givesAp = champ.damage === 'AP' || champ.damage === 'MIXED';
    if (teamNeeds.needsAp && givesAp) {
      score += GAP_BONUS.damage;
      fillsGaps.push('aporta daño mágico');
    }
    if (teamNeeds.needsAd && givesAd) {
      score += GAP_BONUS.damage;
      fillsGaps.push('aporta daño físico');
    }
    if (teamNeeds.needsFrontline && has(champ, 'FRONTLINE')) {
      score += GAP_BONUS.frontline;
      fillsGaps.push('aporta frontline');
    }
    if (teamNeeds.needsHealingOrSustain && has(champ, 'HEALING')) {
      score += GAP_BONUS.healing;
      fillsGaps.push('aporta curación');
    } else if (teamNeeds.needsHealingOrSustain && has(champ, 'SUSTAIN')) {
      score += GAP_BONUS.sustain;
      fillsGaps.push('aporta sustain');
    }
    if (teamNeeds.needsEngage && has(champ, 'ENGAGE')) {
      score += GAP_BONUS.engage;
      fillsGaps.push('aporta engage');
    }
    if (teamNeeds.needsHardCc && has(champ, 'HARD_CC')) {
      score += GAP_BONUS.hardCc;
      fillsGaps.push('aporta CC duro');
    }

    options.push({
      championId: champ.championId,
      championName: champ.name,
      fitScore: clamp(score),
      fillsGaps,
    });
  }

  return options
    .sort((a, b) => b.fitScore - a.fitScore || a.championName.localeCompare(b.championName))
    .slice(0, Math.max(0, limit));
}
