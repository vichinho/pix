'use strict';

// --- Utilidades ---------------------------------------------------------
const $ = (id) => document.getElementById(id);

async function api(path) {
  try {
    const res = await fetch(path);
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
function setLinkedRiotId(gameName, tagLine, platform) {
  localStorage.setItem('riotId', JSON.stringify({ gameName, tagLine, platform }));
}
function clearLinkedRiotId() {
  localStorage.removeItem('riotId');
}
/** Sufijo de query con la identidad vinculada (si existe). */
function riotIdQuery() {
  const id = getLinkedRiotId();
  if (!id) return '';
  let q = `&gameName=${encodeURIComponent(id.gameName)}&tagLine=${encodeURIComponent(id.tagLine)}`;
  if (id.platform) q += `&platform=${encodeURIComponent(id.platform)}`;
  return q;
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

/** Nombre del campeón desde el catálogo. */
function champName(id) {
  const e = catalogById.get(Number(id));
  return e ? e.name : `#${id}`;
}

function iconOrText(entry, cls) {
  if (entry.icon) return `<img class="${cls}" src="${esc(entry.icon)}" alt="${esc(entry.name)}" title="${esc(entry.name)}" loading="lazy"/>`;
  return `<span class="tagfallback">${esc(entry.name)}</span>`;
}
const itemRow = (items) => (items || []).map((i) => iconOrText(i, 'iicon')).join(' ');
const summRow = (sums)  => (sums  || []).map((s) => iconOrText(s, 'sicon')).join(' ');
function abilityRow(abils) {
  return (abils || []).map((a) =>
    `<span class="abil">${a.icon ? `<img class="sicon" src="${esc(a.icon)}" alt="${esc(a.name)}" title="${esc(a.name)}" loading="lazy"/>` : ''}<span class="ablabel">${esc(a.letter)}</span></span>`
  ).join('<span class="arrow">›</span>');
}

function runeRow(r, extraClass) {
  const img = r.icon ? `<img src="${esc(r.icon)}" alt="${esc(r.name)}" loading="lazy"/>` : '<span class="tagfallback">•</span>';
  return `<div class="rune ${extraClass || ''}">${img}<span class="rn">${esc(r.name)}</span></div>`;
}
function styleHead(style) {
  const img = style.icon ? `<img src="${esc(style.icon)}" alt="" loading="lazy"/>` : '';
  return `<div class="runestyle">${img}${esc(style.name)}</div>`;
}
function renderRunes(runes) {
  const shards = (runes.shards || []).map((s) =>
    s.icon ? `<img src="${esc(s.icon)}" alt="${esc(s.name)}" title="${esc(s.name)}" loading="lazy"/>` : ''
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

function rankEmblemUrl(tier) {
  if (!tier) return null;
  const t = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  return `https://ddragon.leagueoflegends.com/cdn/img/ranked-emblems/Emblem_${t}.png`;
}

function renderProfile(p) {
  const cached = clientConnected ? '' : ' <span class="pill ghost" style="font-size:0.65rem">última sesión</span>';
  const rank = p.soloQueue || p.flexQueue || null;
  const emblemUrl = rank ? rankEmblemUrl(rank.tier) : rankEmblemUrl('Unranked');
  const emblemImg = emblemUrl
    ? `<img src="${esc(emblemUrl)}" alt="${esc(rank?.tier || 'Unranked')}" loading="lazy" onerror="this.style.display='none'" />`
    : `<div class="rank-emblem-placeholder"></div>`;

  let rankBlock;
  if (rank) {
    const wr = rank.wins + rank.losses > 0 ? Math.round((rank.wins / (rank.wins + rank.losses)) * 100) : 0;
    const wrGood = wr >= 50;
    const wrWidth = Math.max(5, Math.min(95, wr));
    const queueLabel = p.soloQueue ? 'Solo/Duo' : 'Flex';
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
      <div class="ranked-record">${rank.wins}V / ${rank.losses}D · ${rank.wins + rank.losses} partidas clasificatorias</div>`;
  } else {
    rankBlock = `<div class="rank-unranked">Sin clasificar esta temporada</div>`;
  }

  let peakBlock = '';
  if (p.peakRank && p.peakRank.tier) {
    const pk = p.peakRank;
    const peakUrl = rankEmblemUrl(pk.tier);
    const peakImg = peakUrl ? `<img class="peak-emblem" src="${esc(peakUrl)}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : '';
    peakBlock = `
      <div class="divider"></div>
      <div class="peak-row">
        <span class="peak-label">Mejor liga</span>
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
            <span class="profile-region">${esc(p.region.toUpperCase())}</span>
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
    badge.textContent = 'Desconectado';
    badge.className = 'pill off';
  }
  return data;
}

function stateEs(s) {
  return ({ DISCONNECTED:'desconectado', NONE:'menú', LOBBY:'lobby', MATCHMAKING:'en cola',
    READY_CHECK:'aceptar', CHAMP_SELECT:'champ select', IN_GAME:'en partida', POST_GAME:'post-partida' }[s] || s || '—');
}

// --- Vinculación manual de cuenta ---------------------------------------
/** Formulario para escribir el Riot ID (Nombre#TAG) cuando no hay cuenta vinculada. */
function renderLinkForm() {
  const id = getLinkedRiotId();
  const prefill = id ? `${id.gameName}#${id.tagLine}` : '';
  const sel = id?.platform || 'la2';
  const options = RIOT_PLATFORMS.map(
    (p) => `<option value="${p.v}"${p.v === sel ? ' selected' : ''}>${esc(p.label)}</option>`,
  ).join('');
  return `
    <div class="link-form" style="padding:1.3rem">
      <div class="muted" style="margin-bottom:.6rem">Abre el cliente de LoL una vez, o vincula tu cuenta a mano:</div>
      <select id="riotPlatform" class="link-select">${options}</select>
      <div class="link-row">
        <input id="riotIdInput" type="text" placeholder="Nombre#TAG (ej: Faker#KR1)" value="${esc(prefill)}"
          autocomplete="off" spellcheck="false" />
        <button id="riotIdBtn" type="button">Vincular</button>
      </div>
      <div id="riotIdMsg" class="link-msg"></div>
    </div>`;
}

/** Enlace pequeño para revincular/cambiar la cuenta ya conectada. */
function renderRelinkLink() {
  return `<div class="relink"><button id="relinkBtn" type="button" class="linklike">Cambiar cuenta</button></div>`;
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
    if (msg) { msg.textContent = 'Formato: Nombre#TAG (ej: Faker#KR1)'; msg.className = 'link-msg err'; }
    return;
  }
  const gameName = raw.slice(0, hash).trim();
  const tagLine = raw.slice(hash + 1).trim();
  const platform = $('riotPlatform')?.value || 'la2';
  if (msg) { msg.textContent = 'Verificando…'; msg.className = 'link-msg'; }

  // Comprobamos contra la Riot API antes de guardar, para dar feedback claro.
  const check = await api(`/api/player/profile?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}&platform=${encodeURIComponent(platform)}`);
  if (check.ok && check.data) {
    setLinkedRiotId(gameName, tagLine, platform);
    refreshRiotPanels();
  } else if (msg) {
    msg.innerHTML = riotErrorEs(check);
    msg.className = 'link-msg err';
  }
}

/** Traduce los errores de la Riot API a mensajes claros en español. */
function riotErrorEs(resp) {
  const code = resp.data?.error;
  if (resp.status === 404 || code === 'not_found')
    return 'No se encontró esa cuenta. Revisa el Nombre#TAG (respeta mayúsculas y el tag correcto).';
  if (code === 'riot_api_key_invalid' || code === 'riot_api_key_forbidden_or_expired')
    return 'Tu clave de Riot API no es válida o expiró. Las claves de desarrollo caducan cada 24 h: '
      + 'genera una nueva en <a href="https://developer.riotgames.com/" target="_blank" rel="noopener">developer.riotgames.com</a>, '
      + 'actualízala en tu archivo <code>.env</code> (RIOT_API_KEY) y reinicia la app.';
  if (code === 'riot_rate_limited')
    return 'La Riot API está limitando las peticiones (rate limit). Espera unos segundos e inténtalo de nuevo.';
  return `No se pudo vincular: ${esc(code || `Error ${resp.status}`)}`;
}

// --- Perfil / stats / partidas -----------------------------------------
async function refreshRiotPanels() {
  const prof = await api(`/api/player/profile?_=1${riotIdQuery()}`);
  if (prof.status === 503) {
    riotConfigured = false;
    $('riotBadge').textContent = 'Riot API off';
    $('riotBadge').className = 'pill off';
    $('profileBody').innerHTML = `
      <div style="padding:1.4rem 1.3rem">
        <span class="hint">Define <code style="font-size:0.8rem;color:var(--accent)">RIOT_API_KEY</code> en <code style="font-size:0.8rem;color:var(--muted)">.env</code> para ver el perfil y estadísticas.</span>
      </div>`;
    return;
  }
  riotConfigured = true;
  $('riotBadge').textContent = 'Riot API';
  $('riotBadge').className = 'pill on';

  if (prof.ok && prof.data) {
    $('profileBody').innerHTML = renderProfile(prof.data) + renderRelinkLink();
    wireLinkForm();
    refreshStats();
    refreshMatches();
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

async function refreshStats() {
  const { ok, data, status } = await api(`/api/player/stats?count=20${riotIdQuery()}`);
  if (!ok) { $('statsBody').innerHTML = `<span class="err">${esc(data?.error || status)}</span>`; return; }
  const wr = Math.round((data.winRate || 0) * 100);
  const top = (data.byChampion || []).slice(0, 6);
  const rows = top.map((c) => `<tr>
    <td>${champChip(c.championId, 18)}</td>
    <td>${c.games}</td>
    <td class="${c.winRate >= 0.5 ? 'win' : 'loss'}">${Math.round(c.winRate * 100)}%</td>
    <td>${c.kda}</td>
  </tr>`).join('');
  $('statsBody').innerHTML = `
    <div class="summary"><span class="big ${wr >= 50 ? 'win' : 'loss'}">${wr}%</span><span>WR · ${data.wins}V ${data.losses}D · ${data.totalGames} partidas</span></div>
    <table><thead><tr><th>Campeón</th><th>P</th><th>WR</th><th>KDA</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ── Historial de partidas con paginación ────────────────────────────────

const MATCHES_PER_PAGE = 10;

/** Estado de paginación del historial. */
const matchState = {
  all: [],        // array completo de partidas
  page: 0,        // página actual (0-based)
  expanded: null, // matchId expandido (o null)
};

/** Nombre corto de cola por queueId. */
const QUEUE_NAMES = {
  420: 'Clasif. Solo/Dúo', 440: 'Clasif. Flexible', 400: 'Normal Draft', 430: 'Normal',
  450: 'ARAM', 490: 'Normal Rápida', 480: 'Swiftplay', 700: 'Clash', 830: 'Co-op vs IA',
  840: 'Co-op vs IA', 850: 'Co-op vs IA', 900: 'URF', 1700: 'Arena', 1900: 'URF',
};
const queueName = (id) => QUEUE_NAMES[id] || `Cola ${id}`;

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
  if (mins < 60)   return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
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
    body.innerHTML = '<span class="muted">No hay partidas recientes.</span>';
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

    const role    = ROLE_ES[m.role] || m.role;
    const kda     = kdaStr(m.kills, m.deaths, m.assists);
    const dur     = fmtDuration(m.durationSec || 0);
    const rel     = m.playedAt ? fmtRelative(m.playedAt) : '';
    const winCls  = m.win ? 'win' : 'loss';
    const rowCls  = m.win ? 'win-row' : 'loss-row';
    const result  = m.win ? 'Victoria' : 'Derrota';
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
  info.textContent = `${total} partidas`;
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
  const kdaRatio = m.deaths === 0 ? 'Perfecto' : ((m.kills + m.assists) / m.deaths).toFixed(2);
  const stat = (label, value) => `<div class="detail-stat"><span class="ds-val">${esc(value)}</span><span class="ds-label">${esc(label)}</span></div>`;

  return `<div class="match-detail">
    <div class="detail-loadout">
      <div class="detail-spells">${spells}</div>
      <div class="detail-items">${items}</div>
    </div>
    <div class="detail-stats">
      ${stat('KDA', kdaRatio)}
      ${stat('CS', `${m.cs} (${perMin}/m)`)}
      ${stat('Oro', (m.gold / 1000).toFixed(1) + 'k')}
      ${stat('Daño', (m.damage / 1000).toFixed(1) + 'k')}
      ${stat('Visión', m.visionScore)}
      ${stat('Nivel', m.championLevel)}
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
async function refreshMatches() {
  const body = $('matchesBody');
  body.innerHTML = '<span class="muted">Cargando partidas…</span>';
  $('matchPagination').hidden = true;

  const { ok, data, status } = await api(`/api/player/matches?count=50${riotIdQuery()}`);
  if (!ok) {
    body.innerHTML = `<span class="err">${esc(data?.error || status)}</span>`;
    return;
  }

  matchState.all  = data.matches || [];
  matchState.page = 0;
  renderMatchPage();
}

// Listeners de paginación
$('matchPrevBtn').addEventListener('click', () => {
  if (matchState.page > 0) { matchState.page -= 1; matchState.expanded = null; renderMatchPage(); }
});
$('matchNextBtn').addEventListener('click', () => {
  const totalPages = Math.ceil(matchState.all.length / MATCHES_PER_PAGE);
  if (matchState.page < totalPages - 1) { matchState.page += 1; matchState.expanded = null; renderMatchPage(); }
});
initMatchClicks();

// --- Build --------------------------------------------------------------
function renderBuild(b) {
  const passive = b.passive
    ? `<span class="abil">${b.passive.icon ? `<img class="sicon" src="${esc(b.passive.icon)}" alt="${esc(b.passive.name)}" title="${esc(b.passive.name)}" loading="lazy"/>` : ''}<span class="ablabel">P</span></span>`
    : '';
  return `
    <div class="kv">
      <span class="k">Campeón</span><span>${champChip(b.championId, 22)} · ${esc(ROLE_ES[b.role] || b.role)}</span>
      <span class="k">Hechizos</span><span class="iconrow">${summRow(b.summoners)}</span>
      <span class="k">Habilidades</span><span class="iconrow">${passive}${passive ? '<span class="arrow">·</span>' : ''}${abilityRow(b.abilities)}</span>
    </div>
    <div class="block"><div class="label">Runas</div>${renderRunes(b.runes)}</div>
    <div class="block"><div class="label">Ítems iniciales</div><div class="iconrow">${itemRow(b.items.starting)}</div></div>
    <div class="block"><div class="label">Core</div><div class="iconrow">${itemRow(b.items.core)}</div></div>
    <div class="block"><div class="label">Situacionales</div><div class="iconrow">${itemRow(b.items.situational)}</div></div>
    ${b.notes ? `<div class="note">💡 ${esc(b.notes)}</div>` : ''}
    <div class="source-note">Fuente: ${esc(b.source)} · ${esc(b.patch)}</div>`;
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
  if (liveActive || clientState === 'IN_GAME') return refreshInGame(live);
  if (isAram)                       return refreshAram();
  if (clientState === 'CHAMP_SELECT') return refreshChampSelect();
  $('contextTitle').textContent = 'Contexto';
  $('contextBody').innerHTML = '<span class="muted">Sin champ select activo. Entra a una partida para ver recomendaciones o análisis de ARAM.</span>';
}

function renderRunesSummoners(b) {
  return `<div class="kv">
    <span class="k">Hechizos</span><span class="iconrow">${summRow(b.summoners)}</span>
    <span class="k">Habilidades</span><span class="iconrow">${abilityRow(b.abilities)}</span>
  </div>
  <div class="block"><div class="label">Runas</div>${renderRunes(b.runes)}</div>
  <div class="source-note">Fuente: ${esc(b.source)}</div>`;
}

async function refreshChampSelect() {
  $('contextTitle').textContent = 'Champion Select';
  const { data } = await api('/api/champ-select/session');
  if (!data || !data.active || !data.session) {
    $('contextBody').innerHTML = '<span class="muted">Detectando champ select…</span>';
    return;
  }
  const s = data.session;
  if (s.selectedChampionId) { lastPickedChampionId = s.selectedChampionId; lastPickedRole = s.assignedRole; }
  const rec = await api(`/api/recommendations?role=${s.assignedRole}&limit=5${riotConfigured ? '&personalized=true' + riotIdQuery() : ''}`);
  let recHtml = '<span class="muted">—</span>';
  if (rec.ok) { const tmp = document.createElement('div'); renderRecommendations(tmp, rec.data); recHtml = tmp.innerHTML; }
  let pickHtml = '';
  if (s.selectedChampionId) {
    const head = `${champChip(s.selectedChampionId, 30)} <span class="pill ghost">${s.pickCompleted ? 'confirmado' : 'eligiendo'}</span>`;
    const b = await api(`/api/builds?championId=${s.selectedChampionId}&role=${s.assignedRole}`);
    const body = b.ok ? renderRunesSummoners(b.data) : '<span class="muted">Sin runas sugeridas todavía.</span>';
    pickHtml = `<div class="block"><div class="label">Tu campeón · runas y hechizos</div><div class="pickhead">${head}</div>${body}</div>`;
  }
  $('contextBody').innerHTML = `
    <div class="kv">
      <span class="k">Rol</span><span>${esc(ROLE_ES[s.assignedRole] || s.assignedRole)}</span>
      <span class="k">Fase</span><span class="faint">${esc(s.phase)}</span>
      <span class="k">Bans</span><span class="iconrow">${(s.bans || []).map((b) => champChip(b, 18)).join(' ') || '—'}</span>
    </div>
    ${pickHtml}
    <div class="block"><div class="label">Sugerencias para tu rol</div>${recHtml}</div>`;
}

async function refreshInGame(livePrefetched) {
  $('contextTitle').textContent = 'En partida';
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
    $('contextBody').innerHTML = '<span class="muted">Detectando tu campeón… (si acabas de abrir la app en partida, dame unos segundos)</span>';
    return;
  }
  const b = await api(`/api/builds?championId=${championId}&role=${role || 'UNKNOWN'}`);
  const head = `<div class="pickhead" style="margin-bottom:.6rem">${champChip(championId, 36)}</div>`;

  // Coach en vivo: objetivos épicos, timers y power-spike (Live Client API).
  const game = await api('/api/live/game');
  const coachHtml = game.ok && game.data?.active ? renderLiveCoach(game.data) : '';

  const buildHtml = b.ok ? renderBuild(b.data) : '<span class="muted">Sin build para este campeón todavía.</span>';
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
  if (o.status === 'up') statusHtml = '<span class="obj-up">Disponible</span>';
  else if (o.status === 'respawning') statusHtml = `<span class="obj-timer">${fmtCountdown(o.secondsUntil)}</span>`;
  else if (o.status === 'not_yet') statusHtml = `<span class="obj-soon">en ${fmtCountdown(o.secondsUntil)}</span>`;
  else statusHtml = '<span class="obj-gone">—</span>';
  const taken = o.taken > 0 ? `<span class="obj-count">${o.taken}</span>` : '';
  return `<div class="obj-cell">
    <div class="obj-head">${icon} ${esc(label)} ${taken}</div>
    ${statusHtml}
  </div>`;
}

/** Panel de coach en vivo: tiempo, objetivos y consejo de power-spike. */
function renderLiveCoach(g) {
  const o = g.objectives;
  const gold = g.player.currentGold;
  const spike =
    gold >= 3000 ? '💰 Tienes oro para un ítem grande — considera volver a la base.'
    : gold >= 1300 ? '💰 Oro suficiente para un componente clave — planea tu recall.'
    : null;
  const advice = [];
  if (o.dragon.status === 'up') advice.push('🐉 Dragón disponible — coordina con tu equipo.');
  if (o.baron.status === 'up') advice.push('🦑 Barón disponible — asegúralo con visión.');
  if (o.herald.status === 'up') advice.push('👁️ Heraldo disponible — buen momento para presionar una calle.');
  if (spike) advice.push(spike);

  return `<div class="block coach">
    <div class="label">Coach en vivo · ${fmtCountdown(g.gameTime)}</div>
    <div class="objectives">
      ${objectiveCell('Dragón', '🐉', o.dragon)}
      ${objectiveCell('Heraldo', '👁️', o.herald)}
      ${objectiveCell('Barón', '🦑', o.baron)}
    </div>
    <div class="coach-player">Nivel ${esc(g.player.level)} · ${esc(gold)} oro</div>
    ${advice.length ? `<ul class="coach-advice">${advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

function renderRecommendations(target, data) {
  if (!data || !data.recommendations || data.recommendations.length === 0) {
    target.innerHTML = '<span class="muted">Sin sugerencias para este rol.</span>';
    return;
  }
  const items = data.recommendations.map((r) => `<li class="recitem">
    <span>${champChip(r.championId, 24)}<span class="reason">${esc(reasonEs(r.reason))}</span></span>
    <span class="score">${r.score}</span>
  </li>`).join('');
  const meta = data.personalized ? ` <span class="pill live">personalizado · ${data.basedOnGames}</span>` : '';
  target.innerHTML = `<div class="summary"><span>Rol: ${esc(ROLE_ES[data.role] || data.role)}</span>${meta}</div><ul class="reclist">${items}</ul>`;
}

function reasonEs(r) {
  return { meta_pick:'meta', comfort_pick:'cómodo', comfort_pick_plus_meta:'cómodo + meta' }[r] || r || '';
}

async function refreshAram() {
  $('contextTitle').textContent = 'ARAM — Composición';
  const { data } = await api('/api/aram/analysis');
  if (!data || !data.isAram) { $('contextBody').innerHTML = '<span class="muted">Detectando sesión de ARAM…</span>'; return; }
  const comp = data.currentComp;
  const balanced = comp.balanced ? '<span class="verdict-yes">✓ Equipo equilibrado</span>' : '<span class="verdict-no">⚠ Falta algo</span>';
  const missing   = (comp.missing || []).map((m) => `<span class="tag bad">${esc(m)}</span>`).join('');
  const strengths = (comp.strengths || []).map((m) => `<span class="tag good">${esc(m)}</span>`).join('');
  const team  = (data.team || []).map((c) => `<span class="chip">${champChip(c.championId, 22)}${c.isLocalPlayer ? ' <span class="pill ghost">tú</span>' : ''}</span>`).join(' ');
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
      buildHtml = `<div class="block"><div class="label">Tu build</div>${renderBuild(b.data)}</div>`;
    }
  }

  $('contextBody').innerHTML = `
    <div class="summary">${balanced}</div>
    <div class="kv">
      <span class="k">Equipo</span><span class="iconrow">${team}</span>
      <span class="k">Banca</span><span class="iconrow">${bench}</span>
      <span class="k">Mezcla</span><span class="faint">${comp.adCount} AD · ${comp.apCount} AP · frontline ${comp.frontlineCount} · sustain ${comp.sustainCount} · CC ${comp.hardCcCount}</span>
    </div>
    ${missing   ? `<div class="block"><div class="label">Le falta</div><div>${missing}</div></div>` : ''}
    ${strengths ? `<div class="block"><div class="label">Fortalezas</div><div>${strengths}</div></div>` : ''}
    <div class="block"><div class="label">Mejor elección de tu banca</div><div class="recitem">${best}</div></div>
    ${options ? `<div class="block"><div class="label">Opciones (tú + banca)</div><ul class="reclist">${options}</ul></div>` : ''}
    ${buildHtml}`;
}

// --- Bucle --------------------------------------------------------------
async function tick() {
  const status = await refreshStatus();
  await refreshContext(status?.clientState);
}

// Arranque: primero conocemos el estado del cliente, luego perfil y contexto,
// así el perfil sabe si mostrar "última sesión".
async function boot() {
  await loadCatalog();
  await refreshStatus();
  refreshRiotPanels();
  tick();
}
boot();
setInterval(tick, 4000);
setInterval(() => { refreshRiotPanels(); if (catalogById.size === 0) loadCatalog(); }, 30000);
