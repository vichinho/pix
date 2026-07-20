import { describe, it, expect } from 'vitest';
import {
  LiveGameReader,
  parseRawChampionId,
  type LiveActiveChampion,
} from '@/infrastructure/live/live-game-reader.js';
import type { LiveClientConnector } from '@/infrastructure/live/live-client.js';
import { GetLiveChampionUseCase } from '@/application/get-live-champion.js';
import { ChampionCatalog, type CatalogFetch } from '@/infrastructure/champions/champion-catalog.js';

function fakeConnector(routes: Record<string, unknown>): LiveClientConnector {
  return {
    request: async (path: string) => {
      if (path in routes) return routes[path];
      throw new Error(`Live Client ${path} respondió 404`);
    },
  } as LiveClientConnector;
}

describe('parseRawChampionId', () => {
  it('extrae el id de Data Dragon del rawChampionName', () => {
    expect(parseRawChampionId('game_character_displayname_Xerath')).toBe('Xerath');
    expect(parseRawChampionId('game_character_displayname_MonkeyKing')).toBe('MonkeyKing');
    expect(parseRawChampionId(undefined)).toBeNull();
  });
});

describe('LiveGameReader', () => {
  it('encuentra al jugador activo por riotId y devuelve su campeón y rol', async () => {
    const reader = new LiveGameReader({
      connectorFactory: () =>
        fakeConnector({
          '/liveclientdata/activeplayername': 'Vishox#LAS',
          '/liveclientdata/playerlist': [
            { riotId: 'Otro#LAS', championName: 'Ahri', rawChampionName: 'game_character_displayname_Ahri', position: 'MIDDLE' },
            {
              riotId: 'Vishox#LAS',
              championName: 'Xerath',
              rawChampionName: 'game_character_displayname_Xerath',
              position: 'MIDDLE',
            },
          ],
        }),
    });
    const champ = await reader.getActiveChampion();
    expect(champ).toEqual<LiveActiveChampion>({ championName: 'Xerath', ddragonId: 'Xerath', role: 'MIDDLE' });
  });

  it('devuelve null si no hay partida (conexión rechazada)', async () => {
    const reader = new LiveGameReader({
      connectorFactory: () => ({
        request: async () => {
          throw new Error('ECONNREFUSED');
        },
      }),
    });
    expect(await reader.getActiveChampion()).toBeNull();
  });

  it('devuelve null si el jugador activo no está en la lista', async () => {
    const reader = new LiveGameReader({
      connectorFactory: () =>
        fakeConnector({
          '/liveclientdata/activeplayername': 'Nadie#LAS',
          '/liveclientdata/playerlist': [{ riotId: 'Otro#LAS', championName: 'Ahri' }],
        }),
    });
    expect(await reader.getActiveChampion()).toBeNull();
  });
});

describe('GetLiveChampionUseCase', () => {
  function catalogWith(): ChampionCatalog {
    const championJson = {
      data: {
        Xerath: { key: '101', id: 'Xerath', name: 'Xerath', image: { full: 'Xerath.png' }, tags: ['Mage'], info: { attack: 1, magic: 10, defense: 3 } },
      },
    };
    const fetchImpl: CatalogFetch = async (url) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(url.includes('versions') ? ['1.0.0'] : championJson),
    });
    return new ChampionCatalog({ fetchImpl });
  }

  it('resuelve el championId por ddragonId', async () => {
    const reader = new LiveGameReader({
      connectorFactory: () => ({
        request: async () => {
          throw new Error('no usado');
        },
      }),
    });
    // Sustituimos getActiveChampion por un stub directo.
    reader.getActiveChampion = async () => ({ championName: 'Xerath', ddragonId: 'Xerath', role: 'MIDDLE' });

    const uc = new GetLiveChampionUseCase(reader, catalogWith());
    const res = await uc.execute();
    expect(res).toEqual({ championId: 101, championName: 'Xerath', role: 'MIDDLE' });
  });

  it('cae al nombre si no hay ddragonId', async () => {
    const reader = new LiveGameReader();
    reader.getActiveChampion = async () => ({ championName: 'Xerath', ddragonId: null, role: 'UNKNOWN' });
    const uc = new GetLiveChampionUseCase(reader, catalogWith());
    const res = await uc.execute();
    expect(res?.championId).toBe(101);
  });

  it('devuelve null cuando no hay partida activa', async () => {
    const reader = new LiveGameReader();
    reader.getActiveChampion = async () => null;
    const uc = new GetLiveChampionUseCase(reader, catalogWith());
    expect(await uc.execute()).toBeNull();
  });
});
