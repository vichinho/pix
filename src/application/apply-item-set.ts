import type { Role } from '../domain/types.js';
import type { BuildProvider } from '../domain/build.js';
import type { ItemSetWriter } from '../infrastructure/lcu/item-set.js';

/**
 * Caso de uso: crear en el cliente de LoL el set de ítems de la build recomendada
 * (iniciales / core / situacionales), reusando el mismo BuildProvider que la UI.
 */
export class ApplyItemSetUseCase {
  constructor(
    private readonly buildProvider: BuildProvider,
    private readonly writer: ItemSetWriter,
  ) {}

  async execute(championId: number, role: Role, championName?: string): Promise<void> {
    const build = await this.buildProvider.getBuild(championId, role);
    if (!build) throw new Error('no_build');
    const title = `${championName || build.championName} · PIX`.slice(0, 75);
    await this.writer.apply({
      title,
      championId,
      blocks: [
        { type: 'Iniciales', items: build.startingItems },
        { type: 'Core', items: build.coreItems },
        { type: 'Situacionales', items: build.situationalItems },
      ],
    });
  }
}
