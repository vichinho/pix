import type { LiveGameReader, LiveGameState } from '../infrastructure/live/live-game-reader.js';

/**
 * Caso de uso: estado de la partida en curso (tiempo, objetivos, jugador) para
 * el coach en vivo. Devuelve null si no hay partida activa.
 */
export class GetLiveGameStateUseCase {
  constructor(private readonly reader: LiveGameReader) {}

  execute(): Promise<LiveGameState | null> {
    return this.reader.getGameState();
  }
}
