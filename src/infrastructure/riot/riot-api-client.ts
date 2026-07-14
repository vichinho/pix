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

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ status: number; ok: boolean; text: () => Promise<string> }>;

export interface RiotApiClientOptions {
  apiKey: string;
  /** Routing de plataforma para summoner-v4 (la1, na1, euw1, …). */
  platform: string;
  /** Routing regional para account-v1 y match-v5 (americas, asia, europe). */
  region: string;
  fetchImpl?: FetchLike;
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

  constructor(opts: RiotApiClientOptions) {
    this.apiKey = opts.apiKey;
    this.platform = opts.platform;
    this.region = opts.region;
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }

  private async request<T>(host: string, path: string): Promise<T> {
    const url = `https://${host}${path}`;
    const res = await this.fetchImpl(url, { headers: { 'X-Riot-Token': this.apiKey } });
    const body = await res.text();
    if (!res.ok) {
      throw new RiotApiError(res.status, path, body);
    }
    return JSON.parse(body) as T;
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

  getMatch(matchId: string): Promise<RiotMatchDto> {
    const path = `/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
    return this.request<RiotMatchDto>(this.regionHost(), path);
  }
}
