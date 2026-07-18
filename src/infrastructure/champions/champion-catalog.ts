/**
 * Catálogo de campeones desde Data Dragon (CDN oficial de Riot): resuelve
 * championId → nombre e imagen para mostrar icono y nombre en la UI.
 *
 * Es tolerante a fallos: si el CDN no está disponible, `getData()` devuelve null
 * y la UI cae a mostrar el id. Cachea en memoria con un TTL.
 */

import type { DamageType } from '../../domain/aram.js';

export interface ChampionCatalogEntry {
  id: number;
  name: string;
  image: string; // p.ej. "Xerath.png"
}

/** Metadatos internos incluyendo tipo de daño inferido de Data Dragon. */
export interface ChampionMeta extends ChampionCatalogEntry {
  /** id de Data Dragon (p.ej. "Xerath", "MonkeyKing"). */
  ddragonId: string;
  tags: string[];
  damage: DamageType;
}

/** Normaliza un nombre para comparaciones laxas. */
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Limpia el HTML de Data Dragon (tags, saltos) para usar como tooltip de texto. */
export function stripHtml(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ChampionCatalogData {
  version: string;
  /** Base para construir URLs de icono: iconBase + entry.image */
  iconBase: string;
  itemIconBase: string;
  spellIconBase: string;
  passiveIconBase: string;
  shardIconBase: string;
  profileIconBase: string;
  champions: ChampionCatalogEntry[];
}

/** Asset de runa/estilo con URL de icono ya resuelta. */
export interface RuneAsset {
  name: string;
  icon: string;
  desc?: string;
}

export interface ItemEntry {
  id: number;
  name: string;
  image: string;
  desc?: string;
  /** IDs de los componentes de los que se arma este ítem (un nivel). */
  from?: number[];
}

export interface AbilityAsset {
  name: string;
  image: string;
  desc?: string;
}

/** Habilidades del campeón (pasiva + Q/W/E/R). */
export interface ChampionSpells {
  passive: AbilityAsset | null;
  Q: AbilityAsset | null;
  W: AbilityAsset | null;
  E: AbilityAsset | null;
  R: AbilityAsset | null;
}

export type CatalogFetch = (
  url: string,
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

const DDRAGON = 'https://ddragon.leagueoflegends.com';

export interface ChampionCatalogOptions {
  fetchImpl?: CatalogFetch;
  /** Locale de Data Dragon (es_MX, es_ES, en_US, …). */
  locale?: string;
  /** Tiempo de vida de la cache en ms (por defecto 24h). */
  ttlMs?: number;
  /** Timeout por request al CDN (por defecto 8s). */
  fetchTimeoutMs?: number;
  /** Cooldown antes de reintentar tras un fallo (por defecto 30s). */
  retryCooldownMs?: number;
}

export class ChampionCatalog {
  private readonly fetchImpl: CatalogFetch;
  private readonly locale: string;
  private readonly ttlMs: number;
  private readonly retryCooldownMs: number;
  private data: ChampionCatalogData | null = null;
  private byId = new Map<number, ChampionMeta>();
  private byName = new Map<string, number>();
  private byDdragonId = new Map<string, number>();
  private loadedAt = 0;
  private lastAttemptAt = 0;
  private inflight: Promise<ChampionCatalogData | null> | null = null;
  private items = new Map<number, ItemEntry>();
  private itemsLoadedAt = 0;
  private itemsAttemptAt = 0;
  private itemsInflight: Promise<void> | null = null;
  private spellCache = new Map<number, ChampionSpells>();
  private spellAttemptAt = new Map<number, number>();
  private runes = new Map<number, RuneAsset>();
  private runeStyles = new Map<number, RuneAsset>();
  private runesLoadedAt = 0;
  private runesAttemptAt = 0;
  private runesInflight: Promise<void> | null = null;

  constructor(opts: ChampionCatalogOptions = {}) {
    const timeoutMs = opts.fetchTimeoutMs ?? 8000;
    this.fetchImpl =
      opts.fetchImpl ??
      ((url: string) =>
        (globalThis.fetch as typeof fetch)(url, { signal: AbortSignal.timeout(timeoutMs) }));
    this.locale = opts.locale ?? 'en_US';
    this.ttlMs = opts.ttlMs ?? 24 * 60 * 60 * 1000;
    this.retryCooldownMs = opts.retryCooldownMs ?? 30_000;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`Data Dragon ${url} respondió ${res.status}`);
    return JSON.parse(await res.text()) as T;
  }

  private async loadFresh(): Promise<ChampionCatalogData | null> {
    try {
      const versions = await this.fetchJson<string[]>(`${DDRAGON}/api/versions.json`);
      const version = versions[0];
      if (!version) return this.data;

      const champsRaw = await this.fetchChampions(version, this.locale).catch(() =>
        this.locale === 'en_US' ? null : this.fetchChampions(version, 'en_US'),
      );
      if (!champsRaw) return this.data;

      const metas: ChampionMeta[] = Object.values(champsRaw.data).map((c) => ({
        id: Number(c.key),
        name: c.name,
        image: c.image.full,
        ddragonId: c.id,
        tags: c.tags ?? [],
        damage: inferDamage(c.tags ?? [], c.info),
      }));

      this.data = {
        version,
        iconBase: `${DDRAGON}/cdn/${version}/img/champion/`,
        itemIconBase: `${DDRAGON}/cdn/${version}/img/item/`,
        spellIconBase: `${DDRAGON}/cdn/${version}/img/spell/`,
        passiveIconBase: `${DDRAGON}/cdn/${version}/img/passive/`,
        shardIconBase: `${DDRAGON}/cdn/img/perk-images/StatMods/`,
        profileIconBase: `${DDRAGON}/cdn/${version}/img/profileicon/`,
        champions: metas.map((m) => ({ id: m.id, name: m.name, image: m.image })),
      };
      this.byId = new Map(metas.map((m) => [m.id, m]));
      this.byName = new Map(metas.map((m) => [normalizeName(m.name), m.id]));
      this.byDdragonId = new Map(metas.map((m) => [m.ddragonId.toLowerCase(), m.id]));
      this.loadedAt = Date.now();
      return this.data;
    } catch {
      // CDN caído o red no disponible: conservamos lo que tengamos (o null).
      return this.data;
    }
  }

  private fetchChampions(
    version: string,
    locale: string,
  ): Promise<{
    data: Record<
      string,
      {
        key: string;
        id: string;
        name: string;
        image: { full: string };
        tags?: string[];
        info?: { attack: number; magic: number; defense: number };
      }
    >;
  }> {
    return this.fetchJson(`${DDRAGON}/cdn/${version}/data/${locale}/champion.json`);
  }

  /** Metadatos (incluye tipo de daño) del campeón si el catálogo ya está cargado. */
  getMeta(championId: number): ChampionMeta | null {
    return this.byId.get(championId) ?? null;
  }

  /** championId numérico a partir del id de Data Dragon (p.ej. "Xerath"). */
  idFromDdragonId(ddragonId: string): number | null {
    return this.byDdragonId.get(ddragonId.toLowerCase()) ?? null;
  }

  /** championId numérico a partir del nombre visible (comparación laxa). */
  idFromName(name: string): number | null {
    return this.byName.get(normalizeName(name)) ?? null;
  }

  /** Devuelve el catálogo, recargándolo si está vacío o vencido. */
  async getData(): Promise<ChampionCatalogData | null> {
    const fresh = this.data && Date.now() - this.loadedAt < this.ttlMs;
    if (fresh) return this.data;
    // Tras un fallo, no reintentamos en cada petición (evita colgar builds).
    if (!this.inflight && Date.now() - this.lastAttemptAt < this.retryCooldownMs) {
      return this.data;
    }
    this.lastAttemptAt = Date.now();
    this.inflight ??= this.loadFresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  /** Nombre del campeón, o null si no está en el catálogo cargado. */
  async name(championId: number): Promise<string | null> {
    await this.getData();
    return this.byId.get(championId)?.name ?? null;
  }

  /** Asegura cargado el catálogo de ítems (item.json). */
  async ensureItems(): Promise<void> {
    const data = await this.getData();
    if (!data) return;
    const fresh = this.items.size > 0 && Date.now() - this.itemsLoadedAt < this.ttlMs;
    if (fresh) return;
    if (!this.itemsInflight && Date.now() - this.itemsAttemptAt < this.retryCooldownMs) return;
    this.itemsAttemptAt = Date.now();
    this.itemsInflight ??= this.loadItems(data.version).finally(() => {
      this.itemsInflight = null;
    });
    return this.itemsInflight;
  }

  private async loadItems(version: string): Promise<void> {
    try {
      const raw = await this.fetchItems(version, this.locale).catch(() =>
        this.locale === 'en_US' ? null : this.fetchItems(version, 'en_US'),
      );
      if (!raw) return;
      this.items = new Map(
        Object.entries(raw.data).map(([id, v]) => [
          Number(id),
          {
            id: Number(id),
            name: v.name,
            image: v.image.full,
            desc: stripHtml(v.plaintext || v.description),
            ...(v.from && v.from.length ? { from: v.from.map(Number) } : {}),
          },
        ]),
      );
      this.itemsLoadedAt = Date.now();
    } catch {
      // Ítems no disponibles: se resolverán como id crudo.
    }
  }

  private fetchItems(
    version: string,
    locale: string,
  ): Promise<{
    data: Record<
      string,
      { name: string; image: { full: string }; plaintext?: string; description?: string; from?: string[] }
    >;
  }> {
    return this.fetchJson(`${DDRAGON}/cdn/${version}/data/${locale}/item.json`);
  }

  /** Ítem por id si el catálogo de ítems ya está cargado. */
  getItemSync(itemId: number): ItemEntry | null {
    return this.items.get(itemId) ?? null;
  }

  /** Habilidades del campeón (pasiva + Q/W/E/R), cacheadas por campeón. */
  async getChampionSpells(championId: number): Promise<ChampionSpells | null> {
    const cached = this.spellCache.get(championId);
    if (cached) return cached;
    // Cooldown por campeón tras un fallo, para no reintentar en cada petición.
    if (Date.now() - (this.spellAttemptAt.get(championId) ?? 0) < this.retryCooldownMs) return null;
    this.spellAttemptAt.set(championId, Date.now());
    const data = await this.getData();
    const meta = this.byId.get(championId);
    if (!data || !meta) return null;
    try {
      const raw = await this.fetchChampionDetail(data.version, this.locale, meta.ddragonId).catch(
        () =>
          this.locale === 'en_US'
            ? null
            : this.fetchChampionDetail(data.version, 'en_US', meta.ddragonId),
      );
      const cd = raw?.data[meta.ddragonId];
      if (!cd) return null;
      const asset = (a?: { name: string; image: { full: string }; description?: string }): AbilityAsset | null =>
        a ? { name: a.name, image: a.image.full, desc: stripHtml(a.description) } : null;
      const spells: ChampionSpells = {
        passive: asset(cd.passive),
        Q: asset(cd.spells?.[0]),
        W: asset(cd.spells?.[1]),
        E: asset(cd.spells?.[2]),
        R: asset(cd.spells?.[3]),
      };
      this.spellCache.set(championId, spells);
      return spells;
    } catch {
      return null;
    }
  }

  private fetchChampionDetail(
    version: string,
    locale: string,
    ddragonId: string,
  ): Promise<{
    data: Record<
      string,
      {
        spells?: Array<{ name: string; image: { full: string }; description?: string }>;
        passive?: { name: string; image: { full: string }; description?: string };
      }
    >;
  }> {
    return this.fetchJson(`${DDRAGON}/cdn/${version}/data/${locale}/champion/${ddragonId}.json`);
  }

  /** Asegura cargado el árbol de runas (runesReforged.json). */
  async ensureRunes(): Promise<void> {
    const data = await this.getData();
    if (!data) return;
    const fresh = this.runes.size > 0 && Date.now() - this.runesLoadedAt < this.ttlMs;
    if (fresh) return;
    if (!this.runesInflight && Date.now() - this.runesAttemptAt < this.retryCooldownMs) return;
    this.runesAttemptAt = Date.now();
    this.runesInflight ??= this.loadRunes(data.version).finally(() => {
      this.runesInflight = null;
    });
    return this.runesInflight;
  }

  private async loadRunes(version: string): Promise<void> {
    try {
      const raw = await this.fetchRunes(version, this.locale).catch(() =>
        this.locale === 'en_US' ? null : this.fetchRunes(version, 'en_US'),
      );
      if (!raw) return;
      const base = `${DDRAGON}/cdn/img/`;
      const styles = new Map<number, RuneAsset>();
      const runes = new Map<number, RuneAsset>();
      for (const style of raw) {
        styles.set(style.id, { name: style.name, icon: `${base}${style.icon}` });
        for (const slot of style.slots ?? []) {
          for (const rune of slot.runes ?? []) {
            runes.set(rune.id, { name: rune.name, icon: `${base}${rune.icon}`, desc: stripHtml(rune.shortDesc) });
          }
        }
      }
      this.runeStyles = styles;
      this.runes = runes;
      this.runesLoadedAt = Date.now();
    } catch {
      // Runas no disponibles: se resolverán como id crudo.
    }
  }

  private fetchRunes(
    version: string,
    locale: string,
  ): Promise<
    Array<{
      id: number;
      name: string;
      icon: string;
      slots?: Array<{ runes?: Array<{ id: number; name: string; icon: string; shortDesc?: string }> }>;
    }>
  > {
    return this.fetchJson(`${DDRAGON}/cdn/${version}/data/${locale}/runesReforged.json`);
  }

  /** Runa (perk) por id si el árbol ya está cargado. */
  getRuneSync(perkId: number): RuneAsset | null {
    return this.runes.get(perkId) ?? null;
  }

  /** Estilo de runa por id si el árbol ya está cargado. */
  getRuneStyleSync(styleId: number): RuneAsset | null {
    return this.runeStyles.get(styleId) ?? null;
  }
}

/**
 * Infiere el tipo de daño predominante desde los tags e info de Data Dragon.
 * Heurística simple pero suficiente para armar una build genérica.
 */
export function inferDamage(
  tags: string[],
  info?: { attack: number; magic: number },
): DamageType {
  const attack = info?.attack ?? 0;
  const magic = info?.magic ?? 0;
  if (tags.includes('Marksman')) return 'AD';
  if (tags.includes('Mage')) return 'AP';
  if (tags.includes('Tank')) return 'NONE';
  if (tags.includes('Support')) return magic >= attack ? 'AP' : 'NONE';
  if (tags.includes('Assassin') || tags.includes('Fighter')) {
    return magic > attack ? 'AP' : 'AD';
  }
  if (magic > attack) return 'AP';
  if (attack > magic) return 'AD';
  return 'MIXED';
}
