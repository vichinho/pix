import { join } from 'node:path';
import { loadConfig } from './config/config.js';
import { createServer } from './api/server.js';
import { RiotApiClient } from './infrastructure/riot/riot-api-client.js';
import { FileIdentityStore } from './infrastructure/persistence/identity-store.js';

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

function main(): void {
  loadDotEnv();
  installProcessGuards();
  const config = loadConfig();

  const riotClient = config.riotApiKey
    ? new RiotApiClient({
        apiKey: config.riotApiKey,
        platform: config.riotPlatform,
        region: config.riotRegion,
      })
    : null;

  const identityStore = new FileIdentityStore(join(process.cwd(), 'data', 'last-identity.json'));
  const app = createServer({ riotClient, identityStore });

  app.listen(config.port, '127.0.0.1', () => {
    // eslint-disable-next-line no-console
    console.log(
      `LoL Companion backend escuchando en http://127.0.0.1:${config.port}\n` +
        `Estado del cliente: http://127.0.0.1:${config.port}/api/client/status\n` +
        `Riot API: ${riotClient ? 'configurada' : 'no configurada (define RIOT_API_KEY)'}`,
    );
  });
}

main();
