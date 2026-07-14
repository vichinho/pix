import express, { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import { GetClientStatusUseCase } from '../application/get-client-status.js';
import { GetChampSelectSessionUseCase } from '../application/get-champ-select-session.js';
import { GetGameQueueUseCase } from '../application/get-game-queue.js';
import { GetChampionRecommendationsUseCase } from '../application/get-champion-recommendations.js';
import { ClientDetector } from '../infrastructure/lcu/client-detector.js';
import { ChampSelectReader } from '../infrastructure/lcu/champ-select.js';
import { GameQueueDetector } from '../infrastructure/lcu/game-queue.js';
import { SeedChampionPool } from '../infrastructure/champions/seed-champion-pool.js';
import type { ChampionPool } from '../domain/recommendation.js';

export interface ServerDeps {
  detector?: ClientDetector;
  champSelectReader?: ChampSelectReader;
  gameQueueDetector?: GameQueueDetector;
  championPool?: ChampionPool;
}

const recommendationsQuerySchema = z.object({
  role: z.enum(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

/**
 * Construye el servidor API local. Sólo el módulo de detección del cliente
 * está implementado por completo; el resto de rutas de la especificación
 * quedan declaradas como stubs 501 para trazar el contrato.
 */
export function createServer(deps: ServerDeps = {}): Express {
  const detector = deps.detector ?? new ClientDetector();
  const champSelectReader = deps.champSelectReader ?? new ChampSelectReader();
  const gameQueueDetector = deps.gameQueueDetector ?? new GameQueueDetector();
  const championPool = deps.championPool ?? new SeedChampionPool();
  const getClientStatus = new GetClientStatusUseCase(detector);
  const getChampSelectSession = new GetChampSelectSessionUseCase(champSelectReader);
  const getGameQueue = new GetGameQueueUseCase(gameQueueDetector);
  const getRecommendations = new GetChampionRecommendationsUseCase(
    championPool,
    champSelectReader,
  );

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

  app.get('/api/champ-select/session', async (_req: Request, res: Response) => {
    try {
      const session = await getChampSelectSession.execute();
      if (session === null) {
        res.json({ active: false, session: null });
        return;
      }
      res.json({ active: true, session });
    } catch (err) {
      res.status(500).json({ error: 'champ_select_failed', message: String(err) });
    }
  });

  app.get('/api/game/queue', async (_req: Request, res: Response) => {
    try {
      const queue = await getGameQueue.execute();
      if (queue === null) {
        res.json({ active: false, queue: null });
        return;
      }
      res.json({ active: true, queue });
    } catch (err) {
      res.status(500).json({ error: 'game_queue_failed', message: String(err) });
    }
  });

  app.get('/api/recommendations', async (req: Request, res: Response) => {
    const parsed = recommendationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
      return;
    }
    try {
      const result = await getRecommendations.execute({
        ...(parsed.data.role ? { role: parsed.data.role } : {}),
        ...(parsed.data.limit ? { limit: parsed.data.limit } : {}),
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'recommendations_failed', message: String(err) });
    }
  });

  // Rutas planificadas en la especificación, aún no implementadas.
  const notImplemented = (name: string) => (_req: Request, res: Response) => {
    res.status(501).json({ error: 'not_implemented', endpoint: name });
  };
  app.get('/api/player/profile', notImplemented('player/profile'));
  app.get('/api/player/matches', notImplemented('player/matches'));
  app.get('/api/builds', notImplemented('builds'));
  app.get('/api/settings', notImplemented('settings'));
  app.put('/api/settings', notImplemented('settings'));

  return app;
}
