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

// --- Estado de cliente y Riot ------------------------------------------
let riotConfigured = false;
let clientConnected = false;

async function refreshStatus() {
  const { data } = await api('/api/client/status');
  const badge = $('clientBadge');
  clientConnected = !!(data && data.connected);
  if (clientConnected) {
    badge.textContent = `Cliente: ${stateEs(data.clientState)}`;
    badge.className = 'badge badge-on';
  } else {
    badge.textContent = 'Cliente: desconectado';
    badge.className = 'badge badge-off';
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
    $('riotBadge').textContent = 'Riot API: no configurada';
    $('riotBadge').className = 'badge badge-off';
    $('profileBody').innerHTML = '<span class="muted">Define RIOT_API_KEY en .env para ver perfil, historial y estadísticas.</span>';
    return;
  }
  riotConfigured = true;
  $('riotBadge').textContent = 'Riot API: activa';
  $('riotBadge').className = 'badge badge-on';

  if (prof.ok && prof.data) {
    const p = prof.data;
    const cached = clientConnected ? '' : ' <span class="badge badge-muted">última sesión</span>';
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
        <td>${esc(c.championName)}</td>
        <td>${c.games}</td>
        <td class="${c.winRate >= 0.5 ? 'win' : 'loss'}">${Math.round(c.winRate * 100)}%</td>
        <td>${c.kda}</td>
      </tr>`,
    )
    .join('');
  $('statsBody').innerHTML = `
    <div class="muted" style="margin-bottom:.5rem">Últimas ${data.totalGames} · <span class="${wr >= 50 ? 'win' : 'loss'}">${wr}% WR</span> (${data.wins}V ${data.losses}D)</div>
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
        <td>${esc(m.championName)}</td>
        <td>${esc(ROLE_ES[m.role] || m.role)}</td>
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
        <span><span class="name">${esc(r.championName)}</span> <span class="reason">${esc(reasonEs(r.reason))}</span></span>
        <span class="score">${r.score}</span>
      </li>`,
    )
    .join('');
  const meta = data.personalized ? ` <span class="badge badge-live">personalizado · ${data.basedOnGames} partidas</span>` : '';
  target.innerHTML = `<div class="muted" style="margin-bottom:.5rem">Rol: ${esc(ROLE_ES[data.role] || data.role)}${meta}</div><ul class="reclist">${items}</ul>`;
}

function reasonEs(r) {
  return { meta_pick: 'meta', comfort_pick: 'cómodo', comfort_pick_plus_meta: 'cómodo + meta' }[r] || r || '';
}

// --- Build --------------------------------------------------------------
function renderBuild(b) {
  const list = (arr) => (arr || []).map((x) => `<span class="tag">${esc(x)}</span>`).join('');
  return `
    <div class="kv"><span class="k">Campeón</span><span>${champChip(b.championId, 22)} · ${esc(ROLE_ES[b.role] || b.role)}</span>
      <span class="k">Hechizos</span><span>${esc((b.summonerSpells || []).join(' + '))}</span>
      <span class="k">Skill order</span><span>${esc((b.skillOrder || []).join(' > '))}</span></div>
    <div class="build-block"><div class="label">Runas</div>
      <div>${esc(b.runes.keystone)} <span class="muted">(${esc(b.runes.primaryStyle)})</span> — ${list(b.runes.primary)} · <span class="muted">${esc(b.runes.secondaryStyle)}</span> ${list(b.runes.secondary)} · ${list(b.runes.shards)}</div></div>
    <div class="build-block"><div class="label">Ítems iniciales</div><div>${list(b.startingItems)}</div></div>
    <div class="build-block"><div class="label">Core</div><div>${list(b.coreItems)}</div></div>
    <div class="build-block"><div class="label">Situacionales</div><div>${list(b.situationalItems)}</div></div>
    ${b.notes ? `<div class="muted" style="margin-top:.5rem">💡 ${esc(b.notes)}</div>` : ''}
    <div class="muted" style="margin-top:.4rem">Fuente: ${esc(b.source)} · ${esc(b.patch)}</div>`;
}

// --- Contexto: cola, champ select, ARAM --------------------------------
async function refreshContext(clientState) {
  const queue = await api('/api/game/queue');
  const qBadge = $('queueBadge');
  if (queue.ok && queue.data && queue.data.active && queue.data.queue) {
    qBadge.textContent = queue.data.queue.label;
    qBadge.className = 'badge badge-live';
  } else {
    qBadge.textContent = '—';
    qBadge.className = 'badge badge-muted';
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
  const list = (arr) => (arr || []).map((x) => `<span class="tag">${esc(x)}</span>`).join(' ');
  return `<div class="kv">
      <span class="k">Hechizos</span><span>${esc((b.summonerSpells || []).join(' + '))}</span>
      <span class="k">Keystone</span><span>${esc(b.runes.keystone)} <span class="muted">(${esc(b.runes.primaryStyle)})</span></span>
    </div>
    <div style="margin-top:.3rem">${list(b.runes.primary)} · <span class="muted">${esc(b.runes.secondaryStyle)}:</span> ${list(b.runes.secondary)} · ${list(b.runes.shards)}</div>
    <div class="muted" style="margin-top:.35rem">Skill: ${esc((b.skillOrder || []).join(' > '))} · fuente: ${esc(b.source)}</div>`;
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
    const head = `${champChip(s.selectedChampionId, 30)} ${s.pickCompleted ? '<span class="pill">confirmado</span>' : '<span class="pill">eligiendo</span>'}`;
    const b = await api(`/api/builds?championId=${s.selectedChampionId}&role=${s.assignedRole}`);
    const body = b.ok
      ? renderRunesSummoners(b.data)
      : '<span class="muted">Sin runas sugeridas para este campeón todavía.</span>';
    pickHtml = `<div class="build-block"><div class="label">Tu campeón · runas y hechizos</div><div class="pickhead">${head}</div>${body}</div>`;
  }

  $('contextBody').innerHTML = `
    <div class="kv">
      <span class="k">Rol</span><span>${esc(ROLE_ES[s.assignedRole] || s.assignedRole)}</span>
      <span class="k">Fase</span><span>${esc(s.phase)}</span>
      <span class="k">Bans</span><span>${(s.bans || []).map((b) => champChip(b, 18)).join(' ') || '—'}</span>
    </div>
    ${pickHtml}
    <div class="build-block"><div class="label">Sugerencias para tu rol</div>${recHtml}</div>`;
}

async function refreshInGame() {
  $('contextTitle').textContent = 'En partida';
  if (!lastPickedChampionId) {
    $('contextBody').innerHTML =
      '<span class="muted">No detecté tu campeón. Entra desde champ select para ver tu build completa aquí.</span>';
    return;
  }
  const b = await api(`/api/builds?championId=${lastPickedChampionId}&role=${lastPickedRole}`);
  const head = `<div class="pickhead" style="margin-bottom:.5rem">${champChip(lastPickedChampionId, 36)}</div>`;
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
    ? '<span class="balanced-yes">✅ Equipo equilibrado</span>'
    : '<span class="balanced-no">⚠️ Falta algo</span>';
  const missing = (comp.missing || []).map((m) => `<span class="tag bad">${esc(m)}</span>`).join('');
  const strengths = (comp.strengths || []).map((m) => `<span class="tag good">${esc(m)}</span>`).join('');
  const team = (data.team || [])
    .map((c) => `<span class="tag${c.isLocalPlayer ? ' good' : ''}">${esc(c.championName)}${c.isLocalPlayer ? ' (tú)' : ''}</span>`)
    .join('');
  const bench = (data.bench || []).map((c) => `<span class="tag">${esc(c.championName)}</span>`).join('') || '<span class="muted">—</span>';

  let best = '<span class="muted">—</span>';
  if (data.bestOption) {
    const o = data.bestOption;
    best = `<span class="name">${esc(o.championName)}</span> <span class="score">${o.fitScore}</span> ${(o.fillsGaps || [])
      .map((g) => `<span class="tag good">${esc(g)}</span>`)
      .join('')}`;
  }
  const options = (data.options || [])
    .map((o) => `<li class="recitem"><span class="name">${esc(o.championName)}</span><span class="score">${o.fitScore}</span></li>`)
    .join('');

  $('contextBody').innerHTML = `
    <div style="margin-bottom:.5rem">${balanced}</div>
    <div class="kv">
      <span class="k">Equipo</span><span>${team}</span>
      <span class="k">Banca</span><span>${bench}</span>
      <span class="k">Mezcla</span><span>${comp.adCount} AD · ${comp.apCount} AP · frontline ${comp.frontlineCount} · sustain ${comp.sustainCount} · CC ${comp.hardCcCount}</span>
    </div>
    ${missing ? `<div class="build-block"><div class="label">Le falta</div><div>${missing}</div></div>` : ''}
    ${strengths ? `<div class="build-block"><div class="label">Fortalezas</div><div>${strengths}</div></div>` : ''}
    <div class="build-block"><div class="label">Mejor elección de tu banca</div><div class="recitem">${best}</div></div>
    ${options ? `<div class="build-block"><div class="label">Opciones (tú + banca)</div><ul class="reclist">${options}</ul></div>` : ''}`;
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
