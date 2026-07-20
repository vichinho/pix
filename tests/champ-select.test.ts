import { describe, it, expect } from 'vitest';
import {
  parseChampSelectSession,
  mapAssignedPosition,
  mapChampSelectPhase,
  ChampSelectReader,
  type ChampSelectSessionDto,
} from '@/infrastructure/lcu/champ-select.js';
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

describe('mapAssignedPosition', () => {
  it('mapea posiciones conocidas', () => {
    expect(mapAssignedPosition('top')).toBe('TOP');
    expect(mapAssignedPosition('jungle')).toBe('JUNGLE');
    expect(mapAssignedPosition('middle')).toBe('MIDDLE');
    expect(mapAssignedPosition('bottom')).toBe('BOTTOM');
    expect(mapAssignedPosition('utility')).toBe('UTILITY');
  });
  it('trata blind/vacío como UNKNOWN', () => {
    expect(mapAssignedPosition('')).toBe('UNKNOWN');
    expect(mapAssignedPosition(undefined)).toBe('UNKNOWN');
  });
});

describe('mapChampSelectPhase', () => {
  it('mapea fases del timer', () => {
    expect(mapChampSelectPhase('PLANNING')).toBe('PLANNING');
    expect(mapChampSelectPhase('BAN_PICK')).toBe('BAN_PICK');
    expect(mapChampSelectPhase('FINALIZATION')).toBe('FINALIZATION');
    expect(mapChampSelectPhase('otra')).toBe('UNKNOWN');
  });
});

describe('parseChampSelectSession', () => {
  const dto: ChampSelectSessionDto = {
    localPlayerCellId: 2,
    timer: { phase: 'BAN_PICK' },
    myTeam: [
      { cellId: 1, assignedPosition: 'top', championId: 0 },
      { cellId: 2, assignedPosition: 'middle', championId: 0 },
    ],
    actions: [
      [{ actorCellId: 1, championId: 17, type: 'ban', completed: true }],
      [
        { actorCellId: 1, championId: 24, type: 'pick', completed: true },
        { actorCellId: 2, championId: 103, type: 'pick', completed: false },
      ],
    ],
    bans: { myTeamBans: [17], theirTeamBans: [55] },
  };

  it('extrae rol asignado del jugador local', () => {
    expect(parseChampSelectSession(dto).assignedRole).toBe('MIDDLE');
  });

  it('extrae el campeón elegido y su estado desde la acción de pick local', () => {
    const snap = parseChampSelectSession(dto);
    expect(snap.selectedChampionId).toBe(103);
    expect(snap.pickCompleted).toBe(false);
  });

  it('agrega bans de ambos equipos', () => {
    expect(parseChampSelectSession(dto).bans).toEqual([17, 55]);
  });

  it('usa championId de myTeam como fallback si no hay acción', () => {
    const locked: ChampSelectSessionDto = {
      localPlayerCellId: 0,
      timer: { phase: 'FINALIZATION' },
      myTeam: [{ cellId: 0, assignedPosition: 'jungle', championId: 64 }],
      actions: [],
    };
    const snap = parseChampSelectSession(locked);
    expect(snap.selectedChampionId).toBe(64);
    expect(snap.assignedRole).toBe('JUNGLE');
  });

  it('sin pick devuelve selectedChampionId null', () => {
    const empty: ChampSelectSessionDto = {
      localPlayerCellId: 0,
      timer: { phase: 'PLANNING' },
      myTeam: [{ cellId: 0, assignedPosition: 'bottom', championId: 0 }],
      actions: [],
    };
    expect(parseChampSelectSession(empty).selectedChampionId).toBeNull();
  });
});

describe('ChampSelectReader.getSession', () => {
  it('devuelve null cuando el cliente está cerrado', async () => {
    const reader = new ChampSelectReader({ loadCredentials: async () => null });
    expect(await reader.getSession()).toBeNull();
  });

  it('devuelve null ante 404 (sin champ select activo)', async () => {
    const reader = new ChampSelectReader({
      loadCredentials: async () => creds,
      connectorFactory: () =>
        fakeConnector(() => {
          throw new LcuHttpError(404, 'GET', '/lol-champ-select/v1/session', 'not found');
        }),
    });
    expect(await reader.getSession()).toBeNull();
  });

  it('propaga errores que no sean 404', async () => {
    const reader = new ChampSelectReader({
      loadCredentials: async () => creds,
      connectorFactory: () =>
        fakeConnector(() => {
          throw new LcuHttpError(500, 'GET', '/lol-champ-select/v1/session', 'boom');
        }),
    });
    await expect(reader.getSession()).rejects.toThrow(/500/);
  });

  it('parsea una sesión activa', async () => {
    const reader = new ChampSelectReader({
      loadCredentials: async () => creds,
      connectorFactory: () =>
        fakeConnector(() => ({
          localPlayerCellId: 0,
          timer: { phase: 'BAN_PICK' },
          myTeam: [{ cellId: 0, assignedPosition: 'top' }],
          actions: [[{ actorCellId: 0, championId: 24, type: 'pick', completed: false }]],
          bans: { myTeamBans: [], theirTeamBans: [] },
        })),
    });
    const snap = await reader.getSession();
    expect(snap).not.toBeNull();
    expect(snap?.assignedRole).toBe('TOP');
    expect(snap?.selectedChampionId).toBe(24);
    expect(snap?.phase).toBe('BAN_PICK');
  });
});
