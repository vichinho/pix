import type { Role } from '../domain/types.js';
import type { BuildProvider } from '../domain/build.js';
import type { RunePageWriter } from '../infrastructure/lcu/rune-page.js';

/**
 * Caso de uso: aplicar en el cliente de LoL la página de runas de la build
 * recomendada de un campeón/rol. Reusa el mismo BuildProvider que la UI, así las
 * runas aplicadas coinciden exactamente con las mostradas.
 */
export class ApplyRunePageUseCase {
  constructor(
    private readonly buildProvider: BuildProvider,
    private readonly writer: RunePageWriter,
  ) {}

  async execute(championId: number, role: Role, championName?: string): Promise<void> {
    const build = await this.buildProvider.getBuild(championId, role);
    if (!build) throw new Error('no_build');
    const r = build.runes;
    const selectedPerkIds = [r.keystoneId, ...r.primary, ...r.secondary, ...r.shards];
    const name = `${championName || build.championName} · PIX`.slice(0, 75);
    await this.writer.apply({
      name,
      primaryStyleId: r.primaryStyleId,
      subStyleId: r.secondaryStyleId,
      selectedPerkIds,
    });
  }
}
