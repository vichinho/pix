/** Mapea el nombre de un hechizo de invocador (ES/EN) al archivo de icono. */
const SUMMONER_FILE: Record<string, string> = {
  flash: 'SummonerFlash',
  destello: 'SummonerFlash',
  ignite: 'SummonerDot',
  encender: 'SummonerDot',
  prender: 'SummonerDot',
  teletransporte: 'SummonerTeleport',
  teleport: 'SummonerTeleport',
  curacion: 'SummonerHeal',
  heal: 'SummonerHeal',
  castigo: 'SummonerSmite',
  smite: 'SummonerSmite',
  barrera: 'SummonerBarrier',
  barrier: 'SummonerBarrier',
  agotar: 'SummonerExhaust',
  exhaust: 'SummonerExhaust',
  purificar: 'SummonerBoost',
  cleanse: 'SummonerBoost',
  fantasma: 'SummonerHaste',
  ghost: 'SummonerHaste',
  claridad: 'SummonerMana',
  clarity: 'SummonerMana',
  marca: 'SummonerSnowball',
  mark: 'SummonerSnowball',
};

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Nombre de archivo del icono del hechizo (sin extensión), o null. */
export function summonerImageFile(name: string): string | null {
  return SUMMONER_FILE[normalize(name)] ?? null;
}
