import type { BuildProvider } from '../../domain/build.js';
import type { ChampionBuild, Role } from '../../domain/types.js';

/** Mapa de roles de PIX → ID de rol que usa U.GG en su API. */
const ROLE_MAP: Record<Role, number> = {
  TOP: 4, JUNGLE: 1, MIDDLE: 5, BOTTOM: 3, UTILITY: 2, ARAM: 12, UNKNOWN: 5,
};

/** IDs de hechizos de invocador de Riot → nombres que espera ChampionBuild.summonerSpells. */
const SUMMONER_SPELL_NAMES: Record<number, string> = {
  1: 'Cleanse',
  3: 'Exhaust',
  4: 'Flash',
  6: 'Ghost',
  7: 'Heal',
  11: 'Smite',
  12: 'Teleport',
  13: 'Clarity',
  14: 'Ignite',
  21: 'Barrier',
  32: 'Mark',   // Snowball (ARAM)
  39: 'Mark',
};

/** IDs de habilidad que usa U.GG (1=Q, 2=W, 3=E, 4=R) → nombre legible. */
const SKILL_NAMES: Record<number, string> = { 1: 'Q', 2: 'W', 3: 'E', 4: 'R' };

/**
 * Estructura real de la respuesta de U.GG.
 * Cada campo es un array de arrays donde [0] contiene los IDs
 * y los siguientes sub-arrays son estadísticas (wins, games).
 */
interface UggRawData {
  /** [[primaryStyle, keystone, p1, p2, p3], [secStyle, s1, s2], [shard1, shard2, shard3]] */
  runes?: number[][];
  /** [[spellId1, spellId2], [wins, games]] */
  summoner_spells?: number[][];
  /** [[item1, item2, ...], [wins, games]] */
  starting_items?: number[][];
  /** [[item1, item2, item3], [wins, games]] */
  core_items?: number[][];
  /** [[itemId, wins, games], ...] — ítems situacionales ordenados por pick rate */
  fourth_items?: number[][];
  /** [[skillNum, skillNum, ...], [wins, games]] */
  skill_order?: number[][];
  win_rate?: number;
  pick_rate?: number;
}

/** Filtra undefined de un array y garantiza number[] para TypeScript strict + noUncheckedIndexedAccess. */
function filterNumbers(arr: (number | undefined)[]): number[] {
  return arr.filter((n): n is number => n !== undefined);
}

/**
 * Obtiene el patch actual desde Data Dragon en formato U.GG (ej: "25_14").
 * noUncheckedIndexedAccess-safe: valida versions[0] antes de usarlo.
 */
async function fetchCurrentPatch(): Promise<string> {
  const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', {
    signal: AbortSignal.timeout(4000),
  });
  const versions = await res.json() as string[];
  const latest = versions[0];
  if (latest === undefined) throw new Error('DDragon: lista de versiones vacía');
  const parts = latest.split('.');
  const major = parts[0] ?? String(new Date().getFullYear());
  const minor = parts[1] ?? '1';
  return `${major}_${minor}`;
}

/**
 * Proveedor de builds por campeón basado en la API pública de U.GG.
 * Devuelve builds específicas por championId y rol (no genéricas por arquetipo).
 *
 * - No requiere API key.
 * - Cachea los resultados en memoria por sesión.
 * - Si falla la red, devuelve null y la cadena FallbackBuildProvider
 *   cae al siguiente proveedor (SeedBuildProvider, etc.).
 *
 * Integración en server.ts:
 * @example
 * new FallbackBuildProvider([
 *   new UggBuildProvider(),        // ← primero: datos reales por campeón
 *   new SeedBuildProvider(),       // ← fallback rápido sin red
 *   new ClassifiedBuildProvider(championCatalog),
 *   ...
 * ])
 */
export class UggBuildProvider implements BuildProvider {
  readonly name = 'ugg';

  private readonly cache = new Map<string, ChampionBuild | null>();
  private patchPromise: Promise<string> | null = null;

  private getPatch(): Promise<string> {
    if (this.patchPromise === null) {
      this.patchPromise = fetchCurrentPatch().catch(() => {
        const year = new Date().getFullYear();
        return `${year}_1`;
      });
    }
    return this.patchPromise;
  }

  async getBuild(championId: number, role: Role): Promise<ChampionBuild | null> {
    const cacheKey = `${championId}:${role}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey) ?? null;

    try {
      const patch = await this.getPatch();
      const uggRole = ROLE_MAP[role];

      const url =
        `https://stats2.u.gg/lol/1.5/table/items/${patch}/ranked_solo_5x5` +
        `/${championId}/${uggRole}/1/1.5.0.json`;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        this.cache.set(cacheKey, null);
        return null;
      }

      const raw = await res.json() as UggRawData;
      const build = this.mapToChampionBuild(championId, role, raw, patch);
      this.cache.set(cacheKey, build);
      return build;

    } catch {
      this.cache.set(cacheKey, null);
      return null;
    }
  }

  private mapToChampionBuild(
    championId: number,
    role: Role,
    data: UggRawData,
    patch: string,
  ): ChampionBuild {
    // ── Runas ────────────────────────────────────────────────────────────────
    const runeGroups     = data.runes ?? [];
    const primaryGroup   = runeGroups[0] ?? [];
    const secondaryGroup = runeGroups[1] ?? [];
    const shardGroup     = runeGroups[2] ?? [];

    const primaryStyleId   = primaryGroup[0]   ?? 0;
    const keystoneId       = primaryGroup[1]   ?? 0;
    const secondaryStyleId = secondaryGroup[0] ?? 0;

    // ── Hechizos ─────────────────────────────────────────────────────────────
    // summoner_spells[0] = [spellId1, spellId2]
    const spellIds = data.summoner_spells?.[0] ?? [];
    const summonerSpells = spellIds.map(
      (id) => SUMMONER_SPELL_NAMES[id] ?? `Spell_${id}`,
    );

    // ── Ítems ─────────────────────────────────────────────────────────────────
    const startingItems = filterNumbers(data.starting_items?.[0] ?? []);
    const coreItems     = filterNumbers(data.core_items?.[0] ?? []);

    // fourth_items = [[itemId, wins, games], ...] → tomamos solo el itemId de cada tuple
    const situationalItems = (data.fourth_items ?? []).map(
      (tuple) => tuple[0] ?? 0,
    ).filter((id) => id !== 0);

    // ── Orden de habilidades ─────────────────────────────────────────────────
    // skill_order[0] = [1,1,2,1,3,1,4,...] donde 1=Q, 2=W, 3=E, 4=R
    const rawSkills = data.skill_order?.[0] ?? [];
    const skillOrder: string[] = rawSkills.reduce<string[]>((acc, n) => {
      const name = SKILL_NAMES[n];
      if (name !== undefined) acc.push(name);
      return acc;
    }, []);

    return {
      championId,
      championName: '',   // enrich-build.ts lo rellena con el catálogo
      role,
      source: 'ugg',
      patch: patch.replace('_', '.'),
      summonerSpells,
      runes: {
        primaryStyleId,
        keystoneId,
        primary:         filterNumbers([primaryGroup[2], primaryGroup[3], primaryGroup[4]]),
        secondaryStyleId,
        secondary:       filterNumbers([secondaryGroup[1], secondaryGroup[2]]),
        shards:          filterNumbers([shardGroup[0], shardGroup[1], shardGroup[2]]),
      },
      startingItems,
      coreItems,
      situationalItems,
      skillOrder,
      notes: `Build de U.GG — patch ${patch.replace('_', '.')}`,
    };
  }
}
