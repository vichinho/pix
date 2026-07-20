/**
 * LolalyticsBuildProvider
 *
 * Extrae builds reales con winrate desde el HTML SSR de lolalytics.com.
 * No requiere API key ni sortea Cloudflare: los datos vienen embebidos en el
 * bloque <script type="qwik/json"> que el servidor renderiza en cada request.
 *
 * Estrategia:
 *   1. GET https://lolalytics.com/lol/{champion}/build/?lane={lane}
 *   2. Parsear el JSON de Qwik (estado SSR serializado).
 *   3. Resolver las referencias cruzadas base-36 que usa el framework.
 *   4. Mapear ítems/runas/sums a los tipos del dominio.
 */

import https from 'node:https';
import zlib from 'node:zlib';
import type { BuildProvider } from '../../domain/build.js';
import type { ChampionBuild, Role, RuneSelection } from '../../domain/types.js';
import { STYLE, KEYSTONE } from './rune-ids.js';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const ROLE_TO_LANE: Record<Role, string> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MIDDLE: 'middle',
  BOTTOM: 'bottom',
  SUPPORT: 'support',
  ARAM: 'aram',
};

const SUMMONER_ID: Record<number, string> = {
  1: 'Escudo de invocador',
  3: 'Agotamiento',
  4: 'Flash',
  6: 'Ignite',
  7: 'Curación',
  11: 'Smite',
  12: 'Teletransporte',
  13: 'Claridad',
  14: 'Ignite',
  21: 'Barrera',
  30: 'Celo',
  31: 'Marca de tempestades',
  32: 'Marca de tempestades',
};

/** Decodifica el skill-order numérico de Lolalytics (dígitos 1-4 → Q W E R). */
function decodeSkillOrder(raw: number | string): string[] {
  const map: Record<string, string> = { '1': 'Q', '2': 'W', '3': 'E', '4': 'R' };
  return String(Math.round(Number(raw)))
    .split('')
    .map((d) => map[d] ?? '?')
    .filter((s) => s !== '?');
}

/** Extrae los 3 primeros skills más subidos (skill priority) del skill-order completo. */
function skillPriorityFromOrder(order: string[]): string[] {
  const count: Record<string, number> = { Q: 0, W: 0, E: 0 };
  // Primeros 18 niveles (R se sube en 6, 11, 16 — lo saltamos)
  for (const s of order.slice(0, 18)) {
    if (s in count) count[s]++;
  }
  return Object.entries(count)
    .sort(([, a], [, b]) => b - a)
    .map(([k]) => k);
}

// Mapa de estilos de runa (pri index → style id)
const STYLE_IDS = [STYLE.PRECISION, STYLE.DOMINATION, STYLE.SORCERY, STYLE.RESOLVE, STYLE.INSPIRATION] as const;

// ──────────────────────────────────────────────
// Qwik state resolver
// ──────────────────────────────────────────────

type QwikObj = string | number | boolean | null | QwikObj[] | { [k: string]: QwikObj };

/**
 * Los valores en el estado de Qwik son referencias base-36 a otros slots
 * de la lista `objs`. Esta función los resuelve recursivamente.
 */
function resolveQwik(val: QwikObj, objs: QwikObj[], depth = 0): QwikObj {
  if (depth > 12) return val;
  if (typeof val === 'string' && /^[0-9a-z]{1,6}$/.test(val)) {
    const idx = parseInt(val, 36);
    if (idx < objs.length) return resolveQwik(objs[idx], objs, depth + 1);
  }
  if (Array.isArray(val)) return val.map((v) => resolveQwik(v, objs, depth + 1));
  if (val !== null && typeof val === 'object') {
    const out: { [k: string]: QwikObj } = {};
    for (const [k, v] of Object.entries(val)) out[k] = resolveQwik(v, objs, depth + 1);
    return out;
  }
  return val;
}

// ──────────────────────────────────────────────
// HTTP helper
// ──────────────────────────────────────────────

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.9',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        const encoding = res.headers['content-encoding'] ?? '';
        const stream =
          encoding === 'gzip'
            ? res.pipe(zlib.createGunzip())
            : encoding === 'deflate'
              ? res.pipe(zlib.createInflate())
              : res;
        stream.on('data', (c: Buffer) => chunks.push(c));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', reject);
      },
    );
    req.on('error', reject);
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ──────────────────────────────────────────────
// Parser
// ──────────────────────────────────────────────

interface LolalyticsRaw {
  skillpriority?: { id?: string };
  skillorder?: { id?: number | string };
  sums?: { ids?: number[] };
  runes?: {
    page?: { pri?: number; sec?: number };
    set?: {
      pri?: number[];
      sec?: number[];
      mod?: number[];
    };
  };
  items?: {
    start?: { setUnique?: number[] };
    core?: { set?: number[] };
    item4?: Array<{ id?: number }>;
    item5?: Array<{ id?: number }>;
    item6?: Array<{ id?: number }>;
  };
}

/** Busca el objeto `summary` de Lolalytics en la lista `objs` resuelta. */
function findSummary(objs: QwikObj[]): LolalyticsRaw | null {
  for (const obj of objs) {
    if (
      obj !== null &&
      typeof obj === 'object' &&
      !Array.isArray(obj) &&
      'skillpriority' in obj &&
      'items' in obj &&
      'runes' in obj
    ) {
      return obj as unknown as LolalyticsRaw;
    }
  }
  return null;
}

function parseHtml(
  html: string,
  championId: number,
  championName: string,
  role: Role,
  patch: string,
): ChampionBuild | null {
  // 1. Extraer bloque qwik/json
  const match = /<script[^>]*type=["']qwik\/json["'][^>]*>(.*?)<\/script>/s.exec(html);
  if (!match) return null;

  let state: { objs?: QwikObj[] };
  try {
    state = JSON.parse(match[1]) as { objs?: QwikObj[] };
  } catch {
    return null;
  }

  const objs = state.objs ?? [];

  // 2. Resolver todas las referencias
  const resolved = objs.map((o) => resolveQwik(o, objs));

  // 3. Localizar el objeto summary
  const summary = findSummary(resolved);
  if (!summary) return null;

  // 4. Runas
  const runeSet = summary.runes?.set;
  const priStyle = STYLE_IDS[summary.runes?.page?.pri ?? 2] ?? STYLE.SORCERY; // 2 = Sorcery
  const secStyle = STYLE_IDS[summary.runes?.page?.sec ?? 4] ?? STYLE.INSPIRATION;
  const [keystone = 0, r1 = 0, r2 = 0, r3 = 0] = runeSet?.pri ?? [];
  const [s1 = 0, s2 = 0] = runeSet?.sec ?? [];
  const [sh1 = 5007, sh2 = 5008, sh3 = 5001] = runeSet?.mod ?? [];

  const runes: RuneSelection = {
    primaryStyleId: priStyle,
    keystoneId: keystone as typeof KEYSTONE[keyof typeof KEYSTONE],
    primary: [r1, r2, r3] as [number, number, number],
    secondaryStyleId: secStyle,
    secondary: [s1, s2] as [number, number],
    shards: [sh1, sh2, sh3] as [number, number, number],
  };

  // 5. Ítems
  const startItems = (summary.items?.start?.setUnique ?? []).filter(Boolean);
  const coreItems = (summary.items?.core?.set ?? []).filter(Boolean);
  const item4 = summary.items?.item4?.map((i) => i.id).filter((x): x is number => !!x) ?? [];
  const item5 = summary.items?.item5?.map((i) => i.id).filter((x): x is number => !!x) ?? [];
  const item6 = summary.items?.item6?.map((i) => i.id).filter((x): x is number => !!x) ?? [];
  const situational = [...new Set([...item4, ...item5, ...item6])].slice(0, 6);

  // 6. Skill order
  const rawOrder = summary.skillorder?.id;
  const fullOrder = rawOrder ? decodeSkillOrder(rawOrder) : [];
  const skillOrder =
    fullOrder.length > 0
      ? skillPriorityFromOrder(fullOrder)
      : (summary.skillpriority?.id?.split('') ?? ['Q', 'W', 'E']);

  // 7. Summoners
  const sumIds = summary.sums?.ids ?? [4, 6];
  const summonerSpells = sumIds.map((id) => SUMMONER_ID[id] ?? `Summoner${id}`);

  return {
    championId,
    championName,
    role,
    summonerSpells,
    runes,
    startingItems: startItems,
    coreItems,
    situationalItems: situational,
    skillOrder,
    source: 'lolalytics',
    patch,
    notes: `Build real de LoLalytics (patch ${patch}, Emerald+, Ranked).`,
  };
}

// ──────────────────────────────────────────────
// Caché en memoria (TTL 1 h)
// ──────────────────────────────────────────────

interface CacheEntry {
  build: ChampionBuild;
  expiresAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000;

// ──────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────

/**
 * Proveedor de builds en tiempo real usando el SSR de LoLalytics.
 * No requiere clave de API. Funciona extrayendo el estado Qwik embebido
 * en el HTML que el servidor devuelve en el primer request.
 */
export class LolalyticsBuildProvider implements BuildProvider {
  readonly name = 'lolalytics';

  /** Nombre del campeón en minúsculas tal como lo usa LoLalytics en las rutas. */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  async getBuildAsync(
    championId: number,
    championName: string,
    role: Role,
    patch: string,
  ): Promise<ChampionBuild | null> {
    const slug = this.slugify(championName);
    const lane = ROLE_TO_LANE[role] ?? 'middle';
    const key = `${slug}:${lane}`;

    const cached = CACHE.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.build;

    const url = `https://lolalytics.com/lol/${slug}/build/${lane !== 'middle' ? `?lane=${lane}` : ''}`;

    try {
      const html = await fetchHtml(url);
      const build = parseHtml(html, championId, championName, role, patch);
      if (build) {
        CACHE.set(key, { build, expiresAt: Date.now() + TTL_MS });
        return build;
      }
    } catch (err) {
      console.warn(`[lolalytics] Error al obtener build para ${championName}:`, err);
    }

    return null;
  }

  /** Implementación síncrona requerida por la interfaz BuildProvider (devuelve caché o null). */
  getBuild(championId: number, role: Role): ChampionBuild | null {
    // Usamos la caché si ya existe; de lo contrario el caller debe usar getBuildAsync.
    for (const [key, entry] of CACHE) {
      if (key.endsWith(`:${ROLE_TO_LANE[role]}`) && entry.build.championId === championId) {
        if (entry.expiresAt > Date.now()) return entry.build;
      }
    }
    return null;
  }
}
