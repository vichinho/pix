'use strict';
// Sistema de internacionalización ligero para PIX.
//
// Patrón "texto como clave": el español es la clave y el fallback. Cuando el
// idioma es inglés, se sustituye por la entrada del diccionario EN; si falta,
// se muestra el español. Así el código y el HTML siguen legibles en español.
//
// Uso:
//   window.I18N.t('Historial de partidas')      -> traduce (o deja ES)
//   window.I18N.t('Llevas {n} derrotas', {n:3}) -> con parámetros
//   window.I18N.applyStatic(document)            -> traduce el HTML estático
//   window.I18N.setLang('en'); window.I18N.getLang();

(function () {
  const STORAGE_KEY = 'pix:lang';

  const EN = {
    // — Chrome / topbar —
    'Cliente': 'Client',
    'Desconectado': 'Disconnected',
    'Riot API off': 'Riot API off',
    'Idioma': 'Language',

    // — Estados del cliente (stateEs) —
    'desconectado': 'disconnected',
    'menú': 'menu',
    'lobby': 'lobby',
    'en cola': 'in queue',
    'aceptar': 'accept',
    'champ select': 'champ select',
    'en partida': 'in game',
    'post-partida': 'post-game',

    // — Roles —
    'Top': 'Top',
    'Jungla': 'Jungle',
    'Mid': 'Mid',
    'ADC': 'ADC',
    'Support': 'Support',
    'ARAM': 'ARAM',

    // — Tarjetas (títulos) —
    'Maestría de campeones': 'Champion mastery',
    'Tu última partida': 'Your last game',
    'Rendimiento reciente': 'Recent performance',
    'Historial de partidas': 'Match history',
    'Contexto': 'Context',

    // — Filtro de modos —
    'Todos los modos': 'All modes',
    'Clasificatoria': 'Ranked',
    'Normal': 'Normal',
    'Filtrar por modo': 'Filter by mode',
    'Página anterior': 'Previous page',
    'Página siguiente': 'Next page',

    // — Intro de contexto (HTML) —
    'context-intro': 'Open the LoL client and join a game. In <strong>champion select</strong> you\'ll see the recommended champions for your lane and the runes for your pick; once <strong>in game</strong>, your full build.',
    // — Pie legal —
    'footer-legal': 'Personal unofficial project · Not affiliated with or endorsed by Riot Games · League of Legends is a trademark of Riot Games, Inc.',
    // — Bienvenida —
    'Tu hada compañera en la Grieta': 'Your fairy companion on the Rift',

    // — Perfil —
    'última sesión': 'last session',
    'Solo/Duo': 'Solo/Duo',
    'Flex': 'Flex',
    '{w}V / {l}D · {n} partidas clasificatorias': '{w}W / {l}L · {n} ranked games',
    'Sin clasificar esta temporada': 'Unranked this season',
    'Mejor liga': 'Peak rank',

    // — Vinculación de cuenta —
    'Abre el cliente de LoL una vez, o vincula tu cuenta a mano:': 'Open the LoL client once, or link your account manually:',
    'Nombre#TAG (ej: Faker#KR1)': 'Name#TAG (e.g. Faker#KR1)',
    'Vincular': 'Link',
    'Cambiar cuenta': 'Switch account',
    'Formato: Nombre#TAG (ej: Faker#KR1)': 'Format: Name#TAG (e.g. Faker#KR1)',
    'Verificando…': 'Checking…',
    'No se pudo vincular: {e}': 'Could not link: {e}',
    'No se encontró esa cuenta. Revisa el servidor y el Nombre#TAG (el tag suele ser 3-5 letras/números, ej: #LAS o #1234). Si tu nombre tiene caracteres especiales, lo más fiable es <b>abrir el cliente de LoL</b>: la app detectará tu cuenta automáticamente.':
      'That account was not found. Check the server and the Name#TAG (the tag is usually 3-5 letters/numbers, e.g. #NA1 or #1234). If your name has special characters, the most reliable way is to <b>open the LoL client</b>: the app will detect your account automatically.',
    'Tu clave de Riot API no es válida o expiró. Las claves de desarrollo caducan cada 24 h: genera una nueva en <a href="https://developer.riotgames.com/" target="_blank" rel="noopener">developer.riotgames.com</a>, actualízala en Ajustes y reinicia si hace falta.':
      'Your Riot API key is invalid or expired. Development keys expire every 24h: generate a new one at <a href="https://developer.riotgames.com/" target="_blank" rel="noopener">developer.riotgames.com</a>, update it in Settings and restart if needed.',
    'La Riot API está limitando las peticiones (rate limit). Espera unos segundos e inténtalo de nuevo.':
      'The Riot API is rate-limiting requests. Wait a few seconds and try again.',

    // — Onboarding / clave de API —
    'Conecta tu Riot API': 'Connect your Riot API',
    'Entra en {a} e inicia sesión con tu cuenta de Riot.': 'Go to {a} and sign in with your Riot account.',
    'Copia la {b} (empieza por {c}).': 'Copy the {b} (starts with {c}).',
    'Pégala aquí abajo. Se guarda en tu equipo, nunca se comparte.': 'Paste it below. It\'s stored on your machine, never shared.',
    'Las claves de desarrollo caducan cada 24 h; cuando expire, repite estos pasos.': 'Development keys expire every 24h; when it expires, repeat these steps.',
    'Guardar': 'Save',
    'Pega tu clave (empieza por RGAPI-).': 'Paste your key (starts with RGAPI-).',
    'Verificando y guardando…': 'Checking and saving…',
    '¡Listo! Cargando tu perfil…': 'Done! Loading your profile…',
    'La clave no es válida o expiró. Genera una nueva en <a href="https://developer.riotgames.com/" target="_blank" rel="noopener">developer.riotgames.com</a> y vuelve a pegarla.':
      'The key is invalid or expired. Generate a new one at <a href="https://developer.riotgames.com/" target="_blank" rel="noopener">developer.riotgames.com</a> and paste it again.',
    'El formato de la clave no es válido.': 'The key format is not valid.',
    'No se pudo guardar: {e}': 'Could not save: {e}',

    // — Rendimiento (stats) —
    'WR · {w}V {l}D · {n} partidas': 'WR · {w}W {l}L · {n} games',
    'Campeón': 'Champion',
    'P': 'G',
    'WR': 'WR',
    'KDA': 'KDA',

    // — Última partida —
    'KDA perfecto': 'Perfect KDA',
    'KDA {v}': 'KDA {v}',
    '🏆 Victoria': '🏆 Victory',
    '💀 Derrota': '💀 Defeat',
    'Gran KDA, jugaste muy limpio. 👏': 'Great KDA, you played clean. 👏',
    'Moriste bastante — busca pelear con ventaja y respeta el rango enemigo.': 'You died a lot — look to fight with an advantage and respect enemy range.',
    'Farmeo: {v} cs/min{cmp}.': 'Farm: {v} cs/min{cmp}.',
    ' (por debajo de tu promedio)': ' (below your average)',
    ' (mejor que tu promedio)': ' (better than your average)',
    'Daño a campeones: {v}{cmp}.': 'Damage to champions: {v}{cmp}.',
    ' (bajo para tu campeón)': ' (low for your champion)',
    ' (excelente)': ' (excellent)',
    'Demasiadas muertes: cada muerte le da oro y tempo al rival. Prioriza sobrevivir sobre forzar jugadas.':
      'Too many deaths: each one gives the enemy gold and tempo. Prioritize surviving over forcing plays.',
    'Tu KDA bajó respecto a tu media: elige mejor las peleas y no entres en desventaja numérica.':
      'Your KDA dropped below your average: pick fights better and don\'t engage outnumbered.',
    'Tu farmeo bajó: no descuides los súbditos entre jugadas, el oro constante marca la diferencia.':
      'Your farm dropped: don\'t neglect minions between plays, steady gold makes the difference.',
    'Tu daño fue bajo: posiciónate para poder pegar en las peleas y aprovecha tus power-spikes de ítems.':
      'Your damage was low: position to deal damage in fights and use your item power spikes.',
    'Como soporte, sube tu visión: coloca y limpia guardianes alrededor de los objetivos.':
      'As support, raise your vision: place and clear wards around objectives.',
    'Buen trabajo — mantén esta consistencia y sigue revisando tus power-spikes.':
      'Good job — keep this consistency and keep tracking your power spikes.',
    'Cabeza fría: analiza una cosa a mejorar por partida y a por la siguiente.':
      'Cool head: pick one thing to improve per game and move on to the next.',

    // — Tilt —
    'Cuida tu racha': 'Mind your streak',
    'Llevas <b>{n} derrotas seguidas</b>. Este es un gran momento para parar: el tilt hace jugar peor y alarga las malas rachas. Descansa, hidrátate y vuelve con la mente fresca. 🧘':
      'You\'re on <b>{n} losses in a row</b>. This is a great moment to stop: tilt makes you play worse and drags out bad streaks. Rest, hydrate, and come back with a fresh mind. 🧘',
    'Llevas <b>{n} derrotas seguidas</b>. Ojo con el tilt — una pausa corta ahora suele evitar la 4.ª y 5.ª derrota. Respira antes de la próxima. 💧':
      'You\'re on <b>{n} losses in a row</b>. Watch out for tilt — a short break now often avoids the 4th and 5th loss. Breathe before the next one. 💧',
    'Entendido, ocultar': 'Got it, hide',

    // — Maestría —
    '{name} · Maestría {lvl} · {pts} pts': '{name} · Mastery {lvl} · {pts} pts',
    'Tus campeones (maestría)': 'Your champions (mastery)',

    // — Colas —
    'Clasif. Solo/Dúo': 'Ranked Solo/Duo',
    'Clasif. Flexible': 'Ranked Flex',
    'Normal Draft': 'Normal Draft',
    'Normal Rápida': 'Quickplay',
    'Swiftplay': 'Swiftplay',
    'Clash': 'Clash',
    'Co-op vs IA': 'Co-op vs AI',
    'URF': 'URF',
    'Arena': 'Arena',
    'Nexus Blitz': 'Nexus Blitz',
    'Libro de Hechizos': 'Spellbook',
    'ARAM Mayhem': 'ARAM Mayhem',
    'Mayhem': 'Mayhem',
    'Cola {id}': 'Queue {id}',

    // — Tiempo relativo —
    'hace {n}m': '{n}m ago',
    'hace {n}h': '{n}h ago',
    'hace {n}d': '{n}d ago',

    // — Historial —
    'No hay partidas recientes.': 'No recent games.',
    'Cargando partidas…': 'Loading games…',
    '{n} partidas': '{n} games',
    'Victoria': 'Victory',
    'Derrota': 'Defeat',
    'Oro': 'Gold',
    'Daño': 'Damage',
    'Visión': 'Vision',
    'Nivel': 'Level',
    'CS': 'CS',
    'Perfecto': 'Perfect',

    // — Consejos y combos —
    'Consejos y combos': 'Tips & combos',
    'Combo:': 'Combo:',

    // — Build —
    'Hechizos': 'Spells',
    'Habilidades': 'Abilities',
    'Runas': 'Runes',
    'Ítems iniciales': 'Starting items',
    'Core': 'Core',
    'Situacionales': 'Situational',
    'Orden de subida de habilidades': 'Skill order',
    'Pasiva · ': 'Passive · ',
    'curada': 'curated',
    'por campeón': 'per champion',
    'por clase': 'per class',
    'genérica': 'generic',
    'Parche {p}': 'Patch {p}',
    'Build {src} · {patch}': 'Build {src} · {patch}',
    'Sin build para este campeón.': 'No build for this champion.',
    'Sin build para este campeón todavía.': 'No build for this champion yet.',
    'Cargando build…': 'Loading build…',

    // — Botones aplicar —
    'Aplicar runas en el cliente': 'Apply runes in client',
    'Aplicar ítems al cliente': 'Apply items to client',
    '✓ Runas aplicadas en el cliente': '✓ Runes applied in client',
    '✓ Ítems aplicados al cliente': '✓ Items applied to client',
    'Aplicando…': 'Applying…',
    '✓ Aplicado': '✓ Applied',
    'Abre el cliente de LoL primero': 'Open the LoL client first',
    'No se pudo conectar': 'Could not connect',
    'Error {n}': 'Error {n}',

    // — Contexto: títulos —
    'Explorar builds': 'Explore builds',
    'En partida': 'In game',
    'ARAM — Composición': 'ARAM — Composition',

    // — Explorador —
    'Cargando campeones…': 'Loading champions…',
    'No estás en partida. Busca cualquier campeón para ver su build, runas y orden de subida:':
      'You\'re not in a game. Search any champion to see its build, runes and skill order:',
    'Buscar campeón…': 'Search champion…',
    '← volver a la lista': '← back to list',
    'Línea:': 'Lane:',

    // — Champ select —
    'Detectando champ select…': 'Detecting champ select…',
    'confirmado': 'locked in',
    'eligiendo': 'picking',
    'Tu campeón · runas y hechizos': 'Your champion · runes and spells',
    'Sin runas sugeridas todavía.': 'No suggested runes yet.',
    'Rol': 'Role',
    'Fase': 'Phase',
    'Bans': 'Bans',
    'Sugerencias para tu rol': 'Suggestions for your role',

    // — En partida —
    'Detectando tu campeón… (si acabas de abrir la app en partida, dame unos segundos)':
      'Detecting your champion… (if you just opened the app mid-game, give me a few seconds)',

    // — Coach —
    'Disponible': 'Available',
    'en {t}': 'in {t}',
    '💰 Tienes oro para un ítem grande — considera volver a la base.': '💰 You have gold for a big item — consider recalling.',
    '💰 Oro suficiente para un componente clave — planea tu recall.': '💰 Enough gold for a key component — plan your recall.',
    '🐉 Dragón disponible — coordina con tu equipo.': '🐉 Dragon available — coordinate with your team.',
    '🦑 Barón disponible — asegúralo con visión.': '🦑 Baron available — secure it with vision.',
    '👁️ Heraldo disponible — buen momento para presionar una calle.': '👁️ Herald available — good time to push a lane.',
    'Coach en vivo · {t}': 'Live coach · {t}',
    'Coach ARAM · {t}': 'ARAM coach · {t}',
    'Nivel {l} · {g} oro': 'Level {l} · {g} gold',
    'Dragón': 'Dragon',
    'Heraldo': 'Herald',
    'Barón': 'Baron',
    '💰 Tienes oro para un ítem completo — cómpralo al morir (no puedes volver a la base).':
      '💰 You have gold for a full item — buy it when you die (you can\'t recall).',
    '❤️ Recoge el orbe de salud del centro cuando pases por ahí: cura y da maná.':
      '❤️ Grab the health relic in the middle when you pass by: it heals and restores mana.',
    '🤝 Agrúpate con tu equipo: en ARAM las peleas son 5v5 constantes, evita ir solo.':
      '🤝 Group with your team: ARAM fights are constant 5v5, avoid going alone.',
    '🛡️ Compra resistencias si el enemigo tiene mucho daño — mueres muy rápido en el pasillo único.':
      '🛡️ Buy resistances if the enemy has lots of damage — you die fast in the single lane.',

    // — Recomendaciones —
    'Sin sugerencias para este rol.': 'No suggestions for this role.',
    'Rol: {r}': 'Role: {r}',
    'personalizado · {n}': 'personalized · {n}',
    'meta': 'meta',
    'cómodo': 'comfort',
    'cómodo + meta': 'comfort + meta',

    // — ARAM análisis —
    '✓ Equipo equilibrado': '✓ Balanced team',
    '⚠ Falta algo': '⚠ Missing something',
    'tú': 'you',
    'Equipo': 'Team',
    'Banca': 'Bench',
    'Mezcla': 'Mix',
    'Le falta': 'Missing',
    'Fortalezas': 'Strengths',
    'Mejor elección de tu banca': 'Best pick from your bench',
    'Opciones (tú + banca)': 'Options (you + bench)',
    'Tu build': 'Your build',
    'Detectando sesión de ARAM…': 'Detecting ARAM session…',

    // — Regiones (descriptor tras " · ") —
    'LAS · Latinoamérica Sur': 'LAS · Latin America South',
    'LAN · Latinoamérica Norte': 'LAN · Latin America North',
    'NA · Norteamérica': 'NA · North America',
    'BR · Brasil': 'BR · Brazil',
    'EUW · Europa Oeste': 'EUW · West Europe',
    'EUNE · Europa Nórdica y Este': 'EUNE · Nordic & East',
    'KR · Corea': 'KR · Korea',
    'JP · Japón': 'JP · Japan',
    'OCE · Oceanía': 'OCE · Oceania',
    'TR · Turquía': 'TR · Turkey',
    'RU · Rusia': 'RU · Russia',
  };

  // Claves "sintéticas" (no son texto ES): necesitan valor explícito también en
  // español, porque el español por defecto devuelve la propia clave.
  const ES = {
    'context-intro':
      'Abre el cliente de LoL y entra a una partida. En <strong>selección de campeón</strong> verás los campeones recomendados para tu línea y las runas de tu pick; ya <strong>en partida</strong>, tu build completa.',
    'footer-legal':
      'Proyecto personal no oficial · No afiliado ni patrocinado por Riot Games · League of Legends es marca registrada de Riot Games, Inc.',
  };

  const DICT = { en: EN, es: ES };

  let current =
    localStorage.getItem(STORAGE_KEY) ||
    ((navigator.language || 'es').slice(0, 2) === 'en' ? 'en' : 'es');

  function getLang() {
    return current;
  }
  function setLang(lang) {
    current = lang === 'en' ? 'en' : 'es';
    try { localStorage.setItem(STORAGE_KEY, current); } catch { /* ignore */ }
  }

  function t(key, params) {
    const table = DICT[current];
    let s = table && table[key] != null ? table[key] : key;
    if (params) {
      for (const k in params) s = s.split('{' + k + '}').join(String(params[k]));
    }
    return s;
  }

  /** Traduce el HTML estático marcado con data-i18n / -ph / -al / -html. */
  function applyStatic(root) {
    const r = root || document;
    r.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    r.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    r.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    r.querySelectorAll('[data-i18n-al]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-al')));
    });
  }

  /** Locale de Data Dragon según el idioma (para pedir datos en el idioma). */
  function ddragonLocale() {
    return current === 'en' ? 'en_US' : 'es_MX';
  }

  window.I18N = { t, getLang, setLang, applyStatic, ddragonLocale };
})();
