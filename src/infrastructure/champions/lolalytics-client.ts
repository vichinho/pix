/**
 * Cliente de lolalytics (a1.lolalytics.com/mega). Alternativa a u.gg cuando este
 * bloquea las peticiones de servidor por huella TLS. lolalytics agrega, igual que
 * u.gg, millones de partidas por parche para derivar el build "meta".
 *
 * De momento sólo exponemos una SONDA para verificar accesibilidad y ver la forma
 * real de la respuesta antes de escribir el parser definitivo.
 */

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://lolalytics.com/',
};

export interface LolalyticsProbeResult {
  url: string;
  status: number | string;
  /** Tipo de contenido devuelto. */
  contentType?: string | null;
  /** ¿El cuerpo parseó como JSON? */
  isJson?: boolean;
  /** Claves de nivel superior si es JSON. */
  topKeys?: string[];
  /** Primeros ~700 caracteres del cuerpo crudo (para ver el formato real). */
  bodyPreview?: string;
}

export class LolalyticsClient {
  constructor(
    private readonly timeoutMs = 6000,
    private readonly fetchImpl: typeof fetch = globalThis.fetch as typeof fetch,
  ) {}

  /**
   * Prueba varias URLs de lolalytics (ranked y ARAM) y reporta estado + forma.
   * `championId` es el id numérico de Riot.
   */
  async probe(championId: number): Promise<LolalyticsProbeResult[]> {
    // Variantes de parámetros y host para hallar el que devuelve JSON.
    const urls = [
      `https://a1.lolalytics.com/mega/?ep=champion&v=1&patch=30&cid=${championId}&lane=middle&tier=emerald_plus&queue=420&region=all`,
      `https://a1.lolalytics.com/mega/?ep=champion&p=d&v=1&patch=30&cid=${championId}&lane=middle&tier=emerald_plus&queue=420&region=all`,
      `https://ax.lolalytics.com/mega/?ep=champion&v=1&patch=30&cid=${championId}&lane=middle&tier=emerald_plus&queue=420&region=all`,
      `https://lolalytics.com/mega/?ep=champion&v=1&patch=30&cid=${championId}&lane=middle&tier=emerald_plus&queue=420&region=all`,
      `https://a1.lolalytics.com/mega/?ep=champion&v=7&patch=30&cid=${championId}&lane=middle&tier=emerald_plus&queue=420&region=all`,
    ];
    const out: LolalyticsProbeResult[] = [];
    for (const url of urls) {
      try {
        const res = await this.fetchImpl(url, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        const text = await res.text();
        const entry: LolalyticsProbeResult = {
          url,
          status: res.status,
          contentType: res.headers.get('content-type'),
          bodyPreview: text.slice(0, 700),
        };
        try {
          const json = JSON.parse(text) as Record<string, unknown>;
          entry.isJson = true;
          entry.topKeys = Object.keys(json).slice(0, 40);
        } catch {
          entry.isJson = false;
        }
        out.push(entry);
      } catch (err) {
        out.push({ url, status: String(err) });
      }
    }
    return out;
  }
}
