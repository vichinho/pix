import express, { type Express, type Request, type Response } from 'express';
import { fileURLToPath } from 'node:url';
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
import { enrichBuild, bareEnrichedBuild } from '../application/enrich-build.js';
import { GetLiveChampionUseCase } from '../application/get-live-champion.js';
import { LiveGameReader } from '../infrastructure/live/live-game-reader.js';
import { SeedBuildProvider } from '../infrastructure/champions/seed-build-provider.js';
import {
  ArchetypeBuildProvider,
  CatalogArchetypeBuildProvider,
  DefaultBuildProvider,
} from '../infrastructure/champions/archetype-build-provider.js';
import { ChampionCatalog } from '../infrastructure/champions/champion-catalog.js';
import { FallbackBuildProvider, type BuildProvider } from '../domain/build.js';
import { ClientDetector } from '../infrastructure/lcu/client-detector.js';
import { ChampSelectReader } from '../infrastructure/lcu/champ-select.js';
import { GameQueueDetector } from '../infrastructure/lcu/game-queue.js';
import { AramReader } from '../infrastructure/lcu/aram-reader.js';
import { SeedChampionPool } from '../infrastructure/champions/seed-champion-pool.js';
import { SeedChampionTraitProvider } from '../infrastructure/champions/champion-traits.js';
import { RiotApiError, type RiotApiClient } from '../infrastructure/riot/riot-api-client.js';
import {
  MemoryIdentityStore,
  type IdentityStore,
} from '../infrastructure/persistence/identity-store.js';
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
  /** Directorio de la UI web estática. Por defecto, la carpeta `public` del repo. */
  staticDir?: string | null;
  /** Almacén de la última identidad conectada (por defecto en memoria). */
  identityStore?: IdentityStore;
  /** Catálogo de campeones (Data Dragon) para nombre/icono. */
  championCatalog?: ChampionCatalog;
  /** Lector de la Live Client API para el campeón en partida. */
  liveGameReader?: LiveGameReader;
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
  const championCatalog = deps.championCatalog ?? new ChampionCatalog();
  const liveGameReader = deps.liveGameReader ?? new LiveGameReader();
  const getClientStatus = new GetClientStatusUseCase(detector);
  const getChampSelectSession = new GetChampSelectSessionUseCase(champSelectReader);
  const getGameQueue = new GetGameQueueUseCase(gameQueueDetector);
  const getRecommendations = new GetChampionRecommendationsUseCase(
    championPool,
    champSelectReader,
  );
  const getAramAnalysis = new GetAramAnalysisUseCase(aramReader, championTraits);
  const buildProvider =
    deps.buildProvider ??
    new FallbackBuildProvider([
      new SeedBuildProvider(),
      new ArchetypeBuildProvider(championTraits),
      new CatalogArchetypeBuildProvider(championCatalog),
      new DefaultBuildProvider(),
    ]);
  const getChampionBuild = new GetChampionBuildUseCase(buildProvider);
  const getLiveChampion = new GetLiveChampionUseCase(liveGameReader, championCatalog);
  const riotClient = deps.riotClient ?? null;
  const getPlayerProfile = riotClient ? new GetPlayerProfileUseCase(riotClient) : null;
  const getRecentMatches = riotClient ? new GetRecentMatchesUseCase(riotClient) : null;
  const getPlayerStats = getRecentMatches ? new GetPlayerStatsUseCase(getRecentMatches) : null;
  const getPersonalizedRecommendations = getRecentMatches
    ? new GetPersonalizedRecommendationsUseCase(championPool, getRecentMatches, champSelectReader)
    : null;

  const identityStore = deps.identityStore ?? new MemoryIdentityStore();

  /**
   * Resuelve la identidad Riot en orden de preferencia:
   * 1) query explícita, 2) cliente local (y la recuerda), 3) última identidad
   * conocida (para seguir mostrando el perfil aunque el cliente esté cerrado).
   * Tolerante a fallos: nunca propaga errores del cliente.
   */
  async function resolveIdentity(
    gameName: string | undefined,
    tagLine: string | undefined,
  ): Promise<PlayerIdentity | null> {
    if (gameName && tagLine) {
      const identity = { gameName, tagLine };
      identityStore.set(identity);
      return identity;
    }
    try {
      const summoner = await detector.getCurrentSummoner();
      if (summoner && summoner.gameName && summoner.tagLine) {
        const identity = { gameName: summoner.gameName, tagLine: summoner.tagLine };
        identityStore.set(identity);
        return identity;
      }
    } catch {
      // Cliente no disponible o lento: caemos a la última identidad conocida.
    }
    return identityStore.get();
  }

  const app = express();
  app.use(express.json());

  /**
   * Envuelve un handler async para que cualquier error se convierta en una
   * respuesta 500 en vez de un unhandled rejection que deje la petición colgada
   * (y potencialmente el proceso en mal estado).
   */
  const wrap =
    (fn: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response): void => {
      Promise.resolve(fn(req, res)).catch((err) => {
        if (!res.headersSent) {
          res.status(500).json({ error: 'internal_error', message: String(err) });
        }
      });
    };

  // UI web estática (dashboard). Se puede desactivar con staticDir: null.
  const staticDir =
    deps.staticDir === null
      ? null
      : deps.staticDir ?? fileURLToPath(new URL('../../public', import.meta.url));
  if (staticDir) {
    app.use(express.static(staticDir));
  }

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get(
    '/api/champions',
    wrap(async (_req: Request, res: Response) => {
      const data = await championCatalog.getData().catch(() => null);
      if (!data) {
        res.status(503).json({ error: 'catalog_unavailable' });
        return;
      }
      res.json(data);
    }),
  );

  app.get('/api/client/status', async (_req: Request, res: Response) => {
    try {
      const status = await getClientStatus.execute();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: 'client_status_failed', message: String(err) });
    }
  });

  app.get('/api/live/champion', async (_req: Request, res: Response) => {
    try {
      const result = await getLiveChampion.execute();
      if (!result) {
        res.json({ active: false });
        return;
      }
      res.json({ active: true, ...result });
    } catch (err) {
      res.status(500).json({ error: 'live_champion_failed', message: String(err) });
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

  app.get(
    '/api/builds',
    wrap(async (req: Request, res: Response) => {
      const parsed = buildsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
        return;
      }
      // Asegura el catálogo (best-effort) para inferir la build de cualquier campeón.
      await championCatalog.getData().catch(() => null);
      // getChampionBuild siempre devuelve una build (DefaultBuildProvider como último recurso).
      const build = getChampionBuild.execute(parsed.data.championId, parsed.data.role ?? 'UNKNOWN');
      if (!build) {
        res.status(404).json({ error: 'build_not_found', championId: parsed.data.championId });
        return;
      }
      // El enriquecimiento (iconos) no debe tumbar la respuesta: si falla, se
      // devuelve la build sin iconos resueltos.
      try {
        res.json(await enrichBuild(build, championCatalog));
      } catch {
        res.json(bareEnrichedBuild(build));
      }
    }),
  );

  // Rutas planificadas en la especificación, aún no implementadas.
  const notImplemented = (name: string) => (_req: Request, res: Response) => {
    res.status(501).json({ error: 'not_implemented', endpoint: name });
  };
  app.get('/api/settings', notImplemented('settings'));
  app.put('/api/settings', notImplemented('settings'));

  return app;
}
