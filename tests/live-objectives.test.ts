import { describe, it, expect } from 'vitest';
import { computeObjectives, type LiveEvent } from '@/domain/live-objectives.js';
import { LiveGameReader } from '@/infrastructure/live/live-game-reader.js';
import type { LiveClientConnector } from '@/infrastructure/live/live-client.js';

describe('computeObjectives', () => {
  it('dragón: aún no aparece antes de 5:00', () => {
    const o = computeObjectives(120, []);
    expect(o.dragon.status).toBe('not_yet');
    expect(o.dragon.secondsUntil).toBe(180);
    expect(o.dragon.taken).toBe(0);
  });

  it('dragón: disponible tras 5:00 sin muertes', () => {
    const o = computeObjectives(320, []);
    expect(o.dragon.status).toBe('up');
    expect(o.dragon.secondsUntil).toBeNull();
  });

  it('dragón: reapareciendo tras una muerte (respawn 5:00)', () => {
    const events: LiveEvent[] = [{ EventName: 'DragonKill', EventTime: 600 }];
    const o = computeObjectives(700, events);
    expect(o.dragon.status).toBe('respawning');
    expect(o.dragon.secondsUntil).toBe(200); // 600+300-700
    expect(o.dragon.taken).toBe(1);
  });

  it('barón: no aparece hasta 20:00', () => {
    const o = computeObjectives(600, []);
    expect(o.baron.status).toBe('not_yet');
    expect(o.baron.secondsUntil).toBe(600); // 1200-600
  });

  it('barón: disponible tras 20:00', () => {
    const o = computeObjectives(1300, []);
    expect(o.baron.status).toBe('up');
  });

  it('barón: reapareciendo tras muerte (respawn 6:00)', () => {
    const events: LiveEvent[] = [{ EventName: 'BaronKill', EventTime: 1400 }];
    const o = computeObjectives(1500, events);
    expect(o.baron.status).toBe('respawning');
    expect(o.baron.secondsUntil).toBe(260); // 1400+360-1500
  });

  it('heraldo: aparece a 14:00, se va a 20:00', () => {
    expect(computeObjectives(600, []).herald.status).toBe('not_yet');
    expect(computeObjectives(900, []).herald.status).toBe('up');
    expect(computeObjectives(1300, []).herald.status).toBe('gone');
    expect(computeObjectives(900, [{ EventName: 'HeraldKill', EventTime: 860 }]).herald.status).toBe('gone');
  });
});

function fakeConnector(handler: (path: string) => unknown): LiveClientConnector {
  return { request: async (path: string) => handler(path) } as unknown as LiveClientConnector;
}

describe('LiveGameReader.getGameState', () => {
  it('parsea allgamedata: tiempo, objetivos y jugador', async () => {
    const reader = new LiveGameReader({
      connectorFactory: () =>
        fakeConnector(() => ({
          activePlayer: { level: 11, currentGold: 2450 },
          events: { Events: [{ EventName: 'DragonKill', EventTime: 600 }] },
          gameData: { gameTime: 700.6 },
        })),
    });
    const state = await reader.getGameState();
    expect(state?.gameTime).toBe(700);
    expect(state?.player).toEqual({ level: 11, currentGold: 2450 });
    expect(state?.objectives.dragon.status).toBe('respawning');
  });

  it('devuelve null si no hay partida (conexión rechazada)', async () => {
    const reader = new LiveGameReader({
      connectorFactory: () => ({
        request: async () => {
          throw new Error('ECONNREFUSED');
        },
      }),
    });
    expect(await reader.getGameState()).toBeNull();
  });
});
