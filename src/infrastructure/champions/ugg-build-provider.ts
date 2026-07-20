/**
 * MerakiBuildProvider
 * -------------------
 * Usa la CDN pública de Meraki Analytics para obtener builds por campeón.
 * No requiere API key ni tiene Cloudflare.
 *
 * Meraki NO incluye recommendedItemSets, por lo que los ítems se infieren
 * a partir de `adaptiveType` + `roles` + `abilityReliance` del campeón
 * usando un mapa de arquetipos curado para el patch 16.x.
 */
import type { BuildProvider } from '../../domain/build.js';
import type { ChampionBuild, Role } from '../../domain/types.js';

// ── Runas estándar por rol ─────────────────────────────────────────────────────
const RUNES_BY_ROLE: Record<Role, ChampionBuild['runes']> = {
  TOP: {
    primaryStyleId: 8000, keystoneId: 8010,
    primary: [9101, 9104, 8299], secondaryStyleId: 8200,
    secondary: [8210, 8237], shards: [5005, 5008, 5011],
  },
  JUNGLE: {
    primaryStyleId: 8000, keystoneId: 8010,
    primary: [9101, 9104, 8299], secondaryStyleId: 8400,
    secondary: [8444, 8453], shards: [5005, 5008, 5011],
  },
  MIDDLE: {
    primaryStyleId: 8100, keystoneId: 8112,
    primary: [8143, 8136, 8106], secondaryStyleId: 8200,
    secondary: [8210, 8237], shards: [5007, 5008, 5011],
  },
  BOTTOM: {
    primaryStyleId: 8000, keystoneId: 8005,
    primary: [9101, 9104, 8299], secondaryStyleId: 8100,
    secondary: [8143, 8135], shards: [5005, 5008, 5011],
  },
  UTILITY: {
    primaryStyleId: 8200, keystoneId: 8229,
    primary: [8226, 8210, 8232], secondaryStyleId: 8300,
    secondary: [8304, 8347], shards: [5007, 5008, 5011],
  },
  ARAM: {
    primaryStyleId: 8200, keystoneId: 8229,
    primary: [8226, 5008, 8232], secondaryStyleId: 8300,
    secondary: [8304, 8347], shards: [5007, 5008, 5011],
  },
  UNKNOWN: {
    primaryStyleId: 8200, keystoneId: 8214,
    primary: [8226, 8210, 8232], secondaryStyleId: 8300,
    secondary: [8304, 8347], shards: [5007, 5008, 5011],
  },
};

const SUMMONERS_BY_ROLE: Record<Role, string[]> = {
  TOP:     ['Flash', 'Teleport'],
  JUNGLE:  ['Flash', 'Smite'],
  MIDDLE:  ['Flash', 'Ignite'],
  BOTTOM:  ['Flash', 'Heal'],
  UTILITY: ['Flash', 'Ignite'],
  ARAM:    ['Flash', 'Mark'],
  UNKNOWN: ['Flash', 'Ignite'],
};

// ── Ítems por arquetipo (patch 16.x) ──────────────────────────────────────────
// starting: ítems de inicio
// core: build de 3 ítems principales
// situational: opciones alternativas
type ItemSet = { starting: number[]; core: number[]; situational: number[] };

/**
 * Clasifica el arquetipo de un campeón según los datos de Meraki.
 * Retorna un ItemSet para patch 16.x.
 */
function getItemSetForArchetype(
  adaptiveType: string,
  roles: string[],
  abilityReliance: number,
  position: string,
): ItemSet {
  const isAP = adaptiveType === 'MAGIC_DAMAGE';
  const isAD = adaptiveType === 'PHYSICAL_DAMAGE';
  const isAbilityBased = abilityReliance >= 70;
  const isTank = roles.includes('TANK') || roles.includes('FIGHTER') && !isAbilityBased;
  const isSupport = position === 'UTILITY' || roles.includes('SUPPORT');
  const isMarksman = roles.includes('MARKSMAN') || (isAD && position === 'BOTTOM');
  const isJungle = position === 'JUNGLE';
  const isAssassin = roles.includes('ASSASSIN');

  // AP Mage / Burst / Support AP
  if (isAP && isAbilityBased && isSupport) {
    return {
      starting:    [3303, 2003],          // Spellthief's Edge + Potion
      core:        [3165, 4645, 3174],    // Morellonomicon, Shadowflame, Ardent Censer
      situational: [3135, 3089, 3157],    // Void Staff, Rabadon, Zhonya's
    };
  }

  // AP Assassin (Ahri, Leblanc, Fizz, Katarina...)
  if (isAP && isAssassin) {
    return {
      starting:    [1056, 2003],          // Doran's Ring + Potion
      core:        [3152, 6657, 3157],    // Hextech Rocketbelt, Rod of Ages, Zhonya's
      situational: [3135, 3089, 4645],    // Void Staff, Rabadon, Shadowflame
    };
  }

  // AP Mage (Lux, Syndra, Viktor, Orianna...)
  if (isAP && isAbilityBased) {
    return {
      starting:    [1056, 2003],          // Doran's Ring + Potion
      core:        [3165, 4645, 3089],    // Morellonomicon, Shadowflame, Rabadon
      situational: [3135, 3157, 3116],    // Void Staff, Zhonya's, Rylai's
    };
  }

  // AP Jungler (Amumu AP, Elise, Nidalee...)
  if (isAP && isJungle) {
    return {
      starting:    [1039, 2003],          // Hunter's Talisman + Potion
      core:        [6692, 3165, 3089],    // Jak'Sho → swap to Runic, Morello, Rabadon
      situational: [3135, 3157, 4645],
    };
  }

  // Marksman (ADC)
  if (isMarksman) {
    return {
      starting:    [1055, 2003],          // Doran's Blade + Potion
      core:        [3031, 6672, 3094],    // IE, Kraken Slayer, Rapid Firecannon
      situational: [3036, 3035, 3139],    // Lord Dominik's, Mortal Reminder, Mercurial
    };
  }

  // AD Assassin (Zed, Talon, Qiyana...)
  if (isAD && isAssassin) {
    return {
      starting:    [1055, 2003],
      core:        [6692, 3147, 3814],    // Serylda, Duskblade, Edge of Night
      situational: [3031, 3036, 3026],
    };
  }

  // AD Fighter / Bruiser (Top)
  if (isAD && isTank) {
    return {
      starting:    [1054, 2003],          // Doran's Shield + Potion
      core:        [6630, 3078, 3053],    // Trinity Force, Sterak's Gage
      situational: [3071, 3033, 3026],    // Black Cleaver, Mortal Reminder
    };
  }

  // Tank / Support Tank
  if (isTank || isSupport) {
    return {
      starting:    [1054, 2003],
      core:        [3190, 4401, 3143],    // Locket, Force of Nature, Randuin's
      situational: [3109, 3211, 3107],
    };
  }

  // AD Jungler (default jungle)
  if (isJungle) {
    return {
      starting:    [1039, 2003],
      core:        [6630, 3071, 3053],
      situational: [3036, 3033, 3026],
    };
  }

  // Fallback AP
  if (isAP) {
    return {
      starting:    [1056, 2003],
      core:        [3165, 3089, 3135],
      situational: [3157, 3116, 4645],
    };
  }

  // Fallback AD
  return {
    starting:    [1055, 2003],
    core:        [3031, 6672, 3094],
    situational: [3036, 3035, 3139],
  };
}

// ── Tipos Meraki ──────────────────────────────────────────────────────────────
interface MerakiChampion {
  name: string;
  key: string;
  apiName: string;
  adaptiveType?: string;
  positions?: string[];
  roles?: string[];
  attributeRatings?: { abilityReliance?: number; [k: string]: unknown };
  [key: string]: unknown;
}

const MERAKI_BASE = 'https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US';

async function fetchMerakiIndex(): Promise<Record<string, { id: number; key: string }>> {
  const res = await fetch(`${MERAKI_BASE}/champions.json`, {
    signal: AbortSignal.timeout(6000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Meraki index HTTP ${res.status}`);
  return res.json() as Promise<Record<string, { id: number; key: string }>>;
}

async function fetchMerakiChampion(key: string): Promise<MerakiChampion> {
  const res = await fetch(`${MERAKI_BASE}/champions/${key}.json`, {
    signal: AbortSignal.timeout(6000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Meraki champion HTTP ${res.status}`);
  return res.json() as Promise<MerakiChampion>;
}

/**
 * Proveedor de builds usando Meraki Analytics CDN.
 * - Sin API key, sin Cloudflare.
 * - Ítems inferidos del arquetipo del campeón (adaptiveType + roles).
 * - Runas y summoners estándar por rol.
 */
export class MerakiBuildProvider implements BuildProvider {
  readonly name = 'meraki';

  private readonly idToKey = new Map<number, string>();
  private readonly champCache = new Map<string, MerakiChampion>();
  private readonly buildCache = new Map<string, ChampionBuild | null>();
  private indexPromise: Promise<void> | null = null;

  private loadIndex(): Promise<void> {
    if (this.indexPromise === null) {
      this.indexPromise = fetchMerakiIndex()
        .then((index) => {
          for (const [key, data] of Object.entries(index)) {
            this.idToKey.set(data.id, key);
          }
        })
        .catch(() => { /* índice no disponible: el provider devuelve null */ });
    }
    return this.indexPromise;
  }

  async getBuild(championId: number, role: Role): Promise<ChampionBuild | null> {
    const cacheKey = `${championId}:${role}`;
    if (this.buildCache.has(cacheKey)) return this.buildCache.get(cacheKey) ?? null;

    try {
      await this.loadIndex();

      const key = this.idToKey.get(championId);
      if (key === undefined) {
        this.buildCache.set(cacheKey, null);
        return null;
      }

      let champ = this.champCache.get(key);
      if (champ === undefined) {
        champ = await fetchMerakiChampion(key);
        this.champCache.set(key, champ);
      }

      const build = this.mapToChampionBuild(championId, champ, role);
      this.buildCache.set(cacheKey, build);
      return build;

    } catch {
      this.buildCache.set(cacheKey, null);
      return null;
    }
  }

  private mapToChampionBuild(
    championId: number,
    champ: MerakiChampion,
    role: Role,
  ): ChampionBuild {
    const adaptiveType = champ.adaptiveType ?? 'MAGIC_DAMAGE';
    const roles = champ.roles ?? [];
    const abilityReliance = champ.attributeRatings?.abilityReliance ?? 50;
    // Posición dominante del campeón según Meraki (fallback al rol solicitado)
    const merakiPosition = (champ.positions?.[0] ?? role).toUpperCase();
    const effectivePosition = role !== 'UNKNOWN' ? role : merakiPosition;

    const { starting, core, situational } = getItemSetForArchetype(
      adaptiveType,
      roles,
      abilityReliance,
      effectivePosition,
    );

    // Orden de habilidades: Q-W-E es el más común pero podemos usar roles para refinar
    // (si es marksman o ADC, normalmente Q→W→E; si es support, W→Q→E)
    const skillOrder = roles.includes('SUPPORT') ? ['W', 'Q', 'E'] : ['Q', 'W', 'E'];

    return {
      championId,
      championName: champ.name,
      role,
      source: 'meraki',
      patch: 'latest',
      summonerSpells: SUMMONERS_BY_ROLE[role],
      runes: RUNES_BY_ROLE[role],
      startingItems: starting,
      coreItems: core,
      situationalItems: situational,
      skillOrder,
      notes: `Build de arquetipo Meraki Analytics para ${champ.name} (${adaptiveType.replace('_DAMAGE', '')}${roles.length ? ', ' + roles.slice(0, 2).join('/') : ''}).`,
    };
  }
}
