import { describe, it, expect } from 'vitest';
import { ItemSetWriter } from '@/infrastructure/lcu/item-set.js';
import { ApplyItemSetUseCase } from '@/application/apply-item-set.js';
import type { LcuConnector } from '@/infrastructure/lcu/lcu-connector.js';
import type { BuildProvider } from '@/domain/build.js';
import type { ChampionBuild } from '@/domain/types.js';

interface Call { path: string; method: string; body?: unknown }
const CREDS = { processName: 'LeagueClient', pid: 1, port: 1, password: 'x', protocol: 'https' as const };

function connector(calls: Call[], existing: unknown[]): LcuConnector {
  return {
    request: async (path: string, opts?: { method?: string; body?: unknown }) => {
      calls.push({ path, method: opts?.method ?? 'GET', body: opts?.body });
      if (path === '/lol-summoner/v1/current-summoner') return { summonerId: 42 };
      if (path.endsWith('/sets') && (opts?.method ?? 'GET') === 'GET') return { itemSets: existing };
      return undefined;
    },
  } as unknown as LcuConnector;
}

describe('ItemSetWriter', () => {
  it('crea el set con bloques y reemplaza el previo del mismo título', async () => {
    const calls: Call[] = [];
    const writer = new ItemSetWriter({
      loadCredentials: async () => CREDS,
      connectorFactory: () => connector(calls, [{ title: 'Ahri · PIX', blocks: [] }, { title: 'Otro', blocks: [] }]),
    });
    await writer.apply({
      title: 'Ahri · PIX',
      championId: 103,
      blocks: [{ type: 'Core', items: [6655, 3020] }, { type: 'Vacío', items: [] }],
    });
    const put = calls.find((c) => c.method === 'PUT');
    expect(put).toBeTruthy();
    const body = put!.body as { itemSets: Array<{ title: string; blocks: unknown[] }> };
    // Sólo un set con ese título (el previo se reemplazó), y el "Otro" sigue.
    expect(body.itemSets.filter((s) => s.title === 'Ahri · PIX')).toHaveLength(1);
    expect(body.itemSets.some((s) => s.title === 'Otro')).toBe(true);
    // El bloque vacío se descarta; queda sólo Core con 2 ítems.
    const nuevo = body.itemSets.find((s) => s.title === 'Ahri · PIX')!;
    expect(nuevo.blocks).toHaveLength(1);
  });
});

describe('ApplyItemSetUseCase', () => {
  it('arma los bloques desde la build', async () => {
    const build: ChampionBuild = {
      championId: 103, championName: 'Ahri', role: 'MIDDLE',
      summonerSpells: ['Flash'], runes: { primaryStyleId: 0, keystoneId: 0, primary: [], secondaryStyleId: 0, secondary: [], shards: [] },
      startingItems: [1056, 2003], coreItems: [6655], situationalItems: [3089], skillOrder: ['Q'], source: 'x', patch: '1',
    };
    const provider: BuildProvider = { name: 'stub', getBuild: () => build };
    let captured: { blocks: { type: string; items: number[] }[] } | null = null;
    const writer = { apply: async (s: { blocks: { type: string; items: number[] }[] }) => { captured = s; } } as unknown as ItemSetWriter;
    await new ApplyItemSetUseCase(provider, writer).execute(103, 'MIDDLE', 'Ahri');
    expect(captured!.blocks.map((b) => b.items)).toEqual([[1056, 2003], [6655], [3089]]);
  });
});
