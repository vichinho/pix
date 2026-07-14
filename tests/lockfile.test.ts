import { describe, it, expect } from 'vitest';
import { parseLockfile } from '@/infrastructure/lcu/lockfile.js';

describe('parseLockfile', () => {
  it('parsea un lockfile válido', () => {
    const creds = parseLockfile('LeagueClient:12345:52123:abcXYZ:https');
    expect(creds).toEqual({
      processName: 'LeagueClient',
      pid: 12345,
      port: 52123,
      password: 'abcXYZ',
      protocol: 'https',
    });
  });

  it('recorta espacios/saltos de línea', () => {
    const creds = parseLockfile('  LeagueClient:1:443:pw:https\n');
    expect(creds.port).toBe(443);
    expect(creds.password).toBe('pw');
  });

  it('soporta ":" dentro del password', () => {
    const creds = parseLockfile('LeagueClient:1:443:pa:ss:https');
    expect(creds.password).toBe('pa:ss');
    expect(creds.protocol).toBe('https');
  });

  it('rechaza contenido vacío', () => {
    expect(() => parseLockfile('   ')).toThrow(/vacío/);
  });

  it('rechaza campos insuficientes', () => {
    expect(() => parseLockfile('LeagueClient:1:443')).toThrow(/inválido/);
  });

  it('rechaza puerto inválido', () => {
    expect(() => parseLockfile('LeagueClient:1:notaport:pw:https')).toThrow(/Puerto/);
  });

  it('rechaza protocolo inválido', () => {
    expect(() => parseLockfile('LeagueClient:1:443:pw:ftp')).toThrow(/Protocolo/);
  });
});
