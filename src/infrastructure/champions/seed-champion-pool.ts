import type { ChampionCandidate, ChampionPool } from '../../domain/recommendation.js';
import type { Role } from '../../domain/types.js';

/**
 * Pool de campeones semilla por rol para la primera versión del motor de
 * recomendaciones. Es un punto de partida curado (accesible y sólido en meta),
 * pensado para reemplazarse/complementarse luego con Data Dragon y con el
 * historial personal del jugador (Fase 3 de la especificación).
 *
 * Los championId corresponden a los keys numéricos de Riot / Data Dragon.
 */
const SEED: Record<Exclude<Role, 'UNKNOWN'>, ChampionCandidate[]> = {
  TOP: [
    { championId: 86, championName: 'Garen', role: 'TOP', baseScore: 78 },
    { championId: 122, championName: 'Darius', role: 'TOP', baseScore: 80 },
    { championId: 54, championName: 'Malphite', role: 'TOP', baseScore: 76 },
    { championId: 875, championName: 'Sett', role: 'TOP', baseScore: 79 },
    { championId: 24, championName: 'Jax', role: 'TOP', baseScore: 77 },
    { championId: 114, championName: 'Fiora', role: 'TOP', baseScore: 74 },
    { championId: 516, championName: 'Ornn', role: 'TOP', baseScore: 72 },
  ],
  JUNGLE: [
    { championId: 19, championName: 'Warwick', role: 'JUNGLE', baseScore: 79 },
    { championId: 32, championName: 'Amumu', role: 'JUNGLE', baseScore: 75 },
    { championId: 64, championName: 'Lee Sin', role: 'JUNGLE', baseScore: 74 },
    { championId: 234, championName: 'Viego', role: 'JUNGLE', baseScore: 77 },
    { championId: 11, championName: 'Master Yi', role: 'JUNGLE', baseScore: 73 },
    { championId: 20, championName: 'Nunu & Willump', role: 'JUNGLE', baseScore: 72 },
  ],
  MIDDLE: [
    { championId: 103, championName: 'Ahri', role: 'MIDDLE', baseScore: 80 },
    { championId: 99, championName: 'Lux', role: 'MIDDLE', baseScore: 76 },
    { championId: 90, championName: 'Malzahar', role: 'MIDDLE', baseScore: 75 },
    { championId: 1, championName: 'Annie', role: 'MIDDLE', baseScore: 73 },
    { championId: 45, championName: 'Veigar', role: 'MIDDLE', baseScore: 74 },
    { championId: 157, championName: 'Yasuo', role: 'MIDDLE', baseScore: 70 },
  ],
  BOTTOM: [
    { championId: 22, championName: 'Ashe', role: 'BOTTOM', baseScore: 79 },
    { championId: 21, championName: 'Miss Fortune', role: 'BOTTOM', baseScore: 80 },
    { championId: 51, championName: 'Caitlyn', role: 'BOTTOM', baseScore: 77 },
    { championId: 222, championName: 'Jinx', role: 'BOTTOM', baseScore: 78 },
    { championId: 81, championName: 'Ezreal', role: 'BOTTOM', baseScore: 74 },
    { championId: 145, championName: "Kai'Sa", role: 'BOTTOM', baseScore: 76 },
  ],
  UTILITY: [
    { championId: 16, championName: 'Soraka', role: 'UTILITY', baseScore: 77 },
    { championId: 89, championName: 'Leona', role: 'UTILITY', baseScore: 79 },
    { championId: 117, championName: 'Lulu', role: 'UTILITY', baseScore: 76 },
    { championId: 25, championName: 'Morgana', role: 'UTILITY', baseScore: 75 },
    { championId: 111, championName: 'Nautilus', role: 'UTILITY', baseScore: 78 },
    { championId: 40, championName: 'Janna', role: 'UTILITY', baseScore: 73 },
  ],
};

/** Implementación de ChampionPool basada en la seed estática. */
export class SeedChampionPool implements ChampionPool {
  getCandidates(role: Role): ChampionCandidate[] {
    if (role === 'UNKNOWN') return [];
    // Copia defensiva para que quien consuma no mute la seed.
    return SEED[role].map((c) => ({ ...c }));
  }
}
