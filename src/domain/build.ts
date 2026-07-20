import type { ChampionBuild, Role } from './types.js';

/**
 * Proveedor de builds por campeón y rol. Permite abstraer la fuente (seed
 * curada local, proveedor externo, cache) según el "Build Provider Adapter"
 * de la especificación.
 */
export interface BuildProvider {
  /** Nombre del proveedor (para trazabilidad y fallback). */
  readonly name: string;
  /**
   * Devuelve la build para el campeón/rol, o null si no la tiene.
   * Puede ser síncrono (seed/arquetipo) o asíncrono (proveedor externo en red).
   */
  getBuild(championId: number, role: Role): ChampionBuild | null | Promise<ChampionBuild | null>;
}

/**
 * Encadena proveedores: devuelve la primera build disponible. Pensado para
 * anteponer un proveedor externo (meta en vivo) y caer a la seed local /
 * arquetipo si falla o no cubre. Un proveedor que lance error no rompe la
 * cadena: se registra y se pasa al siguiente.
 */
export class FallbackBuildProvider implements BuildProvider {
  readonly name = 'fallback';

  constructor(private readonly providers: BuildProvider[]) {}

  async getBuild(championId: number, role: Role): Promise<ChampionBuild | null> {
    for (const provider of this.providers) {
      try {
        const build = await provider.getBuild(championId, role);
        if (build) return build;
      } catch {
        // Un proveedor caído (p. ej. red) no debe impedir usar los siguientes.
      }
    }
    return null;
  }
}
