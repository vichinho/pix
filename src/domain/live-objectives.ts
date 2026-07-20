/**
 * Cálculo de estado de objetivos épicos a partir del tiempo de partida y los
 * eventos de la Live Client API. Constantes de la Grieta del Invocador.
 */

export const OBJECTIVE_TIMES = {
  DRAGON_FIRST: 300, // 5:00 primer dragón
  DRAGON_RESPAWN: 300, // 5:00 de reaparición
  HERALD_SPAWN: 840, // 14:00 heraldo
  BARON_SPAWN: 1200, // 20:00 barón (y reemplaza al heraldo)
  BARON_RESPAWN: 360, // 6:00 de reaparición
} as const;

export type ObjectiveStatus = 'not_yet' | 'up' | 'respawning' | 'gone';

export interface ObjectiveTimer {
  /** Cuántos se han matado en la partida. */
  taken: number;
  status: ObjectiveStatus;
  /** Segundos hasta que aparezca/reaparezca (null si ya está o no aplica). */
  secondsUntil: number | null;
}

export interface LiveEvent {
  EventName: string;
  EventTime: number;
}

function killTimes(events: LiveEvent[], name: string): number[] {
  return events
    .filter((e) => e.EventName === name)
    .map((e) => e.EventTime)
    .sort((a, b) => a - b);
}

function respawnTimer(
  gameTime: number,
  firstSpawn: number,
  respawn: number,
  kills: number[],
): ObjectiveTimer {
  const taken = kills.length;
  if (taken === 0) {
    if (gameTime < firstSpawn) {
      return { taken, status: 'not_yet', secondsUntil: Math.ceil(firstSpawn - gameTime) };
    }
    return { taken, status: 'up', secondsUntil: null };
  }
  const last = kills[kills.length - 1]!;
  const next = last + respawn;
  if (gameTime < next) {
    return { taken, status: 'respawning', secondsUntil: Math.ceil(next - gameTime) };
  }
  return { taken, status: 'up', secondsUntil: null };
}

export interface Objectives {
  dragon: ObjectiveTimer;
  baron: ObjectiveTimer;
  herald: ObjectiveTimer;
}

/** Calcula el estado de dragón, barón y heraldo. */
export function computeObjectives(gameTime: number, events: LiveEvent[]): Objectives {
  const dragon = respawnTimer(
    gameTime,
    OBJECTIVE_TIMES.DRAGON_FIRST,
    OBJECTIVE_TIMES.DRAGON_RESPAWN,
    killTimes(events, 'DragonKill'),
  );

  const baron = respawnTimer(
    gameTime,
    OBJECTIVE_TIMES.BARON_SPAWN,
    OBJECTIVE_TIMES.BARON_RESPAWN,
    killTimes(events, 'BaronKill'),
  );

  // Heraldo: aparece a las 14:00 y desaparece a las 20:00 (llega el barón).
  const heraldKills = killTimes(events, 'HeraldKill');
  let herald: ObjectiveTimer;
  if (gameTime < OBJECTIVE_TIMES.HERALD_SPAWN) {
    herald = {
      taken: heraldKills.length,
      status: 'not_yet',
      secondsUntil: Math.ceil(OBJECTIVE_TIMES.HERALD_SPAWN - gameTime),
    };
  } else if (gameTime >= OBJECTIVE_TIMES.BARON_SPAWN || heraldKills.length > 0) {
    herald = { taken: heraldKills.length, status: 'gone', secondsUntil: null };
  } else {
    herald = { taken: 0, status: 'up', secondsUntil: null };
  }

  return { dragon, baron, herald };
}
