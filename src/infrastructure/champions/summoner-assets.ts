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

/** Descripción breve de cada hechizo de invocador (para el tooltip). */
const SUMMONER_DESC: Record<string, string> = {
  flash: 'Te teletransportas una distancia corta hacia el cursor. CD 300s.',
  destello: 'Te teletransportas una distancia corta hacia el cursor. CD 300s.',
  ignite: 'Prende a un enemigo: daño verdadero en el tiempo y reduce su curación. CD 180s.',
  encender: 'Prende a un enemigo: daño verdadero en el tiempo y reduce su curación. CD 180s.',
  prender: 'Prende a un enemigo: daño verdadero en el tiempo y reduce su curación. CD 180s.',
  teleport: 'Te canalizas para teletransportarte a una estructura o súbdito aliado. CD 360→240s.',
  teletransporte: 'Te canalizas para teletransportarte a una estructura o súbdito aliado. CD 360→240s.',
  heal: 'Cura a ti y a un aliado y os da velocidad de movimiento breve. CD 240s.',
  curacion: 'Cura a ti y a un aliado y os da velocidad de movimiento breve. CD 240s.',
  smite: 'Daño verdadero a monstruos o súbditos. Esencial en la jungla. CD 15s.',
  castigo: 'Daño verdadero a monstruos o súbditos. Esencial en la jungla. CD 15s.',
  barrier: 'Te da un escudo temporal que absorbe daño. CD 180s.',
  barrera: 'Te da un escudo temporal que absorbe daño. CD 180s.',
  exhaust: 'Ralentiza a un enemigo y reduce el daño que inflige. CD 210s.',
  agotar: 'Ralentiza a un enemigo y reduce el daño que inflige. CD 210s.',
  cleanse: 'Elimina la mayoría de efectos de control y reduce su duración. CD 210s.',
  purificar: 'Elimina la mayoría de efectos de control y reduce su duración. CD 210s.',
  ghost: 'Ganas velocidad de movimiento y puedes atravesar unidades. CD 210s.',
  fantasma: 'Ganas velocidad de movimiento y puedes atravesar unidades. CD 210s.',
  clarity: 'Restaura maná a ti y aliados cercanos. Útil en ARAM. CD 240s.',
  claridad: 'Restaura maná a ti y aliados cercanos. Útil en ARAM. CD 240s.',
  mark: 'ARAM: lanza una bola de nieve que marca al enemigo; reactiva para saltar hacia él. CD 80s.',
  marca: 'ARAM: lanza una bola de nieve que marca al enemigo; reactiva para saltar hacia él. CD 80s.',
};

/** Descripción breve del hechizo de invocador (ES/EN), o vacío. */
export function summonerDescription(name: string): string {
  return SUMMONER_DESC[normalize(name)] ?? '';
}
