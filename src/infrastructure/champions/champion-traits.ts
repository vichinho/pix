import type { ChampionTraits, ChampionTraitProvider } from '../../domain/aram.js';

const TRAITS: ChampionTraits[] = [
  // --- Tanques / frontline ---
  { championId: 54,  name: 'Malphite',       damage: 'AP',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC'], aramScore: 78 },
  { championId: 32,  name: 'Amumu',          damage: 'AP',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC'], aramScore: 76 },
  { championId: 89,  name: 'Leona',          damage: 'NONE',  traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC'], aramScore: 72 },
  { championId: 111, name: 'Nautilus',       damage: 'AP',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC'], aramScore: 74 },
  { championId: 14,  name: 'Sion',           damage: 'AD',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC', 'WAVECLEAR'], aramScore: 74 },
  { championId: 516, name: 'Ornn',           damage: 'AP',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC'], aramScore: 73 },
  { championId: 57,  name: 'Maokai',         damage: 'AP',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC', 'SUSTAIN'], aramScore: 76 },
  { championId: 33,  name: 'Rammus',         damage: 'AD',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC'], aramScore: 70 },
  { championId: 154, name: 'Zac',            damage: 'AP',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC', 'SUSTAIN'], aramScore: 74 },
  { championId: 20,  name: 'Nunu & Willump', damage: 'AP',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC', 'SUSTAIN'], aramScore: 72 },
  { championId: 201, name: 'Braum',          damage: 'NONE',  traits: ['FRONTLINE', 'HARD_CC'], aramScore: 70 },
  { championId: 12,  name: 'Alistar',        damage: 'NONE',  traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC', 'HEALING'], aramScore: 70 },
  { championId: 79,  name: 'Gragas',         damage: 'AP',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC', 'WAVECLEAR'], aramScore: 76 },
  { championId: 150, name: 'Gnar',           damage: 'MIXED', traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC'], aramScore: 72 },
  { championId: 98,  name: 'Shen',           damage: 'NONE',  traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC'], aramScore: 72 },
  { championId: 31,  name: "Cho'Gath",       damage: 'AP',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC', 'SUSTAIN'], aramScore: 74 },
  { championId: 102, name: 'Shyvana',        damage: 'MIXED', traits: ['FRONTLINE', 'WAVECLEAR'], aramScore: 70 },

  // --- Luchadores / bruisers ---
  { championId: 86,  name: 'Garen',       damage: 'AD',    traits: ['FRONTLINE', 'SUSTAIN'], aramScore: 70 },
  { championId: 122, name: 'Darius',      damage: 'AD',    traits: ['FRONTLINE', 'SUSTAIN', 'HARD_CC'], aramScore: 72 },
  { championId: 875, name: 'Sett',        damage: 'AD',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC'], aramScore: 74 },
  { championId: 24,  name: 'Jax',         damage: 'AD',    traits: ['FRONTLINE', 'SUSTAIN'], aramScore: 70 },
  { championId: 114, name: 'Fiora',       damage: 'AD',    traits: ['SUSTAIN'], aramScore: 64 },
  { championId: 82,  name: 'Mordekaiser', damage: 'AP',    traits: ['FRONTLINE', 'SUSTAIN', 'WAVECLEAR'], aramScore: 78 },
  { championId: 75,  name: 'Nasus',       damage: 'AD',    traits: ['FRONTLINE', 'SUSTAIN'], aramScore: 70 },
  { championId: 58,  name: 'Renekton',    damage: 'AD',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC', 'SUSTAIN'], aramScore: 70 },
  { championId: 106, name: 'Volibear',    damage: 'AD',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC', 'SUSTAIN'], aramScore: 74 },
  { championId: 19,  name: 'Warwick',     damage: 'AD',    traits: ['SUSTAIN', 'ENGAGE', 'HARD_CC'], aramScore: 74 },
  { championId: 36,  name: 'Dr. Mundo',   damage: 'AD',    traits: ['FRONTLINE', 'SUSTAIN'], aramScore: 74 },
  { championId: 62,  name: 'Wukong',      damage: 'AD',    traits: ['FRONTLINE', 'ENGAGE', 'HARD_CC'], aramScore: 70 },
  { championId: 234, name: 'Viego',       damage: 'AD',    traits: ['SUSTAIN'], aramScore: 66 },
  { championId: 80,  name: 'Pantheon',    damage: 'AD',    traits: ['ENGAGE', 'POKE'], aramScore: 74 },
  { championId: 420, name: 'Illaoi',      damage: 'AD',    traits: ['FRONTLINE', 'SUSTAIN'], aramScore: 76 },
  { championId: 266, name: 'Aatrox',      damage: 'AD',    traits: ['FRONTLINE', 'SUSTAIN', 'WAVECLEAR'], aramScore: 74 },
  { championId: 240, name: 'Kled',        damage: 'AD',    traits: ['FRONTLINE', 'ENGAGE'], aramScore: 70 },

  // --- Magos ---
  { championId: 63,  name: 'Brand',         damage: 'AP', traits: ['POKE', 'WAVECLEAR', 'HARD_CC'], aramScore: 82 },
  { championId: 101, name: 'Xerath',        damage: 'AP', traits: ['POKE', 'WAVECLEAR', 'HARD_CC'], aramScore: 82 },
  { championId: 115, name: 'Ziggs',         damage: 'AP', traits: ['POKE', 'WAVECLEAR'], aramScore: 80 },
  { championId: 99,  name: 'Lux',           damage: 'AP', traits: ['POKE', 'WAVECLEAR', 'HARD_CC'], aramScore: 80 },
  { championId: 161, name: "Vel'Koz",       damage: 'AP', traits: ['POKE', 'WAVECLEAR', 'HARD_CC'], aramScore: 80 },
  { championId: 103, name: 'Ahri',          damage: 'AP', traits: ['POKE', 'HARD_CC'], aramScore: 76 },
  { championId: 1,   name: 'Annie',         damage: 'AP', traits: ['WAVECLEAR', 'HARD_CC', 'ENGAGE'], aramScore: 78 },
  { championId: 45,  name: 'Veigar',        damage: 'AP', traits: ['WAVECLEAR', 'HARD_CC'], aramScore: 76 },
  { championId: 90,  name: 'Malzahar',      damage: 'AP', traits: ['WAVECLEAR', 'HARD_CC', 'SUSTAIN'], aramScore: 78 },
  { championId: 30,  name: 'Karthus',       damage: 'AP', traits: ['WAVECLEAR', 'POKE'], aramScore: 82 },
  { championId: 134, name: 'Syndra',        damage: 'AP', traits: ['POKE', 'HARD_CC'], aramScore: 76 },
  { championId: 112, name: 'Viktor',        damage: 'AP', traits: ['WAVECLEAR', 'POKE'], aramScore: 78 },
  { championId: 8,   name: 'Vladimir',      damage: 'AP', traits: ['SUSTAIN', 'WAVECLEAR'], aramScore: 78 },
  { championId: 50,  name: 'Swain',         damage: 'AP', traits: ['SUSTAIN', 'HARD_CC', 'WAVECLEAR', 'FRONTLINE'], aramScore: 78 },
  { championId: 147, name: 'Seraphine',     damage: 'AP', traits: ['POKE', 'HEALING', 'HARD_CC', 'WAVECLEAR'], aramScore: 82 },
  { championId: 25,  name: 'Morgana',       damage: 'AP', traits: ['HARD_CC', 'WAVECLEAR'], aramScore: 74 },
  { championId: 4,   name: 'Twisted Fate',  damage: 'MIXED', traits: ['POKE', 'WAVECLEAR', 'HARD_CC'], aramScore: 74 },
  { championId: 74,  name: 'Heimerdinger',  damage: 'AP', traits: ['POKE', 'WAVECLEAR', 'HARD_CC'], aramScore: 80 },
  { championId: 17,  name: 'Teemo',         damage: 'AP', traits: ['POKE'], aramScore: 72 },
  { championId: 10,  name: 'Kayle',         damage: 'MIXED', traits: ['HEALING', 'WAVECLEAR'], aramScore: 70 },
  { championId: 61,  name: 'Orianna',       damage: 'AP', traits: ['POKE', 'HARD_CC', 'WAVECLEAR'], aramScore: 78 },
  { championId: 136, name: "Aurelion Sol",  damage: 'AP', traits: ['POKE', 'WAVECLEAR'], aramScore: 76 },
  { championId: 69,  name: 'Cassiopeia',    damage: 'AP', traits: ['POKE', 'HARD_CC', 'SUSTAIN'], aramScore: 76 },
  { championId: 142, name: 'Zoe',           damage: 'AP', traits: ['POKE', 'HARD_CC'], aramScore: 74 },
  { championId: 13,  name: 'Ryze',          damage: 'AP', traits: ['WAVECLEAR', 'HARD_CC'], aramScore: 72 },
  { championId: 161, name: "Vel'Koz",       damage: 'AP', traits: ['POKE', 'WAVECLEAR'], aramScore: 80 },

  // --- Tiradores ---
  { championId: 222, name: 'Jinx',     damage: 'AD', traits: ['WAVECLEAR'], aramScore: 78 },
  { championId: 21,  name: 'Miss Fortune', damage: 'AD', traits: ['WAVECLEAR', 'POKE'], aramScore: 82 },
  { championId: 51,  name: 'Caitlyn', damage: 'AD', traits: ['POKE', 'WAVECLEAR'], aramScore: 76 },
  { championId: 22,  name: 'Ashe',    damage: 'AD', traits: ['POKE', 'HARD_CC'], aramScore: 78 },
  { championId: 81,  name: 'Ezreal',  damage: 'MIXED', traits: ['POKE', 'WAVECLEAR'], aramScore: 74 },
  { championId: 202, name: 'Jhin',    damage: 'AD', traits: ['POKE', 'HARD_CC'], aramScore: 80 },
  { championId: 96,  name: "Kog'Maw", damage: 'MIXED', traits: ['POKE', 'WAVECLEAR'], aramScore: 78 },
  { championId: 18,  name: 'Tristana', damage: 'AD', traits: ['WAVECLEAR'], aramScore: 74 },
  { championId: 110, name: 'Varus',   damage: 'AD', traits: ['POKE', 'HARD_CC'], aramScore: 80 },
  { championId: 15,  name: 'Sivir',   damage: 'AD', traits: ['WAVECLEAR'], aramScore: 72 },
  { championId: 67,  name: 'Vayne',   damage: 'AD', traits: ['SUSTAIN'], aramScore: 66 },
  { championId: 119, name: 'Draven',  damage: 'AD', traits: [], aramScore: 72 },
  { championId: 145, name: "Kai'Sa",  damage: 'MIXED', traits: [], aramScore: 72 },
  { championId: 29,  name: 'Twitch',  damage: 'MIXED', traits: ['POKE', 'WAVECLEAR'], aramScore: 76 },
  { championId: 42,  name: 'Corki',   damage: 'MIXED', traits: ['POKE', 'WAVECLEAR'], aramScore: 72 },
  { championId: 6,   name: 'Urgot',   damage: 'AD',    traits: ['FRONTLINE', 'SUSTAIN', 'POKE'], aramScore: 74 },

  // --- Enchantadores / soporte de curación ---
  { championId: 16,  name: 'Soraka',   damage: 'AP', traits: ['HEALING', 'POKE'], aramScore: 78 },
  { championId: 37,  name: 'Sona',     damage: 'AP', traits: ['HEALING', 'POKE', 'HARD_CC', 'WAVECLEAR'], aramScore: 82 },
  { championId: 267, name: 'Nami',     damage: 'AP', traits: ['HEALING', 'HARD_CC', 'POKE'], aramScore: 78 },
  { championId: 40,  name: 'Janna',    damage: 'AP', traits: ['HEALING', 'HARD_CC'], aramScore: 70 },
  { championId: 117, name: 'Lulu',     damage: 'AP', traits: ['HEALING', 'HARD_CC'], aramScore: 76 },
  { championId: 350, name: 'Yuumi',    damage: 'AP', traits: ['HEALING'], aramScore: 66 },
  { championId: 43,  name: 'Karma',    damage: 'AP', traits: ['HEALING', 'POKE', 'HARD_CC'], aramScore: 78 },
  { championId: 44,  name: 'Taric',    damage: 'NONE', traits: ['HEALING', 'FRONTLINE', 'HARD_CC'], aramScore: 70 },
  { championId: 26,  name: 'Zilean',   damage: 'AP', traits: ['HEALING', 'HARD_CC', 'POKE'], aramScore: 74 },
  { championId: 498, name: 'Xayah',    damage: 'AD', traits: ['WAVECLEAR', 'POKE'], aramScore: 72 },
  { championId: 497, name: 'Rakan',    damage: 'AP', traits: ['HEALING', 'ENGAGE', 'HARD_CC'], aramScore: 72 },

  // --- Asesinos ---
  { championId: 238, name: 'Zed',        damage: 'AD', traits: [], aramScore: 62 },
  { championId: 91,  name: 'Talon',      damage: 'AD', traits: ['WAVECLEAR'], aramScore: 64 },
  { championId: 55,  name: 'Katarina',   damage: 'AP', traits: ['WAVECLEAR'], aramScore: 70 },
  { championId: 84,  name: 'Akali',      damage: 'AP', traits: [], aramScore: 66 },
  { championId: 105, name: 'Fizz',       damage: 'AP', traits: ['HARD_CC'], aramScore: 68 },
  { championId: 555, name: 'Pyke',       damage: 'AD', traits: ['ENGAGE', 'HARD_CC'], aramScore: 66 },
  { championId: 157, name: 'Yasuo',      damage: 'AD', traits: ['WAVECLEAR'], aramScore: 68 },
  { championId: 777, name: 'Yone',       damage: 'AD', traits: ['WAVECLEAR'], aramScore: 70 },
  { championId: 64,  name: 'Lee Sin',    damage: 'AD', traits: ['ENGAGE'], aramScore: 60 },
  { championId: 11,  name: 'Master Yi',  damage: 'AD', traits: ['SUSTAIN'], aramScore: 62 },
  { championId: 35,  name: 'Shaco',      damage: 'AD', traits: [], aramScore: 60 },
  { championId: 121, name: "Kha'Zix",   damage: 'AD', traits: [], aramScore: 62 },
  { championId: 107, name: 'Rengar',     damage: 'AD', traits: [], aramScore: 60 },
  { championId: 131, name: 'Diana',      damage: 'AP', traits: ['ENGAGE', 'HARD_CC', 'WAVECLEAR'], aramScore: 72 },
  { championId: 245, name: 'Ekko',       damage: 'AP', traits: ['WAVECLEAR', 'HARD_CC'], aramScore: 68 },
];

export class SeedChampionTraitProvider implements ChampionTraitProvider {
  private readonly byId: Map<number, ChampionTraits>;

  constructor(traits: ChampionTraits[] = TRAITS) {
    this.byId = new Map(traits.map((t) => [t.championId, t]));
  }

  get(championId: number): ChampionTraits | null {
    const found = this.byId.get(championId);
    return found ? { ...found, traits: [...found.traits] } : null;
  }
}
