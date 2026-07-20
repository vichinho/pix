import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadConfig } from './config/config.js';
import { createServer } from './api/server.js';
import { RiotApiClient } from './infrastructure/riot/riot-api-client.js';
import { FileIdentityStore } from './infrastructure/persistence/identity-store.js';
import { FileSettingsStore } from './infrastructure/persistence/settings-store.js';
import { ChampionCatalog } from './infrastructure/champions/champion-catalog.js';

/** Carga variables desde .env si existe (Node 20.12+/22). */
function loadDotEnv(): void {
  try {
    process.loadEnvFile();
  } catch {
    // No hay .env: se usan las variables ya presentes en el entorno.
  }
}

/**
 * Red de seguridad: un app local de larga duración no debe caerse por un fallo
 * transitorio (p.ej. timeout del LCU cuando el cliente está iniciando). Se
 * registra el error y el proceso sigue vivo.
 */
function installProcessGuards(): void {
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('[unhandledRejection]', reason instanceof Error ? reason.message : reason);
  });
  process.on('uncaughtException', (err) => {
    // eslint-disable-next-line no-console
    console.error('[uncaughtException]', err.message);
  });
}

export interface StartServerOptions {
  /**
   * Carpeta donde se guardan los datos del usuario (ajustes, identidad, caché de
   * partidas). Por defecto `./data` en el cwd; la app de escritorio la apunta a
   * la carpeta de datos del usuario del sistema operativo.
   */
  dataDir?: string;
  /**
   * Puerto de escucha. Si es 0 se asigna uno libre (útil para la app de
   * escritorio, que lee el puerto real tras arrancar). Por defecto, el del env.
   */
  port?: number;
}

export interface RunningServer {
  server: Server;
  /** Puerto real donde quedó escuchando (resuelto incluso si se pidió 0). */
  port: number;
  dataDir: string;
}

/**
 * Arranca el backend de PIX y resuelve cuando está escuchando. Reutilizable
 * tanto por el arranque de CLI como por el proceso principal de Electron.
 */
export function startServer(options: StartServerOptions = {}): Promise<RunningServer> {
  loadDotEnv();
  installProcessGuards();
  const config = loadConfig();

  const dataDir = options.dataDir ?? join(process.cwd(), 'data');
  const matchCacheDir = join(dataDir, 'match-cache');
  const riotClientFactory = (apiKey: string, platform: string, region: string): RiotApiClient =>
    new RiotApiClient({ apiKey, platform, region, matchCacheDir });

  // La key puede venir del .env (RIOT_API_KEY) o de los ajustes guardados por el
  // usuario desde la interfaz. El env tiene prioridad si está presente.
  const settingsStore = new FileSettingsStore(join(dataDir, 'settings.json'));
  const initialKey = config.riotApiKey ?? settingsStore.get().riotApiKey;
  const riotClient = initialKey
    ? riotClientFactory(initialKey, config.riotPlatform, config.riotRegion)
    : null;

  const identityStore = new FileIdentityStore(join(dataDir, 'last-identity.json'));
  const championCatalog = new ChampionCatalog({ locale: config.ddragonLocale });
  const app = createServer({
    riotClient,
    identityStore,
    championCatalog,
    settingsStore,
    riotClientFactory,
    riotPlatform: config.riotPlatform,
    riotRegion: config.riotRegion,
  });

  const port = options.port ?? config.port;
  return new Promise((resolve) => {
    const server = app.listen(port, '127.0.0.1', () => {
      const actualPort = (server.address() as AddressInfo).port;
      // eslint-disable-next-line no-console
      console.log(
        `PIX backend escuchando en http://127.0.0.1:${actualPort}\n` +
          `Estado del cliente: http://127.0.0.1:${actualPort}/api/client/status\n` +
          `Riot API: ${riotClient ? 'configurada' : 'sin configurar (pégala en Ajustes o define RIOT_API_KEY)'}`,
      );
      resolve({ server, port: actualPort, dataDir });
    });
  });
}

// Arranque directo por CLI (`node dist/index.js`). No se ejecuta cuando el
// módulo se importa (p.ej. desde el proceso principal de Electron).
const isDirectRun =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  void startServer();
}
