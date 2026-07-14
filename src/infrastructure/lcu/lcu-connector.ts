import https from 'node:https';
import http from 'node:http';
import type { LcuCredentials } from './lockfile.js';

/** Error HTTP del LCU que preserva el código de estado para el que llama. */
export class LcuHttpError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: string,
  ) {
    super(`LCU ${method} ${path} respondió ${status}: ${body}`);
    this.name = 'LcuHttpError';
  }
}

/**
 * Construye el header de autorización Basic para el LCU.
 * El usuario siempre es "riot" y el password viene del lockfile.
 */
export function buildAuthHeader(password: string): string {
  const token = Buffer.from(`riot:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

/** URL base del LCU para las credenciales dadas. */
export function baseUrl(creds: LcuCredentials): string {
  return `${creds.protocol}://127.0.0.1:${creds.port}`;
}

export interface LcuRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Timeout en ms. */
  timeoutMs?: number;
  body?: unknown;
}

/**
 * Conector de bajo nivel al League Client (LCU).
 *
 * El LCU expone un certificado autofirmado de Riot, por lo que la verificación
 * TLS estándar falla. Como la conexión es siempre a 127.0.0.1 (loopback) y las
 * credenciales son locales y efímeras, deshabilitamos la verificación del
 * certificado sólo para este agente dedicado.
 */
export class LcuConnector {
  private readonly agent: https.Agent;

  constructor(private readonly creds: LcuCredentials) {
    this.agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
  }

  async request<T = unknown>(path: string, options: LcuRequestOptions = {}): Promise<T> {
    const { method = 'GET', timeoutMs = 5000, body } = options;
    const url = new URL(path, baseUrl(this.creds));
    const transport = this.creds.protocol === 'https' ? https : http;
    const payload = body === undefined ? undefined : JSON.stringify(body);

    return new Promise<T>((resolve, reject) => {
      const req = transport.request(
        url,
        {
          method,
          agent: this.creds.protocol === 'https' ? this.agent : undefined,
          headers: {
            Authorization: buildAuthHeader(this.creds.password),
            Accept: 'application/json',
            ...(payload
              ? {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(payload),
                }
              : {}),
          },
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk as Buffer));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            const status = res.statusCode ?? 0;
            if (status < 200 || status >= 300) {
              reject(new LcuHttpError(status, method, path, raw));
              return;
            }
            if (raw.length === 0) {
              resolve(undefined as T);
              return;
            }
            try {
              resolve(JSON.parse(raw) as T);
            } catch {
              reject(new Error(`Respuesta LCU no es JSON válido: ${raw.slice(0, 200)}`));
            }
          });
        },
      );

      req.on('timeout', () => {
        req.destroy(new Error(`Timeout (${timeoutMs}ms) en LCU ${method} ${path}`));
      });
      req.on('error', reject);

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }
}
