import type { BuildProvider } from '../../domain/build.js';
import type { ChampionBuild, Role } from '../../domain/types.js';
import type { ChampionCatalog } from './champion-catalog.js';
import { buildFromArchetype, type BuildArchetype } from './archetype-build-provider.js';

/**
 * Clasificación de CADA campeón por su subclase real, para darle la build que le
 * corresponde a su estilo (no una genérica por tag de Data Dragon). La clave es
 * el id de Data Dragon en minúsculas (p. ej. "missfortune", "monkeyking").
 *
 * Esto cubre a todos los campeones con una build afinada a su arquetipo. Los
 * campeones con build curada específica (SeedBuildProvider) tienen prioridad
 * sobre esta; y si aparece un campeón nuevo no listado aquí, cae al proveedor
 * por tags y nunca se queda sin build.
 */
export const CHAMPION_ARCHETYPE: Record<string, BuildArchetype> = {
  aatrox: 'FIGHTER', ahri: 'MAGE', akali: 'ASSASSIN_AP', akshan: 'MARKSMAN',
  alistar: 'SUPPORT_TANK', ambessa: 'FIGHTER', amumu: 'TANK', anivia: 'BATTLEMAGE',
  annie: 'MAGE', aphelios: 'MARKSMAN', ashe: 'MARKSMAN', aurelionsol: 'BATTLEMAGE',
  aurora: 'MAGE', azir: 'AP_ONHIT', bard: 'ENCHANTER', belveth: 'ONHIT_MARKSMAN',
  blitzcrank: 'SUPPORT_TANK', brand: 'MAGE', braum: 'SUPPORT_TANK', briar: 'FIGHTER',
  caitlyn: 'MARKSMAN', camille: 'FIGHTER', cassiopeia: 'BATTLEMAGE', chogath: 'TANK',
  corki: 'MARKSMAN', darius: 'FIGHTER', diana: 'ASSASSIN_AP', draven: 'MARKSMAN',
  drmundo: 'TANK', ekko: 'ASSASSIN_AP', elise: 'MAGE', evelynn: 'ASSASSIN_AP',
  ezreal: 'MARKSMAN', fiddlesticks: 'MAGE', fiora: 'FIGHTER', fizz: 'ASSASSIN_AP',
  galio: 'TANK', gangplank: 'FIGHTER', garen: 'FIGHTER', gnar: 'FIGHTER',
  gragas: 'TANK', graves: 'MARKSMAN', gwen: 'AP_ONHIT', hecarim: 'FIGHTER',
  heimerdinger: 'MAGE', hwei: 'ARTILLERY', illaoi: 'FIGHTER', irelia: 'SKIRMISHER',
  ivern: 'ENCHANTER', janna: 'ENCHANTER', jarvaniv: 'FIGHTER', jax: 'SKIRMISHER',
  jayce: 'MARKSMAN', jhin: 'MARKSMAN', jinx: 'MARKSMAN', kaisa: 'ONHIT_MARKSMAN',
  kalista: 'ONHIT_MARKSMAN', karma: 'ENCHANTER', karthus: 'BATTLEMAGE', kassadin: 'ASSASSIN_AP',
  katarina: 'ASSASSIN_AP', kayle: 'AP_ONHIT', kayn: 'SKIRMISHER', kennen: 'MAGE',
  khazix: 'ASSASSIN_AD', kindred: 'MARKSMAN', kled: 'FIGHTER', kogmaw: 'ONHIT_MARKSMAN',
  ksante: 'FIGHTER', leblanc: 'ASSASSIN_AP', leesin: 'FIGHTER', leona: 'SUPPORT_TANK',
  lillia: 'MAGE', lissandra: 'MAGE', lucian: 'MARKSMAN', lulu: 'ENCHANTER',
  lux: 'ARTILLERY', malphite: 'TANK', malzahar: 'MAGE', maokai: 'TANK',
  masteryi: 'SKIRMISHER', missfortune: 'MARKSMAN', mordekaiser: 'BATTLEMAGE', morgana: 'MAGE',
  naafiri: 'ASSASSIN_AD', nami: 'ENCHANTER', nasus: 'FIGHTER', nautilus: 'SUPPORT_TANK',
  neeko: 'MAGE', nidalee: 'MAGE', nilah: 'ONHIT_MARKSMAN', nocturne: 'ASSASSIN_AD',
  nunu: 'TANK', olaf: 'FIGHTER', orianna: 'MAGE', ornn: 'TANK',
  pantheon: 'FIGHTER', poppy: 'TANK', pyke: 'ASSASSIN_AD', qiyana: 'ASSASSIN_AD',
  quinn: 'MARKSMAN', rakan: 'ENCHANTER', rammus: 'TANK', reksai: 'FIGHTER',
  rell: 'SUPPORT_TANK', renata: 'ENCHANTER', renekton: 'FIGHTER', rengar: 'ASSASSIN_AD',
  riven: 'FIGHTER', rumble: 'BATTLEMAGE', ryze: 'BATTLEMAGE', samira: 'MARKSMAN',
  sejuani: 'TANK', senna: 'MARKSMAN', seraphine: 'ENCHANTER', sett: 'FIGHTER',
  shaco: 'ASSASSIN_AD', shen: 'TANK', shyvana: 'FIGHTER', singed: 'TANK',
  sion: 'TANK', sivir: 'MARKSMAN', skarner: 'TANK', smolder: 'MARKSMAN',
  sona: 'ENCHANTER', soraka: 'ENCHANTER', swain: 'BATTLEMAGE', sylas: 'BATTLEMAGE',
  syndra: 'MAGE', tahmkench: 'TANK', taliyah: 'MAGE', talon: 'ASSASSIN_AD',
  taric: 'SUPPORT_TANK', teemo: 'AP_ONHIT', thresh: 'SUPPORT_TANK', tristana: 'MARKSMAN',
  trundle: 'FIGHTER', tryndamere: 'SKIRMISHER', twistedfate: 'MAGE', twitch: 'ONHIT_MARKSMAN',
  udyr: 'FIGHTER', urgot: 'FIGHTER', varus: 'MARKSMAN', vayne: 'ONHIT_MARKSMAN',
  veigar: 'MAGE', velkoz: 'ARTILLERY', vex: 'MAGE', vi: 'FIGHTER',
  viego: 'SKIRMISHER', viktor: 'MAGE', vladimir: 'BATTLEMAGE', volibear: 'FIGHTER',
  warwick: 'FIGHTER', monkeyking: 'FIGHTER', xayah: 'MARKSMAN', xerath: 'ARTILLERY',
  xinzhao: 'FIGHTER', yasuo: 'SKIRMISHER', yone: 'SKIRMISHER', yorick: 'FIGHTER',
  yuumi: 'ENCHANTER', zac: 'TANK', zed: 'ASSASSIN_AD', zeri: 'MARKSMAN',
  ziggs: 'ARTILLERY', zilean: 'ENCHANTER', zoe: 'MAGE', zyra: 'MAGE',
};

/**
 * Proveedor que da a cada campeón la build de su subclase clasificada a mano.
 * Requiere el catálogo (Data Dragon) para resolver championId → id de Data Dragon.
 * Cubre a prácticamente todos los campeones; si no conoce uno, devuelve null.
 */
export class ClassifiedBuildProvider implements BuildProvider {
  readonly name = 'classified';

  constructor(private readonly catalog: ChampionCatalog) {}

  getBuild(championId: number, role: Role): ChampionBuild | null {
    const meta = this.catalog.getMeta(championId);
    if (!meta) return null;
    const archetype = CHAMPION_ARCHETYPE[meta.ddragonId.toLowerCase()];
    if (!archetype) return null;
    return buildFromArchetype(championId, meta.name, role, archetype);
  }
}
