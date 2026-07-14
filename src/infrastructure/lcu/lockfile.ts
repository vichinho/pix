import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Credenciales de conexión al League Client (LCU) obtenidas del lockfile.
 * El lockfile lo escribe el cliente mientras está abierto y lo borra al cerrar.
 */
export interface LcuCredentials {
  /** Nombre del proceso, normalmente "LeagueClient". */
  processName: string;
  /** PID del proceso del cliente. */
  pid: number;
  /** Puerto local del LCU. */
  port: number;
  /** Password del basic-auth (usuario siempre "riot"). */
  password: string;
  /** Protocolo, normalmente "https". */
  protocol: 'http' | 'https';
}

/**
 * El lockfile tiene el formato:
 *   LeagueClient:<pid>:<port>:<password>:<protocol>
 * Ejemplo:
 *   LeagueClient:12345:52123:abcXYZ:https
 */
export function parseLockfile(content: string): LcuCredentials {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error('Lockfile vacío');
  }

  const parts = trimmed.split(':');
  if (parts.length < 5) {
    throw new Error(
      `Formato de lockfile inválido: se esperaban 5 campos, se encontraron ${parts.length}`,
    );
  }

  // El password puede (teóricamente) contener ":"; unimos los campos intermedios.
  const processName = parts[0]!;
  const pidRaw = parts[1]!;
  const portRaw = parts[2]!;
  const protocolRaw = parts[parts.length - 1]!;
  const password = parts.slice(3, parts.length - 1).join(':');

  const pid = Number.parseInt(pidRaw, 10);
  const port = Number.parseInt(portRaw, 10);

  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`PID inválido en lockfile: "${pidRaw}"`);
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Puerto inválido en lockfile: "${portRaw}"`);
  }
  if (protocolRaw !== 'http' && protocolRaw !== 'https') {
    throw new Error(`Protocolo inválido en lockfile: "${protocolRaw}"`);
  }
  if (password.length === 0) {
    throw new Error('Password ausente en lockfile');
  }

  return { processName, pid, port, password, protocol: protocolRaw };
}

/**
 * Rutas candidatas del lockfile según el sistema operativo.
 * El usuario puede sobrescribir con la variable LOL_LOCKFILE_PATH.
 */
export function candidateLockfilePaths(): string[] {
  const override = process.env.LOL_LOCKFILE_PATH;
  if (override && override.trim().length > 0) {
    return [override.trim()];
  }

  const platform = os.platform();
  if (platform === 'win32') {
    const paths = ['C:\\Riot Games\\League of Legends\\lockfile'];
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData && localAppData.trim().length > 0) {
      paths.push(
        path.join(localAppData, 'Riot Games', 'League of Legends', 'lockfile'),
      );
    }
    return paths;
  }

  if (platform === 'darwin') {
    return [
      '/Applications/League of Legends.app/Contents/LoL/lockfile',
      path.join(
        os.homedir(),
        'Applications',
        'League of Legends.app',
        'Contents',
        'LoL',
        'lockfile',
      ),
    ];
  }

  // Linux (p.ej. bajo Wine): sólo vía override.
  return [];
}

/**
 * Lee y parsea el primer lockfile disponible en las rutas candidatas.
 * Devuelve `null` si ninguna ruta existe (cliente cerrado).
 */
export async function readLockfileCredentials(
  paths: string[] = candidateLockfilePaths(),
): Promise<LcuCredentials | null> {
  for (const filePath of paths) {
    try {
      const content = await readFile(filePath, 'utf8');
      return parseLockfile(content);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        continue; // probamos la siguiente ruta
      }
      throw err;
    }
  }
  return null;
}
