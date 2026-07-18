import { describe, it, expect } from 'vitest';
import { RunePageWriter, LcuUnavailableError } from '@/infrastructure/lcu/rune-page.js';
import { ApplyRunePageUseCase } from '@/application/apply-rune-page.js';
import type { LcuConnector } from '@/infrastructure/lcu/lcu-connector.js';
import type { BuildProvider } from '@/domain/build.js';
import type { ChampionBuild } from '@/domain/types.js';

interface Call { path: string; method: string; body?: unknown }

function recordingConnector(calls: Call[], current: unknown): LcuConnector {
  return {
    request: async (path: string, opts?: { method?: string; body?: unknown }) => {
      calls.push({ path, method: opts?.method ?? 'GET', body: opts?.body });
      if (path === '/lol-perks/v1/currentpage') return current;
      return undefined;
    },
  } as unknown as LcuConnector;
}

const CREDS = { pid: 1, port: 1, password: 'x', protocol: 'https' as const };

describe('RunePageWriter', () => {
  it('borra la página actual editable y crea la nueva como activa', async () => {
    const calls: Call[] = [];
    const writer = new RunePageWriter({
      loadCredentials: async () => CREDS,
      connectorFactory: () => recordingConnector(calls, { id: 7, isDeletable: true }),
    });
    await writer.apply({ name: 'Test', primaryStyleId: 8100, subStyleId: 8000, selectedPerkIds: [8112, 1, 2, 3, 4, 5, 5008, 5008, 5011] });

    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/lol-perks/v1/pages/7')).toBe(true);
    const post = calls.find((c) => c.method === 'POST' && c.path === '/lol-perks/v1/pages');
    expect(post).toBeTruthy();
    expect(post!.body).toMatchObject({ primaryStyleId: 8100, subStyleId: 8000, current: true });
  });

  it('no borra si la página actual no es editable, pero igual crea la nueva', async () => {
    const calls: Call[] = [];
    const writer = new RunePageWriter({
      loadCredentials: async () => CREDS,
      connectorFactory: () => recordingConnector(calls, { id: 1, isDeletable: false }),
    });
    await writer.apply({ name: 'T', primaryStyleId: 8000, subStyleId: 8100, selectedPerkIds: [] });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(calls.some((c) => c.method === 'POST')).toBe(true);
  });

  it('lanza LcuUnavailableError si el cliente no está abierto', async () => {
    const writer = new RunePageWriter({ loadCredentials: async () => null });
    await expect(writer.apply({ name: 'T', primaryStyleId: 0, subStyleId: 0, selectedPerkIds: [] }))
      .rejects.toBeInstanceOf(LcuUnavailableError);
  });
});

describe('ApplyRunePageUseCase', () => {
  it('arma selectedPerkIds en orden keystone+primarias+secundarias+fragmentos', async () => {
    const build: ChampionBuild = {
      championId: 1, championName: 'Annie', role: 'MIDDLE',
      summonerSpells: ['Flash', 'Ignite'],
      runes: { primaryStyleId: 8200, keystoneId: 8229, primary: [8226, 8210, 8237], secondaryStyleId: 8300, secondary: [8321, 8347], shards: [5007, 5008, 5011] },
      startingItems: [], coreItems: [3089], situationalItems: [], skillOrder: ['Q'], source: 'x', patch: '1',
    };
    const provider: BuildProvider = { name: 'stub', getBuild: () => build };
    let captured: number[] = [];
    const writer = { apply: async (p: { selectedPerkIds: number[] }) => { captured = p.selectedPerkIds; } } as unknown as RunePageWriter;
    await new ApplyRunePageUseCase(provider, writer).execute(1, 'MIDDLE');
    expect(captured).toEqual([8229, 8226, 8210, 8237, 8321, 8347, 5007, 5008, 5011]);
  });
});
