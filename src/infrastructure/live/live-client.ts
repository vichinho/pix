import https from 'node:https';

/** Conector a la Live Client Data API (mínimo para tests). */
export interface LiveClientConnector {
  request<T>(path: string): Promise<T>;
}

/**
 * Cliente de la Live Client Data API del juego en curso.
 *
 * Se expone en https://127.0.0.1:2999 con certificado autofirmado de Riot y sin
 * autenticación. Sólo responde durante una partida activa; fuera de ella la
 * conexión se rechaza (y el lector lo trata como "sin partida").
 */
export class LiveClient implements LiveClientConnector {
  private readonly agent: https.Agent;

  constructor(
    private readonly host = '127.0.0.1',
    private readonly port = 2999,
    private readonly timeoutMs = 4000,
  ) {
    this.agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
  }

  request<T>(path: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const req = https.request(
        { host: this.host, port: this.port, path, method: 'GET', agent: this.agent, timeout: this.timeoutMs },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c as Buffer));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            const status = res.statusCode ?? 0;
            if (status < 200 || status >= 300) {
              reject(new Error(`Live Client ${path} respondió ${status}`));
              return;
            }
            try {
              resolve(JSON.parse(raw) as T);
            } catch {
              reject(new Error(`Respuesta de Live Client no es JSON válido en ${path}`));
            }
          });
        },
      );
      req.on('timeout', () => req.destroy(new Error(`Timeout (${this.timeoutMs}ms) en Live Client ${path}`)));
      req.on('error', reject);
      req.end();
    });
  }
}
