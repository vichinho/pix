import express, { type Express, type Request, type Response } from 'express';
import { GetClientStatusUseCase } from '../application/get-client-status.js';
import { ClientDetector } from '../infrastructure/lcu/client-detector.js';

export interface ServerDeps {
  detector?: ClientDetector;
}

/**
 * Construye el servidor API local. Sólo el módulo de detección del cliente
 * está implementado por completo; el resto de rutas de la especificación
 * quedan declaradas como stubs 501 para trazar el contrato.
 */
export function createServer(deps: ServerDeps = {}): Express {
  const detector = deps.detector ?? new ClientDetector();
  const getClientStatus = new GetClientStatusUseCase(detector);

  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/client/status', async (_req: Request, res: Response) => {
    try {
      const status = await getClientStatus.execute();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: 'client_status_failed', message: String(err) });
    }
  });

  // Rutas planificadas en la especificación, aún no implementadas.
  const notImplemented = (name: string) => (_req: Request, res: Response) => {
    res.status(501).json({ error: 'not_implemented', endpoint: name });
  };
  app.get('/api/player/profile', notImplemented('player/profile'));
  app.get('/api/player/matches', notImplemented('player/matches'));
  app.get('/api/champ-select/session', notImplemented('champ-select/session'));
  app.get('/api/recommendations', notImplemented('recommendations'));
  app.get('/api/builds', notImplemented('builds'));
  app.get('/api/settings', notImplemented('settings'));
  app.put('/api/settings', notImplemented('settings'));

  return app;
}
