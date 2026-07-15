'use strict';

// --- Utilidades ---------------------------------------------------------
const $ = (id) => document.getElementById(id);

async function api(path) {
  try {
    const res = await fetch(path);
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: String(err) } };
  }
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ROLE_ES = { TOP: 'Top', JUNGLE: 'Jungla', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support', UNKNOWN: '—' };

// --- Catálogo de campeones (nombre + icono desde Data Dragon) -----------
let catalogById = new Map();
let iconBase = '';
let lastPickedChampionId = null;
let lastPickedRole = 'UNKNOWN';

async function loadCatalog() {
  const { ok, data } = await api('/api/champions');
  if (ok && data && Array.isArray(data.champions)) {
    iconBase = data.iconBase || '';
    catalogById = new Map(data.champions.map((c) => [Number(c.id), c]));
  }
}

function champChip(id, size = 22) {
  const e = catalogById.get(Number(id));
  if (e && iconBase) {
    return `<span class="chip"><img class="cicon" style="width:${size}px;height:${size}px" src="${iconBase}${esc(e.image)}" alt="${esc(e.name)}" loading="lazy"/> ${esc(e.name)}</span>`;
  }
  return `<span class="chip">${e ? esc(e.name) : '#' + esc(id)}</span>`;
}

// Helpers de iconos para builds enriquecidas (ítems, hechizos, habilidades).
function iconOrText(entry, cls) {
  if (entry.icon) {
    return `<img class="${cls}" src="${esc(entry.icon)}" alt="${esc(entry.name)}" title="${esc(entry.name)}" loading="lazy"/>`;
  }
  return `<span class="tagfallback">${esc(entry.name)}</span>`;
}
const itemRow = (items) => (items || []).map((i) => iconOrText(i, 'iicon')).join(' ');
const summRow = (sums) => (sums || []).map((s) => iconOrText(s, 'sicon')).join(' ');
function abilityRow(abils) {
  return (abils || [])
    .map(
      (a) =>
        `<span class="abil">${a.icon ? `<img class="sicon" src="${esc(a.icon)}" alt="${esc(a.name)}" title="${esc(a.name)}" loading="lazy"/>` : ''}<span class="ablabel">${esc(a.letter)}</span></span>`,
    )
    .join('<span class="arrow">›</span>');
}

// Página de runas al estilo LoL: árbol primario (keystone + filas) y secundario + fragmentos.
function runeRow(r, extraClass) {
  const img = r.icon
    ? `<img src="${esc(r.icon)}" alt="${esc(r.name)}" loading="lazy"/>`
    : '<span class="tagfallback">•</span>';
  return `<div class="rune ${extraClass || ''}">${img}<span class="rn">${esc(r.name)}</span></div>`;
}
function styleHead(style) {
  const img = style.icon ? `<img src="${esc(style.icon)}" alt="" loading="lazy"/>` : '';
  return `<div class="runestyle">${img}${esc(style.name)}</div>`;
}
function renderRunes(runes) {
  const shards = (runes.shards || [])
    .map((s) => (s.icon ? `<img src="${esc(s.icon)}" alt="${esc(s.name)}" title="${esc(s.name)}" loading="lazy"/>` : ''))
    .join('');
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
  return (
    {
      DISCONNECTED: 'desconectado',
      NONE: 'menú',
      LOBBY: 'lobby',
      MATCHMAKING: 'en cola',
      READY_CHECK: 'aceptar',
      CHAMP_SELECT: 'champ select',
      IN_GAME: 'en partida',
      POST_GAME: 'post-partida',
    }[s] || s || '—'
  );
}

// --- Perfil / stats / partidas -----------------------------------------
async function refreshRiotPanels() {
  const prof = await api('/api/player/profile');
  if (prof.status === 503) {
    riotConfigured = false;
    $('riotBadge').textContent = 'Riot API off';
    $('riotBadge').className = 'pill off';
    $('profileBody').innerHTML = '<span class="hint">Define RIOT_API_KEY en .env para ver perfil, historial y estadísticas.</span>';
    return;
  }
  riotConfigured = true;
  $('riotBadge').textContent = 'Riot API';
  $('riotBadge').className = 'pill on';

  if (prof.ok && prof.data) {
    const p = prof.data;
    const cached = clientConnected ? '' : ' <span class="pill ghost">última sesión</span>';
    $('profileBody').innerHTML = `<div class="kv">
      <span class="k">Invocador</span><span>${esc(p.gameName)} #${esc(p.tagLine)}${cached}</span>
      <span class="k">Nivel</span><span>${esc(p.summonerLevel ?? '—')}</span>
      <span class="k">Región</span><span>${esc(p.region)}</span>
    </div>`;
    refreshStats();
    refreshMatches();
  } else if (prof.status === 400) {
    // Aún no conocemos ninguna identidad (cliente nunca conectado en esta máquina).
    $('profileBody').innerHTML =
      '<span class="muted">Abre el cliente de LoL una vez para vincular tu cuenta, o consulta con tu Riot ID.</span>';
    $('statsBody').innerHTML = '<span class="muted">—</span>';
    $('matchesBody').innerHTML = '<span class="muted">—</span>';
  } else {
    $('profileBody').innerHTML = `<span class="err">No se pudo cargar el perfil (${esc(prof.data?.error || prof.status)}).</span>`;
  }
}

async function refreshStats() {
  const { ok, data, status } = await api('/api/player/stats?count=20');
  if (!ok) {
    $('statsBody').innerHTML = `<span class="err">${esc(data?.error || status)}</span>`;
    return;
  }
  const wr = Math.round((data.winRate || 0) * 100);
  const top = (data.byChampion || []).slice(0, 6);
  const rows = top
    .map(
      (c) => `<tr>
        <td>${champChip(c.championId, 18)}</td>
        <td>${c.games}</td>
        <td class="${c.winRate >= 0.5 ? 'win' : 'loss'}">${Math.round(c.winRate * 100)}%</td>
        <td>${c.kda}</td>
      </tr>`,
    )
    .join('');
  $('statsBody').innerHTML = `
    <div class="summary"><span class="big ${wr >= 50 ? 'win' : 'loss'}">${wr}%</span><span>WR · ${data.wins}V ${data.losses}D · ${data.totalGames} partidas</span></div>
    <table><thead><tr><th>Campeón</th><th>P</th><th>WR</th><th>KDA</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function refreshMatches() {
  const { ok, data, status } = await api('/api/player/matches?count=8');
  if (!ok) {
    $('matchesBody').innerHTML = `<span class="err">${esc(data?.error || status)}</span>`;
    return;
  }
  const rows = (data.matches || [])
    .map(
      (m) => `<tr>
        <td>${champChip(m.championId, 18)}</td>
        <td class="faint">${esc(ROLE_ES[m.role] || m.role)}</td>
        <td>${m.kills}/${m.deaths}/${m.assists}</td>
        <td class="${m.win ? 'win' : 'loss'}">${m.win ? 'V' : 'D'}</td>
      </tr>`,
    )
    .join('');
  $('matchesBody').innerHTML = `<table><thead><tr><th>Campeón</th><th>Rol</th><th>KDA</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// --- Recomendaciones ----------------------------------------------------
function renderRecommendations(target, data) {
  if (!data || !data.recommendations || data.recommendations.length === 0) {
    target.innerHTML = '<span class="muted">Sin sugerencias para este rol.</span>';
    return;
  }
  const items = data.recommendations
    .map(
      (r) => `<li class="recitem">
        <span>${champChip(r.championId, 24)}<span class="reason">${esc(reasonEs(r.reason))}</span></span>
        <span class="score">${r.score}</span>
      </li>`,
    )
    .join('');
  const meta = data.personalized ? ` <span class="pill live">personalizado · ${data.basedOnGames}</span>` : '';
  target.innerHTML = `<div class="summary"><span>Rol: ${esc(ROLE_ES[data.role] || data.role)}</span>${meta}</div><ul class="reclist">${items}</ul>`;
}

function reasonEs(r) {
  return { meta_pick: 'meta', comfort_pick: 'cómodo', comfort_pick_plus_meta: 'cómodo + meta' }[r] || r || '';
}

// --- Build --------------------------------------------------------------
function renderBuild(b) {
  const passive = b.passive
    ? `<span class="abil">${b.passive.icon ? `<img class="sicon" src="${esc(b.passive.icon)}" alt="${esc(b.passive.name)}" title="${esc(b.passive.name)}" loading="lazy"/>` : ''}<span class="ablabel">P</span></span>`
    : '';
  return `
    <div class="kv"><span class="k">Campeón</span><span>${champChip(b.championId, 22)} · ${esc(ROLE_ES[b.role] || b.role)}</span>
      <span class="k">Hechizos</span><span class="iconrow">${summRow(b.summoners)}</span>
      <span class="k">Habilidades</span><span class="iconrow">${passive}${passive ? '<span class="arrow">·</span>' : ''}${abilityRow(b.abilities)}</span></div>
    <div class="block"><div class="label">Runas</div>${renderRunes(b.runes)}</div>
    <div class="block"><div class="label">Ítems iniciales</div><div class="iconrow">${itemRow(b.items.starting)}</div></div>
    <div class="block"><div class="label">Core</div><div class="iconrow">${itemRow(b.items.core)}</div></div>
    <div class="block"><div class="label">Situacionales</div><div class="iconrow">${itemRow(b.items.situational)}</div></div>
    ${b.notes ? `<div class="note">💡 ${esc(b.notes)}</div>` : ''}
    <div class="source-note">Fuente: ${esc(b.source)} · ${esc(b.patch)}</div>`;
}

// --- Contexto: cola, champ select, ARAM --------------------------------
async function refreshContext(clientState) {
  const queue = await api('/api/game/queue');
  const qBadge = $('queueBadge');
  if (queue.ok && queue.data && queue.data.active && queue.data.queue) {
    qBadge.textContent = queue.data.queue.label;
    qBadge.className = 'pill live';
  } else {
    qBadge.textContent = '—';
    qBadge.className = 'pill ghost';
  }

  const isAram = queue.ok && queue.data?.queue?.category === 'ARAM';

  if (clientState === 'IN_GAME') {
    return refreshInGame();
  }
  if (isAram) {
    return refreshAram();
  }
  if (clientState === 'CHAMP_SELECT') {
    return refreshChampSelect();
  }
  $('contextTitle').textContent = 'Contexto';
  $('contextBody').innerHTML =
    '<span class="muted">Sin champ select activo. Entra a una partida para ver recomendaciones o análisis de ARAM.</span>';
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
  if (s.selectedChampionId) {
    lastPickedChampionId = s.selectedChampionId;
    lastPickedRole = s.assignedRole;
  }

  // Sugerencias por rol.
  const rec = await api(`/api/recommendations?role=${s.assignedRole}&limit=5${riotConfigured ? '&personalized=true' : ''}`);
  let recHtml = '<span class="muted">—</span>';
  if (rec.ok) {
    const tmp = document.createElement('div');
    renderRecommendations(tmp, rec.data);
    recHtml = tmp.innerHTML;
  }

  // Runas + summoners del campeón que estás eligiendo.
  let pickHtml = '';
  if (s.selectedChampionId) {
    const head = `${champChip(s.selectedChampionId, 30)} <span class="pill ghost">${s.pickCompleted ? 'confirmado' : 'eligiendo'}</span>`;
    const b = await api(`/api/builds?championId=${s.selectedChampionId}&role=${s.assignedRole}`);
    const body = b.ok
      ? renderRunesSummoners(b.data)
      : '<span class="muted">Sin runas sugeridas para este campeón todavía.</span>';
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

async function refreshInGame() {
  $('contextTitle').textContent = 'En partida';

  // Preferimos la Live Client API (autoritativa, funciona aunque no viéramos el
  // champ select); si no hay partida detectable, caemos al último pick conocido.
  let championId = null;
  let role = lastPickedRole;
  const live = await api('/api/live/champion');
  if (live.ok && live.data && live.data.active && live.data.championId) {
    championId = live.data.championId;
    role = live.data.role && live.data.role !== 'UNKNOWN' ? live.data.role : role;
  } else if (lastPickedChampionId) {
    championId = lastPickedChampionId;
  }

  if (!championId) {
    $('contextBody').innerHTML =
      '<span class="muted">Detectando tu campeón… (si acabas de abrir la app en partida, dame unos segundos)</span>';
    return;
  }

  const b = await api(`/api/builds?championId=${championId}&role=${role || 'UNKNOWN'}`);
  const head = `<div class="pickhead" style="margin-bottom:.5rem">${champChip(championId, 36)}</div>`;
  if (!b.ok) {
    $('contextBody').innerHTML = `${head}<span class="muted">Sin build para este campeón todavía.</span>`;
    return;
  }
  $('contextBody').innerHTML = head + renderBuild(b.data);
}

async function refreshAram() {
  $('contextTitle').textContent = 'ARAM — Análisis de composición';
  const { data } = await api('/api/aram/analysis');
  if (!data || !data.isAram) {
    $('contextBody').innerHTML = '<span class="muted">Detectando sesión de ARAM…</span>';
    return;
  }
  const comp = data.currentComp;
  const balanced = comp.balanced
    ? '<span class="verdict-yes">✓ Equipo equilibrado</span>'
    : '<span class="verdict-no">⚠ Falta algo</span>';
  const missing = (comp.missing || []).map((m) => `<span class="tag bad">${esc(m)}</span>`).join('');
  const strengths = (comp.strengths || []).map((m) => `<span class="tag good">${esc(m)}</span>`).join('');
  const team = (data.team || [])
    .map((c) => `<span class="chip">${champChip(c.championId, 22)}${c.isLocalPlayer ? ' <span class="pill ghost">tú</span>' : ''}</span>`)
    .join(' ');
  const bench = (data.bench || []).map((c) => champChip(c.championId, 22)).join(' ') || '<span class="muted">—</span>';

  let best = '<span class="muted">—</span>';
  if (data.bestOption) {
    const o = data.bestOption;
    best = `${champChip(o.championId, 26)} <span class="score">${o.fitScore}</span> ${(o.fillsGaps || [])
      .map((g) => `<span class="tag good">${esc(g)}</span>`)
      .join('')}`;
  }
  const options = (data.options || [])
    .map((o) => `<li class="recitem"><span>${champChip(o.championId, 24)}</span><span class="score">${o.fitScore}</span></li>`)
    .join('');

  $('contextBody').innerHTML = `
    <div class="summary">${balanced}</div>
    <div class="kv">
      <span class="k">Equipo</span><span class="iconrow">${team}</span>
      <span class="k">Banca</span><span class="iconrow">${bench}</span>
      <span class="k">Mezcla</span><span class="faint">${comp.adCount} AD · ${comp.apCount} AP · frontline ${comp.frontlineCount} · sustain ${comp.sustainCount} · CC ${comp.hardCcCount}</span>
    </div>
    ${missing ? `<div class="block"><div class="label">Le falta</div><div>${missing}</div></div>` : ''}
    ${strengths ? `<div class="block"><div class="label">Fortalezas</div><div>${strengths}</div></div>` : ''}
    <div class="block"><div class="label">Mejor elección de tu banca</div><div class="recitem">${best}</div></div>
    ${options ? `<div class="block"><div class="label">Opciones (tú + banca)</div><ul class="reclist">${options}</ul></div>` : ''}`;
}

// --- Bucle de refresco --------------------------------------------------
async function tick() {
  const status = await refreshStatus();
  await refreshContext(status?.clientState);
}

// Arranque
loadCatalog();
refreshRiotPanels();
tick();
setInterval(tick, 4000);
// Reintenta paneles Riot y el catálogo con menor frecuencia (por si fallaron).
setInterval(() => {
  refreshRiotPanels();
  if (catalogById.size === 0) loadCatalog();
}, 30000);
