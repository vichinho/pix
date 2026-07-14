import type { ChampionBuild, Role } from '../domain/types.js';
import type { BuildProvider } from '../domain/build.js';

/**
 * Caso de uso: obtener la build recomendada de un campeón para un rol (HU-09/10).
 * Delega en el BuildProvider configurado (seed local y/o proveedor externo).
 */
export class GetChampionBuildUseCase {
  constructor(private readonly provider: BuildProvider) {}

  execute(championId: number, role: Role): ChampionBuild | null {
    return this.provider.getBuild(championId, role);
  }
}
