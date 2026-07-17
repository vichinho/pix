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
import { GetLiveGameStateUseCase } from '../application/get-live-game-state.js';
import { LiveGameReader } from '../infrastructure/live/live-game-reader.js';
import { SeedBuildProvider } from '../infrastructure/champions/seed-build-provider.js';
import { UggBuildProvider } from '../infrastructure/champions/ugg-build-provider.js';
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
  /** Proveedor de builds del meta en vivo (u.gg). Se antepone a la seed si se pasa. */
  uggProvider?: UggBuildProvider | null;
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
  role: z.enum(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY', 'UNKNOWN']).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
  personalized: z.enum(['true', 'false']).optional(),
  gameName: z.string().min(1).optional(),
  tagLine: z.string().min(1).optional(),
  platform: z.string().min(2).max(5).optional(),
});

const buildsQuerySchema = z.object({
  championId: z.coerce.number().int().positive(),
  role: z.enum(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY', 'ARAM', 'UNKNOWN']).optional(),
});

const identityQuerySchema = z.object({
  gameName: z.string().min(1).optional(),
  tagLine: z.string().min(1).optional(),
  /** Máximo 50 para soportar la paginación del historial de partidas en cliente. */
  count: z.coerce.number().int().min(1).max(50).optional(),
  /** Plataforma Riot (la1, la2, na1, euw1…) para enrutar summoner-v4/league-v4. */
  platform: z.string().min(2).max(5).optional(),
  /** Filtro de historial por queueId (p. ej. 450 = ARAM). */
  queue: z.coerce.number().int().positive().optional(),
  /** Filtro de historial por tipo (ranked | normal | tourney). */
  type: z.enum(['ranked', 'normal', 'tourney']).optional(),
});

/**
 * Mapa plataforma → región de enrutado (account-v1 y match-v5 usan la región;
 * summoner-v4 y league-v4 usan la plataforma). Permite que el usuario elija su
 * servidor en la interfaz sin tener que tocar variables de entorno.
 */
const PLATFORM_TO_REGION: Record<string, string> = {
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas',
  euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe',
  kr: 'asia', jp1: 'asia',
  oc1: 'sea', ph2: 'sea', sg2: 'sea', th2: 'sea', tw2: 'sea', vn2: 'sea',
};

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
  const uggProvider = deps.uggProvider ?? null;
  const buildProvider =
    deps.buildProvider ??
    new FallbackBuildProvider([
      // Meta en vivo (u.gg) primero: builds específicas por campeón y parche.
      // Si u.gg no responde o cambia de formato, cae a las curadas/arquetipo.
      ...(uggProvider ? [uggProvider] : []),
      new SeedBuildProvider(),
      new CatalogArchetypeBuildProvider(championCatalog),
      new ArchetypeBuildProvider(championTraits),
      new DefaultBuildProvider(),
    ]);
  const getChampionBuild = new GetChampionBuildUseCase(buildProvider);
  const getLiveChampion = new GetLiveChampionUseCase(liveGameReader, championCatalog);
  const getLiveGameState = new GetLiveGameStateUseCase(liveGameReader);
  const riotClient = deps.riotClient ?? null;
  const getPlayerProfile = riotClient ? new GetPlayerProfileUseCase(riotClient) : null;
  const getRecentMatches = riotClient ? new GetRecentMatchesUseCase(riotClient) : null;
  const getPlayerStats = getRecentMatches ? new GetPlayerStatsUseCase(getRecentMatches) : null;
  const getPersonalizedRecommendations = getRecentMatches
    ? new GetPersonalizedRecommendationsUseCase(championPool, getRecentMatches, champSelectReader)
    : null;

  /**
   * Devuelve los casos de uso de perfil/partidas enrutados a la plataforma pedida.
   * Si no se especifica plataforma (o no hay Riot API), usa los de por defecto.
   */
  // Casos de uso por plataforma, memorizados: así el cliente enrutado (y sus
  // cachés de cuenta y de partidas) persiste entre peticiones en vez de crearse
  // de cero cada vez (clave cuando el usuario siempre envía platform=la2).
  const routedCache = new Map<
    string,
    { profile: typeof getPlayerProfile; matches: typeof getRecentMatches; stats: typeof getPlayerStats }
  >();
  function routedRiot(platform: string | undefined): {
    profile: typeof getPlayerProfile;
    matches: typeof getRecentMatches;
    stats: typeof getPlayerStats;
  } {
    if (!riotClient || !platform || platform.toLowerCase() === riotClient.platform) {
      return { profile: getPlayerProfile, matches: getRecentMatches, stats: getPlayerStats };
    }
    const key = platform.toLowerCase();
    const hit = routedCache.get(key);
    if (hit) return hit;
    const region = PLATFORM_TO_REGION[key] ?? riotClient.region;
    const client = riotClient.withRouting(key, region);
    const matches = new GetRecentMatchesUseCase(client);
    const bundle = {
      profile: new GetPlayerProfileUseCase(client),
      matches,
      stats: new GetPlayerStatsUseCase(matches),
    };
    routedCache.set(key, bundle);
    return bundle;
  }

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
      // No persistimos la identidad explícita aquí: aún no está verificada contra
      // la Riot API, y persistir un Riot ID mal escrito dejaría al usuario atascado
      // en un 404 en cargas posteriores. La persistencia del enlace manual la
      // gestiona el frontend (localStorage); aquí sólo la usamos para esta petición.
      return { gameName, tagLine };
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

  app.get(
    '/api/live/game',
    wrap(async (_req: Request, res: Response) => {
      const state = await getLiveGameState.execute();
      if (!state) {
        res.json({ active: false });
        return;
      }
      res.json({ active: true, ...state });
    }),
  );

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
    const { role, limit, personalized, gameName, tagLine, platform } = parsed.data;

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
      // Enruta el historial a la plataforma del jugador si difiere de la de por defecto.
      const routedMatches = routedRiot(platform).matches;
      const personalizedUseCase =
        routedMatches && routedMatches !== getRecentMatches
          ? new GetPersonalizedRecommendationsUseCase(championPool, routedMatches, champSelectReader)
          : getPersonalizedRecommendations;
      try {
        res.json(
          await personalizedUseCase.execute({
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

  /**
   * GET /api/aram/build
   *
   * Detecta el campeón que el jugador está jugando en este momento via la
   * Live Client API y devuelve su build recomendada para ARAM con iconos
   * enriquecidos desde Data Dragon.
   *
   * Respuestas:
   *   200 { active: false }                        — no hay partida activa
   *   200 { active: true, championId, championName, buildSource, build }  — build encontrada
   *   500                                          — error interno
   */
  app.get(
    '/api/aram/build',
    wrap(async (_req: Request, res: Response) => {
      // 1. Detectar campeón en partida via Live Client API
      const live = await getLiveChampion.execute();
      if (!live) {
        res.json({ active: false });
        return;
      }

      // championId puede ser null si el catálogo no pudo resolver el nombre
      if (live.championId === null) {
        res.json({
          active: true,
          championId: null,
          championName: live.championName,
          build: null,
          error: 'champion_id_unresolved',
        });
        return;
      }

      // 2. Asegurar catálogo cargado (best-effort: si falla, el enriquecimiento
      //    devolverá iconos null pero no rompe la respuesta)
      await championCatalog.getData().catch(() => null);

      // 3. Obtener build pasando rol ARAM para activar la lógica específica
      //    (summoners Flash+Mark, ítems de ARAM, etc.)
      const build = await getChampionBuild.execute(live.championId, 'ARAM');

      // getChampionBuild nunca debería retornar null (DefaultBuildProvider como
      // último recurso), pero lo manejamos por si acaso.
      if (!build) {
        res.status(404).json({
          error: 'build_not_found',
          championId: live.championId,
          championName: live.championName,
        });
        return;
      }

      // 4. Enriquecer con iconos (best-effort: si falla devuelve build sin iconos)
      let enriched;
      try {
        enriched = await enrichBuild(build, championCatalog);
      } catch {
        enriched = bareEnrichedBuild(build);
      }

      res.json({
        active: true,
        championId: live.championId,
        championName: live.championName,
        buildSource: build.source,
        build: enriched,
      });
    }),
  );

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
      res.json(await routedRiot(parsed.data.platform).profile!.execute(identity));
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
      const filter = {
        ...(parsed.data.queue != null ? { queue: parsed.data.queue } : {}),
        ...(parsed.data.type ? { type: parsed.data.type } : {}),
      };
      const matches = await routedRiot(parsed.data.platform).matches!.execute(
        identity,
        parsed.data.count ?? 10,
        filter,
      );
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
      res.json(await routedRiot(parsed.data.platform).stats!.execute(identity, parsed.data.count ?? 20));
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
      const build = await getChampionBuild.execute(parsed.data.championId, parsed.data.role ?? 'UNKNOWN');
      if (!build) {
        res.status(404).json({ error: 'build_not_found', championId: parsed.data.championId });
        return;
      }
      try {
        res.json(await enrichBuild(build, championCatalog));
      } catch {
        res.json(bareEnrichedBuild(build));
      }
    }),
  );

  // Diagnóstico: devuelve el JSON CRUDO de u.gg para un campeón, para calibrar el
  // parser con datos reales (u.gg no es accesible desde el entorno de desarrollo).
  app.get(
    '/api/builds/debug-ugg',
    wrap(async (req: Request, res: Response) => {
      if (!uggProvider) {
        res.status(503).json({ error: 'ugg_disabled' });
        return;
      }
      const parsed = buildsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
        return;
      }
      const role = parsed.data.role ?? 'ARAM';
      res.json(await uggProvider.debug(parsed.data.championId, role));
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
