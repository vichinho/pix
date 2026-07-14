import type { ChampionCandidate, ChampionPool } from '../../domain/recommendation.js';
import type { MatchSummary, Role } from '../../domain/types.js';

/**
 * Pool de campeones derivado del historial del jugador: por cada rol, los
 * campeones que jugó, con un puntaje base según su winrate reciente.
 */
export function buildHistoryPool(matches: MatchSummary[]): ChampionPool {
  // role -> championId -> agregado
  const byRole = new Map<Role, Map<number, { name: string; games: number; wins: number }>>();

  for (const m of matches) {
    const perRole = byRole.get(m.role) ?? new Map();
    const cur = perRole.get(m.championId) ?? { name: m.championName, games: 0, wins: 0 };
    cur.games += 1;
    cur.wins += m.win ? 1 : 0;
    perRole.set(m.championId, cur);
    byRole.set(m.role, perRole);
  }

  const candidatesByRole = new Map<Role, ChampionCandidate[]>();
  for (const [role, champs] of byRole.entries()) {
    const list: ChampionCandidate[] = [...champs.entries()].map(([championId, agg]) => {
      const winRate = agg.games > 0 ? agg.wins / agg.games : 0.5;
      // Puntaje base centrado en 55, ajustado por winrate reciente.
      const baseScore = Math.max(0, Math.min(100, Math.round(55 + (winRate - 0.5) * 30)));
      return { championId, championName: agg.name, role, baseScore };
    });
    candidatesByRole.set(role, list);
  }

  return {
    getCandidates(role: Role): ChampionCandidate[] {
      return (candidatesByRole.get(role) ?? []).map((c) => ({ ...c }));
    },
  };
}

/**
 * Combina varios pools en uno. Ante el mismo championId en un rol, conserva el
 * candidato de mayor baseScore (prioriza el pool que lo valora mejor).
 */
export class CompositeChampionPool implements ChampionPool {
  constructor(private readonly pools: ChampionPool[]) {}

  getCandidates(role: Role): ChampionCandidate[] {
    const merged = new Map<number, ChampionCandidate>();
    for (const pool of this.pools) {
      for (const candidate of pool.getCandidates(role)) {
        const existing = merged.get(candidate.championId);
        if (!existing || candidate.baseScore > existing.baseScore) {
          merged.set(candidate.championId, candidate);
        }
      }
    }
    return [...merged.values()];
  }
}
