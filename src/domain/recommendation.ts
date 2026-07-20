import type { ChampionRecommendation, Role } from './types.js';

/** Campeón candidato para una línea, con su puntaje base de meta/tier. */
export interface ChampionCandidate {
  championId: number;
  championName: string;
  role: Role;
  /** Puntaje base 0-100 por meta/tier/facilidad. */
  baseScore: number;
}

/** Fuente de campeones candidatos por rol (seed estática, historial, etc.). */
export interface ChampionPool {
  getCandidates(role: Role): ChampionCandidate[];
}

/** Contexto que ajusta el puntaje de las recomendaciones. */
export interface RecommendationContext {
  /** Campeones a excluir (p.ej. bans de la partida). */
  excludeChampionIds?: number[];
  /** Campeones "cómodos" del usuario (suben de prioridad). */
  comfortChampionIds?: number[];
}

/** Bono aplicado a un comfort pick del usuario. */
export const COMFORT_BONUS = 15;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Motor de recomendación por reglas, determinístico y explicable (ADR-004).
 *
 * Puntaje = base (meta/tier) + bono por comfort pick.
 * Excluye campeones vetados y ordena de mayor a menor puntaje; ante empate,
 * ordena por nombre para resultados estables.
 */
export function recommendChampions(
  pool: ChampionPool,
  role: Role,
  context: RecommendationContext = {},
  limit = 5,
): ChampionRecommendation[] {
  const exclude = new Set(context.excludeChampionIds ?? []);
  const comfort = new Set(context.comfortChampionIds ?? []);

  return pool
    .getCandidates(role)
    .filter((candidate) => !exclude.has(candidate.championId))
    .map((candidate) => {
      const isComfort = comfort.has(candidate.championId);
      const score = clampScore(candidate.baseScore + (isComfort ? COMFORT_BONUS : 0));
      const reason = isComfort
        ? candidate.baseScore >= 70
          ? 'comfort_pick_plus_meta'
          : 'comfort_pick'
        : 'meta_pick';
      return {
        championId: candidate.championId,
        championName: candidate.championName,
        score,
        reason,
      };
    })
    .sort((a, b) => b.score - a.score || a.championName.localeCompare(b.championName))
    .slice(0, Math.max(0, limit));
}
