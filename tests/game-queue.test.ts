import { describe, it, expect } from 'vitest';
import {
  classifyGameflowSession,
  GameQueueDetector,
  type GameflowSessionDto,
} from '@/infrastructure/lcu/game-queue.js';
import { LcuConnector, LcuHttpError } from '@/infrastructure/lcu/lcu-connector.js';
import type { LcuCredentials } from '@/infrastructure/lcu/lockfile.js';

const creds: LcuCredentials = {
  processName: 'LeagueClient',
  pid: 1,
  port: 443,
  password: 'pw',
  protocol: 'https',
};

function fakeConnector(handler: (path: string) => unknown): LcuConnector {
  return { request: async (path: string) => handler(path) } as unknown as LcuConnector;
}

function session(
  queue: NonNullable<NonNullable<GameflowSessionDto['gameData']>['queue']>,
  extra: Partial<GameflowSessionDto> = {},
): GameflowSessionDto {
  return { phase: 'ChampSelect', gameData: { queue }, ...extra };
}

describe('classifyGameflowSession', () => {
  it('clasifica Swiftplay como casual', () => {
    const info = classifyGameflowSession(session({ id: 480, gameMode: 'CLASSIC' }));
    expect(info.category).toBe('CASUAL_SWIFTPLAY');
    expect(info.label).toBe('Casual (Swiftplay)');
    expect(info.isRanked).toBe(false);
  });

  it('clasifica Normal Draft como reclutamiento/normal', () => {
    const info = classifyGameflowSession(
      session({ id: 400, type: 'NORMAL', name: 'Normal Draft' }),
    );
    expect(info.category).toBe('NORMAL_DRAFT');
    expect(info.rawName).toBe('Normal Draft');
  });

  it('clasifica Ranked Solo/Dúo', () => {
    const info = classifyGameflowSession(session({ id: 420, type: 'RANKED_SOLO_5x5' }));
    expect(info.category).toBe('RANKED_SOLO');
    expect(info.isRanked).toBe(true);
  });

  it('clasifica Ranked Flex', () => {
    const info = classifyGameflowSession(session({ id: 440 }));
    expect(info.category).toBe('RANKED_FLEX');
    expect(info.isRanked).toBe(true);
  });

  it('clasifica cooperativo vs IA (bots)', () => {
    expect(classifyGameflowSession(session({ id: 830 })).category).toBe('CO_OP_VS_AI');
    expect(classifyGameflowSession(session({ id: 850 })).category).toBe('CO_OP_VS_AI');
  });

  it('detecta la herramienta de práctica por gameMode', () => {
    const info = classifyGameflowSession({
      phase: 'InProgress',
      gameData: { isCustomGame: true, queue: { id: 0, gameMode: 'PRACTICETOOL' } },
    });
    expect(info.category).toBe('PRACTICE_TOOL');
    expect(info.isPracticeTool).toBe(true);
    expect(info.isCustom).toBe(true);
  });

  it('detecta la herramienta de práctica por tipo de cola', () => {
    const info = classifyGameflowSession({
      phase: 'InProgress',
      gameData: { queue: { id: 0, type: 'PRACTICETOOL' } },
    });
    expect(info.category).toBe('PRACTICE_TOOL');
    expect(info.isPracticeTool).toBe(true);
  });

  it('clasifica partida personalizada (custom, no práctica)', () => {
    const info = classifyGameflowSession({
      phase: 'ChampSelect',
      gameData: { isCustomGame: true, queue: { id: 0, gameMode: 'CLASSIC' } },
    });
    expect(info.category).toBe('CUSTOM');
    expect(info.isCustom).toBe(true);
    expect(info.isPracticeTool).toBe(false);
  });

  it('queueId desconocido cae en OTHER conservando el nombre', () => {
    const info = classifyGameflowSession(session({ id: 1700, name: 'Arena' }));
    expect(info.category).toBe('OTHER');
    expect(info.rawName).toBe('Arena');
  });
});

describe('GameQueueDetector.getQueueInfo', () => {
  it('devuelve null cuando el cliente está cerrado', async () => {
    const detector = new GameQueueDetector({ loadCredentials: async () => null });
    expect(await detector.getQueueInfo()).toBeNull();
  });

  it('devuelve null cuando no hay sesión (phase None sin cola)', async () => {
    const detector = new GameQueueDetector({
      loadCredentials: async () => creds,
      connectorFactory: () => fakeConnector(() => ({ phase: 'None', gameData: {} })),
    });
    expect(await detector.getQueueInfo()).toBeNull();
  });

  it('devuelve null ante 404', async () => {
    const detector = new GameQueueDetector({
      loadCredentials: async () => creds,
      connectorFactory: () =>
        fakeConnector(() => {
          throw new LcuHttpError(404, 'GET', '/lol-gameflow/v1/session', 'x');
        }),
    });
    expect(await detector.getQueueInfo()).toBeNull();
  });

  it('clasifica una sesión activa de ranked', async () => {
    const detector = new GameQueueDetector({
      loadCredentials: async () => creds,
      connectorFactory: () =>
        fakeConnector(() => ({
          phase: 'ChampSelect',
          gameData: { queue: { id: 420, type: 'RANKED_SOLO_5x5' } },
        })),
    });
    const info = await detector.getQueueInfo();
    expect(info?.category).toBe('RANKED_SOLO');
    expect(info?.isRanked).toBe(true);
  });
});
