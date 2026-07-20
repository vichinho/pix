import type { ChampSelectSnapshot } from '../domain/types.js';
import type { ChampSelectReader } from '../infrastructure/lcu/champ-select.js';

/**
 * Caso de uso: obtener la sesión actual de champion select para la UI.
 * Corresponde a GetChampSelectSessionUseCase de la especificación.
 */
export class GetChampSelectSessionUseCase {
  constructor(private readonly reader: ChampSelectReader) {}

  /** Devuelve la instantánea de champ select, o null si no hay una activa. */
  async execute(): Promise<ChampSelectSnapshot | null> {
    return this.reader.getSession();
  }
}
