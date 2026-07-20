import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import {
  MemorySettingsStore,
  FileSettingsStore,
} from '@/infrastructure/persistence/settings-store.js';
import { createServer } from '@/api/server.js';
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
  const dir = mkdtempSync(join(tmpdir(), 'lolc-set-'));
  tmpDirs.push(dir);
  return join(dir, 'settings.json');
}

describe('MemorySettingsStore', () => {
  it('guarda y devuelve ajustes, fusionando en cada set', () => {
    const s = new MemorySettingsStore();
    expect(s.get()).toEqual({});
    s.set({ riotApiKey: 'RGAPI-1' });
    expect(s.get()).toEqual({ riotApiKey: 'RGAPI-1' });
    s.set({});
    expect(s.get()).toEqual({ riotApiKey: 'RGAPI-1' });
  });
});

describe('FileSettingsStore', () => {
  it('persiste en disco y se recarga en una nueva instancia', () => {
    const file = tmpFile();
    new FileSettingsStore(file).set({ riotApiKey: 'RGAPI-abc' });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ riotApiKey: 'RGAPI-abc' });
    expect(new FileSettingsStore(file).get()).toEqual({ riotApiKey: 'RGAPI-abc' });
  });

  it('ignora un archivo inválido', () => {
    const file = tmpFile();
    writeFileSync(file, 'no es json', 'utf8');
    expect(new FileSettingsStore(file).get()).toEqual({});
  });
});

function listen(app: ReturnType<typeof createServer>): Promise<string> {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server!.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

/** Cliente Riot que responde 200 a cualquier ruta (clave "válida"). */
function okRiotFactory(): (apiKey: string, platform: string, region: string) => RiotApiClient {
  const fetchImpl: FetchLike = async () => ({ status: 200, ok: true, text: async () => '{}' });
  return (apiKey, platform, region) =>
    new RiotApiClient({ apiKey, platform, region, fetchImpl });
}

describe('rutas /api/settings', () => {
  it('reporta sin configurar y responde 503 al perfil sin clave', async () => {
    const base = await listen(
      createServer({ settingsStore: new MemorySettingsStore(), staticDir: null }),
    );
    const s = await fetch(`${base}/api/settings`);
    expect(await s.json()).toEqual({ riotConfigured: false, hasKey: false });

    const prof = await fetch(`${base}/api/player/profile`);
    expect(prof.status).toBe(503);
    expect(((await prof.json()) as { error: string }).error).toBe('riot_not_configured');
  });

  it('guarda una clave válida y activa la Riot API', async () => {
    const store = new MemorySettingsStore();
    const base = await listen(
      createServer({
        settingsStore: store,
        riotClientFactory: okRiotFactory(),
        staticDir: null,
      }),
    );
    const res = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ riotApiKey: 'RGAPI-valid' }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { riotConfigured: boolean }).riotConfigured).toBe(true);
    expect(store.get().riotApiKey).toBe('RGAPI-valid');

    const s = await fetch(`${base}/api/settings`);
    expect(await s.json()).toEqual({ riotConfigured: true, hasKey: true });
  });

  it('rechaza una clave inválida (401/403) sin guardarla', async () => {
    const store = new MemorySettingsStore();
    const rejectingFactory = (apiKey: string, platform: string, region: string): RiotApiClient => {
      const fetchImpl: FetchLike = async () => ({
        status: 403,
        ok: false,
        text: async () => 'forbidden',
      });
      return new RiotApiClient({ apiKey, platform, region, fetchImpl });
    };
    const base = await listen(
      createServer({ settingsStore: store, riotClientFactory: rejectingFactory, staticDir: null }),
    );
    const res = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ riotApiKey: 'RGAPI-bad' }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('riot_api_key_invalid');
    expect(store.get().riotApiKey).toBeUndefined();
  });

  it('rechaza un cuerpo inválido', async () => {
    const base = await listen(
      createServer({ settingsStore: new MemorySettingsStore(), staticDir: null }),
    );
    const res = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ riotApiKey: '' }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid_body');
  });
});
