import { LcuConnector } from './lcu-connector.js';
import { LcuUnavailableError } from './rune-page.js';
import { readLockfileCredentials, type LcuCredentials } from './lockfile.js';

/** Bloque de un set de ítems (una sección: iniciales, core, situacionales…). */
export interface ItemSetBlock {
  type: string;
  items: number[];
}

/** Set de ítems a crear en el cliente. */
export interface ItemSetInput {
  title: string;
  championId: number;
  blocks: ItemSetBlock[];
}

export interface ItemSetWriterDeps {
  loadCredentials?: () => Promise<LcuCredentials | null>;
  connectorFactory?: (creds: LcuCredentials) => LcuConnector;
}

/**
 * Crea un set de ítems personalizado en el cliente de LoL vía LCU
 * (/lol-item-sets/v1). Aparece en la tienda ordenado por bloques. Reemplaza el
 * set previo con el mismo título para no acumular duplicados.
 */
export class ItemSetWriter {
  private readonly loadCredentials: () => Promise<LcuCredentials | null>;
  private readonly connectorFactory: (creds: LcuCredentials) => LcuConnector;

  constructor(deps: ItemSetWriterDeps = {}) {
    this.loadCredentials = deps.loadCredentials ?? readLockfileCredentials;
    this.connectorFactory = deps.connectorFactory ?? ((creds) => new LcuConnector(creds));
  }

  async apply(set: ItemSetInput): Promise<void> {
    const creds = await this.loadCredentials();
    if (!creds) throw new LcuUnavailableError();
    const connector = this.connectorFactory(creds);

    const summoner = await connector.request<{ summonerId?: number }>(
      '/lol-summoner/v1/current-summoner',
    );
    const summonerId = summoner?.summonerId;
    if (summonerId == null) throw new LcuUnavailableError();

    const url = `/lol-item-sets/v1/item-sets/${summonerId}/sets`;
    const current = await connector
      .request<{ itemSets?: unknown[] }>(url)
      .catch((): { itemSets?: unknown[] } => ({}));
    const existing = Array.isArray(current.itemSets) ? current.itemSets : [];

    const lcuSet = {
      title: set.title,
      type: 'custom',
      map: 'any',
      mode: 'any',
      sortrank: 0,
      startedFrom: 'blank',
      associatedChampions: [set.championId],
      associatedMaps: [] as number[],
      blocks: set.blocks
        .filter((b) => b.items.length > 0)
        .map((b) => ({
          type: b.type,
          items: b.items.map((id) => ({ id: String(id), count: 1 })),
        })),
    };

    // Quita cualquier set previo con el mismo título y antepone el nuevo.
    const filtered = existing.filter(
      (s: unknown) => !(s && typeof s === 'object' && (s as { title?: string }).title === set.title),
    );
    filtered.unshift(lcuSet);

    await connector.request(url, {
      method: 'PUT',
      body: { ...current, itemSets: filtered, timestamp: Date.now() },
    });
  }
}
