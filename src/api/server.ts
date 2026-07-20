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
import { GetChampionMasteryUseCase } from '../application/get-champion-mastery.js';
import { GetPersonalizedRecommendationsUseCase } from '../application/get-personalized-recommendations.js';
import { GetChampionBuildUseCase } from '../application/get-champion-build.js';
import { enrichBuild, bareEnrichedBuild } from '../application/enrich-build.js';
import { GetLiveChampionUseCase } from '../application/get-live-champion.js';
import { GetLiveGameStateUseCase } from '../application/get-live-game-state.js';
import { ApplyRunePageUseCase } from '../application/apply-rune-page.js';
import { RunePageWriter, LcuUnavailableError } from '../infrastructure/lcu/rune-page.js';
import { ApplyItemSetUseCase } from '../application/apply-item-set.js';
import { ItemSetWriter } from '../infrastructure/lcu/item-set.js';
import { LiveGameReader } from '../infrastructure/live/live-game-reader.js';
import { MerakiBuildProvider } from '../infrastructure/champions/ugg-build-provider.js';
import { SeedBuildProvider } from '../infrastructure/champions/seed-build-provider.js';
import { ClassifiedBuildProvider } from '../infrastructure/champions/champion-archetypes.js';
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
import { RiotApiError, RiotApiClient } from '../infrastructure/riot/riot-api-client.js';
import {
  MemoryIdentityStore,
  type IdentityStore,
} from '../infrastructure/persistence/identity-store.js';
import {
  MemorySettingsStore,
  type SettingsStore,
} from '../infrastructure/persistence/settings-store.js';
import type { ChampionPool } from '../domain/recommendation.js';
import type { ChampionTraitProvider } from '../domain/aram.js';

export interface ServerDeps {
  detector?: ClientDetector;
  champSelectReader?: ChampSelectReader;
  gameQueueDetector?: GameQueueDetector;
  championPool?: ChampionPool;
  aramReader?: AramReader;
  championTraits?: ChampionTraitProvider;
  /** Cliente Riot API inicial; si es null/ausente, se intenta desde ajustes/env. */
  riotClient?: RiotApiClient | null;
  /** Almacén de ajustes (Riot API key configurable desde la UI). */
  settingsStore?: SettingsStore;
  /** Fábrica del cliente Riot al (re)configurar la key desde ajustes. */
  riotClientFactory?: (apiKey: string, platform: string, region: string) => RiotApiClient;
  /** Plataforma/región por defecto para el cliente Riot reconstruido. */
  riotPlatform?: string;
  riotRegion?: string;
  buildProvider?: BuildProvider;
  /** Escritor de páginas de runas al cliente (LCU). */
  runePageWriter?: RunePageWriter;
  /** Escritor de sets de ítems al cliente (LCU). */
  itemSetWriter?: ItemSetWriter;
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
  const buildProvider =
    deps.buildProvider ??
    new FallbackBuildProvider([
      // 1) Meraki Analytics: ítems recomendados por Riot, sin Cloudflare, sin API key.
      new MerakiBuildProvider(),
      // 2) Builds curadas a mano para campeones específicos.
      new SeedBuildProvider(),
      // 3) Build por subclase clasificada a mano para cada campeón (cobertura total).
      new ClassifiedBuildProvider(championCatalog),
      // 4) Respaldo por tags de Data Dragon y por rasgos de ARAM.
      new CatalogArchetypeBuildProvider(championCatalog),
      new ArchetypeBuildProvider(championTraits),
      // 5) Último recurso: nunca deja a un campeón sin build.
      new DefaultBuildProvider(),
    ]);
  const getChampionBuild = new GetChampionBuildUseCase(buildProvider);
  const runePageWriter = deps.runePageWriter ?? new RunePageWriter();
  const applyRunePage = new ApplyRunePageUseCase(buildProvider, runePageWriter);
  const itemSetWriter = deps.itemSetWriter ?? new ItemSetWriter();
  const applyItemSet = new ApplyItemSetUseCase(buildProvider, itemSetWriter);
  const getLiveChampion = new GetLiveChampionUseCase(liveGameReader, championCatalog);
  const getLiveGameState = new GetLiveGameStateUseCase(liveGameReader);
  const settingsStore = deps.settingsStore ?? new MemorySettingsStore();
  const defaultPlatform = deps.riotPlatform ?? 'la1';
  const defaultRegion = deps.riotRegion ?? 'americas';
  const makeRiotClient =
    deps.riotClientFactory ??
    ((apiKey: string, platform: string, region: string) => new RiotApiClient({ apiKey, platform, region }));

  let riotClient: RiotApiClient | null = deps.riotClient ?? null;
  if (!riotClient) {
    const savedKey = settingsStore.get().riotApiKey;
    if (savedKey) riotClient = makeRiotClient(savedKey, defaultPlatform, defaultRegion);
  }

  type RoutedBundle = {
    profile: GetPlayerProfileUseCase;
    matches: GetRecentMatchesUseCase;
    stats: GetPlayerStatsUseCase;
    mastery: GetChampionMasteryUseCase;
    personalized: GetPersonalizedRecommendationsUseCase;
  };
  function buildRiotUseCases(client: RiotApiClient): RoutedBundle {
    const matches = new GetRecentMatchesUseCase(client);
    return {
      profile: new GetPlayerProfileUseCase(client),
      matches,
      stats: new GetPlayerStatsUseCase(matches),
      mastery: new GetChampionMasteryUseCase(client),
      personalized: new GetPersonalizedRecommendationsUseCase(championPool, matches, champSelectReader),
    };
  }

  const routedCache = new Map<string, RoutedBundle>();
  function routedRiot(platform: string | undefined): RoutedBundle | null {
    if (!riotClient) return null;
    const key = platform && platform.toLowerCase() !== riotClient.platform ? platform.toLowerCase() : '__default__';
    const hit = routedCache.get(key);
    if (hit) return hit;
    const client =
      key === '__default__' ? riotClient : riotClient.withRouting(key, PLATFORM_TO_REGION[key] ?? riotClient.region);
    const bundle = buildRiotUseCases(client);
    routedCache.set(key, bundle);
    return bundle;
  }

  function reconfigureRiot(apiKey: string | undefined): void {
    riotClient = apiKey ? makeRiotClient(apiKey, defaultPlatform, defaultRegion) : null;
    routedCache.clear();
  }

  const identityStore = deps.identityStore ?? new MemoryIdentityStore();

  async function resolveIdentity(
    gameName: string | undefined,
    tagLine: string | undefined,
  ): Promise<PlayerIdentity | null> {
    if (gameName && tagLine) return { gameName, tagLine };
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

  const wrap =
    (fn: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response): void => {
      Promise.resolve(fn(req, res)).catch((err) => {
        if (!res.headersSent) {
          res.status(500).json({ error: 'internal_error', message: String(err) });
        }
      });
    };

  const staticDir =
    deps.staticDir === null
      ? null
      : deps.staticDir ?? fileURLToPath(new URL('../../public', import.meta.url));
  if (staticDir) app.use(express.static(staticDir));

  app.get('/api/health', (_req: Request, res: Response) => { res.json({ ok: true }); });

  app.get('/api/champions', wrap(async (_req, res) => {
    const data = await championCatalog.getData().catch(() => null);
    if (!data) { res.status(503).json({ error: 'catalog_unavailable' }); return; }
    res.json(data);
  }));

  app.get('/api/client/status', async (_req, res) => {
    try { res.json(await getClientStatus.execute()); }
    catch (err) { res.status(500).json({ error: 'client_status_failed', message: String(err) }); }
  });

  app.get('/api/live/champion', async (_req, res) => {
    try {
      const result = await getLiveChampion.execute();
      res.json(result ? { active: true, ...result } : { active: false });
    } catch (err) { res.status(500).json({ error: 'live_champion_failed', message: String(err) }); }
  });

  app.get('/api/live/game', wrap(async (_req, res) => {
    const state = await getLiveGameState.execute();
    res.json(state ? { active: true, ...state } : { active: false });
  }));

  app.get('/api/champ-select/session', async (_req, res) => {
    try {
      const session = await getChampSelectSession.execute();
      res.json(session === null ? { active: false, session: null } : { active: true, session });
    } catch (err) { res.status(500).json({ error: 'champ_select_failed', message: String(err) }); }
  });

  app.get('/api/game/queue', async (_req, res) => {
    try {
      const queue = await getGameQueue.execute();
      res.json(queue === null ? { active: false, queue: null } : { active: true, queue });
    } catch (err) { res.status(500).json({ error: 'game_queue_failed', message: String(err) }); }
  });

  app.get('/api/recommendations', async (req, res) => {
    const parsed = recommendationsQuerySchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() }); return; }
    const { role, limit, personalized, gameName, tagLine, platform } = parsed.data;
    if (personalized === 'true') {
      const routed = routedRiot(platform);
      if (!routed) { res.status(503).json({ error: 'riot_not_configured' }); return; }
      const identity = await resolveIdentity(gameName, tagLine);
      if (!identity) { res.status(400).json({ error: 'identity_unavailable' }); return; }
      try {
        res.json(await routed.personalized.execute({ identity, ...(role ? { role } : {}), ...(limit ? { limit } : {}) }));
      } catch (err) { riotErrorResponse(res, err); }
      return;
    }
    try {
      res.json(await getRecommendations.execute({ ...(role ? { role } : {}), ...(limit ? { limit } : {}) }));
    } catch (err) { res.status(500).json({ error: 'recommendations_failed', message: String(err) }); }
  });

  app.get('/api/aram/analysis', async (_req, res) => {
    try { res.json(await getAramAnalysis.execute()); }
    catch (err) { res.status(500).json({ error: 'aram_analysis_failed', message: String(err) }); }
  });

  app.get('/api/aram/build', wrap(async (_req, res) => {
    const live = await getLiveChampion.execute();
    if (!live) { res.json({ active: false }); return; }
    if (live.championId === null) {
      res.json({ active: true, championId: null, championName: live.championName, build: null, error: 'champion_id_unresolved' });
      return;
    }
    await championCatalog.getData().catch(() => null);
    const build = await getChampionBuild.execute(live.championId, 'ARAM');
    if (!build) { res.status(404).json({ error: 'build_not_found', championId: live.championId, championName: live.championName }); return; }
    let enriched;
    try { enriched = await enrichBuild(build, championCatalog); }
    catch { enriched = bareEnrichedBuild(build); }
    res.json({ active: true, championId: live.championId, championName: live.championName, buildSource: build.source, build: enriched });
  }));

  app.get('/api/player/profile', async (req, res) => {
    const parsed = identityQuerySchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() }); return; }
    const routed = routedRiot(parsed.data.platform);
    if (!routed) { res.status(503).json({ error: 'riot_not_configured' }); return; }
    const identity = await resolveIdentity(parsed.data.gameName, parsed.data.tagLine);
    if (!identity) { res.status(400).json({ error: 'identity_unavailable' }); return; }
    try { res.json(await routed.profile.execute(identity)); }
    catch (err) { riotErrorResponse(res, err); }
  });

  app.get('/api/player/matches', async (req, res) => {
    const parsed = identityQuerySchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() }); return; }
    const routed = routedRiot(parsed.data.platform);
    if (!routed) { res.status(503).json({ error: 'riot_not_configured' }); return; }
    const identity = await resolveIdentity(parsed.data.gameName, parsed.data.tagLine);
    if (!identity) { res.status(400).json({ error: 'identity_unavailable' }); return; }
    try {
      const filter = {
        ...(parsed.data.queue != null ? { queue: parsed.data.queue } : {}),
        ...(parsed.data.type ? { type: parsed.data.type } : {}),
      };
      res.json({ matches: await routed.matches.execute(identity, parsed.data.count ?? 10, filter) });
    } catch (err) { riotErrorResponse(res, err); }
  });

  app.get('/api/player/stats', async (req, res) => {
    const parsed = identityQuerySchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() }); return; }
    const routed = routedRiot(parsed.data.platform);
    if (!routed) { res.status(503).json({ error: 'riot_not_configured' }); return; }
    const identity = await resolveIdentity(parsed.data.gameName, parsed.data.tagLine);
    if (!identity) { res.status(400).json({ error: 'identity_unavailable' }); return; }
    try { res.json(await routed.stats.execute(identity, parsed.data.count ?? 20)); }
    catch (err) { riotErrorResponse(res, err); }
  });

  app.get('/api/player/mastery', async (req, res) => {
    const parsed = identityQuerySchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() }); return; }
    const routed = routedRiot(parsed.data.platform);
    if (!routed) { res.status(503).json({ error: 'riot_not_configured' }); return; }
    const identity = await resolveIdentity(parsed.data.gameName, parsed.data.tagLine);
    if (!identity) { res.status(400).json({ error: 'identity_unavailable' }); return; }
    try { res.json({ mastery: await routed.mastery.execute(identity, parsed.data.count ?? 8) }); }
    catch (err) { riotErrorResponse(res, err); }
  });

  app.get('/api/builds', wrap(async (req, res) => {
    const parsed = buildsQuerySchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() }); return; }
    await championCatalog.getData().catch(() => null);
    const build = await getChampionBuild.execute(parsed.data.championId, parsed.data.role ?? 'UNKNOWN');
    if (!build) { res.status(404).json({ error: 'build_not_found', championId: parsed.data.championId }); return; }
    try { res.json(await enrichBuild(build, championCatalog)); }
    catch { res.json(bareEnrichedBuild(build)); }
  }));

  app.post('/api/runes/apply', wrap(async (req, res) => {
    const parsed = buildsQuerySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() }); return; }
    await championCatalog.getData().catch(() => null);
    const meta = championCatalog.getMeta(parsed.data.championId);
    try {
      await applyRunePage.execute(parsed.data.championId, parsed.data.role ?? 'UNKNOWN', meta?.name);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof LcuUnavailableError) { res.status(503).json({ error: 'client_not_running' }); return; }
      res.status(500).json({ error: 'rune_apply_failed', message: String(err) });
    }
  }));

  app.post('/api/items/apply', wrap(async (req, res) => {
    const parsed = buildsQuerySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() }); return; }
    await championCatalog.getData().catch(() => null);
    const meta = championCatalog.getMeta(parsed.data.championId);
    try {
      await applyItemSet.execute(parsed.data.championId, parsed.data.role ?? 'UNKNOWN', meta?.name);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof LcuUnavailableError) { res.status(503).json({ error: 'client_not_running' }); return; }
      res.status(500).json({ error: 'item_apply_failed', message: String(err) });
    }
  }));

  app.get('/api/settings', (_req, res) => {
    res.json({ riotConfigured: riotClient != null, hasKey: !!settingsStore.get().riotApiKey });
  });

  const settingsBodySchema = z.object({ riotApiKey: z.string().trim().min(1).max(120).optional() });
  app.put('/api/settings', wrap(async (req, res) => {
    const parsed = settingsBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() }); return; }
    if (parsed.data.riotApiKey !== undefined) {
      const key = parsed.data.riotApiKey;
      const probe = makeRiotClient(key, defaultPlatform, defaultRegion);
      try {
        await probe.getAccountByRiotId('Riot Phreak', 'NA1');
      } catch (err) {
        if (err instanceof RiotApiError && (err.status === 401 || err.status === 403)) {
          res.status(400).json({ error: 'riot_api_key_invalid' }); return;
        }
      }
      settingsStore.set({ riotApiKey: key });
      reconfigureRiot(key);
    }
    res.json({ ok: true, riotConfigured: riotClient != null });
  }));

  return app;
}
