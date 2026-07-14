import type { ClientStatus } from '../domain/types.js';
import type { ClientDetector } from '../infrastructure/lcu/client-detector.js';

/**
 * Caso de uso: obtener el estado consolidado del cliente para la UI.
 * Corresponde a GetCurrentClientStateUseCase de la especificación.
 */
export class GetClientStatusUseCase {
  constructor(private readonly detector: ClientDetector) {}

  async execute(now: () => Date = () => new Date()): Promise<ClientStatus> {
    const { connected, clientState, summoner } = await this.detector.getStatus();
    return {
      connected,
      clientState,
      summoner,
      lastUpdated: now().toISOString(),
    };
  }
}
