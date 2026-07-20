import type { GameQueueInfo } from '../domain/types.js';
import type { GameQueueDetector } from '../infrastructure/lcu/game-queue.js';

/**
 * Caso de uso: obtener el tipo de partida actual (cola) para la UI.
 * Permite distinguir casual/normal/ranked/flex/práctica, etc.
 */
export class GetGameQueueUseCase {
  constructor(private readonly detector: GameQueueDetector) {}

  /** Devuelve la info de cola, o null si no hay partida/sesión activa. */
  async execute(): Promise<GameQueueInfo | null> {
    return this.detector.getQueueInfo();
  }
}
