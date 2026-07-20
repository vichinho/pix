import { describe, it, expect, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createServer } from '@/api/server.js';
import type { ClientDetector } from '@/infrastructure/lcu/client-detector.js';
import { RiotApiClient, type FetchLike } from '@/infrastructure/riot/riot-api-client.js';
import { ChampionCatalog } from '@/infrastructure/champions/champion-catalog.js';

/** Catálogo con el CDN caído (getData/getMeta degradan a null). */
const downCatalog = () =>
  new ChampionCatalog({ fetchImpl: async () => ({ ok: false, status: 503, text: async () => '' }) });

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
});

function listen(app: ReturnType<typeof createServer>): Promise<string> {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server!.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

/** Detector cuyo getCurrentSummoner rechaza (simula timeout del LCU). */
const throwingDetector = {
  getCurrentSummoner: async () => {
    throw new Error('Timeout (5000ms) en LCU GET /lol-summoner/v1/current-summoner');
  },
  getStatus: async () => ({ connected: false, clientState: 'DISCONNECTED' as const, summoner: null }),
} as unknown as ClientDetector;

const dummyFetch: FetchLike = async () => ({ status: 200, ok: true, text: async () => '{}' });

describe('builds robustas', () => {
  it('acepta role=UNKNOWN (ARAM) y devuelve una build con iconos', async () => {
    const base = await listen(
      createServer({ championCatalog: downCatalog(), staticDir: null }),
    );
    const res = await fetch(`${base}/api/builds?championId=202&role=UNKNOWN`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { championId: number; items: { core: unknown[] } };
    expect(body.championId).toBe(202);
    expect(body.items.core.length).toBeGreaterThan(0);
  });

  it('nunca devuelve 404: cualquier championId trae build', async () => {
    const base = await listen(
      createServer({ championCatalog: downCatalog(), staticDir: null }),
    );
    const res = await fetch(`${base}/api/builds?championId=99999&role=MIDDLE`);
    expect(res.status).toBe(200);
  });
});

describe('resiliencia del servidor', () => {
  it('un timeout del LCU no tumba el proceso: responde 400 identity_unavailable', async () => {
    const riotClient = new RiotApiClient({ apiKey: 'k', platform: 'la1', region: 'americas', fetchImpl: dummyFetch });
    const base = await listen(createServer({ detector: throwingDetector, riotClient, staticDir: null }));

    // Sin gameName/tagLine, la ruta cae a la detección local, que lanza timeout.
    const res = await fetch(`${base}/api/player/profile`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('identity_unavailable');

    // El servidor sigue vivo tras el fallo previo.
    const health = await fetch(`${base}/api/health`);
    expect(health.status).toBe(200);
  });

  it('con identidad explícita en query no depende del cliente local', async () => {
    const routes: Record<string, unknown> = {
      'by-riot-id': { puuid: 'P', gameName: 'Vishox', tagLine: 'LAS' },
      'by-puuid': { puuid: 'P', summonerLevel: 100, profileIconId: 1 },
    };
    const fetchImpl: FetchLike = async (url) => {
      const key = Object.keys(routes).find((k) => url.includes(k));
      return { status: 200, ok: true, text: async () => JSON.stringify(key ? routes[key] : {}) };
    };
    const riotClient = new RiotApiClient({ apiKey: 'k', platform: 'la1', region: 'americas', fetchImpl });
    const base = await listen(createServer({ detector: throwingDetector, riotClient, staticDir: null }));

    const res = await fetch(`${base}/api/player/profile?gameName=Vishox&tagLine=LAS`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { gameName: string };
    expect(body.gameName).toBe('Vishox');
  });
});
