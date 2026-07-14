import type { RecommendationsResponse, Role } from '../domain/types.js';
import { recommendChampions, type ChampionPool } from '../domain/recommendation.js';
import type { ChampSelectReader } from '../infrastructure/lcu/champ-select.js';

export interface RecommendationRequest {
  /** Rol explícito. Si se omite o es UNKNOWN, se intenta detectar de champ select. */
  role?: Role;
  limit?: number;
  comfortChampionIds?: number[];
}

/**
 * Caso de uso: recomendar campeones para una línea.
 *
 * Si no se entrega el rol, intenta leerlo de la sesión de champion select y,
 * de paso, excluye los campeones baneados en la partida.
 */
export class GetChampionRecommendationsUseCase {
  constructor(
    private readonly pool: ChampionPool,
    private readonly champSelectReader?: ChampSelectReader,
  ) {}

  async execute(req: RecommendationRequest = {}): Promise<RecommendationsResponse> {
    let role: Role = req.role ?? 'UNKNOWN';
    let excludeChampionIds: number[] = [];

    if ((role === 'UNKNOWN' || req.role === undefined) && this.champSelectReader) {
      const session = await this.champSelectReader.getSession();
      if (session) {
        if (req.role === undefined) role = session.assignedRole;
        excludeChampionIds = session.bans;
      }
    }

    const recommendations = recommendChampions(
      this.pool,
      role,
      {
        excludeChampionIds,
        ...(req.comfortChampionIds ? { comfortChampionIds: req.comfortChampionIds } : {}),
      },
      req.limit ?? 5,
    );

    return { role, recommendations };
  }
}
