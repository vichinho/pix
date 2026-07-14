import type { MatchSummary, Role } from './types.js';

/** Rendimiento del jugador con un campeón. */
export interface ChampionStats {
  championId: number;
  championName: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number; // 0-1
  kills: number;
  deaths: number;
  assists: number;
  kda: number; // (kills + assists) / max(1, deaths)
}

/** Rendimiento del jugador en un rol. */
export interface RoleStats {
  role: Role;
  games: number;
  /** championIds jugados en ese rol, ordenados por partidas descendente. */
  championIds: number[];
}

/** Resumen de rendimiento reciente del jugador. */
export interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  byChampion: ChampionStats[];
  byRole: RoleStats[];
}

function kdaOf(kills: number, deaths: number, assists: number): number {
  return Number(((kills + assists) / Math.max(1, deaths)).toFixed(2));
}

/** Agrega el historial en estadísticas por campeón y por rol. */
export function computePlayerStats(matches: MatchSummary[]): PlayerStats {
  const champAgg = new Map<number, ChampionStats>();
  const roleAgg = new Map<Role, Map<number, number>>(); // role -> championId -> games

  let wins = 0;
  for (const m of matches) {
    if (m.win) wins += 1;

    const existing =
      champAgg.get(m.championId) ??
      {
        championId: m.championId,
        championName: m.championName,
        games: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        kda: 0,
      };
    existing.games += 1;
    existing.wins += m.win ? 1 : 0;
    existing.losses += m.win ? 0 : 1;
    existing.kills += m.kills;
    existing.deaths += m.deaths;
    existing.assists += m.assists;
    champAgg.set(m.championId, existing);

    const perRole = roleAgg.get(m.role) ?? new Map<number, number>();
    perRole.set(m.championId, (perRole.get(m.championId) ?? 0) + 1);
    roleAgg.set(m.role, perRole);
  }

  const byChampion = [...champAgg.values()]
    .map((c) => ({
      ...c,
      winRate: c.games > 0 ? Number((c.wins / c.games).toFixed(3)) : 0,
      kda: kdaOf(c.kills, c.deaths, c.assists),
    }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate);

  const byRole: RoleStats[] = [...roleAgg.entries()]
    .map(([role, champs]) => ({
      role,
      games: [...champs.values()].reduce((s, n) => s + n, 0),
      championIds: [...champs.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id),
    }))
    .sort((a, b) => b.games - a.games);

  const totalGames = matches.length;
  return {
    totalGames,
    wins,
    losses: totalGames - wins,
    winRate: totalGames > 0 ? Number((wins / totalGames).toFixed(3)) : 0,
    byChampion,
    byRole,
  };
}

/**
 * Campeones "cómodos" del jugador para un rol: los que jugó en ese rol con al
 * menos `minGames` partidas, ordenados por winrate y luego por partidas.
 * Con rol UNKNOWN considera todo el historial.
 */
export function comfortChampionIds(
  matches: MatchSummary[],
  role: Role,
  minGames = 2,
): number[] {
  const relevant = role === 'UNKNOWN' ? matches : matches.filter((m) => m.role === role);
  const agg = new Map<number, { games: number; wins: number }>();
  for (const m of relevant) {
    const cur = agg.get(m.championId) ?? { games: 0, wins: 0 };
    cur.games += 1;
    cur.wins += m.win ? 1 : 0;
    agg.set(m.championId, cur);
  }
  return [...agg.entries()]
    .filter(([, s]) => s.games >= minGames)
    .sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games || b[1].games - a[1].games)
    .map(([id]) => id);
}
