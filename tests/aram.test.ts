import { describe, it, expect } from 'vitest';
import {
  analyzeComp,
  rankAramOptions,
  type ChampionTraits,
  type CompNeeds,
} from '@/domain/aram.js';
import { SeedChampionTraitProvider } from '@/infrastructure/champions/champion-traits.js';
import { parseAramSession, AramReader } from '@/infrastructure/lcu/aram-reader.js';
import { GetAramAnalysisUseCase } from '@/application/get-aram-analysis.js';
import { LcuConnector, LcuHttpError } from '@/infrastructure/lcu/lcu-connector.js';
import type { LcuCredentials } from '@/infrastructure/lcu/lockfile.js';

const creds: LcuCredentials = {
  processName: 'LeagueClient',
  pid: 1,
  port: 443,
  password: 'pw',
  protocol: 'https',
};

function t(over: Partial<ChampionTraits>): ChampionTraits {
  return { championId: 1, name: 'X', damage: 'AD', traits: [], aramScore: 60, ...over };
}

describe('analyzeComp', () => {
  it('detecta equipo full AD sin frontline/sustain/CC', () => {
    const comp = analyzeComp([
      t({ damage: 'AD' }),
      t({ damage: 'AD' }),
      t({ damage: 'AD' }),
    ]);
    expect(comp.needs.needsAp).toBe(true);
    expect(comp.needs.needsFrontline).toBe(true);
    expect(comp.needs.needsHealingOrSustain).toBe(true);
    expect(comp.needs.needsHardCc).toBe(true);
    expect(comp.balanced).toBe(false);
    expect(comp.missing.length).toBeGreaterThan(0);
  });

  it('marca equilibrado cuando hay daño mixto, frontline, sustain y CC', () => {
    const comp = analyzeComp([
      t({ damage: 'AD', traits: ['FRONTLINE', 'HARD_CC'] }),
      t({ damage: 'AP', traits: ['HEALING'] }),
      t({ damage: 'AP', traits: ['POKE'] }),
    ]);
    expect(comp.balanced).toBe(true);
    expect(comp.missing).toEqual([]);
  });

  it('cuenta desconocidos y no los evalúa', () => {
    const comp = analyzeComp([t({ damage: 'AP', traits: ['HEALING', 'FRONTLINE', 'HARD_CC'] }), null, null]);
    expect(comp.unknownCount).toBe(2);
  });

  it('destaca fortalezas de poke', () => {
    const comp = analyzeComp([
      t({ damage: 'AP', traits: ['POKE', 'FRONTLINE', 'HEALING', 'HARD_CC'] }),
      t({ damage: 'AP', traits: ['POKE'] }),
    ]);
    expect(comp.strengths).toContain('composición de poke fuerte');
  });
});

describe('rankAramOptions', () => {
  const needs: CompNeeds = {
    needsAd: false,
    needsAp: true,
    needsFrontline: true,
    needsHealingOrSustain: true,
    needsEngage: false,
    needsHardCc: false,
  };

  it('prioriza el campeón que más huecos cubre', () => {
    const options = rankAramOptions(
      [
        t({ championId: 10, name: 'ADCarry', damage: 'AD', traits: [], aramScore: 80 }),
        t({
          championId: 20,
          name: 'ApTank',
          damage: 'AP',
          traits: ['FRONTLINE', 'HEALING'],
          aramScore: 60,
        }),
      ],
      needs,
      5,
    );
    expect(options[0]?.championId).toBe(20);
    expect(options[0]?.fillsGaps).toEqual(
      expect.arrayContaining(['aporta daño mágico', 'aporta frontline', 'aporta curación']),
    );
  });

  it('ignora slots vacíos/desconocidos (null)', () => {
    const options = rankAramOptions([null, t({ championId: 5, name: 'A' })], needs, 5);
    expect(options).toHaveLength(1);
    expect(options[0]?.championId).toBe(5);
  });
});

describe('parseAramSession', () => {
  it('extrae equipo, banca y marca al jugador local', () => {
    const snap = parseAramSession({
      benchEnabled: true,
      localPlayerCellId: 1,
      myTeam: [
        { cellId: 0, championId: 22 },
        { cellId: 1, championId: 103 },
        { cellId: 2, championId: 0 }, // sin campeón aún: se descarta
      ],
      benchChampions: [{ championId: 54 }, { championId: 16 }],
    });
    expect(snap.benchEnabled).toBe(true);
    expect(snap.team).toHaveLength(2);
    expect(snap.team.find((m) => m.championId === 103)?.isLocalPlayer).toBe(true);
    expect(snap.benchChampionIds).toEqual([54, 16]);
  });

  it('benchEnabled false para sesiones no-ARAM', () => {
    const snap = parseAramSession({ localPlayerCellId: 0, myTeam: [{ cellId: 0, championId: 1 }] });
    expect(snap.benchEnabled).toBe(false);
    expect(snap.benchChampionIds).toEqual([]);
  });
});

function fakeConnector(handler: (path: string) => unknown): LcuConnector {
  return { request: async (path: string) => handler(path) } as unknown as LcuConnector;
}

describe('AramReader', () => {
  it('devuelve null ante 404', async () => {
    const reader = new AramReader({
      loadCredentials: async () => creds,
      connectorFactory: () =>
        fakeConnector(() => {
          throw new LcuHttpError(404, 'GET', '/lol-champ-select/v1/session', 'x');
        }),
    });
    expect(await reader.getSession()).toBeNull();
  });
});

describe('GetAramAnalysisUseCase', () => {
  const traits = new SeedChampionTraitProvider();

  function readerWith(snapshot: Awaited<ReturnType<AramReader['getSession']>>): AramReader {
    return { getSession: async () => snapshot } as unknown as AramReader;
  }

  it('isAram false cuando no hay banca', async () => {
    const uc = new GetAramAnalysisUseCase(
      readerWith({ benchEnabled: false, localPlayerCellId: 0, team: [], benchChampionIds: [] }),
      traits,
    );
    const res = await uc.execute();
    expect(res.isAram).toBe(false);
  });

  it('recomienda de la banca el campeón que cubre los huecos del equipo', async () => {
    // Equipo full AD sin curación ni frontline; jugador local tiene un AD.
    // Banca ofrece Soraka (16, AP+HEALING) y Malphite (54, AP+FRONTLINE).
    const uc = new GetAramAnalysisUseCase(
      readerWith({
        benchEnabled: true,
        localPlayerCellId: 0,
        team: [
          { cellId: 0, championId: 22, isLocalPlayer: true }, // Ashe (AD)
          { cellId: 1, championId: 21, isLocalPlayer: false }, // Miss Fortune (AD)
          { cellId: 2, championId: 51, isLocalPlayer: false }, // Caitlyn (AD)
          { cellId: 3, championId: 18, isLocalPlayer: false }, // Tristana (AD)
        ],
        benchChampionIds: [16, 54], // Soraka, Malphite
      }),
      traits,
    );
    const res = await uc.execute();
    expect(res.isAram).toBe(true);
    expect(res.currentComp.needs.needsAp).toBe(true);
    expect(res.currentComp.balanced).toBe(false);
    // La mejor opción debe ser de la banca (Soraka o Malphite), no el AD actual.
    expect([16, 54]).toContain(res.bestOption?.championId);
    expect(res.bestOption?.fillsGaps.length).toBeGreaterThan(0);
  });

  it('marca campeones desconocidos en equipo/banca', async () => {
    const uc = new GetAramAnalysisUseCase(
      readerWith({
        benchEnabled: true,
        localPlayerCellId: 0,
        team: [{ cellId: 0, championId: 999999, isLocalPlayer: true }],
        benchChampionIds: [888888],
      }),
      traits,
    );
    const res = await uc.execute();
    expect(res.team[0]?.unknown).toBe(true);
    expect(res.team[0]?.championName).toBe('Campeón 999999');
    expect(res.bench[0]?.unknown).toBe(true);
  });
});
