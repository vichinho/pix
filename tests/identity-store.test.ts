import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import {
  MemoryIdentityStore,
  FileIdentityStore,
} from '@/infrastructure/persistence/identity-store.js';
import { createServer } from '@/api/server.js';
import type { ClientDetector } from '@/infrastructure/lcu/client-detector.js';
import { RiotApiClient, type FetchLike } from '@/infrastructure/riot/riot-api-client.js';

const tmpDirs: string[] = [];
let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
  tmpDirs.length = 0;
});

function tmpFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lolc-'));
  tmpDirs.push(dir);
  return join(dir, 'id.json');
}

describe('MemoryIdentityStore', () => {
  it('guarda y devuelve la identidad', () => {
    const s = new MemoryIdentityStore();
    expect(s.get()).toBeNull();
    s.set({ gameName: 'A', tagLine: 'LAS' });
    expect(s.get()).toEqual({ gameName: 'A', tagLine: 'LAS' });
  });
});

describe('FileIdentityStore', () => {
  it('persiste en disco y se recarga en una nueva instancia', () => {
    const file = tmpFile();
    new FileIdentityStore(file).set({ gameName: 'Vishox', tagLine: 'LAS' });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ gameName: 'Vishox', tagLine: 'LAS' });
    expect(new FileIdentityStore(file).get()).toEqual({ gameName: 'Vishox', tagLine: 'LAS' });
  });

  it('ignora un archivo inválido', () => {
    const file = tmpFile();
    writeFileSync(file, 'no es json', 'utf8');
    expect(new FileIdentityStore(file).get()).toBeNull();
  });
});

// --- Integración: fallback a la última identidad cuando el cliente cae -----
const throwingDetector = {
  getCurrentSummoner: async () => {
    throw new Error('Timeout LCU');
  },
  getStatus: async () => ({ connected: false, clientState: 'DISCONNECTED' as const, summoner: null }),
} as unknown as ClientDetector;

function riotWith(routes: Record<string, unknown>): RiotApiClient {
  const fetchImpl: FetchLike = async (url) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    return { status: 200, ok: true, text: async () => JSON.stringify(key ? routes[key] : {}) };
  };
  return new RiotApiClient({ apiKey: 'k', platform: 'la1', region: 'americas', fetchImpl });
}

function listen(app: ReturnType<typeof createServer>): Promise<string> {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server!.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

describe('perfil con cliente desconectado', () => {
  it('usa la última identidad conocida cuando el cliente no responde', async () => {
    const store = new MemoryIdentityStore({ gameName: 'Vishox', tagLine: 'LAS' });
    const riotClient = riotWith({
      'by-riot-id': { puuid: 'P', gameName: 'Vishox', tagLine: 'LAS' },
      'by-puuid': { puuid: 'P', summonerLevel: 312, profileIconId: 5 },
    });
    const base = await listen(
      createServer({ detector: throwingDetector, riotClient, identityStore: store, staticDir: null }),
    );

    const res = await fetch(`${base}/api/player/profile`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { gameName: string; summonerLevel: number };
    expect(body.gameName).toBe('Vishox');
    expect(body.summonerLevel).toBe(312);
  });

  it('devuelve 400 si nunca hubo identidad conocida', async () => {
    const riotClient = riotWith({});
    const base = await listen(
      createServer({ detector: throwingDetector, riotClient, identityStore: new MemoryIdentityStore(), staticDir: null }),
    );
    const res = await fetch(`${base}/api/player/profile`);
    expect(res.status).toBe(400);
  });
});
