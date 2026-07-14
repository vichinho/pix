import { loadConfig } from './config/config.js';
import { createServer } from './api/server.js';
import { RiotApiClient } from './infrastructure/riot/riot-api-client.js';

/** Carga variables desde .env si existe (Node 20.12+/22). */
function loadDotEnv(): void {
  try {
    process.loadEnvFile();
  } catch {
    // No hay .env: se usan las variables ya presentes en el entorno.
  }
}

function main(): void {
  loadDotEnv();
  const config = loadConfig();

  const riotClient = config.riotApiKey
    ? new RiotApiClient({
        apiKey: config.riotApiKey,
        platform: config.riotPlatform,
        region: config.riotRegion,
      })
    : null;

  const app = createServer({ riotClient });

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
