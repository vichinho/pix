import type { Role } from '../domain/types.js';
import type { LiveGameReader } from '../infrastructure/live/live-game-reader.js';
import type { ChampionCatalog } from '../infrastructure/champions/champion-catalog.js';

/** Campeón del jugador local en partida, resuelto a championId. */
export interface LiveChampionResult {
  championId: number | null;
  championName: string;
  role: Role;
}

/**
 * Caso de uso: obtener el campeón que el jugador está jugando ahora mismo,
 * usando la Live Client API y resolviendo el championId con el catálogo.
 */
export class GetLiveChampionUseCase {
  constructor(
    private readonly reader: LiveGameReader,
    private readonly catalog: ChampionCatalog,
  ) {}

  async execute(): Promise<LiveChampionResult | null> {
    const live = await this.reader.getActiveChampion();
    if (!live) return null;

    await this.catalog.getData();
    let championId: number | null = null;
    if (live.ddragonId) championId = this.catalog.idFromDdragonId(live.ddragonId);
    if (championId === null) championId = this.catalog.idFromName(live.championName);

    return { championId, championName: live.championName, role: live.role };
  }
}
