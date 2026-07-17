import type { BuildProvider } from '../../domain/build.js';
import type { ChampionBuild, Role, RuneSelection } from '../../domain/types.js';

/**
 * ¿Cómo obtienen op.gg / u.gg sus builds "del meta en tiempo real"?
 *
 * No hay ninguna fuente mágica: esas páginas ingieren MILLONES de partidas
 * clasificatorias por parche a través de la Riot API (match-v5), y agregan
 * estadísticamente qué runas, hechizos, ítems y orden de habilidades usan (y con
 * qué win rate) los jugadores por campeón, rol y elo. El "build meta" es, por
 * tanto, el conjunto más popular/ganador entre esas partidas. u.gg publica esos
 * agregados en endpoints JSON internos (stats2.u.gg) que su web consume; aquí los
 * usamos como fuente de builds específicas por campeón.
 *
 * Es una API NO oficial: su formato puede cambiar sin aviso. Por eso este
 * proveedor es defensivo (ante cualquier sorpresa devuelve null) y en la cadena
 * de proveedores cae a las builds curadas/arquetipo si u.gg no responde o cambia.
 */

/** Hechizos de invocador: id de Riot → nombre (para resolver su icono). */
const SPELL_ID_TO_NAME: Record<number, string> = {
  1: 'cleanse', 3: 'exhaust', 4: 'flash', 6: 'ghost', 7: 'heal',
  11: 'smite', 12: 'teleport', 13: 'clarity', 14: 'ignite', 21: 'barrier',
  32: 'mark', 39: 'mark',
};

/** Roles de u.gg (Grieta). ARAM no tiene rol → usamos "none" (6). */
const UGG_ROLE_ID: Record<string, string> = {
  JUNGLE: '1', UTILITY: '2', BOTTOM: '3', TOP: '4', MIDDLE: '5', ARAM: '6', UNKNOWN: '6',
};

/** Modo de juego de u.gg según el rol pedido. */
function uggGameMode(role: Role): string {
  return role === 'ARAM' ? 'aram' : 'ranked_solo_5x5';
}

/**
 * Headers de navegador. El CDN de u.gg (stats2) responde 403 a peticiones sin
 * un User-Agent creíble; enviarlos evita el bloqueo anti-bots.
 */
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://u.gg',
  Referer: 'https://u.gg/',
};

export interface UggConfig {
  /** Parche en formato u.gg, p. ej. "15_1". Si se omite, se descubre online. */
  patch?: string;
  /** Versión del endpoint overview, p. ej. "1.5.0". */
  overviewVersion?: string;
  /** Región de u.gg. "12" = mundo. */
  regionId?: string;
  /** Rango. "10" = platino+, "8" = general. */
  rankId?: string;
  /** Timeout de red en ms. */
  timeoutMs?: number;
  /** Segundos de validez de la caché por campeón. */
  cacheTtlSec?: number;
  fetchImpl?: typeof fetch;
}

interface CacheEntry {
  build: ChampionBuild | null;
  at: number;
}

/**
 * Proveedor de builds del meta en vivo desde u.gg (stats2.u.gg).
 * Cubre a cualquier campeón. Ante cualquier fallo devuelve null (fallback).
 */
export class UggBuildProvider implements BuildProvider {
  readonly name = 'u.gg';

  private readonly regionId: string;
  private readonly rankId: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly configuredPatch: string | undefined;
  private readonly configuredVersion: string | undefined;
  private readonly cache = new Map<string, CacheEntry>();
  private versionPromise: Promise<{ patch: string; version: string } | null> | null = null;
  private versionFailedUntil = 0;

  constructor(cfg: UggConfig = {}) {
    this.regionId = cfg.regionId ?? '12';
    this.rankId = cfg.rankId ?? '10';
    this.timeoutMs = cfg.timeoutMs ?? 5000;
    this.cacheTtlMs = (cfg.cacheTtlSec ?? 6 * 3600) * 1000;
    this.fetchImpl = cfg.fetchImpl ?? (globalThis.fetch as typeof fetch);
    this.configuredPatch = cfg.patch;
    this.configuredVersion = cfg.overviewVersion;
  }

  async getBuild(championId: number, role: Role): Promise<ChampionBuild | null> {
    const key = `${championId}:${role}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.cacheTtlMs) return hit.build;

    let build: ChampionBuild | null = null;
    try {
      const raw = await this.fetchRawOverview(championId, role);
      build = raw ? this.parseOverview(raw, championId, role) : null;
    } catch {
      build = null;
    }
    this.cache.set(key, { build, at: Date.now() });
    return build;
  }

  /** GET con headers de navegador y timeout. */
  private get(url: string): Promise<Response> {
    return this.fetchImpl(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  /** Descarga el JSON crudo del overview de u.gg (o null si falla). Público para diagnóstico. */
  async fetchRawOverview(championId: number, role: Role): Promise<unknown | null> {
    const ver = await this.resolveVersion();
    if (!ver) return null;
    const url = this.overviewUrl(championId, role, ver);
    const res = await this.get(url);
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  }

  private overviewUrl(
    championId: number,
    role: Role,
    ver: { patch: string; version: string },
  ): string {
    const primary = ver.version.split('.').slice(0, 2).join('.'); // "1.5.0" → "1.5"
    const mode = uggGameMode(role);
    return `https://stats2.u.gg/lol/${primary}/overview/${ver.patch}/${mode}/${championId}/${ver.version}.json`;
  }

  /**
   * Diagnóstico completo para calibrar el parser con datos reales: URL probada,
   * parche/versión resueltos, estado HTTP, JSON crudo y la build parseada.
   */
  async debug(
    championId: number,
    role: Role,
  ): Promise<{
    patch: string | null;
    version: string | null;
    url: string | null;
    httpStatus: number | null;
    raw: unknown | null;
    parsed: ChampionBuild | null;
    error: string | null;
  }> {
    const base = {
      patch: null as string | null,
      version: null as string | null,
      url: null as string | null,
      httpStatus: null as number | null,
      raw: null as unknown,
      parsed: null as ChampionBuild | null,
      error: null as string | null,
    };
    try {
      const ver = await this.resolveVersion();
      if (!ver) return { ...base, error: 'no_version_resolved' };
      base.patch = ver.patch;
      base.version = ver.version;
      const url = this.overviewUrl(championId, role, ver);
      base.url = url;
      const res = await this.get(url);
      base.httpStatus = res.status;
      if (!res.ok) return base;
      const raw = (await res.json()) as unknown;
      base.raw = raw;
      base.parsed = this.parseOverview(raw, championId, role);
      return base;
    } catch (err) {
      return { ...base, error: String(err) };
    }
  }

  /** Resuelve parche + versión: config explícita, o descubrimiento online cacheado. */
  private async resolveVersion(): Promise<{ patch: string; version: string } | null> {
    if (this.configuredPatch && this.configuredVersion) {
      return { patch: this.configuredPatch, version: this.configuredVersion };
    }
    if (Date.now() < this.versionFailedUntil) return null;
    if (!this.versionPromise) {
      this.versionPromise = this.discoverVersion().catch(() => {
        this.versionFailedUntil = Date.now() + 5 * 60 * 1000; // reintenta en 5 min
        this.versionPromise = null;
        return null;
      });
    }
    return this.versionPromise;
  }

  private async discoverVersion(): Promise<{ patch: string; version: string } | null> {
    const url =
      'https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/ugg/ugg-api-versions.json';
    const res = await this.get(url);
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, Record<string, string>>;
    // El parche más alto (claves tipo "15_1", "14_24"…). Orden numérico por partes.
    const patches = Object.keys(json).sort((a, b) => cmpPatch(b, a));
    const patch = patches[0];
    if (!patch) return null;
    const version = json[patch]?.overview ?? this.configuredVersion;
    if (!version) return null;
    return { patch, version };
  }

  /**
   * Parser del overview de u.gg → ChampionBuild. Basado en la estructura
   * posicional conocida (overview 1.5). Defensivo: si algo no cuadra, null.
   *
   * Estructura esperada: json[regionId][rankId][roleId] = data[], donde:
   *   data[0] → runas   data[1] → hechizos   data[2] → ítems iniciales
   *   data[3] → ítems core   data[4] → habilidades   data[5..7] → ítems opción
   */
  parseOverview(raw: unknown, championId: number, role: Role): ChampionBuild | null {
    const roleId = UGG_ROLE_ID[role] ?? '6';
    const byRegion = raw as Record<string, Record<string, Record<string, unknown>>>;
    const data =
      byRegion?.[this.regionId]?.[this.rankId]?.[roleId] ??
      // Si el rango pedido no existe, probamos "general" (8).
      byRegion?.[this.regionId]?.['8']?.[roleId];
    if (!Array.isArray(data)) return null;

    const runes = this.parseRunes(data[0]);
    const summonerSpells = this.parseSummoners(data[1]);
    const startingItems = this.parseItems(data[2]);
    const coreItems = this.parseItems(data[3]);
    const skillOrder = this.parseSkills(data[4]);
    const situationalItems = [data[5], data[6], data[7]].flatMap((d) => this.parseItems(d)).slice(0, 6);

    if (!runes || coreItems.length === 0) return null;

    return {
      championId,
      championName: `Campeón ${championId}`, // el catálogo lo reemplaza al enriquecer
      role,
      summonerSpells,
      runes,
      startingItems,
      coreItems,
      situationalItems,
      skillOrder: skillOrder.length ? skillOrder : ['Q', 'W', 'E'],
      source: 'u.gg',
      patch: 'meta',
    };
  }

  private parseRunes(node: unknown): RuneSelection | null {
    // data[0] = [ _, _, [perkIds...], [shardIds...], primaryStyleId, secondaryStyleId ]
    if (!Array.isArray(node)) return null;
    const perks = (node.find((x) => Array.isArray(x) && (x as number[]).every((n) => typeof n === 'number' && n > 5100)) as number[] | undefined) ?? [];
    const styles = node.filter((x) => typeof x === 'number' && x >= 8000 && x <= 8500) as number[];
    if (perks.length < 4 || styles.length < 2) return null;
    const [primaryStyleId, secondaryStyleId] = styles;
    // perks: keystone + 3 primarias + 2 secundarias = 6.
    const keystoneId = perks[0]!;
    const primary = perks.slice(1, 4);
    const secondary = perks.slice(4, 6);
    const shards = (node.find(
      (x) => Array.isArray(x) && (x as number[]).every((n) => n >= 5001 && n <= 5013),
    ) as number[] | undefined) ?? [];
    return {
      primaryStyleId: primaryStyleId!,
      keystoneId,
      primary,
      secondaryStyleId: secondaryStyleId!,
      secondary,
      shards,
    };
  }

  private parseSummoners(node: unknown): string[] {
    const ids = deepNumbers(node).filter((n) => n in SPELL_ID_TO_NAME).slice(0, 2);
    const names = ids.map((id) => SPELL_ID_TO_NAME[id]!).filter(Boolean);
    return names.length ? names : ['flash', 'ignite'];
  }

  private parseItems(node: unknown): number[] {
    // Ítems: ids típicamente 1000-7999 (algunos nuevos hasta ~8090, pero esos
    // chocan con runas 8000+, así que acotamos a < 8000 para ítems).
    return deepNumbers(node).filter((n) => n >= 1000 && n < 8000);
  }

  private parseSkills(node: unknown): string[] {
    const letters = ['Q', 'W', 'E', 'R'];
    // u.gg codifica habilidades como 1..4 (Q,W,E,R) o como letras.
    const nums = deepNumbers(node).filter((n) => n >= 1 && n <= 4);
    const order: string[] = [];
    for (const n of nums) {
      const l = letters[n - 1]!;
      if (!order.includes(l) && l !== 'R') order.push(l);
      if (order.length === 3) break;
    }
    return order;
  }
}

/** Compara dos parches "a_b" numéricamente (mayor = más nuevo). */
function cmpPatch(a: string, b: string): number {
  const [a1, a2] = a.split('_').map(Number);
  const [b1, b2] = b.split('_').map(Number);
  return (a1! - b1!) || (a2! - b2!);
}

/** Extrae todos los números de una estructura anidada, en orden. */
function deepNumbers(node: unknown, out: number[] = []): number[] {
  if (typeof node === 'number') out.push(node);
  else if (Array.isArray(node)) for (const x of node) deepNumbers(x, out);
  return out;
}
