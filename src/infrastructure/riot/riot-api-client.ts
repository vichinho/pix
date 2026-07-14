import type { Role } from '../../domain/types.js';

/** Error de la Riot API que preserva el status HTTP. */
export class RiotApiError extends Error {
  constructor(
    readonly status: number,
    readonly endpoint: string,
    readonly body: string,
  ) {
    super(`Riot API ${endpoint} respondió ${status}: ${body}`);
    this.name = 'RiotApiError';
  }
}

/** Cuenta (account-v1). */
export interface RiotAccountDto {
  puuid: string;
  gameName: string;
  tagLine: string;
}

/** Invocador (summoner-v4). */
export interface RiotSummonerDto {
  puuid: string;
  summonerLevel: number;
  profileIconId: number;
}

/** Detalle de partida (match-v5), parcial. */
export interface RiotMatchDto {
  metadata: { matchId: string };
  info: {
    queueId: number;
    gameDuration: number;
    gameCreation: number;
    gameEndTimestamp?: number;
    participants: RiotParticipantDto[];
  };
}

export interface RiotParticipantDto {
  puuid: string;
  championId: number;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  teamPosition?: string;
  individualPosition?: string;
}

/** Normaliza la posición (mayúsculas de match-v5) a nuestro Role. */
export function mapTeamPosition(position: string | undefined): Role {
  switch ((position ?? '').toUpperCase()) {
    case 'TOP':
      return 'TOP';
    case 'JUNGLE':
      return 'JUNGLE';
    case 'MIDDLE':
      return 'MIDDLE';
    case 'BOTTOM':
      return 'BOTTOM';
    case 'UTILITY':
      return 'UTILITY';
    default:
      return 'UNKNOWN';
  }
}

export interface FetchResponse {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
  headers?: { get(name: string): string | null };
}

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<FetchResponse>;

export interface RiotApiClientOptions {
  apiKey: string;
  /** Routing de plataforma para summoner-v4 (la1, na1, euw1, …). */
  platform: string;
  /** Routing regional para account-v1 y match-v5 (americas, asia, europe). */
  region: string;
  fetchImpl?: FetchLike;
  /** Reintentos ante 429 (rate limit). Por defecto 3. */
  maxRetries?: number;
  /** Concurrencia máxima al traer partidas en lote. Por defecto 5. */
  matchConcurrency?: number;
  /** Función de espera (inyectable para tests). */
  sleepImpl?: (ms: number) => Promise<void>;
}

/**
 * Cliente de la Riot API oficial. Usa routing de plataforma para summoner-v4 y
 * routing regional para account-v1 y match-v5.
 */
export class RiotApiClient {
  private readonly apiKey: string;
  readonly platform: string;
  readonly region: string;
  private readonly fetchImpl: FetchLike;
  private readonly maxRetries: number;
  private readonly matchConcurrency: number;
  private readonly sleep: (ms: number) => Promise<void>;
  /** Cache de partidas (inmutables una vez jugadas) para evitar refetch. */
  private readonly matchCache = new Map<string, RiotMatchDto>();

  constructor(opts: RiotApiClientOptions) {
    this.apiKey = opts.apiKey;
    this.platform = opts.platform;
    this.region = opts.region;
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.maxRetries = opts.maxRetries ?? 3;
    this.matchConcurrency = Math.max(1, opts.matchConcurrency ?? 5);
    this.sleep =
      opts.sleepImpl ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  private async request<T>(host: string, path: string): Promise<T> {
    const url = `https://${host}${path}`;
    for (let attempt = 0; ; attempt += 1) {
      const res = await this.fetchImpl(url, { headers: { 'X-Riot-Token': this.apiKey } });
      const body = await res.text();
      if (res.ok) {
        return JSON.parse(body) as T;
      }
      // Ante 429, respeta Retry-After y reintenta hasta agotar los intentos.
      if (res.status === 429 && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers?.get('Retry-After') ?? '1');
        const waitMs = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1) * 1000;
        await this.sleep(waitMs);
        continue;
      }
      throw new RiotApiError(res.status, path, body);
    }
  }

  private platformHost(): string {
    return `${this.platform}.api.riotgames.com`;
  }

  private regionHost(): string {
    return `${this.region}.api.riotgames.com`;
  }

  getAccountByRiotId(gameName: string, tagLine: string): Promise<RiotAccountDto> {
    const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      gameName,
    )}/${encodeURIComponent(tagLine)}`;
    return this.request<RiotAccountDto>(this.regionHost(), path);
  }

  getSummonerByPuuid(puuid: string): Promise<RiotSummonerDto> {
    const path = `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
    return this.request<RiotSummonerDto>(this.platformHost(), path);
  }

  getMatchIdsByPuuid(puuid: string, count: number): Promise<string[]> {
    const path = `/lol/match/v5/matches/by-puuid/${encodeURIComponent(
      puuid,
    )}/ids?start=0&count=${count}`;
    return this.request<string[]>(this.regionHost(), path);
  }

  async getMatch(matchId: string): Promise<RiotMatchDto> {
    const cached = this.matchCache.get(matchId);
    if (cached) return cached;
    const path = `/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
    const match = await this.request<RiotMatchDto>(this.regionHost(), path);
    this.matchCache.set(matchId, match);
    return match;
  }

  /**
   * Trae varias partidas respetando un límite de concurrencia para no saturar el
   * rate limit. Aprovecha la cache y preserva el orden de `matchIds`.
   */
  async getMatches(matchIds: string[]): Promise<RiotMatchDto[]> {
    const results = new Array<RiotMatchDto>(matchIds.length);
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < matchIds.length) {
        const index = next;
        next += 1;
        results[index] = await this.getMatch(matchIds[index]!);
      }
    };
    const workers = Array.from(
      { length: Math.min(this.matchConcurrency, matchIds.length) },
      () => worker(),
    );
    await Promise.all(workers);
    return results;
  }
}
