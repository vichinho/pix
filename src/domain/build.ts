import type { ChampionBuild, Role } from './types.js';

/**
 * Proveedor de builds por campeón y rol. Permite abstraer la fuente (seed
 * curada local, proveedor externo, cache) según el "Build Provider Adapter"
 * de la especificación.
 */
export interface BuildProvider {
  /** Nombre del proveedor (para trazabilidad y fallback). */
  readonly name: string;
  /** Devuelve la build para el campeón/rol, o null si no la tiene. */
  getBuild(championId: number, role: Role): ChampionBuild | null;
}

/**
 * Encadena proveedores: devuelve la primera build disponible. Pensado para
 * anteponer un proveedor externo y caer a la seed local si falla o no cubre.
 */
export class FallbackBuildProvider implements BuildProvider {
  readonly name = 'fallback';

  constructor(private readonly providers: BuildProvider[]) {}

  getBuild(championId: number, role: Role): ChampionBuild | null {
    for (const provider of this.providers) {
      const build = provider.getBuild(championId, role);
      if (build) return build;
    }
    return null;
  }
}
