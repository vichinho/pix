import express, { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import { GetClientStatusUseCase } from '../application/get-client-status.js';
import { GetChampSelectSessionUseCase } from '../application/get-champ-select-session.js';
import { GetGameQueueUseCase } from '../application/get-game-queue.js';
import { GetChampionRecommendationsUseCase } from '../application/get-champion-recommendations.js';
import { GetAramAnalysisUseCase } from '../application/get-aram-analysis.js';
import { GetPlayerProfileUseCase, type PlayerIdentity } from '../application/get-player-profile.js';
import { GetRecentMatchesUseCase } from '../application/get-recent-matches.js';
import { GetPlayerStatsUseCase } from '../application/get-player-stats.js';
import { GetPersonalizedRecommendationsUseCase } from '../application/get-personalized-recommendations.js';
import { GetChampionBuildUseCase } from '../application/get-champion-build.js';
import { SeedBuildProvider } from '../infrastructure/champions/seed-build-provider.js';
import type { BuildProvider } from '../domain/build.js';
import { ClientDetector } from '../infrastructure/lcu/client-detector.js';
import { ChampSelectReader } from '../infrastructure/lcu/champ-select.js';
import { GameQueueDetector } from '../infrastructure/lcu/game-queue.js';
import { AramReader } from '../infrastructure/lcu/aram-reader.js';
import { SeedChampionPool } from '../infrastructure/champions/seed-champion-pool.js';
import { SeedChampionTraitProvider } from '../infrastructure/champions/champion-traits.js';
import { RiotApiError, type RiotApiClient } from '../infrastructure/riot/riot-api-client.js';
import type { ChampionPool } from '../domain/recommendation.js';
import type { ChampionTraitProvider } from '../domain/aram.js';

export interface ServerDeps {
  detector?: ClientDetector;
  champSelectReader?: ChampSelectReader;
  gameQueueDetector?: GameQueueDetector;
  championPool?: ChampionPool;
  aramReader?: AramReader;
  championTraits?: ChampionTraitProvider;
  /** Cliente Riot API; si es null/ausente, las rutas de perfil/historial devuelven 503. */
  riotClient?: RiotApiClient | null;
  buildProvider?: BuildProvider;
}

const recommendationsQuerySchema = z.object({
  role: z.enum(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
  personalized: z.enum(['true', 'false']).optional(),
  gameName: z.string().min(1).optional(),
  tagLine: z.string().min(1).optional(),
});

const buildsQuerySchema = z.object({
  championId: z.coerce.number().int().positive(),
  role: z.enum(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']).optional(),
});

const identityQuerySchema = z.object({
  gameName: z.string().min(1).optional(),
  tagLine: z.string().min(1).optional(),
  count: z.coerce.number().int().min(1).max(20).optional(),
});

/** Traduce un error de Riot API a un status HTTP y mensaje para el cliente local. */
function riotErrorResponse(res: Response, err: unknown): void {
  if (err instanceof RiotApiError) {
    const map: Record<number, string> = {
      401: 'riot_api_key_invalid',
      403: 'riot_api_key_forbidden_or_expired',
      404: 'not_found',
      429: 'riot_rate_limited',
    };
    res
      .status(err.status === 429 ? 429 : err.status >= 500 ? 502 : 400)
      .json({ error: map[err.status] ?? 'riot_api_error', status: err.status });
    return;
  }
  res.status(500).json({ error: 'internal_error', message: String(err) });
}

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
  const aramReader = deps.aramReader ?? new AramReader();
  const championTraits = deps.championTraits ?? new SeedChampionTraitProvider();
  const getClientStatus = new GetClientStatusUseCase(detector);
  const getChampSelectSession = new GetChampSelectSessionUseCase(champSelectReader);
  const getGameQueue = new GetGameQueueUseCase(gameQueueDetector);
  const getRecommendations = new GetChampionRecommendationsUseCase(
    championPool,
    champSelectReader,
  );
  const getAramAnalysis = new GetAramAnalysisUseCase(aramReader, championTraits);
  const buildProvider = deps.buildProvider ?? new SeedBuildProvider();
  const getChampionBuild = new GetChampionBuildUseCase(buildProvider);
  const riotClient = deps.riotClient ?? null;
  const getPlayerProfile = riotClient ? new GetPlayerProfileUseCase(riotClient) : null;
  const getRecentMatches = riotClient ? new GetRecentMatchesUseCase(riotClient) : null;
  const getPlayerStats = getRecentMatches ? new GetPlayerStatsUseCase(getRecentMatches) : null;
  const getPersonalizedRecommendations = getRecentMatches
    ? new GetPersonalizedRecommendationsUseCase(championPool, getRecentMatches, champSelectReader)
    : null;

  /** Resuelve la identidad Riot: primero de la query, luego del cliente local. */
  async function resolveIdentity(
    gameName: string | undefined,
    tagLine: string | undefined,
  ): Promise<PlayerIdentity | null> {
    if (gameName && tagLine) return { gameName, tagLine };
    const summoner = await detector.getCurrentSummoner();
    if (summoner && summoner.gameName && summoner.tagLine) {
      return { gameName: summoner.gameName, tagLine: summoner.tagLine };
    }
    return null;
  }

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
    const { role, limit, personalized, gameName, tagLine } = parsed.data;

    // Ruta personalizada: combina el pool base con el historial del jugador.
    if (personalized === 'true') {
      if (!getPersonalizedRecommendations) {
        res.status(503).json({ error: 'riot_not_configured' });
        return;
      }
      const identity = await resolveIdentity(gameName, tagLine);
      if (!identity) {
        res.status(400).json({ error: 'identity_unavailable' });
        return;
      }
      try {
        res.json(
          await getPersonalizedRecommendations.execute({
            identity,
            ...(role ? { role } : {}),
            ...(limit ? { limit } : {}),
          }),
        );
      } catch (err) {
        riotErrorResponse(res, err);
      }
      return;
    }

    try {
      const result = await getRecommendations.execute({
        ...(role ? { role } : {}),
        ...(limit ? { limit } : {}),
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'recommendations_failed', message: String(err) });
    }
  });

  app.get('/api/aram/analysis', async (_req: Request, res: Response) => {
    try {
      const analysis = await getAramAnalysis.execute();
      res.json(analysis);
    } catch (err) {
      res.status(500).json({ error: 'aram_analysis_failed', message: String(err) });
    }
  });

  app.get('/api/player/profile', async (req: Request, res: Response) => {
    if (!getPlayerProfile) {
      res.status(503).json({ error: 'riot_not_configured' });
      return;
    }
    const parsed = identityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
      return;
    }
    const identity = await resolveIdentity(parsed.data.gameName, parsed.data.tagLine);
    if (!identity) {
      res.status(400).json({ error: 'identity_unavailable' });
      return;
    }
    try {
      res.json(await getPlayerProfile.execute(identity));
    } catch (err) {
      riotErrorResponse(res, err);
    }
  });

  app.get('/api/player/matches', async (req: Request, res: Response) => {
    if (!getRecentMatches) {
      res.status(503).json({ error: 'riot_not_configured' });
      return;
    }
    const parsed = identityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
      return;
    }
    const identity = await resolveIdentity(parsed.data.gameName, parsed.data.tagLine);
    if (!identity) {
      res.status(400).json({ error: 'identity_unavailable' });
      return;
    }
    try {
      const matches = await getRecentMatches.execute(identity, parsed.data.count ?? 10);
      res.json({ matches });
    } catch (err) {
      riotErrorResponse(res, err);
    }
  });

  app.get('/api/player/stats', async (req: Request, res: Response) => {
    if (!getPlayerStats) {
      res.status(503).json({ error: 'riot_not_configured' });
      return;
    }
    const parsed = identityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
      return;
    }
    const identity = await resolveIdentity(parsed.data.gameName, parsed.data.tagLine);
    if (!identity) {
      res.status(400).json({ error: 'identity_unavailable' });
      return;
    }
    try {
      res.json(await getPlayerStats.execute(identity, parsed.data.count ?? 20));
    } catch (err) {
      riotErrorResponse(res, err);
    }
  });

  app.get('/api/builds', (req: Request, res: Response) => {
    const parsed = buildsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
      return;
    }
    const build = getChampionBuild.execute(parsed.data.championId, parsed.data.role ?? 'UNKNOWN');
    if (!build) {
      res.status(404).json({ error: 'build_not_found', championId: parsed.data.championId });
      return;
    }
    res.json(build);
  });

  // Rutas planificadas en la especificación, aún no implementadas.
  const notImplemented = (name: string) => (_req: Request, res: Response) => {
    res.status(501).json({ error: 'not_implemented', endpoint: name });
  };
  app.get('/api/settings', notImplemented('settings'));
  app.put('/api/settings', notImplemented('settings'));

  return app;
}
