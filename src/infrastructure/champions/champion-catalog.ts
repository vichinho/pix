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

export interface ChampionCatalogData {
  version: string;
  /** Base para construir URLs de icono: iconBase + entry.image */
  iconBase: string;
  itemIconBase: string;
  spellIconBase: string;
  passiveIconBase: string;
  champions: ChampionCatalogEntry[];
}

export interface ItemEntry {
  id: number;
  name: string;
  image: string;
}

export interface AbilityAsset {
  name: string;
  image: string;
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
}

export class ChampionCatalog {
  private readonly fetchImpl: CatalogFetch;
  private readonly locale: string;
  private readonly ttlMs: number;
  private data: ChampionCatalogData | null = null;
  private byId = new Map<number, ChampionMeta>();
  private byName = new Map<string, number>();
  private byDdragonId = new Map<string, number>();
  private loadedAt = 0;
  private inflight: Promise<ChampionCatalogData | null> | null = null;
  private items = new Map<number, ItemEntry>();
  private itemsLoadedAt = 0;
  private itemsInflight: Promise<void> | null = null;
  private spellCache = new Map<number, ChampionSpells>();

  constructor(opts: ChampionCatalogOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as CatalogFetch);
    this.locale = opts.locale ?? 'en_US';
    this.ttlMs = opts.ttlMs ?? 24 * 60 * 60 * 1000;
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
          { id: Number(id), name: v.name, image: v.image.full },
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
  ): Promise<{ data: Record<string, { name: string; image: { full: string } }> }> {
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
      const asset = (a?: { name: string; image: { full: string } }): AbilityAsset | null =>
        a ? { name: a.name, image: a.image.full } : null;
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
        spells?: Array<{ name: string; image: { full: string } }>;
        passive?: { name: string; image: { full: string } };
      }
    >;
  }> {
    return this.fetchJson(`${DDRAGON}/cdn/${version}/data/${locale}/champion/${ddragonId}.json`);
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
