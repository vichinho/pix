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
  /** Claves de nivel superior de la respuesta (para inspeccionar la forma). */
  topKeys?: string[];
  /** Muestra recortada del JSON (para calibrar el parser sin volcar todo). */
  sample?: unknown;
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
    const base = 'https://a1.lolalytics.com/mega/?ep=champion&p=d&v=1';
    const urls = [
      `${base}&patch=30&cid=${championId}&lane=middle&tier=emerald_plus&queue=420&region=all`,
      `${base}&patch=30&cid=${championId}&lane=default&tier=all&queue=450&region=all`,
    ];
    const out: LolalyticsProbeResult[] = [];
    for (const url of urls) {
      try {
        const res = await this.fetchImpl(url, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        const entry: LolalyticsProbeResult = { url, status: res.status };
        if (res.ok) {
          const json = (await res.json()) as Record<string, unknown>;
          entry.topKeys = Object.keys(json).slice(0, 40);
          // Muestra: algunas secciones típicas si existen, recortadas.
          entry.sample = {
            summonerSpells: json['summonerSpells'],
            skills: json['skills'],
            itemSets: json['itemSets'],
            runes: json['runes'],
          };
        }
        out.push(entry);
      } catch (err) {
        out.push({ url, status: String(err) });
      }
    }
    return out;
  }
}
