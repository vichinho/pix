'use strict';

// --- Utilidades ---------------------------------------------------------
const $ = (id) => document.getElementById(id);

/** Atajo de traducción (i18n.js). El español es la clave y el fallback. */
const T = (s, params) => window.I18N.t(s, params);

// En la app de escritorio (Electron) integramos la barra de título: marcamos el
// documento para activar las zonas arrastrables y el hueco de los botones.
if (navigator.userAgent.includes('Electron')) {
  document.documentElement.classList.add('electron');
}

async function api(path, options) {
  try {
    const res = await fetch(path, options);
    let data = null;
    try { data = await res.json(); } catch { /* sin JSON */ }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: String(err) } };
  }
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// --- Identidad Riot vinculada manualmente -------------------------------
// Si el cliente de LoL no está abierto, el usuario puede escribir su Riot ID
// (Nombre#TAG) para vincular la cuenta vía Riot API. Se guarda en localStorage
// y se envía en cada consulta de perfil/stats/partidas.
function getLinkedRiotId() {
  try {
    const raw = localStorage.getItem('riotId');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && v.gameName && v.tagLine ? v : null;
  } catch { return null; }
}
function setLinkedRiotId(gameName, tagLine) {
  localStorage.setItem('riotId', JSON.stringify({ gameName, tagLine }));
}
function clearLinkedRiotId() {
  localStorage.removeItem('riotId');
}
/** La región/plataforma se guarda aparte, para enrutar aunque no haya Riot ID manual. */
function getLinkedPlatform() {
  return localStorage.getItem('riotPlatform') || 'la2';
}
function setLinkedPlatform(platform) {
  if (platform) localStorage.setItem('riotPlatform', platform);
}
/**
 * Sufijo de query para consultas Riot. Siempre enviamos la plataforma (para
 * enrutar summoner-v4/league-v4 al servidor correcto). El Riot ID manual sólo se
 * envía si el cliente de LoL está cerrado: si está abierto, el backend detecta la
 * identidad EXACTA por LCU (evita fallos al reescribir nombres con caracteres
 * especiales).
 */
function riotIdQuery() {
  const parts = [`platform=${encodeURIComponent(getLinkedPlatform())}`];
  const id = getLinkedRiotId();
  if (!clientConnected && id) {
    parts.push(`gameName=${encodeURIComponent(id.gameName)}`);
    parts.push(`tagLine=${encodeURIComponent(id.tagLine)}`);
  }
  return `&${parts.join('&')}`;
}

/** Etiqueta corta del servidor a partir de la plataforma (la2 → "LAS"). */
function platformShort(platform) {
  const p = RIOT_PLATFORMS.find((x) => x.v === platform);
  return p ? p.label.split(' · ')[0] : (platform || '').toUpperCase();
}

/** Servidores de LoL: valor = plataforma Riot (para summoner-v4/league-v4). */
const RIOT_PLATFORMS = [
  { v: 'la2', label: 'LAS · Latinoamérica Sur' },
  { v: 'la1', label: 'LAN · Latinoamérica Norte' },
  { v: 'na1', label: 'NA · Norteamérica' },
  { v: 'br1', label: 'BR · Brasil' },
  { v: 'euw1', label: 'EUW · Europa Oeste' },
  { v: 'eun1', label: 'EUNE · Europa Nórdica y Este' },
  { v: 'kr', label: 'KR · Corea' },
  { v: 'jp1', label: 'JP · Japón' },
  { v: 'oc1', label: 'OCE · Oceanía' },
  { v: 'tr1', label: 'TR · Turquía' },
  { v: 'ru', label: 'RU · Rusia' },
];

const ROLE_ES = { TOP:'Top', JUNGLE:'Jungla', MIDDLE:'Mid', BOTTOM:'ADC', UTILITY:'Support', ARAM:'ARAM', UNKNOWN:'—' };

// --- Catálogo -----------------------------------------------------------
let catalogById = new Map();
let iconBase = '';
let itemIconBase = '';
let spellIconBase = '';
let profileIconBase = '';
let lastPickedChampionId = null;
let lastPickedRole = 'UNKNOWN';

async function loadCatalog() {
  const { ok, data } = await api('/api/champions');
  if (ok && data && Array.isArray(data.champions)) {
    iconBase = data.iconBase || '';
    itemIconBase = data.itemIconBase || '';
    spellIconBase = data.spellIconBase || '';
    profileIconBase = data.profileIconBase || '';
    catalogById = new Map(data.champions.map((c) => [Number(c.id), c]));
  }
}

/** ID de hechizo de invocador → archivo de icono de Data Dragon. */
const SUMMONER_SPELL_FILE = {
  1: 'SummonerBoost', 3: 'SummonerExhaust', 4: 'SummonerFlash', 6: 'SummonerHaste',
  7: 'SummonerHeal', 11: 'SummonerSmite', 12: 'SummonerTeleport', 13: 'SummonerMana',
  14: 'SummonerDot', 21: 'SummonerBarrier', 32: 'SummonerSnowball', 39: 'SummonerSnowball',
};
function summonerSpellIconUrl(id) {
  const f = SUMMONER_SPELL_FILE[Number(id)];
  return f && spellIconBase ? `${spellIconBase}${f}.png` : null;
}
function itemIconUrl(id) {
  return id && itemIconBase ? `${itemIconBase}${id}.png` : null;
}
function profileIconUrl(id) {
  return (id != null && profileIconBase) ? `${profileIconBase}${id}.png` : null;
}

function champChip(id, size = 22) {
  const e = catalogById.get(Number(id));
  if (e && iconBase) {
    return `<span class="chip"><img class="cicon" style="width:${size}px;height:${size}px" src="${iconBase}${esc(e.image)}" alt="${esc(e.name)}" loading="lazy"/> ${esc(e.name)}</span>`;
  }
  return `<span class="chip">${e ? esc(e.name) : '#' + esc(id)}</span>`;
}

/** URL del icono de campeón (sin texto), o null si no está en el catálogo. */
function champIconUrl(id) {
  const e = catalogById.get(Number(id));
  return (e && iconBase) ? `${iconBase}${e.image}` : null;
}

/** URL del splash art (banner ancho) del campeón, o null. */
function champSplashUrl(id) {
  const e = catalogById.get(Number(id));
  if (!e || !iconBase) return null;
  const ddragonId = e.image.replace(/\.png$/, '');
  // iconBase: .../cdn/{ver}/img/champion/ → splash: .../cdn/img/champion/splash/
  const base = iconBase.replace(/cdn\/[^/]+\/img\/champion\/$/, 'cdn/img/champion/splash/');
  return `${base}${ddragonId}_0.jpg`;
}

/** Nombre del campeón desde el catálogo. */
function champName(id) {
  const e = catalogById.get(Number(id));
  return e ? e.name : `#${id}`;
}

/** Texto del tooltip: nombre + descripción (si hay). */
function tipText(e, prefix) {
  const name = `${prefix || ''}${e.name || ''}`;
  return e.desc ? `${name} — ${e.desc}` : name;
}
function iconOrText(entry, cls) {
  const tip = esc(tipText(entry));
  if (entry.icon) return `<img class="${cls}" src="${esc(entry.icon)}" alt="${esc(entry.name)}" data-tip="${tip}" loading="lazy"/>`;
  return `<span class="tagfallback" data-tip="${tip}">${esc(entry.name)}</span>`;
}
/** Icono pequeño de un componente (con sus sub-componentes si los tiene). */
function buildPathNode(node) {
  const img = node.icon
    ? `<img src="${esc(node.icon)}" alt="${esc(node.name)}" data-tip="${esc(node.name)}" loading="lazy"/>`
    : `<span class="ic-name">${esc(node.name)}</span>`;
  const sub = (node.components && node.components.length)
    ? `<div class="bp-sub">${node.components.map((s) =>
        s.icon ? `<img src="${esc(s.icon)}" alt="${esc(s.name)}" data-tip="${esc(s.name)}" loading="lazy"/>` : '',
      ).join('')}</div>`
    : '';
  return `<div class="bp-comp"><div class="bp-comp-main">${img}<span class="bp-name">${esc(node.name)}</span></div>${sub}</div>`;
}

/** Celda de ítem: icono + popover con el ÁRBOL de construcción al pulsar. */
function itemCell(it) {
  const tip = esc(tipText(it));
  const inner = it.icon
    ? `<img class="iicon" src="${esc(it.icon)}" alt="${esc(it.name)}" data-tip="${tip}" loading="lazy"/>`
    : `<span class="tagfallback" data-tip="${tip}">${esc(it.name)}</span>`;
  let comps = '';
  if (it.components && it.components.length) {
    const finalImg = it.icon ? `<img src="${esc(it.icon)}" alt="${esc(it.name)}" loading="lazy"/>` : '';
    const tree = it.components.map(buildPathNode).join('<span class="bp-plus">+</span>');
    comps = `<div class="item-comps" hidden>
      <div class="bp-final">${finalImg}<span class="bp-final-name">${esc(it.name)}</span></div>
      <div class="bp-down">▾</div>
      <div class="bp-comps">${tree}</div>
    </div>`;
  }
  return `<span class="item-wrap ${comps ? 'has-comps' : ''}">${inner}${comps}</span>`;
}
const itemRow = (items) => (items || []).map(itemCell).join(' ');
const summRow = (sums)  => (sums  || []).map((s) => iconOrText(s, 'sicon')).join(' ');
function abilityRow(abils) {
  return (abils || []).map((a) => {
    const tip = esc(tipText(a, `${a.letter} · `));
    return `<span class="abil" data-tip="${tip}">${a.icon ? `<img class="sicon" src="${esc(a.icon)}" alt="${esc(a.name)}" loading="lazy"/>` : ''}<span class="ablabel">${esc(a.letter)}</span></span>`;
  }).join('<span class="arrow">›</span>');
}

function runeRow(r, extraClass) {
  const tip = esc(tipText(r));
  const img = r.icon ? `<img src="${esc(r.icon)}" alt="${esc(r.name)}" loading="lazy"/>` : '<span class="tagfallback">•</span>';
  return `<div class="rune ${extraClass || ''}" data-tip="${tip}">${img}<span class="rn">${esc(r.name)}</span></div>`;
}
function styleHead(style) {
  const img = style.icon ? `<img src="${esc(style.icon)}" alt="" loading="lazy"/>` : '';
  return `<div class="runestyle">${img}${esc(style.name)}</div>`;
}
function renderRunes(runes) {
  const shards = (runes.shards || []).map((s) =>
    s.icon ? `<img src="${esc(s.icon)}" alt="${esc(s.name)}" data-tip="${esc(s.name)}" loading="lazy"/>` : ''
  ).join('');
  return `<div class="runepage">
    <div class="runecol">
      ${styleHead(runes.primaryStyle)}
      ${runeRow(runes.keystone, 'key')}
      ${(runes.primary || []).map((r) => runeRow(r)).join('')}
    </div>
    <div class="runecol">
      ${styleHead(runes.secondaryStyle)}
      ${(runes.secondary || []).map((r) => runeRow(r)).join('')}
      <div class="shards">${shards}</div>
    </div>
  </div>`;
}

// --- Ranked helpers -----------------------------------------------------

/**
 * Fuentes de emblemas de rango. Data Dragon NO sirve estos emblemas por URL
 * (sólo en un zip descargable), por eso no cargaban. Usamos CommunityDragon y
 * op.gg como respaldo, con cascada de errores en el <img>.
 */
function rankEmblemSources(tier) {
  const t = (tier || '').toLowerCase();
  return [
    // op.gg: cresta compacta que llena bien el recuadro.
    `https://opgg-static.akamaized.net/images/medals_new/${t}.png`,
    `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${t}.png`,
    `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-regalia/${t}.png`,
  ];
}

/** Construye el <img> del emblema con cascada de fuentes de respaldo. */
function rankEmblemImg(tier, cls = '') {
  if (!tier) return `<div class="rank-emblem-placeholder"></div>`;
  const srcs = rankEmblemSources(tier);
  const rest = srcs.slice(1).join('|');
  return `<img class="${cls}" src="${esc(srcs[0])}" alt="${esc(tier)}" loading="lazy"
    data-fallbacks="${esc(rest)}" onerror="emblemFallback(this)" />`;
}

/** Al fallar una fuente de emblema, prueba la siguiente; si no hay, la oculta. */
function emblemFallback(img) {
  const list = (img.dataset.fallbacks || '').split('|').filter(Boolean);
  if (list.length) {
    img.src = list.shift();
    img.dataset.fallbacks = list.join('|');
  } else {
    img.style.display = 'none';
  }
}

function renderProfile(p) {
  const cached = clientConnected ? '' : ` <span class="pill ghost" style="font-size:0.65rem">${T('última sesión')}</span>`;
  const rank = p.soloQueue || p.flexQueue || null;
  const emblemImg = rank ? rankEmblemImg(rank.tier) : `<div class="rank-emblem-placeholder"></div>`;

  let rankBlock;
  if (rank) {
    const wr = rank.wins + rank.losses > 0 ? Math.round((rank.wins / (rank.wins + rank.losses)) * 100) : 0;
    const wrGood = wr >= 50;
    const wrWidth = Math.max(5, Math.min(95, wr));
    const queueLabel = p.soloQueue ? T('Solo/Duo') : T('Flex');
    rankBlock = `
      <div class="rank-row">
        <span class="rank-tier">${esc(rank.tier)}</span>
        <span class="rank-division">${esc(rank.division || '')}</span>
        <span class="rank-lp">${esc(rank.leaguePoints)} LP</span>
        <span class="rank-queue-label">${esc(queueLabel)}</span>
      </div>
      <div class="rank-wr-row">
        <div class="wr-bar-track"><div class="wr-bar-fill ${wrGood ? '' : 'low'}" style="width:${wrWidth}%"></div></div>
        <span class="wr-text ${wrGood ? 'good' : 'bad'}">${wr}% WR</span>
      </div>
      <div class="ranked-record">${T('{w}V / {l}D · {n} partidas clasificatorias', { w: rank.wins, l: rank.losses, n: rank.wins + rank.losses })}</div>`;
  } else {
    rankBlock = `<div class="rank-unranked">${T('Sin clasificar esta temporada')}</div>`;
  }

  let peakBlock = '';
  if (p.peakRank && p.peakRank.tier) {
    const pk = p.peakRank;
    const peakImg = rankEmblemImg(pk.tier, 'peak-emblem');
    peakBlock = `
      <div class="divider"></div>
      <div class="peak-row">
        <span class="peak-label">${T('Mejor liga')}</span>
        ${peakImg}
        <span class="peak-tier">${esc(pk.tier)}</span>
        <span class="peak-division">${esc(pk.division || '')}</span>
        ${pk.year ? `<span class="peak-year">${esc(pk.year)}</span>` : ''}
      </div>`;
  }

  const iconUrl = profileIconUrl(p.profileIconId);
  const avatar = iconUrl
    ? `<img class="summoner-icon" src="${esc(iconUrl)}" alt="" loading="lazy" onerror="this.style.display='none'"/>`
    : `<div class="summoner-icon summoner-icon-empty">${esc((p.gameName || '?').charAt(0))}</div>`;

  return `
    <div class="profile-banner">
      <div class="profile-identity">
        <div class="summoner-avatar">
          ${avatar}
          <span class="level-badge">${esc(p.summonerLevel ?? '—')}</span>
        </div>
        <div class="profile-info">
          <div class="profile-name">${esc(p.gameName)}<span class="profile-tag">#${esc(p.tagLine)}</span>${cached}</div>
          <div class="profile-meta">
            <span class="profile-region">${esc(platformShort(getLinkedPlatform()) || p.region.toUpperCase())}</span>
          </div>
        </div>
      </div>
      <div class="rank-panel">
        <div class="rank-emblem-wrap">${emblemImg}</div>
        <div class="rank-detail">${rankBlock}</div>
      </div>
    </div>
    <div class="profile-footer">
      ${peakBlock}
    </div>`;
}

// --- Estado de cliente y Riot ------------------------------------------
let riotConfigured = false;
let clientConnected = false;

async function refreshStatus() {
  const { data } = await api('/api/client/status');
  const badge = $('clientBadge');
  clientConnected = !!(data && data.connected);
  if (clientConnected) {
    badge.textContent = stateEs(data.clientState);
    badge.className = 'pill on';
  } else {
    badge.textContent = T('Desconectado');
    badge.className = 'pill off';
  }
  const dot = $('settingsDot');
  if (dot) dot.classList.toggle('on', clientConnected);
  return data;
}

function stateEs(s) {
  const es = ({ DISCONNECTED:'desconectado', NONE:'menú', LOBBY:'lobby', MATCHMAKING:'en cola',
    READY_CHECK:'aceptar', CHAMP_SELECT:'champ select', IN_GAME:'en partida', POST_GAME:'post-partida' }[s] || s || '—');
  return T(es);
}

// --- Vinculación manual de cuenta ---------------------------------------
/** Formulario para escribir el Riot ID (Nombre#TAG) cuando no hay cuenta vinculada. */
function renderLinkForm() {
  const id = getLinkedRiotId();
  const prefill = id ? `${id.gameName}#${id.tagLine}` : '';
  const sel = getLinkedPlatform();
  const options = RIOT_PLATFORMS.map(
    (p) => `<option value="${p.v}"${p.v === sel ? ' selected' : ''}>${esc(T(p.label))}</option>`,
  ).join('');
  return `
    <div class="link-form" style="padding:1.3rem">
      <div class="muted" style="margin-bottom:.6rem">${T('Abre el cliente de LoL una vez, o vincula tu cuenta a mano:')}</div>
      <select id="riotPlatform" class="link-select">${options}</select>
      <div class="link-row">
        <input id="riotIdInput" type="text" placeholder="${esc(T('Nombre#TAG (ej: Faker#KR1)'))}" value="${esc(prefill)}"
          autocomplete="off" spellcheck="false" />
        <button id="riotIdBtn" type="button">${T('Vincular')}</button>
      </div>
      <div id="riotIdMsg" class="link-msg"></div>
    </div>`;
}

/** Enlace pequeño para revincular/cambiar la cuenta ya conectada. */
function renderRelinkLink() {
  return `<div class="relink"><button id="relinkBtn" type="button" class="linklike">${T('Cambiar cuenta')}</button></div>`;
}

/** Conecta los eventos del formulario/enlace de vinculación tras renderizar. */
function wireLinkForm() {
  const btn = $('riotIdBtn');
  if (btn) {
    const submit = () => submitRiotId();
    btn.addEventListener('click', submit);
    const input = $('riotIdInput');
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }
  const platformSel = $('riotPlatform');
  if (platformSel) {
    // Guardamos la región al elegirla: así se enruta bien incluso con detección
    // automática por LCU (sin Riot ID manual).
    platformSel.addEventListener('change', () => setLinkedPlatform(platformSel.value));
  }
  const relink = $('relinkBtn');
  if (relink) {
    relink.addEventListener('click', () => {
      clearLinkedRiotId();
      $('profileBody').innerHTML = renderLinkForm();
      wireLinkForm();
    });
  }
}

/** Valida y guarda el Riot ID escrito, luego recarga los paneles. */
async function submitRiotId() {
  const input = $('riotIdInput');
  const msg = $('riotIdMsg');
  const raw = (input?.value || '').trim();
  const hash = raw.lastIndexOf('#');
  if (hash <= 0 || hash === raw.length - 1) {
    if (msg) { msg.textContent = T('Formato: Nombre#TAG (ej: Faker#KR1)'); msg.className = 'link-msg err'; }
    return;
  }
  const gameName = raw.slice(0, hash).trim();
  const tagLine = raw.slice(hash + 1).trim();
  const platform = $('riotPlatform')?.value || 'la2';
  setLinkedPlatform(platform);
  if (msg) { msg.textContent = T('Verificando…'); msg.className = 'link-msg'; }

  // Comprobamos contra la Riot API antes de guardar, para dar feedback claro.
  const check = await api(`/api/player/profile?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}&platform=${encodeURIComponent(platform)}`);
  if (check.ok && check.data) {
    // Guardamos la forma CANÓNICA que devuelve Riot (con los caracteres exactos),
    // no lo que se escribió, para que futuras cargas no fallen por tipeo.
    setLinkedRiotId(check.data.gameName || gameName, check.data.tagLine || tagLine);
    refreshRiotPanels();
  } else if (msg) {
    msg.innerHTML = riotErrorEs(check);
    msg.className = 'link-msg err';
  }
}

/** Traduce los errores de la Riot API a mensajes claros para el usuario. */
function riotErrorEs(resp) {
  const code = resp.data?.error;
  if (resp.status === 404 || code === 'not_found')
    return T('No se encontró esa cuenta. Revisa el servidor y el Nombre#TAG (el tag suele ser 3-5 letras/números, ej: #LAS o #1234). Si tu nombre tiene caracteres especiales, lo más fiable es <b>abrir el cliente de LoL</b>: la app detectará tu cuenta automáticamente.');
  if (code === 'riot_api_key_invalid' || code === 'riot_api_key_forbidden_or_expired')
    return T('Tu clave de Riot API no es válida o expiró. Las claves de desarrollo caducan cada 24 h: genera una nueva en <a href="https://developer.riotgames.com/" target="_blank" rel="noopener">developer.riotgames.com</a>, actualízala en Ajustes y reinicia si hace falta.');
  if (code === 'riot_rate_limited')
    return T('La Riot API está limitando las peticiones (rate limit). Espera unos segundos e inténtalo de nuevo.');
  return T('No se pudo vincular: {e}', { e: esc(code || T('Error {n}', { n: resp.status })) });
}

// --- Onboarding / Ajustes: clave de la Riot API -------------------------
/**
 * Formulario de primer uso: cuando el backend no tiene clave de Riot API
 * configurada (503), guiamos al usuario para conseguirla y pegarla. La clave
 * se guarda en el servidor (PUT /api/settings) — nunca se muestra de vuelta.
 */
function renderApiKeyForm() {
  const link = '<a href="https://developer.riotgames.com/" target="_blank" rel="noopener">developer.riotgames.com</a>';
  return `
    <div class="apikey-form" style="padding:1.3rem">
      <div class="apikey-title">${T('Conecta tu Riot API')}</div>
      <ol class="apikey-steps">
        <li>${T('Entra en {a} e inicia sesión con tu cuenta de Riot.', { a: link })}</li>
        <li>${T('Copia la {b} (empieza por {c}).', { b: '<b>Development API Key</b>', c: '<code>RGAPI-</code>' })}</li>
        <li>${T('Pégala aquí abajo. Se guarda en tu equipo, nunca se comparte.')}</li>
      </ol>
      <div class="apikey-note muted">${T('Las claves de desarrollo caducan cada 24 h; cuando expire, repite estos pasos.')}</div>
      <div class="link-row">
        <input id="apiKeyInput" type="password" placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          autocomplete="off" spellcheck="false" />
        <button id="apiKeyBtn" type="button">${T('Guardar')}</button>
      </div>
      <div id="apiKeyMsg" class="link-msg"></div>
    </div>`;
}

/** Conecta los eventos del formulario de clave de API tras renderizar. */
function wireApiKeyForm() {
  const btn = $('apiKeyBtn');
  if (!btn) return;
  const submit = () => submitApiKey();
  btn.addEventListener('click', submit);
  const input = $('apiKeyInput');
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

/** Valida y guarda la clave de la Riot API en el servidor, luego recarga. */
async function submitApiKey() {
  const input = $('apiKeyInput');
  const msg = $('apiKeyMsg');
  const key = (input?.value || '').trim();
  if (!key) {
    if (msg) { msg.textContent = T('Pega tu clave (empieza por RGAPI-).'); msg.className = 'link-msg err'; }
    return;
  }
  const btn = $('apiKeyBtn');
  if (btn) btn.disabled = true;
  if (msg) { msg.textContent = T('Verificando y guardando…'); msg.className = 'link-msg'; }

  const res = await api('/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ riotApiKey: key }),
  });
  if (btn) btn.disabled = false;

  if (res.ok && res.data?.riotConfigured) {
    if (msg) { msg.textContent = T('¡Listo! Cargando tu perfil…'); msg.className = 'link-msg ok'; }
    refreshRiotPanels();
    return;
  }
  const code = res.data?.error;
  if (msg) {
    if (code === 'riot_api_key_invalid')
      msg.innerHTML = T('La clave no es válida o expiró. Genera una nueva en <a href="https://developer.riotgames.com/" target="_blank" rel="noopener">developer.riotgames.com</a> y vuelve a pegarla.');
    else if (code === 'invalid_body')
      msg.textContent = T('El formato de la clave no es válido.');
    else
      msg.textContent = T('No se pudo guardar: {e}', { e: esc(code || T('Error {n}', { n: res.status })) });
    msg.className = 'link-msg err';
  }
}

// --- Perfil / stats / partidas -----------------------------------------
async function refreshRiotPanels() {
  const prof = await api(`/api/player/profile?_=1${riotIdQuery()}`);
  if (prof.status === 503) {
    riotConfigured = false;
    $('riotBadge').textContent = 'Riot API off';
    $('riotBadge').className = 'pill off';
    $('profileBody').innerHTML = renderApiKeyForm();
    wireApiKeyForm();
    return;
  }
  riotConfigured = true;
  $('riotBadge').textContent = 'Riot API';
  $('riotBadge').className = 'pill on';

  if (prof.ok && prof.data) {
    // Recordamos el Riot ID exacto detectado (por LCU o manual) para que siga
    // funcionando aunque luego se cierre el cliente.
    if (prof.data.gameName && prof.data.tagLine) setLinkedRiotId(prof.data.gameName, prof.data.tagLine);
    $('profileBody').innerHTML = renderProfile(prof.data) + renderRelinkLink();
    wireLinkForm();
    // Cargamos el historial (progresivo) y calculamos las estadísticas del mismo
    // set de partidas (antes se pedían aparte, duplicando decenas de peticiones).
    await refreshMatches();
    refreshMastery();
  } else if (prof.status === 400 && prof.data?.error === 'identity_unavailable') {
    $('profileBody').innerHTML = renderLinkForm();
    wireLinkForm();
    $('statsBody').innerHTML = '<span class="muted">—</span>';
    matchState.all = [];
    renderMatchPage();
  } else {
    // Error real (clave inválida/expirada, rate limit, cuenta no encontrada…):
    // mostramos el formulario con un mensaje claro para poder reintentar.
    const isKeyError = prof.data?.error === 'riot_api_key_invalid' || prof.data?.error === 'riot_api_key_forbidden_or_expired';
    if (isKeyError) { $('riotBadge').textContent = 'Riot API ⚠'; $('riotBadge').className = 'pill off'; }
    $('profileBody').innerHTML = renderLinkForm();
    wireLinkForm();
    const msg = $('riotIdMsg');
    if (msg) { msg.innerHTML = riotErrorEs(prof); msg.className = 'link-msg err'; }
    $('statsBody').innerHTML = '<span class="muted">—</span>';
    matchState.all = [];
    renderMatchPage();
  }
}

/**
 * Calcula el rendimiento (WR global y por campeón) a partir del historial ya
 * cargado en matchState.all — sin peticiones adicionales a la Riot API.
 */
function renderStatsFromMatches() {
  const el = $('statsBody');
  const matches = matchState.all;
  if (!matches.length) { el.innerHTML = '<span class="muted">—</span>'; return; }

  const total = matches.length;
  const wins = matches.filter((m) => m.win).length;
  const losses = total - wins;
  const wr = Math.round((wins / total) * 100);

  const by = new Map();
  for (const m of matches) {
    let e = by.get(m.championId);
    if (!e) { e = { championId: m.championId, games: 0, wins: 0, k: 0, d: 0, a: 0 }; by.set(m.championId, e); }
    e.games += 1; if (m.win) e.wins += 1;
    e.k += m.kills; e.d += m.deaths; e.a += m.assists;
  }
  const top = [...by.values()].sort((x, y) => y.games - x.games).slice(0, 6);

  const rows = top.map((c) => {
    const cwr = c.wins / c.games;
    const kda = (c.d === 0 ? c.k + c.a : (c.k + c.a) / c.d).toFixed(2);
    return `<tr>
      <td>${champChip(c.championId, 18)}</td>
      <td>${c.games}</td>
      <td class="${cwr >= 0.5 ? 'win' : 'loss'}">${Math.round(cwr * 100)}%</td>
      <td>${kda}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="summary"><span class="big ${wr >= 50 ? 'win' : 'loss'}">${wr}%</span><span>${T('WR · {w}V {l}D · {n} partidas', { w: wins, l: losses, n: total })}</span></div>
    <table><thead><tr><th>${T('Campeón')}</th><th>${T('P')}</th><th>${T('WR')}</th><th>${T('KDA')}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// --- Resumen de la última partida ---------------------------------------
const kdaOf = (x) => (x.deaths === 0 ? x.kills + x.assists : (x.kills + x.assists) / x.deaths);
const csmOf = (x) => (x.durationSec ? x.cs / (x.durationSec / 60) : 0);
const isAramQueue = (q) => q === 450 || q === 2400 || q === 2300;

/**
 * Genera un resumen en lenguaje natural de la última partida, comparándola con
 * el promedio de las anteriores, y un consejo sobre el punto más flojo.
 */
function renderLastGameSummary() {
  const card = $('lastGameCard');
  const body = $('lastGameBody');
  const all = matchState.all;
  if (!all || !all.length) { if (card) card.hidden = true; return; }
  const m = all[0];
  const prior = all.slice(1, 20);
  const avg = (fn) => (prior.length ? prior.reduce((s, x) => s + fn(x), 0) / prior.length : fn(m));
  const aram = isAramQueue(m.queueId);

  const kda = kdaOf(m);
  const kdaTxt = m.deaths === 0 ? T('KDA perfecto') : T('KDA {v}', { v: kda.toFixed(2) });
  const resultTxt = m.win ? T('🏆 Victoria') : T('💀 Derrota');
  const champ = m.championName || champName(m.championId);
  const dur = fmtDuration(m.durationSec || 0);

  // Frase principal.
  const head = `${resultTxt} con <b>${esc(champ)}</b> · ${m.kills}/${m.deaths}/${m.assists} (${kdaTxt}) · ${dur}`;

  // Métricas y comparación con el promedio.
  const lines = [];
  if (kda >= 3.5) lines.push(T('Gran KDA, jugaste muy limpio. 👏'));
  else if (m.deaths >= 8 || (kda < 1.5 && m.deaths >= 5)) lines.push(T('Moriste bastante — busca pelear con ventaja y respeta el rango enemigo.'));

  if (!aram) {
    const csm = csmOf(m);
    const csmAvg = avg(csmOf);
    if (csm > 0) {
      const cmp = csm < csmAvg - 0.8 ? T(' (por debajo de tu promedio)') : csm > csmAvg + 0.8 ? T(' (mejor que tu promedio)') : '';
      lines.push(T('Farmeo: {v} cs/min{cmp}.', { v: csm.toFixed(1), cmp }));
    }
  }
  if (m.damage) {
    const dmgAvg = avg((x) => x.damage || 0);
    const cmp = m.damage < dmgAvg * 0.75 ? T(' (bajo para tu campeón)') : m.damage > dmgAvg * 1.2 ? T(' (excelente)') : '';
    lines.push(T('Daño a campeones: {v}{cmp}.', { v: Math.round(m.damage).toLocaleString(window.I18N.getLang()), cmp }));
  }

  // Consejo: el punto más flojo respecto al promedio.
  const tip = lastGameTip(m, avg, aram);

  card.hidden = false;
  body.innerHTML = `
    <div class="lg-head">${head}</div>
    ${lines.length ? `<ul class="lg-lines">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    ${tip ? `<div class="lg-tip">💡 ${esc(tip)}</div>` : ''}`;
}

/** Elige un consejo según el punto más flojo de la partida vs el promedio. */
function lastGameTip(m, avg, aram) {
  const kda = kdaOf(m);
  const kdaAvg = avg(kdaOf);
  if (m.deaths >= 8) return T('Demasiadas muertes: cada muerte le da oro y tempo al rival. Prioriza sobrevivir sobre forzar jugadas.');
  if (kda < kdaAvg * 0.7) return T('Tu KDA bajó respecto a tu media: elige mejor las peleas y no entres en desventaja numérica.');
  if (!aram) {
    const csm = csmOf(m);
    if (csm > 0 && csm < avg(csmOf) - 1) return T('Tu farmeo bajó: no descuides los súbditos entre jugadas, el oro constante marca la diferencia.');
  }
  if (m.damage && m.damage < avg((x) => x.damage || 0) * 0.7) {
    return T('Tu daño fue bajo: posiciónate para poder pegar en las peleas y aprovecha tus power-spikes de ítems.');
  }
  if ((m.visionScore || 0) > 0 && m.role === 'UTILITY' && m.visionScore < avg((x) => x.visionScore || 0) * 0.7) {
    return T('Como soporte, sube tu visión: coloca y limpia guardianes alrededor de los objetivos.');
  }
  return m.win ? T('Buen trabajo — mantén esta consistencia y sigue revisando tus power-spikes.') : T('Cabeza fría: analiza una cosa a mejorar por partida y a por la siguiente.');
}

// --- Detector de tilt (racha de derrotas) -------------------------------
let tiltDismissed = null; // matchId de la partida más reciente ya descartada

function renderTiltAlert() {
  const card = $('tiltCard');
  const body = $('tiltBody');
  if (!card || !body) return;
  const all = matchState.all;
  if (!all || all.length < 3) { card.hidden = true; return; }
  let streak = 0;
  for (const m of all) { if (!m.win) streak += 1; else break; }
  const latestId = all[0].matchId;
  if (streak < 3 || tiltDismissed === latestId) { card.hidden = true; return; }

  const msg = streak >= 5
    ? T('Llevas <b>{n} derrotas seguidas</b>. Este es un gran momento para parar: el tilt hace jugar peor y alarga las malas rachas. Descansa, hidrátate y vuelve con la mente fresca. 🧘', { n: streak })
    : T('Llevas <b>{n} derrotas seguidas</b>. Ojo con el tilt — una pausa corta ahora suele evitar la 4.ª y 5.ª derrota. Respira antes de la próxima. 💧', { n: streak });
  body.innerHTML = `<div class="tilt-head">⚠️ ${T('Cuida tu racha')}</div><div class="tilt-msg">${msg}</div><button class="linklike tilt-dismiss" id="tiltDismiss">${T('Entendido, ocultar')}</button>`;
  card.hidden = false;
  $('tiltDismiss').addEventListener('click', () => { tiltDismissed = latestId; card.hidden = true; });
}

// --- Maestría de campeones ----------------------------------------------
let masteryList = [];

/** Puntos de maestría abreviados (12345 → "12.3k"). */
function fmtPoints(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k`;
  return `${n}`;
}

/** Ficha de maestría (icono + nivel + puntos). */
function masteryTile(m, clickable) {
  const url = champIconUrl(m.championId);
  const img = url ? `<img src="${esc(url)}" alt="${esc(champName(m.championId))}" loading="lazy"/>` : '';
  const tip = T('{name} · Maestría {lvl} · {pts} pts', { name: champName(m.championId), lvl: m.level, pts: m.points.toLocaleString(window.I18N.getLang()) });
  const attrs = clickable ? `data-cid="${esc(m.championId)}"` : '';
  const cls = clickable ? 'mastery-tile clickable' : 'mastery-tile';
  return `<div class="${cls}" ${attrs} data-tip="${esc(tip)}">${img}<span class="m-lvl">M${esc(m.level)}</span><span class="m-pts">${esc(fmtPoints(m.points))}</span></div>`;
}

async function refreshMastery() {
  const card = $('masteryCard');
  const body = $('masteryBody');
  const { ok, data } = await api(`/api/player/mastery?count=12${riotIdQuery()}`);
  if (!ok || !Array.isArray(data?.mastery) || !data.mastery.length) {
    masteryList = [];
    if (card) card.hidden = true;
    return;
  }
  masteryList = data.mastery;
  if (card) card.hidden = false;
  if (body) body.innerHTML = `<div class="mastery-row">${data.mastery.slice(0, 8).map((m) => masteryTile(m, false)).join('')}</div>`;
  // Si el explorador ya está visible y aún no tiene el acceso rápido, lo añade
  // una sola vez (sin re-render en refrescos posteriores para no molestar).
  if (contextMode === 'idle' && !document.querySelector('.quick-access')) renderIdleContext();
}

// ── Historial de partidas con paginación ────────────────────────────────

const MATCHES_PER_PAGE = 10;

/** Estado de paginación del historial. */
const matchState = {
  all: [],        // array completo de partidas
  page: 0,        // página actual (0-based)
  expanded: null, // matchId expandido (o null)
  filter: '',     // filtro de modo ('' todos, '450' ARAM, 'ranked', 'normal')
};

/** Nombre corto de cola por queueId. */
const QUEUE_NAMES = {
  420: 'Clasif. Solo/Dúo', 440: 'Clasif. Flexible', 400: 'Normal Draft', 430: 'Normal',
  450: 'ARAM', 490: 'Normal Rápida', 480: 'Swiftplay', 700: 'Clash', 830: 'Co-op vs IA',
  840: 'Co-op vs IA', 850: 'Co-op vs IA', 900: 'URF', 1700: 'Arena', 1710: 'Arena', 1900: 'URF',
  1300: 'Nexus Blitz', 1400: 'Libro de Hechizos', 2400: 'ARAM Mayhem', 2300: 'Mayhem',
};
const queueName = (id) => (QUEUE_NAMES[id] ? T(QUEUE_NAMES[id]) : T('Cola {id}', { id }));

/**
 * Formatea la duración en segundos como "mm:ss".
 */
function fmtDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Formatea la fecha relativa (hace X días/horas).
 */
function fmtRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)   return T('hace {n}m', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return T('hace {n}h', { n: hrs });
  const days = Math.floor(hrs / 24);
  return T('hace {n}d', { n: days });
}

/**
 * Calcula el ratio KDA como string, marcando en verde si ≥ 3.0.
 */
function kdaStr(k, d, a) {
  if (d === 0) return `<span class="kda-good">${k}/${d}/${a}</span>`;
  const ratio = ((k + a) / d).toFixed(2);
  const cls = parseFloat(ratio) >= 3.0 ? 'kda-good' : '';
  return `<span class="${cls}">${k}/${d}/${a}</span>`;
}

/**
 * Renderiza la página actual del historial en #matchesBody.
 */
function renderMatchPage() {
  const body  = $('matchesBody');
  const pag   = $('matchPagination');
  const label = $('matchPageLabel');
  const info  = $('matchPageInfo');
  const prev  = $('matchPrevBtn');
  const next  = $('matchNextBtn');

  const all   = matchState.all;
  const total = all.length;

  if (total === 0) {
    body.innerHTML = `<span class="muted">${T('No hay partidas recientes.')}</span>`;
    pag.hidden = true;
    info.textContent = '';
    return;
  }

  const totalPages = Math.ceil(total / MATCHES_PER_PAGE);
  const page       = Math.max(0, Math.min(matchState.page, totalPages - 1));
  matchState.page  = page;

  const start = page * MATCHES_PER_PAGE;
  const slice = all.slice(start, start + MATCHES_PER_PAGE);

  body.innerHTML = slice.map((m) => {
    const iconUrl = champIconUrl(m.championId);
    const iconEl  = iconUrl
      ? `<img class="match-champ-icon" src="${esc(iconUrl)}" alt="${esc(champName(m.championId))}" loading="lazy"/>`
      : `<div class="match-champ-icon" style="display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:var(--faint)">${esc(m.championId)}</div>`;

    const role    = T(ROLE_ES[m.role] || m.role);
    const kda     = kdaStr(m.kills, m.deaths, m.assists);
    const dur     = fmtDuration(m.durationSec || 0);
    const rel     = m.playedAt ? fmtRelative(m.playedAt) : '';
    const winCls  = m.win ? 'win' : 'loss';
    const rowCls  = m.win ? 'win-row' : 'loss-row';
    const result  = m.win ? T('Victoria') : T('Derrota');
    const isOpen  = matchState.expanded === m.matchId;

    return `<div class="match-item ${isOpen ? 'open' : ''}">
      <button class="match-row ${rowCls}" data-mid="${esc(m.matchId)}" aria-expanded="${isOpen}">
        ${iconEl}
        <div class="match-center">
          <div class="match-name">${esc(m.championName || champName(m.championId))} <span class="match-queue">${esc(queueName(m.queueId))}</span></div>
          <div class="match-meta">
            <span class="match-kda">${kda}</span>
            <span class="match-role">${esc(role)}</span>
            <span class="match-time">${esc(rel || dur)}</span>
          </div>
        </div>
        <span class="match-result ${winCls}">${result}</span>
        <span class="match-caret">${isOpen ? '▾' : '▸'}</span>
      </button>
      ${isOpen ? renderMatchDetail(m) : ''}
    </div>`;
  }).join('');

  // Paginación
  info.textContent = T('{n} partidas', { n: total });
  label.textContent = `${page + 1} / ${totalPages}`;
  prev.disabled = page === 0;
  next.disabled = page >= totalPages - 1;
  pag.hidden = totalPages <= 1;
}

/** Detalle expandido de una partida: ítems, hechizos y estadísticas. */
function renderMatchDetail(m) {
  const items = (m.items || []).map((id) => {
    const url = itemIconUrl(id);
    return id && url
      ? `<img class="detail-item" src="${esc(url)}" alt="" loading="lazy" onerror="this.classList.add('empty')"/>`
      : `<span class="detail-item empty"></span>`;
  }).join('');
  const spells = (m.summonerSpells || []).map((id) => {
    const url = summonerSpellIconUrl(id);
    return url ? `<img class="detail-spell" src="${esc(url)}" alt="" loading="lazy"/>` : '';
  }).join('');
  const perMin = m.durationSec ? (m.cs / (m.durationSec / 60)).toFixed(1) : '0';
  const kdaRatio = m.deaths === 0 ? T('Perfecto') : ((m.kills + m.assists) / m.deaths).toFixed(2);
  const stat = (label, value) => `<div class="detail-stat"><span class="ds-val">${esc(value)}</span><span class="ds-label">${esc(label)}</span></div>`;

  return `<div class="match-detail">
    <div class="detail-loadout">
      <div class="detail-spells">${spells}</div>
      <div class="detail-items">${items}</div>
    </div>
    <div class="detail-stats">
      ${stat(T('KDA'), kdaRatio)}
      ${stat(T('CS'), `${m.cs} (${perMin}/m)`)}
      ${stat(T('Oro'), (m.gold / 1000).toFixed(1) + 'k')}
      ${stat(T('Daño'), (m.damage / 1000).toFixed(1) + 'k')}
      ${stat(T('Visión'), m.visionScore)}
      ${stat(T('Nivel'), m.championLevel)}
    </div>
    <div class="detail-foot">${esc(fmtDuration(m.durationSec || 0))} · ${esc(queueName(m.queueId))} · ${esc(m.playedAt ? fmtRelative(m.playedAt) : '')}</div>
  </div>`;
}

/** Manejo de click en una fila para expandir/colapsar (delegación). */
function initMatchClicks() {
  $('matchesBody').addEventListener('click', (e) => {
    const row = e.target.closest('.match-row[data-mid]');
    if (!row) return;
    const mid = row.getAttribute('data-mid');
    matchState.expanded = matchState.expanded === mid ? null : mid;
    renderMatchPage();
  });
}

/**
 * Carga TODAS las partidas recientes (hasta 50) en memoria y muestra la página 1.
 * Se llama una sola vez al cargar el perfil; después solo se repagina en cliente.
 */
/** Sufijo de query del filtro de modo del historial (queueId o type). */
function matchFilterQuery() {
  const v = matchState.filter;
  if (!v) return '';
  if (v === 'ranked' || v === 'normal') return `&type=${v}`;
  return `&queue=${encodeURIComponent(v)}`; // queueId numérico (450 = ARAM)
}

async function refreshMatches() {
  const body = $('matchesBody');
  body.innerHTML = `<span class="muted">${T('Cargando partidas…')}</span>`;
  $('matchPagination').hidden = true;
  const fq = matchFilterQuery();

  // Tanda rápida: primeras 12 partidas para pintar el historial cuanto antes.
  const first = await api(`/api/player/matches?count=12${riotIdQuery()}${fq}`);
  if (!first.ok) {
    body.innerHTML = `<span class="err">${esc(first.data?.error || first.status)}</span>`;
    return;
  }
  matchState.all  = first.data.matches || [];
  matchState.page = 0;
  renderMatchPage();
  renderStatsFromMatches();
  renderLastGameSummary();
  renderTiltAlert();
  refreshProgress();

  // Tanda completa en segundo plano (el backend cachea, así que sólo trae las
  // partidas nuevas). Al terminar, refresca historial y estadísticas.
  const full = await api(`/api/player/matches?count=50${riotIdQuery()}${fq}`);
  if (full.ok && Array.isArray(full.data?.matches) && full.data.matches.length > matchState.all.length) {
    matchState.all = full.data.matches;
    renderMatchPage();
    renderStatsFromMatches();
    renderLastGameSummary();
    renderTiltAlert();
  }
}

// Listeners de paginación
$('matchPrevBtn').addEventListener('click', () => {
  if (matchState.page > 0) { matchState.page -= 1; matchState.expanded = null; renderMatchPage(); }
});
$('matchNextBtn').addEventListener('click', () => {
  const totalPages = Math.ceil(matchState.all.length / MATCHES_PER_PAGE);
  if (matchState.page < totalPages - 1) { matchState.page += 1; matchState.expanded = null; renderMatchPage(); }
});

// Filtro de modo del historial: al cambiar, recarga con el filtro elegido.
$('matchQueueFilter').addEventListener('change', (e) => {
  matchState.filter = e.target.value;
  matchState.expanded = null;
  refreshMatches();
});
initMatchClicks();

// --- Consejos y combos por campeón --------------------------------------
// Los datos viven en champion-tips.js (window.CHAMPION_TIPS), cargado antes.

/** Consejos del campeón por su id de Data Dragon, o null. */
function champTipsFor(id) {
  const e = catalogById.get(Number(id));
  if (!e) return null;
  const dd = e.image.replace(/\.png$/, '').toLowerCase();
  return (window.CHAMPION_TIPS || {})[dd] || null;
}

/** Bloque de consejos y combos del campeón (si hay curados). */
function renderTips(championId) {
  const tips = champTipsFor(championId);
  if (!tips || !tips.length) return '';
  const items = tips.map((t) => {
    const m = t.match(/^combo:\s*(.*)$/i);
    return m ? `<li class="combo"><b>${T('Combo:')}</b> ${esc(m[1])}</li>` : `<li>${esc(t)}</li>`;
  }).join('');
  return `<div class="block"><div class="label">${T('Consejos y combos')}</div><ul class="tips-list">${items}</ul></div>`;
}

// --- Build --------------------------------------------------------------
function renderBuild(b) {
  return `
    ${buildBanner(b)}
    <div class="kv">
      <span class="k">${T('Hechizos')}</span><span class="iconrow">${summRow(b.summoners)}</span>
      <span class="k">${T('Habilidades')}</span><span class="iconrow">${passiveChip(b.passive)}${b.passive ? '<span class="arrow">·</span>' : ''}${abilityRow(b.abilities)}</span>
    </div>
    ${renderSkillMatrix(b)}
    <div class="block"><div class="label">${T('Runas')}</div>${renderRunes(b.runes)}${applyRunesBtn(b)}</div>
    <div class="block"><div class="label">${T('Ítems iniciales')}</div><div class="iconrow">${itemRow(b.items.starting)}</div></div>
    <div class="block"><div class="label">${T('Core')}</div><div class="iconrow">${itemRow(b.items.core)}</div></div>
    <div class="block"><div class="label">${T('Situacionales')}</div><div class="iconrow">${itemRow(b.items.situational)}</div>${applyItemsBtn(b)}</div>
    ${b.notes ? `<div class="note">💡 ${esc(b.notes)}</div>` : ''}
    ${renderTips(b.championId)}
    <div class="source-note">${buildMeta(b)}</div>`;
}

/** Etiqueta de fuente + parche de la build. */
function buildMeta(b) {
  const esSrc = { curated: 'curada', classified: 'por campeón', archetype: 'por clase', default: 'genérica' }[b.source] || b.source;
  const src = T(esSrc);
  const patch = /^\d+\.\d+/.test(b.patch || '') ? T('Parche {p}', { p: b.patch }) : esc(b.patch);
  return T('Build {src} · {patch}', { src: esc(src), patch });
}

/** Chip de la pasiva con tooltip. */
function passiveChip(p) {
  if (!p) return '';
  const tip = esc(tipText(p, T('Pasiva · ')));
  return `<span class="abil" data-tip="${tip}">${p.icon ? `<img class="sicon" src="${esc(p.icon)}" alt="${esc(p.name)}" loading="lazy"/>` : ''}<span class="ablabel">P</span></span>`;
}

/**
 * Genera la secuencia de subida de nivel 1..18 a partir de la prioridad de
 * maximización (p. ej. [Q,W,E]): R a 6/11/16, un punto en cada básica al inicio
 * y luego se maximiza por prioridad. Devuelve un arreglo de 18 letras.
 */
function computeSkillMatrix(priority) {
  const P = priority && priority.length >= 3 ? priority.slice(0, 3) : ['Q', 'W', 'E'];
  const counts = { Q: 0, W: 0, E: 0, R: 0 };
  const early = { 1: P[0], 2: P[1], 3: P[2] };
  const levels = [];
  for (let lvl = 1; lvl <= 18; lvl++) {
    if (lvl === 6 || lvl === 11 || lvl === 16) { levels.push('R'); counts.R++; continue; }
    if (early[lvl]) { levels.push(early[lvl]); counts[early[lvl]]++; continue; }
    const pick = P.find((a) => counts[a] < 5) || P[P.length - 1];
    levels.push(pick); counts[pick]++;
  }
  return levels;
}

/** Matriz de subida de habilidades (filas Q/W/E/R × niveles 1..18). */
function renderSkillMatrix(b) {
  const matrix = computeSkillMatrix(b.skillOrder);
  const spells = b.spells || {};
  const head = `<div class="sm-row sm-head"><div class="sm-key"></div>${
    Array.from({ length: 18 }, (_, i) => `<div class="sm-cell sm-lvl">${i + 1}</div>`).join('')
  }</div>`;
  const body = ['Q', 'W', 'E', 'R'].map((letter) => {
    const sp = spells[letter];
    const tip = esc(sp ? tipText(sp, `${letter} · `) : letter);
    const icon = sp && sp.icon
      ? `<img src="${esc(sp.icon)}" alt="${esc(letter)}"/>`
      : '';
    const cells = matrix.map((lv, i) =>
      `<div class="sm-cell ${lv === letter ? 'on k-' + letter : ''}">${lv === letter ? i + 1 : ''}</div>`,
    ).join('');
    return `<div class="sm-row"><div class="sm-key" data-tip="${tip}">${icon}<span class="sm-letter">${letter}</span></div>${cells}</div>`;
  }).join('');
  return `<div class="block"><div class="label">${T('Orden de subida de habilidades')}</div>
    <div class="skill-matrix-wrap"><div class="skill-matrix">${head}${body}</div></div></div>`;
}

// --- Coach de progreso --------------------------------------------------
// Todo se calcula del historial ya cargado (matchState.all); no hay peticiones
// extra ni red. Las metas se guardan en localStorage.

/** Metas por defecto; la de visión sube si sueles ir de support. */
function defaultGoals() {
  const supportish = matchState.all.filter((m) => m.role === 'UTILITY').length >= matchState.all.length * 0.4;
  return { kda: 3, deaths: 5, csmin: 6, vision: supportish ? 25 : 15 };
}
function getGoals() {
  try {
    const raw = JSON.parse(localStorage.getItem('pix:goals') || '{}');
    return { ...defaultGoals(), ...raw };
  } catch { return defaultGoals(); }
}
function setGoal(key, value) {
  const g = getGoals();
  g[key] = value;
  try { localStorage.setItem('pix:goals', JSON.stringify(g)); } catch { /* best-effort */ }
}

const avgOf = (arr, fn) => (arr.length ? arr.reduce((s, x) => s + fn(x), 0) / arr.length : 0);

/** Mini-gráfico de tendencia (SVG) de una serie de valores (antiguo→reciente). */
function sparkline(values, good) {
  if (!values || values.length < 2) return '';
  const w = 56, h = 18, pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const cls = good ? 'spark-good' : 'spark-bad';
  const last = values[values.length - 1], first = values[0];
  const trendCls = last >= first ? 'up' : 'down';
  return `<svg class="spark ${cls} ${trendCls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

/**
 * Calcula las métricas de progreso: promedio reciente vs anterior, tendencia y
 * cumplimiento de metas. Devuelve null si no hay datos suficientes.
 */
function computeProgress() {
  const all = matchState.all;
  if (!all || all.length < 3) return null;
  const goals = getGoals();
  const recent = all.slice(0, 10);
  const older = all.slice(10, 20);
  const noAram = (arr) => arr.filter((m) => !isAramQueue(m.queueId));

  const metric = (fn, arrRecent, arrOlder, target, higherBetter) => {
    const cur = avgOf(arrRecent, fn);
    const prev = arrOlder.length ? avgOf(arrOlder, fn) : cur;
    const series = arrRecent.slice(0, 12).map(fn).reverse();
    const met = higherBetter ? cur >= target : cur <= target;
    // progreso 0..1 respecto a la meta (para la barra)
    const prog = higherBetter
      ? Math.max(0, Math.min(1, cur / target))
      : Math.max(0, Math.min(1, target / Math.max(0.1, cur)));
    return { cur, prev, series, target, met, prog, higherBetter };
  };

  const csR = noAram(recent), csO = noAram(older);
  return {
    count: all.length,
    kda: metric(kdaOf, recent, older, goals.kda, true),
    deaths: metric((m) => m.deaths, recent, older, goals.deaths, false),
    csmin: metric(csmOf, csR, csO, goals.csmin, true),
    vision: metric((m) => m.visionScore || 0, recent, older, goals.vision, true),
  };
}

const GOAL_META = {
  kda:    { key: 'kda',    label: 'KDA',        step: '0.5', fmt: (v) => v.toFixed(2) },
  deaths: { key: 'deaths', label: 'Muertes',    step: '1',   fmt: (v) => v.toFixed(1) },
  csmin:  { key: 'csmin',  label: 'CS/min',     step: '0.5', fmt: (v) => v.toFixed(1) },
  vision: { key: 'vision', label: 'Visión',     step: '1',   fmt: (v) => Math.round(v) },
};

/** Elige el "foco" de mejora: la meta más lejos de cumplirse. */
function focusInsight(p) {
  const cards = ['kda', 'deaths', 'csmin', 'vision'].map((k) => ({ k, ...p[k] }));
  const pending = cards.filter((c) => !c.met);
  const pick = (pending.length ? pending : cards).sort((a, b) => a.prog - b.prog)[0];
  const tips = {
    kda: 'Elige mejor tus peleas: entra cuando tengas ventaja numérica o de objetos.',
    deaths: 'Baja tus muertes: respeta el rango enemigo y no fuerces jugadas sin visión.',
    csmin: 'Sube tu farmeo: no descuides súbditos entre jugadas, el oro constante suma.',
    vision: 'Sube tu visión: coloca y limpia guardianes alrededor de los objetivos.',
  };
  return { key: pick.k, tip: tips[pick.k] };
}

/** Racha actual (V/D consecutivas desde la más reciente). */
function currentStreak() {
  const all = matchState.all;
  if (!all.length) return { n: 0, win: false };
  const win = all[0].win;
  let n = 0;
  for (const m of all) { if (m.win === win) n++; else break; }
  return { n, win };
}

/** Mejor y peor campeón por winrate (con un mínimo de partidas). */
function championRecords(minGames = 3) {
  const by = new Map();
  for (const m of matchState.all) {
    let e = by.get(m.championId);
    if (!e) { e = { championId: m.championId, name: m.championName || champName(m.championId), games: 0, wins: 0 }; by.set(m.championId, e); }
    e.games += 1; if (m.win) e.wins += 1;
  }
  const list = [...by.values()].filter((e) => e.games >= minGames).map((e) => ({ ...e, wr: e.wins / e.games }));
  if (!list.length) return { best: null, worst: null };
  const byWr = [...list].sort((a, b) => b.wr - a.wr || b.games - a.games);
  const best = byWr[0];
  const wc = byWr[byWr.length - 1];
  const worst = wc && wc.wr <= 0.45 && wc.championId !== best.championId ? wc : null;
  return { best, worst };
}

/** Franjas horarias (hora local del jugador). */
const TIME_SLOTS = [
  { key: 'Madrugada', from: 0, to: 6 },
  { key: 'Mañana', from: 6, to: 12 },
  { key: 'Tarde', from: 12, to: 18 },
  { key: 'Noche', from: 18, to: 24 },
];
/** Franja horaria con mejor winrate (mínimo de partidas). */
function bestTimeSlot(minGames = 3) {
  const buckets = {};
  for (const m of matchState.all) {
    if (!m.playedAt) continue;
    const h = new Date(m.playedAt).getHours();
    const slot = TIME_SLOTS.find((s) => h >= s.from && h < s.to);
    if (!slot) continue;
    const b = buckets[slot.key] || (buckets[slot.key] = { games: 0, wins: 0 });
    b.games += 1; if (m.win) b.wins += 1;
  }
  let best = null;
  for (const [key, b] of Object.entries(buckets)) {
    if (b.games < minGames) continue;
    const wr = b.wins / b.games;
    if (!best || wr > best.wr) best = { key, wr, games: b.games };
  }
  return best;
}

/** Marcador de hoy (V–D), o null si no jugaste hoy. */
function todayRecord() {
  const now = new Date();
  let w = 0, l = 0;
  for (const m of matchState.all) {
    if (!m.playedAt) continue;
    const d = new Date(m.playedAt);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
      if (m.win) w += 1; else l += 1;
    }
  }
  return (w + l) ? { w, l } : null;
}

/** Chip de insight: icono + etiqueta + valor (con opcional icono de campeón y WR). */
function insightChip(ico, label, valueHtml, wr, tone) {
  const wrBadge = wr != null ? `<b class="pi-wr ${tone || ''}">${wr}%</b>` : '';
  return `<div class="pg-insight">
    <span class="pi-ico">${ico}</span>
    <div class="pi-body">
      <span class="pi-label">${esc(label)}</span>
      <span class="pi-val">${valueHtml} ${wrBadge}</span>
    </div>
  </div>`;
}

/** Icono pequeño de campeón para los insights. */
function champIconMini(id) {
  const url = champIconUrl(id);
  return url ? `<img class="pi-champ" src="${esc(url)}" alt="" loading="lazy"/>` : '';
}

/** Panel del coach de progreso; se inyecta arriba del explorador cuando estás inactivo. */
function renderProgressInto(el) {
  if (!el) return;
  const p = computeProgress();
  if (!p) {
    el.innerHTML = riotConfigured
      ? `<div class="pg-empty muted">${T('Juega algunas partidas para ver tu progreso aquí.')}</div>`
      : '';
    return;
  }

  // Forma reciente (últimas 10, izquierda = más reciente).
  const form = matchState.all.slice(0, 10)
    .map((m) => `<span class="form-pip ${m.win ? 'w' : 'l'}" data-tip="${esc((m.championName || champName(m.championId)) + ' · ' + (m.win ? T('Victoria') : T('Derrota')))}"></span>`)
    .join('');
  const st = currentStreak();
  const streakTxt = st.n >= 2
    ? T('{n} {res} seguidas', { n: st.n, res: st.win ? T('victorias') : T('derrotas') })
    : '';

  // Tarjetas de metas.
  const goalCard = (k) => {
    const m = p[k], meta = GOAL_META[k];
    const arrow = m.cur === m.prev ? '' : (m.cur > m.prev
      ? `<span class="pg-delta ${meta.key === 'deaths' ? 'bad' : 'good'}">▲</span>`
      : `<span class="pg-delta ${meta.key === 'deaths' ? 'good' : 'bad'}">▼</span>`);
    return `<div class="pg-goal ${m.met ? 'met' : ''}">
      <div class="pg-goal-head">
        <span class="pg-goal-label">${T(meta.label)}</span>
        ${m.met ? '<span class="pg-badge">✓</span>' : ''}
      </div>
      <div class="pg-goal-val">${meta.fmt(m.cur)} ${arrow} ${sparkline(m.series, meta.key !== 'deaths')}</div>
      <div class="pg-bar"><div class="pg-bar-fill ${m.met ? 'ok' : ''}" style="width:${Math.round(m.prog * 100)}%"></div></div>
      <label class="pg-goal-target">${T('Meta')} <input type="number" class="pg-target" data-goal="${meta.key}" value="${m.target}" step="${meta.step}" min="0" inputmode="decimal"/></label>
    </div>`;
  };

  const focus = focusInsight(p);

  // Insights: mejor campeón, "ojo con", mejor horario, marcador de hoy.
  const rec = championRecords();
  const slot = bestTimeSlot();
  const today = todayRecord();
  const chips = [];
  if (rec.best) chips.push(insightChip('🏅', T('Mejor campeón'), champIconMini(rec.best.championId) + esc(rec.best.name), Math.round(rec.best.wr * 100), 'good'));
  if (rec.worst) chips.push(insightChip('⚠️', T('Ojo con'), champIconMini(rec.worst.championId) + esc(rec.worst.name), Math.round(rec.worst.wr * 100), 'bad'));
  if (slot) chips.push(insightChip('⏰', T('Mejor horario'), T(slot.key), Math.round(slot.wr * 100), 'good'));
  if (today) chips.push(insightChip('📅', T('Hoy'), `${today.w}–${today.l}`, null, ''));
  const insightsHtml = chips.length ? `<div class="pg-insights">${chips.join('')}</div>` : '';

  el.innerHTML = `
    <div class="pg-head">
      <span class="pg-title">${T('Tu progreso')}</span>
      <span class="pg-sub muted">${T('últimas {n} partidas', { n: Math.min(10, p.count) })}</span>
    </div>
    <div class="pg-form">
      <div class="form-pips">${form}</div>
      ${streakTxt ? `<span class="pg-streak ${st.win ? 'w' : 'l'}">${streakTxt}</span>` : ''}
    </div>
    <div class="pg-goals">
      ${['kda', 'deaths', 'csmin', 'vision'].map(goalCard).join('')}
    </div>
    ${insightsHtml}
    <div class="pg-focus">
      <span class="pg-focus-ico">🎯</span>
      <div><span class="pg-focus-label">${T('Foco de la semana')}: ${T(GOAL_META[focus.key].label)}</span>
      <span class="pg-focus-tip">${T(focus.tip)}</span></div>
    </div>`;

  el.querySelectorAll('.pg-target').forEach((inp) => {
    inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      if (Number.isFinite(v) && v >= 0) { setGoal(inp.dataset.goal, v); refreshProgress(); }
    });
    inp.addEventListener('click', (e) => e.stopPropagation());
  });
}

/** Refresca el panel de progreso si está visible (tras cargar partidas o cambiar metas). */
function refreshProgress() {
  const el = document.getElementById('progressPanel');
  if (el) renderProgressInto(el);
}

// --- Contexto -----------------------------------------------------------
async function refreshContext(clientState) {
  // La Live Client API (puerto 2999) es independiente del LCU: funciona incluso
  // cuando el LCU se satura o devuelve UNKNOWN. La consultamos primero para que
  // el coach en partida aparezca siempre que haya una partida en curso, sin
  // depender de que clientState sea 'IN_GAME'.
  const live = await api('/api/live/champion');
  const liveActive = live.ok && live.data?.active && live.data.championId;

  const queue = await api('/api/game/queue');
  const qBadge = $('queueBadge');
  if (queue.ok && queue.data?.active && queue.data.queue) {
    qBadge.textContent = queue.data.queue.label;
    qBadge.className = 'pill live';
  } else {
    qBadge.textContent = '—';
    qBadge.className = 'pill ghost';
  }
  const isAram = queue.ok && queue.data?.queue?.category === 'ARAM';

  // En partida (detectado por Live Client API o por el estado del LCU).
  // En ARAM la banca sólo existe en la fase previa (champ-select); una vez
  // dentro de la partida mostramos el coach en vivo con el campeón real.
  if (liveActive || clientState === 'IN_GAME') { contextMode = 'ingame'; return refreshInGame(live); }
  if (isAram)                       { contextMode = 'aram'; return refreshAram(); }
  if (clientState === 'CHAMP_SELECT') { contextMode = 'champselect'; return refreshChampSelect(); }
  // Inactivo: mostramos el explorador de builds. Se renderiza UNA vez (sticky)
  // para no borrar la búsqueda o la build abierta en cada tick de 4s.
  if (contextMode !== 'idle') { contextMode = 'idle'; renderIdleContext(); }
}

/** Modo actual del panel de contexto, para no re-renderizar el explorador. */
let contextMode = null;

/** Panel inactivo: explorador de builds de cualquier campeón. */
function renderIdleContext() {
  $('contextTitle').textContent = T('Explorar builds');
  const champs = [...catalogById.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (!champs.length) {
    $('contextBody').innerHTML = `<span class="muted">${T('Cargando campeones…')}</span>`;
    contextMode = null; // reintenta en el próximo tick cuando cargue el catálogo
    return;
  }
  const tiles = champs.map((c) => {
    const url = iconBase ? `${iconBase}${esc(c.image)}` : '';
    const img = url ? `<img src="${url}" alt="${esc(c.name)}" loading="lazy"/>` : '';
    return `<button class="champ-tile" data-cid="${esc(c.id)}" data-tip="${esc(c.name)}" data-name="${esc(c.name.toLowerCase())}">${img}<span>${esc(c.name)}</span></button>`;
  }).join('');
  // Acceso rápido: tus campeones con más maestría (si hay datos de Riot).
  const quick = masteryList.length
    ? `<div class="quick-access">
        <div class="qa-label">${T('Tus campeones (maestría)')}</div>
        <div class="qa-row">${masteryList.slice(0, 8).map((m) => masteryTile(m, true)).join('')}</div>
      </div>`
    : '';
  $('contextBody').innerHTML = `
    <div id="progressPanel" class="progress-panel"></div>
    <div class="idle-section-head">${T('Explorar builds')}</div>
    <div class="muted" style="margin-bottom:.6rem">${T('No estás en partida. Busca cualquier campeón para ver su build, runas y orden de subida:')}</div>
    ${quick}
    <input id="champSearch" class="champ-search" type="text" placeholder="${esc(T('Buscar campeón…'))}" autocomplete="off" spellcheck="false"/>
    <div id="champGrid" class="champ-grid">${tiles}</div>
    <div id="champBuildView" class="champ-build-view"></div>`;

  renderProgressInto($('progressPanel'));

  const search = $('champSearch');
  const grid = $('champGrid');
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const t of grid.querySelectorAll('.champ-tile')) {
      t.style.display = t.dataset.name.includes(q) ? '' : 'none';
    }
  });
  grid.addEventListener('click', (e) => {
    const tile = e.target.closest('.champ-tile');
    if (tile) showIdleBuild(Number(tile.dataset.cid));
  });
  const qaRow = $('contextBody').querySelector('.qa-row');
  if (qaRow) qaRow.addEventListener('click', (e) => {
    const tile = e.target.closest('.mastery-tile.clickable');
    if (tile) showIdleBuild(Number(tile.dataset.cid));
  });
}

/** Líneas seleccionables en el explorador (valor = rol de la API). */
const EXPLORER_LANES = [
  { v: 'TOP', label: 'Top' },
  { v: 'JUNGLE', label: 'Jungla' },
  { v: 'MIDDLE', label: 'Mid' },
  { v: 'BOTTOM', label: 'ADC' },
  { v: 'UTILITY', label: 'Support' },
  { v: 'ARAM', label: 'ARAM' },
];

/** Muestra la build del campeón elegido en el explorador, con selector de línea. */
async function showIdleBuild(championId, role = 'MIDDLE') {
  const grid = $('champGrid');
  const search = $('champSearch');
  const view = $('champBuildView');
  if (!view) return;
  if (grid) grid.style.display = 'none';
  if (search) search.style.display = 'none';

  const lanes = EXPLORER_LANES.map(
    (l) => `<button class="lane-pill ${l.v === role ? 'on' : ''}" data-role="${l.v}">${esc(T(l.label))}</button>`,
  ).join('');
  const header = `
    <button class="linklike" id="champBack">${T('← volver a la lista')}</button>
    <div class="lane-picker"><span class="lane-label">${T('Línea:')}</span>${lanes}</div>`;

  view.innerHTML = `${header}<div id="laneBuild"><span class="muted">${T('Cargando build…')}</span></div>`;
  const b = await api(`/api/builds?championId=${championId}&role=${encodeURIComponent(role)}`);
  $('laneBuild').innerHTML = b.ok ? renderBuild(b.data) : `<span class="muted">${T('Sin build para este campeón.')}</span>`;

  $('champBack').addEventListener('click', () => {
    view.innerHTML = '';
    if (grid) grid.style.display = '';
    if (search) { search.style.display = ''; search.focus(); }
  });
  view.querySelector('.lane-picker').addEventListener('click', (e) => {
    const pill = e.target.closest('.lane-pill');
    if (pill && pill.dataset.role !== role) showIdleBuild(championId, pill.dataset.role);
  });
}

function renderRunesSummoners(b) {
  return `<div class="kv">
    <span class="k">${T('Hechizos')}</span><span class="iconrow">${summRow(b.summoners)}</span>
    <span class="k">${T('Habilidades')}</span><span class="iconrow">${passiveChip(b.passive)}${b.passive ? '<span class="arrow">·</span>' : ''}${abilityRow(b.abilities)}</span>
  </div>
  ${renderSkillMatrix(b)}
  <div class="block"><div class="label">${T('Runas')}</div>${renderRunes(b.runes)}${applyRunesBtn(b)}</div>
  <div class="source-note">${buildMeta(b)}</div>`;
}

/** Banner con el splash art del campeón y su nombre. */
function buildBanner(b) {
  const url = champSplashUrl(b.championId);
  const bg = url ? `style="background-image:url('${esc(url)}')"` : '';
  const name = esc(b.championName || champName(b.championId));
  return `<div class="build-banner ${url ? '' : 'no-splash'}" ${bg}><span class="bb-name">${name}</span></div>`;
}

/** Botón para aplicar la página de runas en el cliente de LoL (LCU). */
function applyRunesBtn(b) {
  return `<button class="apply-btn" data-endpoint="/api/runes/apply" data-ok="${esc(T('✓ Runas aplicadas en el cliente'))}" data-cid="${esc(b.championId)}" data-role="${esc(b.role || 'UNKNOWN')}"><span class="ar-ico">⟳</span> ${T('Aplicar runas en el cliente')}</button>`;
}

/** Botón para crear el set de ítems en el cliente. */
function applyItemsBtn(b) {
  return `<button class="apply-btn secondary" data-endpoint="/api/items/apply" data-ok="${esc(T('✓ Ítems aplicados al cliente'))}" data-cid="${esc(b.championId)}" data-role="${esc(b.role || 'UNKNOWN')}"><span class="ar-ico">⟳</span> ${T('Aplicar ítems al cliente')}</button>`;
}

/** Envía la build (runas o ítems) al cliente y da feedback en el propio botón. */
async function applyBuildAction(btn) {
  const championId = Number(btn.dataset.cid);
  const role = btn.dataset.role || 'UNKNOWN';
  const original = btn.innerHTML;
  const base = btn.className.replace(/\s*(loading|ok|err)\b/g, '');
  btn.disabled = true;
  btn.className = `${base} loading`;
  btn.innerHTML = `<span class="ar-ico">⟳</span> ${T('Aplicando…')}`;
  let res, data = null;
  try {
    res = await fetch(btn.dataset.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ championId, role }),
    });
    try { data = await res.json(); } catch { /* sin JSON */ }
  } catch { res = { ok: false, status: 0 }; }

  if (res.ok) {
    btn.className = `${base} ok`;
    btn.innerHTML = btn.dataset.ok || T('✓ Aplicado');
  } else {
    btn.className = `${base} err`;
    const msg = res.status === 503 ? T('Abre el cliente de LoL primero')
      : res.status === 0 ? T('No se pudo conectar')
      : (data?.error || T('Error {n}', { n: res.status }));
    btn.innerHTML = `✗ ${esc(msg)}`;
  }
  setTimeout(() => { btn.disabled = false; btn.className = base; btn.innerHTML = original; }, 2800);
}

// Delegación global: cualquier botón .apply-btn aplica su acción al pulsarlo.
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('.apply-btn');
  if (btn && !btn.disabled) applyBuildAction(btn);
});

// Ruta de construcción: al pulsar un ítem, muestra/oculta sus componentes.
document.addEventListener('click', (e) => {
  const wrap = e.target.closest && e.target.closest('.item-wrap.has-comps');
  // Cierra los popovers de otros ítems.
  document.querySelectorAll('.item-comps:not([hidden])').forEach((el) => {
    if (!wrap || !wrap.contains(el)) el.hidden = true;
  });
  if (wrap) {
    const c = wrap.querySelector('.item-comps');
    if (c) c.hidden = !c.hidden;
  }
});

// --- Tooltip personalizado (reemplaza el nativo del navegador) -----------
const tooltipEl = document.createElement('div');
tooltipEl.className = 'tooltip';
tooltipEl.hidden = true;
document.body.appendChild(tooltipEl);
let tipTarget = null;

function showTip(el) {
  const raw = el.dataset.tip || '';
  if (!raw) { hideTip(); return; }
  const idx = raw.indexOf(' — ');
  tooltipEl.innerHTML = idx >= 0
    ? `<span class="tt-name">${esc(raw.slice(0, idx))}</span><span class="tt-desc">${esc(raw.slice(idx + 3))}</span>`
    : `<span class="tt-name">${esc(raw)}</span>`;
  tooltipEl.hidden = false;
}
function hideTip() { tooltipEl.hidden = true; tipTarget = null; }
function positionTip(x, y) {
  const pad = 14;
  const r = tooltipEl.getBoundingClientRect();
  let left = x + pad;
  let top = y + pad;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - pad;
  if (top + r.height > window.innerHeight - 8) top = y - r.height - pad;
  tooltipEl.style.left = `${Math.max(8, left)}px`;
  tooltipEl.style.top = `${Math.max(8, top)}px`;
}
document.addEventListener('mouseover', (e) => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (t) {
    if (t !== tipTarget) { tipTarget = t; showTip(t); }
    positionTip(e.clientX, e.clientY);
  } else if (tipTarget) {
    hideTip();
  }
});
document.addEventListener('mousemove', (e) => { if (tipTarget) positionTip(e.clientX, e.clientY); });
window.addEventListener('scroll', hideTip, true);

async function refreshChampSelect() {
  $('contextTitle').textContent = 'Champion Select';
  const { data } = await api('/api/champ-select/session');
  if (!data || !data.active || !data.session) {
    $('contextBody').innerHTML = `<span class="muted">${T('Detectando champ select…')}</span>`;
    return;
  }
  const s = data.session;
  if (s.selectedChampionId) { lastPickedChampionId = s.selectedChampionId; lastPickedRole = s.assignedRole; }
  const rec = await api(`/api/recommendations?role=${s.assignedRole}&limit=5${riotConfigured ? '&personalized=true' + riotIdQuery() : ''}`);
  let recHtml = '<span class="muted">—</span>';
  if (rec.ok) { const tmp = document.createElement('div'); renderRecommendations(tmp, rec.data); recHtml = tmp.innerHTML; }
  let pickHtml = '';
  if (s.selectedChampionId) {
    const head = `${champChip(s.selectedChampionId, 30)} <span class="pill ghost">${s.pickCompleted ? T('confirmado') : T('eligiendo')}</span>`;
    const b = await api(`/api/builds?championId=${s.selectedChampionId}&role=${s.assignedRole}`);
    const body = b.ok ? renderRunesSummoners(b.data) : `<span class="muted">${T('Sin runas sugeridas todavía.')}</span>`;
    pickHtml = `<div class="block"><div class="label">${T('Tu campeón · runas y hechizos')}</div><div class="pickhead">${head}</div>${body}</div>`;
  }
  $('contextBody').innerHTML = `
    <div class="kv">
      <span class="k">${T('Rol')}</span><span>${esc(T(ROLE_ES[s.assignedRole] || s.assignedRole))}</span>
      <span class="k">${T('Fase')}</span><span class="faint">${esc(s.phase)}</span>
      <span class="k">${T('Bans')}</span><span class="iconrow">${(s.bans || []).map((b) => champChip(b, 18)).join(' ') || '—'}</span>
    </div>
    ${pickHtml}
    <div class="block"><div class="label">${T('Sugerencias para tu rol')}</div>${recHtml}</div>`;
}

async function refreshInGame(livePrefetched) {
  $('contextTitle').textContent = T('En partida');
  let championId = null;
  let role = lastPickedRole;
  const live = livePrefetched ?? (await api('/api/live/champion'));
  if (live.ok && live.data?.active && live.data.championId) {
    championId = live.data.championId;
    role = live.data.role && live.data.role !== 'UNKNOWN' ? live.data.role : role;
  } else if (lastPickedChampionId) {
    championId = lastPickedChampionId;
  }
  if (!championId) {
    $('contextBody').innerHTML = `<span class="muted">${T('Detectando tu campeón… (si acabas de abrir la app en partida, dame unos segundos)')}</span>`;
    return;
  }
  const b = await api(`/api/builds?championId=${championId}&role=${role || 'UNKNOWN'}`);
  const head = `<div class="pickhead" style="margin-bottom:.6rem">${champChip(championId, 36)}</div>`;

  // Coach en vivo: objetivos épicos, timers y power-spike (Live Client API).
  const game = await api('/api/live/game');
  const coachHtml = game.ok && game.data?.active ? renderLiveCoach(game.data) : '';

  const buildHtml = b.ok ? renderBuild(b.data) : `<span class="muted">${T('Sin build para este campeón todavía.')}</span>`;
  $('contextBody').innerHTML = head + coachHtml + buildHtml;
}

/** Formatea segundos como "m:ss". */
function fmtCountdown(sec) {
  if (sec == null) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function objectiveCell(label, icon, o) {
  let statusHtml;
  if (o.status === 'up') statusHtml = `<span class="obj-up">${T('Disponible')}</span>`;
  else if (o.status === 'respawning') statusHtml = `<span class="obj-timer">${fmtCountdown(o.secondsUntil)}</span>`;
  else if (o.status === 'not_yet') statusHtml = `<span class="obj-soon">${T('en {t}', { t: fmtCountdown(o.secondsUntil) })}</span>`;
  else statusHtml = '<span class="obj-gone">—</span>';
  const taken = o.taken > 0 ? `<span class="obj-count">${o.taken}</span>` : '';
  return `<div class="obj-cell">
    <div class="obj-head">${icon} ${esc(label)} ${taken}</div>
    ${statusHtml}
  </div>`;
}

/** Panel de coach en vivo. Los objetivos épicos sólo existen en la Grieta (mapa 11);
 *  en el Abismo Aullador (ARAM y ARAM Mayhem, mapa 12) mostramos otra ayuda. */
function renderLiveCoach(g) {
  const isRift = g.mapNumber === 11 || (g.mapNumber == null && g.gameMode === 'CLASSIC');
  return isRift ? renderRiftCoach(g) : renderAramCoach(g);
}

/** Coach de Grieta: objetivos épicos, timers y power-spike. */
function renderRiftCoach(g) {
  const o = g.objectives;
  const gold = g.player.currentGold;
  const spike =
    gold >= 3000 ? T('💰 Tienes oro para un ítem grande — considera volver a la base.')
    : gold >= 1300 ? T('💰 Oro suficiente para un componente clave — planea tu recall.')
    : null;
  const advice = [];
  if (o.dragon.status === 'up') advice.push(T('🐉 Dragón disponible — coordina con tu equipo.'));
  if (o.baron.status === 'up') advice.push(T('🦑 Barón disponible — asegúralo con visión.'));
  if (o.herald.status === 'up') advice.push(T('👁️ Heraldo disponible — buen momento para presionar una calle.'));
  if (spike) advice.push(spike);

  return `<div class="block coach">
    <div class="label">${T('Coach en vivo · {t}', { t: fmtCountdown(g.gameTime) })}</div>
    <div class="objectives">
      ${objectiveCell(T('Dragón'), '🐉', o.dragon)}
      ${objectiveCell(T('Heraldo'), '👁️', o.herald)}
      ${objectiveCell(T('Barón'), '🦑', o.baron)}
    </div>
    <div class="coach-player">${T('Nivel {l} · {g} oro', { l: esc(g.player.level), g: esc(gold) })}</div>
    ${advice.length ? `<ul class="coach-advice">${advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

/** Coach de ARAM: sin barón/dragón; consejos propios del Abismo Aullador. */
function renderAramCoach(g) {
  const gold = g.player.currentGold;
  const advice = [];
  if (gold >= 1600) advice.push(T('💰 Tienes oro para un ítem completo — cómpralo al morir (no puedes volver a la base).'));
  advice.push(T('❤️ Recoge el orbe de salud del centro cuando pases por ahí: cura y da maná.'));
  advice.push(T('🤝 Agrúpate con tu equipo: en ARAM las peleas son 5v5 constantes, evita ir solo.'));
  advice.push(T('🛡️ Compra resistencias si el enemigo tiene mucho daño — mueres muy rápido en el pasillo único.'));

  return `<div class="block coach">
    <div class="label">${T('Coach ARAM · {t}', { t: fmtCountdown(g.gameTime) })}</div>
    <div class="coach-player">${T('Nivel {l} · {g} oro', { l: esc(g.player.level), g: esc(gold) })}</div>
    <ul class="coach-advice">${advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
  </div>`;
}

function renderRecommendations(target, data) {
  if (!data || !data.recommendations || data.recommendations.length === 0) {
    target.innerHTML = `<span class="muted">${T('Sin sugerencias para este rol.')}</span>`;
    return;
  }
  const items = data.recommendations.map((r) => `<li class="recitem">
    <span>${champChip(r.championId, 24)}<span class="reason">${esc(reasonEs(r.reason))}</span></span>
    <span class="score">${r.score}</span>
  </li>`).join('');
  const meta = data.personalized ? ` <span class="pill live">${T('personalizado · {n}', { n: data.basedOnGames })}</span>` : '';
  target.innerHTML = `<div class="summary"><span>${T('Rol: {r}', { r: esc(T(ROLE_ES[data.role] || data.role)) })}</span>${meta}</div><ul class="reclist">${items}</ul>`;
}

function reasonEs(r) {
  const es = { meta_pick:'meta', comfort_pick:'cómodo', comfort_pick_plus_meta:'cómodo + meta' }[r] || r || '';
  return es ? T(es) : es;
}

async function refreshAram() {
  $('contextTitle').textContent = T('ARAM — Composición');
  const { data } = await api('/api/aram/analysis');
  if (!data || !data.isAram) { $('contextBody').innerHTML = `<span class="muted">${T('Detectando sesión de ARAM…')}</span>`; return; }
  const comp = data.currentComp;
  const balanced = comp.balanced ? `<span class="verdict-yes">${T('✓ Equipo equilibrado')}</span>` : `<span class="verdict-no">${T('⚠ Falta algo')}</span>`;
  const missing   = (comp.missing || []).map((m) => `<span class="tag bad">${esc(m)}</span>`).join('');
  const strengths = (comp.strengths || []).map((m) => `<span class="tag good">${esc(m)}</span>`).join('');
  const team  = (data.team || []).map((c) => `<span class="chip">${champChip(c.championId, 22)}${c.isLocalPlayer ? ` <span class="pill ghost">${T('tú')}</span>` : ''}</span>`).join(' ');
  const bench = (data.bench || []).map((c) => champChip(c.championId, 22)).join(' ') || '<span class="muted">—</span>';
  let best = '<span class="muted">—</span>';
  if (data.bestOption) {
    const o = data.bestOption;
    best = `${champChip(o.championId, 26)} <span class="score">${o.fitScore}</span> ${(o.fillsGaps || []).map((g) => `<span class="tag good">${esc(g)}</span>`).join('')}`;
  }
  const options = (data.options || [])
    .map((o) => `<li class="recitem"><span>${champChip(o.championId, 24)}</span><span class="score">${o.fitScore}</span></li>`)
    .join('');

  // Build del campeón que tienes actualmente (se actualiza al intercambiar en la banca).
  const localChamp = (data.team || []).find((c) => c.isLocalPlayer);
  let buildHtml = '';
  if (localChamp) {
    lastPickedChampionId = localChamp.championId;
    lastPickedRole = 'ARAM';
    const b = await api(`/api/builds?championId=${localChamp.championId}&role=ARAM`);
    if (b.ok) {
      buildHtml = `<div class="block"><div class="label">${T('Tu build')}</div>${renderBuild(b.data)}</div>`;
    }
  }

  $('contextBody').innerHTML = `
    <div class="summary">${balanced}</div>
    <div class="kv">
      <span class="k">${T('Equipo')}</span><span class="iconrow">${team}</span>
      <span class="k">${T('Banca')}</span><span class="iconrow">${bench}</span>
      <span class="k">${T('Mezcla')}</span><span class="faint">${comp.adCount} AD · ${comp.apCount} AP · frontline ${comp.frontlineCount} · sustain ${comp.sustainCount} · CC ${comp.hardCcCount}</span>
    </div>
    ${missing   ? `<div class="block"><div class="label">${T('Le falta')}</div><div>${missing}</div></div>` : ''}
    ${strengths ? `<div class="block"><div class="label">${T('Fortalezas')}</div><div>${strengths}</div></div>` : ''}
    <div class="block"><div class="label">${T('Mejor elección de tu banca')}</div><div class="recitem">${best}</div></div>
    ${options ? `<div class="block"><div class="label">${T('Opciones (tú + banca)')}</div><ul class="reclist">${options}</ul></div>` : ''}
    ${buildHtml}`;
}

// --- Bucle --------------------------------------------------------------
async function tick() {
  const status = await refreshStatus();
  await refreshContext(status?.clientState);
}

/**
 * Oculta la pantalla de bienvenida tras dejar que la animación se luzca.
 * Con "reduce motion" la quitamos casi al instante.
 */
function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const delay = reduce ? 300 : 3300;
  setTimeout(() => {
    splash.classList.add('hide');
    // En la app de escritorio, avisa para que los botones de ventana aparezcan
    // (durante la animación estaban fundidos con el splash).
    if (window.pixDesktop) window.pixDesktop.splashDone();
    setTimeout(() => splash.remove(), 600);
  }, delay);
}

// --- Idioma (i18n) ------------------------------------------------------
/** Marca el botón de idioma activo. */
function markLangButton() {
  const lang = window.I18N.getLang();
  document.querySelectorAll('#langSwitch .lang-btn').forEach((b) => {
    b.classList.toggle('on', b.dataset.lang === lang);
  });
}

/** Re-traduce el HTML estático y vuelve a renderizar los paneles dinámicos. */
function relocalize() {
  document.documentElement.lang = window.I18N.getLang();
  window.I18N.applyStatic(document);
  markLangButton();
  // Los paneles dinámicos se regeneran con el nuevo idioma.
  refreshRiotPanels();
  contextMode = null; // fuerza re-render del contexto en el próximo tick
  tick();
}

/** Conecta el selector de idioma del topbar. */
function setupLangSwitch() {
  const sw = $('langSwitch');
  if (!sw) return;
  sw.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-btn');
    if (!btn || btn.dataset.lang === window.I18N.getLang()) return;
    window.I18N.setLang(btn.dataset.lang);
    relocalize();
  });
}

/** Conecta el botón de ajustes (estados + reconfigurar clave). */
function setupSettings() {
  const btn = $('settingsBtn');
  const panel = $('settingsPanel');
  if (!btn || !panel) return;
  const close = () => {
    panel.hidden = true;
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    panel.hidden = false;
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.hidden ? open() : close();
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  const rk = $('reconfigKeyBtn');
  if (rk) rk.addEventListener('click', () => {
    close();
    $('profileBody').innerHTML = renderApiKeyForm();
    wireApiKeyForm();
  });
}

// Arranque: primero conocemos el estado del cliente, luego perfil y contexto,
// así el perfil sabe si mostrar "última sesión".
async function boot() {
  dismissSplash();
  document.documentElement.lang = window.I18N.getLang();
  window.I18N.applyStatic(document);
  markLangButton();
  setupLangSwitch();
  setupSettings();
  await loadCatalog();
  await refreshStatus();
  refreshRiotPanels();
  tick();
}
boot();
setInterval(tick, 4000);
setInterval(() => { refreshRiotPanels(); if (catalogById.size === 0) loadCatalog(); }, 30000);
