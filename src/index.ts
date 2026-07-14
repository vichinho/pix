import { loadConfig } from './config/config.js';
import { createServer } from './api/server.js';

function main(): void {
  const config = loadConfig();
  const app = createServer();

  app.listen(config.port, '127.0.0.1', () => {
    // eslint-disable-next-line no-console
    console.log(
      `LoL Companion backend escuchando en http://127.0.0.1:${config.port}\n` +
        `Estado del cliente: http://127.0.0.1:${config.port}/api/client/status`,
    );
  });
}

main();
