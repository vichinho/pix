import {
  analyzeComp,
  rankAramOptions,
  type AramChampionOption,
  type ChampionTraitProvider,
  type CompAnalysis,
} from '../domain/aram.js';
import type { AramReader } from '../infrastructure/lcu/aram-reader.js';

/** Campeón mostrado en el equipo/banca. */
export interface AramChampionRef {
  championId: number;
  championName: string;
  /** true si es el slot del jugador local (sólo en `team`). */
  isLocalPlayer?: boolean;
  /** true si no hay metadatos para analizarlo. */
  unknown?: boolean;
}

/** Resultado del análisis de ARAM. */
export interface AramAnalysisResult {
  /** ¿La sesión activa es ARAM (tiene banca)? */
  isAram: boolean;
  /** Equipo propio actual. */
  team: AramChampionRef[];
  /** Campeones disponibles en la banca. */
  bench: AramChampionRef[];
  /** Análisis de la composición actual (los 5). */
  currentComp: CompAnalysis;
  /** Mejor opción disponible para el jugador local (actual + banca). */
  bestOption: AramChampionOption | null;
  /** Opciones disponibles para el jugador local, ordenadas por conveniencia. */
  options: AramChampionOption[];
}

const EMPTY_COMP: CompAnalysis = {
  adCount: 0,
  apCount: 0,
  frontlineCount: 0,
  sustainCount: 0,
  healingCount: 0,
  engageCount: 0,
  hardCcCount: 0,
  pokeCount: 0,
  unknownCount: 0,
  balanced: false,
  missing: [],
  strengths: [],
  needs: {
    needsAd: false,
    needsAp: false,
    needsFrontline: false,
    needsHealingOrSustain: false,
    needsEngage: false,
    needsHardCc: false,
  },
};

/**
 * Caso de uso: analizar la composición de ARAM y recomendar el mejor campeón
 * disponible (actual o de la banca) según los huecos del equipo.
 */
export class GetAramAnalysisUseCase {
  constructor(
    private readonly reader: AramReader,
    private readonly traits: ChampionTraitProvider,
  ) {}

  async execute(): Promise<AramAnalysisResult> {
    const session = await this.reader.getSession();
    if (session === null || !session.benchEnabled) {
      return { isAram: false, team: [], bench: [], currentComp: EMPTY_COMP, bestOption: null, options: [] };
    }

    const nameFor = (id: number): string => this.traits.get(id)?.name ?? `Campeón ${id}`;
    const isUnknown = (id: number): boolean => this.traits.get(id) === null;

    const team: AramChampionRef[] = session.team.map((m) => ({
      championId: m.championId,
      championName: nameFor(m.championId),
      isLocalPlayer: m.isLocalPlayer,
      unknown: isUnknown(m.championId),
    }));

    const bench: AramChampionRef[] = session.benchChampionIds.map((id) => ({
      championId: id,
      championName: nameFor(id),
      unknown: isUnknown(id),
    }));

    // Composición actual (los 5) para el veredicto de equilibrio.
    const currentComp = analyzeComp(session.team.map((m) => this.traits.get(m.championId)));

    // Necesidades de los COMPAÑEROS (sin el slot propio), para evaluar swaps.
    const local = session.team.find((m) => m.isLocalPlayer);
    const teammates = session.team.filter((m) => !m.isLocalPlayer);
    const teamNeeds = analyzeComp(teammates.map((m) => this.traits.get(m.championId))).needs;

    // Disponibles para el jugador local: su campeón actual + la banca.
    const availableIds = [
      ...(local ? [local.championId] : []),
      ...session.benchChampionIds,
    ];
    const options = rankAramOptions(
      availableIds.map((id) => this.traits.get(id)),
      teamNeeds,
      availableIds.length,
    );

    return {
      isAram: true,
      team,
      bench,
      currentComp,
      bestOption: options[0] ?? null,
      options,
    };
  }
}
