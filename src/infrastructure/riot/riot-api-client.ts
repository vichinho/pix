import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
  id: string;  // summonerId (encryptedId) necesario para league-v4
  summonerLevel: number;
  profileIconId: number;
}

/** Entrada de liga (league-v4 entry). */
export interface RiotLeagueEntryDto {
  queueType: string;   // RANKED_SOLO_5x5 | RANKED_FLEX_SR | ...
  tier: string;
  rank: string;        // I | II | III | IV
  leaguePoints: number;
  wins: number;
  losses: number;
  veteran?: boolean;
  inactive?: boolean;
  freshBlood?: boolean;
  hotStreak?: boolean;
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
  champLevel?: number;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  teamPosition?: string;
  individualPosition?: string;
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  item6?: number;
  summoner1Id?: number;
  summoner2Id?: number;
  totalMinionsKilled?: number;
  neutralMinionsKilled?: number;
  goldEarned?: number;
  totalDamageDealtToChampions?: number;
  visionScore?: number;
}

/** Normaliza la posición (mayúsculas de match-v5) a nuestro Role. */
export function mapTeamPosition(position: string | undefined): Role {
  switch ((position ?? '').toUpperCase()) {
    case 'TOP':     return 'TOP';
    case 'JUNGLE':  return 'JUNGLE';
    case 'MIDDLE':  return 'MIDDLE';
    case 'BOTTOM':  return 'BOTTOM';
    case 'UTILITY': return 'UTILITY';
    default:        return 'UNKNOWN';
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
  platform: string;
  region: string;
  fetchImpl?: FetchLike;
  maxRetries?: number;
  matchConcurrency?: number;
  sleepImpl?: (ms: number) => Promise<void>;
  /** Carpeta para cachear partidas en disco (inmutables). Acelera reinicios. */
  matchCacheDir?: string;
}

export class RiotApiClient {
  private readonly apiKey: string;
  readonly platform: string;
  readonly region: string;
  private readonly fetchImpl: FetchLike;
  private readonly maxRetries: number;
  private readonly matchConcurrency: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly matchCache = new Map<string, RiotMatchDto>();
  private readonly accountCache = new Map<string, RiotAccountDto>();
  private readonly matchCacheDir: string | undefined;

  constructor(opts: RiotApiClientOptions) {
    this.apiKey = opts.apiKey;
    this.platform = opts.platform;
    this.region = opts.region;
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.maxRetries = opts.maxRetries ?? 3;
    // Concurrencia alta pero segura para la clave de desarrollo (límite 20 req/s).
    this.matchConcurrency = Math.max(1, opts.matchConcurrency ?? 8);
    this.sleep = opts.sleepImpl ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.matchCacheDir = opts.matchCacheDir;
    if (this.matchCacheDir) {
      try { mkdirSync(this.matchCacheDir, { recursive: true }); } catch { /* best-effort */ }
    }
  }

  /** Lee una partida cacheada en disco, si existe. Best-effort. */
  private readDiskMatch(matchId: string): RiotMatchDto | null {
    if (!this.matchCacheDir) return null;
    try {
      const file = join(this.matchCacheDir, `${matchId}.json`);
      if (!existsSync(file)) return null;
      return JSON.parse(readFileSync(file, 'utf8')) as RiotMatchDto;
    } catch {
      return null;
    }
  }

  /** Guarda una partida en disco (inmutable). Best-effort. */
  private writeDiskMatch(matchId: string, match: RiotMatchDto): void {
    if (!this.matchCacheDir) return;
    try {
      writeFileSync(join(this.matchCacheDir, `${matchId}.json`), JSON.stringify(match));
    } catch {
      /* best-effort */
    }
  }

  /**
   * Clona el cliente con otro enrutado (platform/region) conservando la misma
   * API key y configuración. Sirve para atender una petición cuya región difiere
   * de la configurada por defecto (p. ej. el usuario elige LAS en la interfaz).
   */
  withRouting(platform: string, region: string): RiotApiClient {
    return new RiotApiClient({
      apiKey: this.apiKey,
      platform,
      region,
      fetchImpl: this.fetchImpl,
      maxRetries: this.maxRetries,
      matchConcurrency: this.matchConcurrency,
      sleepImpl: this.sleep,
      ...(this.matchCacheDir ? { matchCacheDir: this.matchCacheDir } : {}),
    });
  }

  private async request<T>(host: string, path: string): Promise<T> {
    const url = `https://${host}${path}`;
    for (let attempt = 0; ; attempt += 1) {
      const res = await this.fetchImpl(url, { headers: { 'X-Riot-Token': this.apiKey } });
      const body = await res.text();
      if (res.ok) return JSON.parse(body) as T;
      if (res.status === 429 && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers?.get('Retry-After') ?? '1');
        const waitMs = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1) * 1000;
        await this.sleep(waitMs);
        continue;
      }
      throw new RiotApiError(res.status, path, body);
    }
  }

  private platformHost(): string { return `${this.platform}.api.riotgames.com`; }
  private regionHost():   string { return `${this.region}.api.riotgames.com`; }

  async getAccountByRiotId(gameName: string, tagLine: string): Promise<RiotAccountDto> {
    // El puuid de un Riot ID no cambia: lo memorizamos para no repetir account-v1
    // en cada endpoint (perfil, stats, historial) y reducir latencia y rate limit.
    const key = `${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;
    const cached = this.accountCache.get(key);
    if (cached) return cached;
    const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const account = await this.request<RiotAccountDto>(this.regionHost(), path);
    this.accountCache.set(key, account);
    return account;
  }

  getSummonerByPuuid(puuid: string): Promise<RiotSummonerDto> {
    const path = `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
    return this.request<RiotSummonerDto>(this.platformHost(), path);
  }

  /**
   * league-v4: entradas clasificatorias del invocador.
   * Devuelve arreglo vacío si no tiene partidas clasificatorias.
   * Requiere el encryptedSummonerId (campo `id` de summoner-v4).
   */
  getLeagueEntries(summonerId: string): Promise<RiotLeagueEntryDto[]> {
    const path = `/lol/league/v4/entries/by-summoner/${encodeURIComponent(summonerId)}`;
    return this.request<RiotLeagueEntryDto[]>(this.platformHost(), path);
  }

  /**
   * league-v4 por PUUID: alternativa moderna que no depende del summonerId
   * encriptado (que Riot está deprecando). Preferida para obtener el rango.
   */
  getLeagueEntriesByPuuid(puuid: string): Promise<RiotLeagueEntryDto[]> {
    const path = `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
    return this.request<RiotLeagueEntryDto[]>(this.platformHost(), path);
  }

  getMatchIdsByPuuid(puuid: string, count: number): Promise<string[]> {
    const path = `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${count}`;
    return this.request<string[]>(this.regionHost(), path);
  }

  async getMatch(matchId: string): Promise<RiotMatchDto> {
    const cached = this.matchCache.get(matchId);
    if (cached) return cached;
    const disk = this.readDiskMatch(matchId);
    if (disk) {
      this.matchCache.set(matchId, disk);
      return disk;
    }
    const path = `/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
    const match = await this.request<RiotMatchDto>(this.regionHost(), path);
    this.matchCache.set(matchId, match);
    this.writeDiskMatch(matchId, match);
    return match;
  }

  async getMatches(matchIds: string[]): Promise<RiotMatchDto[]> {
    const results = new Array<RiotMatchDto | undefined>(matchIds.length);
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < matchIds.length) {
        const index = next;
        next += 1;
        // Tolerante a fallos: si una partida concreta falla (rate limit, partida
        // no disponible…), la omitimos en vez de tumbar todo el historial.
        try {
          results[index] = await this.getMatch(matchIds[index]!);
        } catch {
          results[index] = undefined;
        }
      }
    };
    const workers = Array.from(
      { length: Math.min(this.matchConcurrency, matchIds.length) },
      () => worker(),
    );
    await Promise.all(workers);
    return results.filter((m): m is RiotMatchDto => m !== undefined);
  }
}
