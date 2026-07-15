/**
 * Catálogo de campeones desde Data Dragon (CDN oficial de Riot): resuelve
 * championId → nombre e imagen para mostrar icono y nombre en la UI.
 *
 * Es tolerante a fallos: si el CDN no está disponible, `getData()` devuelve null
 * y la UI cae a mostrar el id. Cachea en memoria con un TTL.
 */

export interface ChampionCatalogEntry {
  id: number;
  name: string;
  image: string; // p.ej. "Xerath.png"
}

export interface ChampionCatalogData {
  version: string;
  /** Base para construir URLs de icono: iconBase + entry.image */
  iconBase: string;
  champions: ChampionCatalogEntry[];
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
  private byId = new Map<number, ChampionCatalogEntry>();
  private loadedAt = 0;
  private inflight: Promise<ChampionCatalogData | null> | null = null;

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

      const champions: ChampionCatalogEntry[] = Object.values(champsRaw.data).map((c) => ({
        id: Number(c.key),
        name: c.name,
        image: c.image.full,
      }));

      this.data = {
        version,
        iconBase: `${DDRAGON}/cdn/${version}/img/champion/`,
        champions,
      };
      this.byId = new Map(champions.map((c) => [c.id, c]));
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
  ): Promise<{ data: Record<string, { key: string; name: string; image: { full: string } }> }> {
    return this.fetchJson(`${DDRAGON}/cdn/${version}/data/${locale}/champion.json`);
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
}
