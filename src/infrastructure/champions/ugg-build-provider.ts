/**
 * MerakiBuildProvider
 * -------------------
 * Usa la CDN pública de Meraki Analytics para obtener builds reales por campeón.
 * No requiere API key, no tiene Cloudflare, y se actualiza con cada patch.
 *
 * CDN: https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/{key}.json
 *
 * Nota: Meraki provee datos de campeón (stats, habilidades, items recomendados
 * por Riot), NO builds de winrate como U.GG. Por eso el provider arma una build
 * razonable usando los ítems recomendados por Riot + runas estándar por rol,
 * funcionando como puente entre los datos curados locales y la realidad del parche.
 */
import type { BuildProvider } from '../../domain/build.js';
import type { ChampionBuild, Role } from '../../domain/types.js';

// ── Runas estándar por rol ─────────────────────────────────────────────────────
// IDs de Data Dragon / Riot para keystones y estilos comunes por posición.
// Son una buena aproximación para campeones que no tienen build curada en seed.
const RUNES_BY_ROLE: Record<Role, ChampionBuild['runes']> = {
  TOP: {
    primaryStyleId: 8000, keystoneId: 8010,  // Precision / Conqueror
    primary: [9101, 9104, 8299], secondaryStyleId: 8200,
    secondary: [8210, 8237], shards: [5005, 5008, 5011],
  },
  JUNGLE: {
    primaryStyleId: 8000, keystoneId: 8010,
    primary: [9101, 9104, 8299], secondaryStyleId: 8400,
    secondary: [8444, 8453], shards: [5005, 5008, 5011],
  },
  MIDDLE: {
    primaryStyleId: 8100, keystoneId: 8112, // Domination / Electrocute
    primary: [8143, 8136, 8106], secondaryStyleId: 8200,
    secondary: [8210, 8237], shards: [5007, 5008, 5011],
  },
  BOTTOM: {
    primaryStyleId: 8000, keystoneId: 8005, // Precision / Press the Attack
    primary: [9101, 9104, 8299], secondaryStyleId: 8100,
    secondary: [8143, 8135], shards: [5005, 5008, 5011],
  },
  UTILITY: {
    primaryStyleId: 8200, keystoneId: 8229, // Sorcery / Summon Aery
    primary: [8226, 8210, 8232], secondaryStyleId: 8300,
    secondary: [8304, 8347], shards: [5007, 5008, 5011],
  },
  ARAM: {
    primaryStyleId: 8200, keystoneId: 8229,
    primary: [8226, 5008, 8232], secondaryStyleId: 8300,
    secondary: [8304, 8347], shards: [5007, 5008, 5011],
  },
  UNKNOWN: {
    primaryStyleId: 8200, keystoneId: 8214, // Sorcery / Summon Aery
    primary: [8226, 8210, 8232], secondaryStyleId: 8300,
    secondary: [8304, 8347], shards: [5007, 5008, 5011],
  },
};

const SUMMONERS_BY_ROLE: Record<Role, string[]> = {
  TOP:     ['Flash', 'Teleport'],
  JUNGLE:  ['Flash', 'Smite'],
  MIDDLE:  ['Flash', 'Ignite'],
  BOTTOM:  ['Flash', 'Heal'],
  UTILITY: ['Flash', 'Ignite'],
  ARAM:    ['Flash', 'Mark'],
  UNKNOWN: ['Flash', 'Ignite'],
};

// ── Tipos de la respuesta de Meraki ─────────────────────────────────────────
interface MerakiItem {
  id: number;
  name: string;
}

interface MerakiItemSet {
  items: MerakiItem[];
}

interface MerakiChampion {
  name: string;
  key: string;             // nombre de Data Dragon (ej: "Ahri", "MissFortune")
  apiName: string;        // igual que key pero en formato Riot
  // Riot sugiere sets de ítems opcionales por estilo de juego
  recommendedItemSets?: MerakiItemSet[];
  // Stats y habilidades (no usamos aquí, pero están disponibles)
  [key: string]: unknown;
}

// Mapa de championId Riot → key de Meraki (nombre en Data Dragon).
// Meraki usa el mismo key que Data Dragon (MissFortune, Wukong como MonkeyKing, etc.)
// Solo necesitamos el endpoint por nombre, pero lo resolvemos dinámicamente.
const MERAKI_BASE = 'https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US';

async function fetchMerakiIndex(): Promise<Record<string, { id: number; key: string }>> {
  const res = await fetch(`${MERAKI_BASE}/champions.json`, {
    signal: AbortSignal.timeout(6000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Meraki index HTTP ${res.status}`);
  return res.json() as Promise<Record<string, { id: number; key: string }>>;
}

async function fetchMerakiChampion(key: string): Promise<MerakiChampion> {
  const res = await fetch(`${MERAKI_BASE}/champions/${key}.json`, {
    signal: AbortSignal.timeout(6000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Meraki champion HTTP ${res.status}`);
  return res.json() as Promise<MerakiChampion>;
}

/**
 * Proveedor de builds usando Meraki Analytics CDN (pública, sin Cloudflare).
 *
 * - No requiere API key.
 * - Cachea índice y campeones en memoria por sesión.
 * - Devuelve null si falla la red (la cadena FallbackBuildProvider sigue al siguiente).
 * - Los ítems vienen de los sets recomendados oficiales de Riot en Meraki;
 *   las runas y summoners son los estándar por rol (no hay datos de winrate en Meraki).
 */
export class MerakiBuildProvider implements BuildProvider {
  readonly name = 'meraki';

  // Cache: championId → Meraki key (string como "Ahri", "MissFortune")
  private readonly idToKey = new Map<number, string>();
  // Cache: key → datos completos del campeón
  private readonly champCache = new Map<string, MerakiChampion>();
  // Cache de build final
  private readonly buildCache = new Map<string, ChampionBuild | null>();
  // Promesa del índice (se carga una sola vez)
  private indexPromise: Promise<void> | null = null;

  private loadIndex(): Promise<void> {
    if (this.indexPromise === null) {
      this.indexPromise = fetchMerakiIndex()
        .then((index) => {
          for (const [key, data] of Object.entries(index)) {
            this.idToKey.set(data.id, key);
          }
        })
        .catch(() => {
          // Si falla el índice, el provider devuelve null para todos los campeones
        });
    }
    return this.indexPromise;
  }

  async getBuild(championId: number, role: Role): Promise<ChampionBuild | null> {
    const cacheKey = `${championId}:${role}`;
    if (this.buildCache.has(cacheKey)) return this.buildCache.get(cacheKey) ?? null;

    try {
      // 1. Asegurar que el índice esté cargado
      await this.loadIndex();

      // 2. Resolver championId → Meraki key
      const key = this.idToKey.get(championId);
      if (key === undefined) {
        this.buildCache.set(cacheKey, null);
        return null;
      }

      // 3. Obtener datos del campeón (con caché)
      let champ = this.champCache.get(key);
      if (champ === undefined) {
        champ = await fetchMerakiChampion(key);
        this.champCache.set(key, champ);
      }

      // 4. Armar la build
      const build = this.mapToChampionBuild(championId, champ, role);
      this.buildCache.set(cacheKey, build);
      return build;

    } catch {
      this.buildCache.set(cacheKey, null);
      return null;
    }
  }

  private mapToChampionBuild(
    championId: number,
    champ: MerakiChampion,
    role: Role,
  ): ChampionBuild {
    // Items recomendados por Riot en Meraki (primer set disponible)
    const itemSet = champ.recommendedItemSets?.[0];
    const allItems = itemSet?.items ?? [];

    // Dividimos: primeros 2 = starting, siguientes 3 = core, resto = situational
    const startingItems = allItems.slice(0, 2).map((i) => i.id);
    const coreItems     = allItems.slice(2, 5).map((i) => i.id);
    const situationalItems = allItems.slice(5).map((i) => i.id);

    return {
      championId,
      championName: champ.name,
      role,
      source: 'meraki',
      patch: 'latest',
      summonerSpells: SUMMONERS_BY_ROLE[role],
      runes: RUNES_BY_ROLE[role],
      startingItems,
      coreItems,
      situationalItems,
      skillOrder: ['Q', 'W', 'E'],
      notes: `Build base de Meraki Analytics (ítems recomendados por Riot para ${champ.name}).`,
    };
  }
}
