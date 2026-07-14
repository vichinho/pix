import { describe, it, expect } from 'vitest';
import { ClientDetector, mapGameflowPhase } from '@/infrastructure/lcu/client-detector.js';
import type { LcuConnector } from '@/infrastructure/lcu/lcu-connector.js';
import type { LcuCredentials } from '@/infrastructure/lcu/lockfile.js';

const creds: LcuCredentials = {
  processName: 'LeagueClient',
  pid: 1,
  port: 443,
  password: 'pw',
  protocol: 'https',
};

/** Conector falso que devuelve respuestas predefinidas por ruta. */
function fakeConnector(routes: Record<string, unknown>): LcuConnector {
  return {
    request: async (path: string) => {
      if (path in routes) return routes[path];
      throw new Error(`ruta no simulada: ${path}`);
    },
  } as unknown as LcuConnector;
}

describe('mapGameflowPhase', () => {
  it('mapea ChampSelect', () => {
    expect(mapGameflowPhase('ChampSelect')).toBe('CHAMP_SELECT');
  });
  it('mapea InProgress a IN_GAME', () => {
    expect(mapGameflowPhase('InProgress')).toBe('IN_GAME');
  });
  it('mapea fases desconocidas a UNKNOWN', () => {
    expect(mapGameflowPhase('SomethingNew')).toBe('UNKNOWN');
  });
});

describe('ClientDetector.getStatus', () => {
  it('reporta desconectado cuando no hay lockfile', async () => {
    const detector = new ClientDetector({ loadCredentials: async () => null });
    const status = await detector.getStatus();
    expect(status).toEqual({
      connected: false,
      clientState: 'DISCONNECTED',
      summoner: null,
    });
  });

  it('consolida fase y summoner cuando el cliente está abierto', async () => {
    const detector = new ClientDetector({
      loadCredentials: async () => creds,
      connectorFactory: () =>
        fakeConnector({
          '/lol-gameflow/v1/gameflow-phase': 'ChampSelect',
          '/lol-summoner/v1/current-summoner': {
            gameName: 'Player',
            tagLine: 'LAS',
            summonerLevel: 200,
          },
        }),
    });
    const status = await detector.getStatus();
    expect(status.connected).toBe(true);
    expect(status.clientState).toBe('CHAMP_SELECT');
    expect(status.summoner).toEqual({
      gameName: 'Player',
      tagLine: 'LAS',
      summonerLevel: 200,
    });
  });

  it('tolera fallos parciales (summoner cae) sin lanzar', async () => {
    const detector = new ClientDetector({
      loadCredentials: async () => creds,
      connectorFactory: () =>
        fakeConnector({ '/lol-gameflow/v1/gameflow-phase': 'Lobby' }),
    });
    const status = await detector.getStatus();
    expect(status.connected).toBe(true);
    expect(status.clientState).toBe('LOBBY');
    expect(status.summoner).toBeNull();
  });
});
