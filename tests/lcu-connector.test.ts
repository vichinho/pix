import { describe, it, expect } from 'vitest';
import { buildAuthHeader, baseUrl } from '@/infrastructure/lcu/lcu-connector.js';
import type { LcuCredentials } from '@/infrastructure/lcu/lockfile.js';

describe('buildAuthHeader', () => {
  it('genera basic auth con usuario "riot"', () => {
    const header = buildAuthHeader('secret');
    const expected = 'Basic ' + Buffer.from('riot:secret').toString('base64');
    expect(header).toBe(expected);
  });
});

describe('baseUrl', () => {
  it('apunta al loopback con el puerto de las credenciales', () => {
    const creds: LcuCredentials = {
      processName: 'LeagueClient',
      pid: 1,
      port: 52123,
      password: 'x',
      protocol: 'https',
    };
    expect(baseUrl(creds)).toBe('https://127.0.0.1:52123');
  });
});
