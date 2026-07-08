/* Planet Apparel — Front Door shell.
   Everything renders from registry.json — no content lives in this file.
   AUTH IS SERVER-SIDE: the frontdoor-gate service (gate/index.js, Codex-reviewed)
   challenges for the PIN before this page is served. No client gate here. */

const ENUMS = {
  kind: ['hub', 'surface'],
  group: ['hubs', 'library'],
  type: ['live-app', 'dashboard', 'system-map', 'tool', 'report', 'reference', 'training'],
  status: ['live', 'stale', 'wip', 'planned'],
  access: ['open', 'pin']
};
const BADGE = { live: 'LIVE', stale: 'STALE', wip: 'WIP', planned: 'PLANNED' };
const PINS_KEY = 'frontdoor.pins';

/* Registry URLs may only be same-origin paths or approved external domains —
   a bad registry edit must never send the team to a lookalike site. */
const APPROVED_EXTERNAL = ['https://docs.google.com/'];
function isAllowedUrl(u) {
  if (!u) return false;
  if (/^(\.\.?\/|\/(?!\/))/.test(u)) return true;                       // relative or root-relative, not //
  return APPROVED_EXTERNAL.some(pre => u.startsWith(pre));
}
function openUrl(u) {
  if (isAllowedUrl(u)) window.open(u, '_blank');
  else alert('Blocked: this registry URL is not on the approved list:\n' + u);
}

/* ── Branded circular icons (QuickBooks-style: bright glyph in a dark Ø circle) ──
   Marquee hubs + the Floor App get hand-built flat SVG glyphs; every other surface
   keeps its distinct emoji, rendered inside the same dark circle. */
const GLYPHS = {
  planetops:     '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3.5" fill="#F7BE00"/><circle cx="12" cy="12" r="3.2" fill="#232323"/></svg>',
  'revenue-house':'<svg viewBox="0 0 24 24"><path d="M12 4.5 20 14h-4.6v5.5H8.6V14H4z" fill="#10b981"/></svg>',
  planetiq:      '<svg viewBox="0 0 24 24"><rect x="4.5" y="12" width="3.6" height="7" rx="1" fill="#38bdf8"/><rect x="10.2" y="8" width="3.6" height="11" rx="1" fill="#38bdf8"/><rect x="15.9" y="5" width="3.6" height="14" rx="1" fill="#38bdf8"/></svg>',
  systems:       '<svg viewBox="0 0 24 24"><circle cx="9.5" cy="12" r="4.3" fill="none" stroke="#a78bfa" stroke-width="2.6"/><circle cx="14.5" cy="12" r="4.3" fill="none" stroke="#a78bfa" stroke-width="2.6"/></svg>',
  training:      '<svg viewBox="0 0 24 24"><path d="M12 5.5 21 10l-9 4.5L3 10z" fill="#2dd4bf"/><path d="M17 12v3.2c0 1.8-2.2 3.3-5 3.3s-5-1.5-5-3.3V12" fill="none" stroke="#2dd4bf" stroke-width="2"/></svg>',
  references:    '<svg viewBox="0 0 24 24"><path d="M12 6.5C10.3 5.6 6.7 5.6 5 6.3V18c1.7-.7 5.3-.7 7 .2z" fill="#fbbf24"/><path d="M12 6.5c1.7-.9 5.3-.9 7-.2V18c-1.7-.7-5.3-.7-7 .2z" fill="#fbbf24" opacity=".65"/></svg>',
  'time-labor':  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="#22d3ee" stroke-width="2.4"/><path d="M12 8.2V12l3 2" fill="none" stroke="#22d3ee" stroke-width="2.4" stroke-linecap="round"/></svg>',
  growth:        '<svg viewBox="0 0 24 24"><path d="M12 19v-7.5" stroke="#34d399" stroke-width="2.4" stroke-linecap="round"/><path d="M12 12.5C8 12.5 6.5 8 6.5 8c4 0 5.5 4.5 5.5 4.5z" fill="#34d399"/><path d="M12 13.5c3.5 0 4.8-3.2 4.8-3.2-3.6 0-4.8 3.2-4.8 3.2z" fill="#34d399" opacity=".8"/></svg>',
  brain:         '<svg viewBox="0 0 24 24"><path d="M8 9.5 16 9.5 12 16.5z" fill="none" stroke="#f472b6" stroke-width="1.6"/><circle cx="8" cy="9.5" r="2.1" fill="#f472b6"/><circle cx="16" cy="9.5" r="2.1" fill="#f472b6"/><circle cx="12" cy="16.5" r="2.1" fill="#f472b6"/></svg>',
  decisions:     '<svg viewBox="0 0 24 24"><path d="M12 5.5v6M12 11.5l-5 5M12 11.5l5 5" fill="none" stroke="#cbd5e1" stroke-width="2.4" stroke-linecap="round"/></svg>',
  floor:         '<svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="4" height="13" rx="1.4" fill="#F7BE00"/><rect x="10" y="5.5" width="4" height="8.5" rx="1.4" fill="#F7BE00"/><rect x="16" y="5.5" width="4" height="10.5" rx="1.4" fill="#F7BE00"/></svg>'
};
function iconInner(node) {
  if (GLYPHS[node.id]) return GLYPHS[node.id];
  return `<span class="bEmoji">${esc(node.icon || (node.kind === 'hub' ? '🗂️' : '📄'))}</span>`;
}
function badge(node, size) { return `<span class="iconBadge ib-${size}">${iconInner(node)}</span>`; }

let REG = null;          // the registry
let BYID = new Map();    // id -> node
let PARENT = new Map();  // id -> parent node (null for roots)

const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const esc = s => (s == null ? '' : String(s)).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));

/* ── validation: fail loudly, never render half an app ── */
function validate(reg) {
  const errs = [];
  if (!reg || typeof reg !== 'object') return ['registry.json is not an object'];
  if (!reg.app || !reg.app.name) errs.push('app.name missing');
  if (!Array.isArray(reg.tree)) return errs.concat('tree is not an array');
  const seen = new Set();
  const walk = (node, path, depth) => {
    const where = path + '/' + (node.id || '?');
    if (!node.id) errs.push(`node at ${where}: missing id`);
    else if (seen.has(node.id)) errs.push(`duplicate id "${node.id}"`);
    else seen.add(node.id);
    if (!ENUMS.kind.includes(node.kind)) errs.push(`"${node.id}": bad kind "${node.kind}"`);
    if (!node.name) errs.push(`"${node.id}": missing name`);
    if (depth === 0 && !ENUMS.group.includes(node.group)) errs.push(`"${node.id}": top-level node needs group hubs|library`);
    if (node.kind === 'hub') {
      if (!Array.isArray(node.children)) errs.push(`hub "${node.id}": children must be an array`);
      else node.children.forEach(c => walk(c, where, depth + 1));
    } else {
      if (node.type && !ENUMS.type.includes(node.type)) errs.push(`"${node.id}": bad type "${node.type}"`);
      if (node.status && !ENUMS.status.includes(node.status)) errs.push(`"${node.id}": bad status "${node.status}"`);
      if (node.access && !ENUMS.access.includes(node.access)) errs.push(`"${node.id}": bad access "${node.access}"`);
    }
  };
  reg.tree.forEach(n => walk(n, '', 0));
  return errs;
}

function index(reg) {
  BYID.clear(); PARENT.clear();
  const walk = (node, parent) => {
    BYID.set(node.id, node); PARENT.set(node.id, parent);
    (node.children || []).forEach(c => walk(c, node));
  };
  reg.tree.forEach(n => walk(n, null));
}

/* ── pins ── */
const getPins = () => { try { return JSON.parse(localStorage.getItem(PINS_KEY)) || []; } catch { return []; } };
const setPins = p => localStorage.setItem(PINS_KEY, JSON.stringify(p));
function togglePin(id) {
  const pins = getPins();
  const i = pins.indexOf(id);
  i >= 0 ? pins.splice(i, 1) : pins.push(id);
  setPins(pins); renderPinned(); renderPane();
}
function renderPinned() {
  const wrap = document.getElementById('pinnedChips');
  wrap.innerHTML = '';
  getPins().map(id => BYID.get(id)).filter(Boolean).forEach(node => {
    const c = el('span', 'chip', badge(node, 'xs') + esc(node.name));
    c.onclick = () => openNode(node);
    wrap.appendChild(c);
  });
}

/* ── navigation (hash routing: #/planetops/time-labor) ── */
function pathOf(node) {
  const ids = [];
  let n = node;
  while (n) { ids.unshift(n.id); n = PARENT.get(n.id); }
  return ids;
}
function navTo(node) { location.hash = '#/' + pathOf(node).join('/'); }
const isExternal = u => APPROVED_EXTERNAL.some(pre => u && u.startsWith(pre));
/* The node the hash points at — hub OR surface. Falls back to the first hub. */
function currentNode() {
  const ids = (location.hash || '').replace(/^#\//, '').split('/').filter(Boolean);
  let node = null;
  for (const id of ids) { const n = BYID.get(id); if (n) node = n; }
  return node || REG.tree.find(n => n.kind === 'hub') || null;
}
function railHubFor(node) {                 // which top-level hub to highlight in the rail
  let t = node; while (t && PARENT.get(t.id)) t = PARENT.get(t.id); return t;
}
function openNode(node) {
  if (node.kind === 'hub') { navTo(node); return; }
  if (!node.url) { navTo(PARENT.get(node.id) || REG.tree[0]); return; }
  if (isExternal(node.url)) { openUrl(node.url); return; }   // Google Sheets etc. → new tab
  navTo(node);                                               // internal → embed in the pane
}

/* ── rail ── */
function renderRail() {
  const rail = document.getElementById('rail');
  rail.innerHTML = '';
  const cur = currentNode();
  const activeTop = cur ? railHubFor(cur) : null;
  [['hubs', 'Hubs'], ['library', 'Library']].forEach(([g, label]) => {
    rail.appendChild(el('div', 'railGroup', esc(label)));
    REG.tree.filter(n => n.group === g).forEach(node => {
      const item = el('div', 'railItem' + (activeTop && activeTop.id === node.id ? ' active' : ''),
        `${badge(node, 'sm')}<span class="riName">${esc(node.name)}</span>`);
      item.onclick = () => navTo(node);
      rail.appendChild(item);
    });
  });
}

/* ── main pane ── */
function renderCrumbs(node) {
  const c = document.getElementById('crumbs');
  c.innerHTML = '';
  const chain = pathOf(node).map(id => BYID.get(id));
  chain.forEach((n, i) => {
    if (i) c.appendChild(el('span', 'sep', '›'));
    if (i === chain.length - 1) c.appendChild(el('span', 'here', esc(n.name)));
    else { const a = el('a', '', esc(n.name)); a.onclick = () => navTo(n); c.appendChild(a); }
  });
}
function tileFor(node) {
  const pins = getPins();
  const isHub = node.kind === 'hub';
  const t = el('div', 'tile' + (isHub || node.url ? ' clickable' : ''));
  const statusBadge = !isHub && node.status ? ` <span class="badge ${esc(node.status)}">${esc(BADGE[node.status])}</span>` : '';
  const lock = node.access === 'pin' ? ' <span class="lock" title="Financials — needs the finance PIN">🔒</span>' : '';
  const ext = !isHub && isExternal(node.url) ? ' <span class="ext" title="Opens in a new tab">↗</span>' : '';
  const typeTag = !isHub && node.type ? ` <span class="typeTag">${esc(node.type)}</span>` : '';
  t.innerHTML =
    `<h3>${badge(node, 'lg')}` +
    `<span class="tName">${esc(node.name)}</span>${statusBadge}${lock}${ext}${typeTag}</h3>` +
    (node.blurb ? `<p>${esc(node.blurb)}</p>` : '') +
    (node.dataSource ? `<div class="meta">⛁ ${esc(node.dataSource)}</div>` : '') +
    (isHub ? `<div class="meta">${(node.children || []).length} inside →</div>` : '') +
    (node.note ? `<div class="note">${esc(node.note)}</div>` : '');
  const pin = el('button', 'pinBtn' + (pins.includes(node.id) ? ' pinned' : ''), '📌');
  pin.title = pins.includes(node.id) ? 'Unpin' : 'Pin to top bar';
  pin.onclick = e => { e.stopPropagation(); togglePin(node.id); };
  t.appendChild(pin);
  t.onclick = () => openNode(node);
  return t;
}
function renderPane() {
  const node = currentNode();
  if (!node) return;
  renderCrumbs(node);
  const pane = document.getElementById('pane');
  pane.innerHTML = '';

  /* Surface with an embeddable URL → load it right here in the pane. */
  if (node.kind === 'surface' && node.url && !isExternal(node.url)) {
    document.body.classList.add('embedding');
    const bar = el('div', 'surfBar');
    bar.innerHTML =
      `<button class="surfBack" title="Back to ${esc(PARENT.get(node.id)?.name || 'hub')}">‹ Back</button>` +
      `<span class="surfTitle">${badge(node, 'sm')}${esc(node.name)}</span>` +
      `<button class="surfFull" title="Open full screen in a new tab">⤢ Full screen</button>`;
    bar.querySelector('.surfBack').onclick = () => navTo(PARENT.get(node.id) || REG.tree[0]);
    bar.querySelector('.surfFull').onclick = () => openUrl(node.url);
    const frame = el('iframe', 'surfFrame');
    frame.src = node.url; frame.title = node.name;
    frame.setAttribute('loading', 'eager');
    pane.appendChild(bar); pane.appendChild(frame);
    return;
  }

  document.body.classList.remove('embedding');
  const hub = node.kind === 'hub' ? node : (PARENT.get(node.id) || REG.tree[0]);
  if (node.kind !== 'hub') { navTo(hub); return; }   // surface w/o embeddable url → show its hub
  pane.appendChild(el('h2', 'hubHead', `${badge(hub, 'lg')}<span>${esc(hub.name)}</span>`));
  if (hub.blurb) pane.appendChild(el('p', 'hubBlurb', esc(hub.blurb)));
  const kids = hub.children || [];
  if (!kids.length) { pane.appendChild(el('div', 'emptyHub', 'Nothing here yet.')); return; }

  if (kids.length <= 8) {                                 // small hub: one flat grid
    const grid = el('div', 'tiles');
    kids.forEach(k => grid.appendChild(tileFor(k)));
    pane.appendChild(grid);
    return;
  }

  /* Big hub: group tiles under small type headers so long lists stay scannable. */
  const TYPE_ORDER = ['hub', 'live-app', 'dashboard', 'system-map', 'tool', 'report', 'reference', 'training'];
  const TYPE_LABEL = { hub: 'Sections', 'live-app': 'Apps', dashboard: 'Dashboards', 'system-map': 'System Maps', tool: 'Tools', report: 'Reports', reference: 'Guides & References', training: 'Training' };
  const groups = new Map();
  kids.forEach(k => {
    const key = k.kind === 'hub' ? 'hub' : (k.type || 'reference');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(k);
  });
  TYPE_ORDER.filter(t => groups.has(t)).forEach(t => {
    pane.appendChild(el('div', 'groupHead', esc(TYPE_LABEL[t] || t)));
    const grid = el('div', 'tiles');
    groups.get(t).forEach(k => grid.appendChild(tileFor(k)));
    pane.appendChild(grid);
  });
}

/* ── search (index-only in v1; invoice/document search = Phase 2) ── */
function setupSearch() {
  const input = document.getElementById('search');
  const box = document.getElementById('searchResults');
  let results = [], sel = -1;
  const close = () => { box.hidden = true; sel = -1; };
  const run = q => {
    q = q.trim().toLowerCase();
    if (!q) { close(); return; }
    results = [...BYID.values()].filter(n =>
      n.name.toLowerCase().includes(q) || (n.blurb || '').toLowerCase().includes(q)).slice(0, 12);
    box.innerHTML = '';
    if (!results.length) { box.innerHTML = '<div class="sr">No matches</div>'; box.hidden = false; return; }
    results.forEach((n, i) => {
      const chain = pathOf(n).slice(0, -1).map(id => BYID.get(id).name).join(' › ');
      const r = el('div', 'sr', badge(n, 'xs') +
        `<span>${esc(n.name)}</span><span class="path">${esc(chain)}</span>`);
      r.onmousedown = e => { e.preventDefault(); openNode(n); close(); input.blur(); };
      r.dataset.i = i;
      box.appendChild(r);
    });
    box.hidden = false;
  };
  input.addEventListener('input', () => run(input.value));
  input.addEventListener('keydown', e => {
    const items = [...box.querySelectorAll('.sr')];
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); }
    else if (e.key === 'Enter') { const n = results[sel >= 0 ? sel : 0]; if (n) { openNode(n); close(); input.blur(); } return; }
    else if (e.key === 'Escape') { close(); input.blur(); return; }
    else return;
    e.preventDefault();
    items.forEach((it, i) => it.classList.toggle('sel', i === sel));
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
}

/* ── collapsible rail (Holly's "hover to the left" idea) ── */
const RAIL_KEY = 'frontdoor.rail';
function applyRailState() {
  document.body.classList.toggle('rail-collapsed', localStorage.getItem(RAIL_KEY) === 'collapsed');
}
function setupRail() {
  applyRailState();
  document.getElementById('railToggle').onclick = () => {
    const collapsed = localStorage.getItem(RAIL_KEY) === 'collapsed';
    localStorage.setItem(RAIL_KEY, collapsed ? 'open' : 'collapsed');
    applyRailState();
  };
}

/* ── boot ── */
function boot() {
  document.getElementById('brandName').textContent = REG.app.name;
  document.getElementById('foot').innerHTML =
    `Planet Apparel · the front door · updated ${esc(REG.app.updated)} · everything renders from <code>registry.json</code> — edit it to add a hub or surface`;
  setupRail(); renderRail(); renderPane(); renderPinned(); setupSearch();
  window.addEventListener('hashchange', () => { renderRail(); renderPane(); });
}

async function main() {
  const tpl = document.getElementById('paLogo');
  document.getElementById('brandLogo').appendChild(tpl.content.cloneNode(true));

  let reg;
  try {
    const r = await fetch('./registry.json?_=' + Math.floor(Date.now() / 60000));
    reg = await r.json();
  } catch (e) {
    showRegError(['could not load/parse registry.json — ' + esc(e.message),
      'Open via a server (the gate or python3 -m http.server), not file://']);
    return;
  }
  const errs = validate(reg);
  if (errs.length) { showRegError(errs); return; }
  REG = reg; index(reg);
  document.getElementById('app').hidden = false;
  boot();
}
function showRegError(errs) {
  document.getElementById('app').hidden = false;
  const b = document.getElementById('regError');
  b.hidden = false;
  b.innerHTML = `<b>registry.json failed validation — fix it before this page will render:</b><br>` +
    errs.slice(0, 10).map(e => '• ' + e).join('<br>') + (errs.length > 10 ? `<br>…and ${errs.length - 10} more` : '');
}

main();
