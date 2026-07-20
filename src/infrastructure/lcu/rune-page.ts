import { LcuConnector } from './lcu-connector.js';
import { readLockfileCredentials, type LcuCredentials } from './lockfile.js';

/** Página de runas a escribir en el cliente (formato del LCU). */
export interface RunePageInput {
  name: string;
  primaryStyleId: number;
  subStyleId: number;
  /** [keystone, 3 primarias, 2 secundarias, 3 fragmentos] = 9 ids. */
  selectedPerkIds: number[];
}

export class LcuUnavailableError extends Error {
  constructor() {
    super('client_not_running');
    this.name = 'LcuUnavailableError';
  }
}

export interface RunePageWriterDeps {
  loadCredentials?: () => Promise<LcuCredentials | null>;
  connectorFactory?: (creds: LcuCredentials) => LcuConnector;
}

/**
 * Escribe una página de runas en el cliente de LoL vía LCU: borra la página
 * actual (si es editable) y crea la nueva como página activa. Permite aplicar la
 * build recomendada con un clic, como hacen Blitz/Porofessor.
 */
export class RunePageWriter {
  private readonly loadCredentials: () => Promise<LcuCredentials | null>;
  private readonly connectorFactory: (creds: LcuCredentials) => LcuConnector;

  constructor(deps: RunePageWriterDeps = {}) {
    this.loadCredentials = deps.loadCredentials ?? readLockfileCredentials;
    this.connectorFactory = deps.connectorFactory ?? ((creds) => new LcuConnector(creds));
  }

  async apply(page: RunePageInput): Promise<void> {
    const creds = await this.loadCredentials();
    if (!creds) throw new LcuUnavailableError();
    const connector = this.connectorFactory(creds);

    // 1) Borra la página actual si el cliente permite borrarla (deja hueco).
    try {
      const current = await connector.request<{ id?: number; isDeletable?: boolean }>(
        '/lol-perks/v1/currentpage',
      );
      if (current?.id != null && current.isDeletable !== false) {
        await connector.request(`/lol-perks/v1/pages/${current.id}`, { method: 'DELETE' });
      }
    } catch {
      // Sin página actual o no accesible: seguimos e intentamos crear la nueva.
    }

    // 2) Crea la nueva página como activa.
    await connector.request('/lol-perks/v1/pages', {
      method: 'POST',
      body: {
        name: page.name,
        primaryStyleId: page.primaryStyleId,
        subStyleId: page.subStyleId,
        selectedPerkIds: page.selectedPerkIds,
        current: true,
      },
    });
  }
}
