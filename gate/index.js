/* PlanetOps Front-Door Gate
   ─────────────────────────
   PIN auth + gated static serving + credential-holding proxies.
   Implements the Codex-approved design in /PLAN.md (3 review rounds) exactly.
   Sibling of state-api; same Express+pg patterns.

   Env vars (Railway):
     ENTRY_PIN            team PIN (6-8+ digits or word-code) — NEVER in the repo
     FINANCE_PIN          second PIN for the financials zone
     SESSION_SECRET       HMAC secret for session cookies (rotate = log everyone out)
     DATABASE_URL         shared Postgres (same instance as state-api)
     STATE_API_URL        https://planetops-production.up.railway.app
     STATE_API_KEY        state-api key (server-side ONLY — removed from all pages)
     SS_PROXY_URL         n8n shipstation-proxy webhook
     SHIPSTATION_KEY / SHIPSTATION_SECRET   ShipStation creds (server-side ONLY)
     ALERT_WEBHOOK_URL    n8n webhook that posts to 🚨 System Alerts
     PORT                 (Railway sets)
*/

const express = require('express');
const crypto  = require('crypto');
const path    = require('path');
const fs      = require('fs');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);                       // Railway sits behind a proxy
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
// Anti-clickjacking: our own front door may frame these pages; nobody else can.
app.use((req, res, next) => { res.set('X-Frame-Options', 'SAMEORIGIN'); res.set('X-Content-Type-Options', 'nosniff'); next(); });

const STATIC_ROOT = path.resolve(__dirname, '..');   // serve the repo tree

/* ── Config ─────────────────────────────────────────────────────────────── */
const ENTRY_PIN      = process.env.ENTRY_PIN || '';
const FINANCE_PIN    = process.env.FINANCE_PIN || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';

// Public tier — no session required. Exact prefixes, case-sensitive.
const PUBLIC_PREFIXES = ['/signature/', '/rush/', '/bandana-templates/', '/ship-estimate/'];
const PUBLIC_EXACT    = ['/healthz', '/health-public', '/gate', '/gate/finance'];

// Never served at all (source, planning, secrets-adjacent)
const DENY_PREFIXES = ['/gate/', '/state-api/', '/_planning/', '/.git/', '/node_modules/'];
const DENY_EXACT    = ['/PLAN.md', '/PLAN-REVIEW-LOG.md'];

// Finance zone — requires the second PIN (server-side map; registry labels are display-only)
const FINANCE_PREFIXES = ['/planetiq/'];
const FINANCE_EXACT    = ['/clock/admin.html', '/clock/report.html'];

const FINANCE_IDLE_MIN = 60;   // finance unlock re-prompts after 60 min idle

/* ── Alerts (🚨 System Alerts via n8n) + structured logs ────────────────── */
function logEvent(event, detail) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...detail }));
}
async function alert(event, detail) {
  logEvent(event, detail);
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'frontdoor-gate', event, detail, ts: new Date().toISOString() }),
    });
  } catch (e) { logEvent('alert_send_failed', { error: e.message }); }
}

/* ── Database: sessions table ───────────────────────────────────────────── */
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(`
  CREATE TABLE IF NOT EXISTS gate_sessions (
    sid           TEXT        PRIMARY KEY,
    expires_at    TIMESTAMPTZ NOT NULL,
    finance_until TIMESTAMPTZ,
    created_ip    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`).then(() => console.log('gate_sessions ready'))
  .catch(err => console.error('DB init failed:', err.message));
// housekeeping: purge expired sessions hourly
setInterval(() => pool.query('DELETE FROM gate_sessions WHERE expires_at < NOW()').catch(()=>{}), 3600e3);

/* ── Crypto helpers ─────────────────────────────────────────────────────── */
const hmac = v => crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url');
const timingEq = (a, b) => {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
function signedCookieValue(sid) { return sid + '.' + hmac(sid); }
function parseSignedCookie(raw) {
  if (!raw) return null;
  const i = raw.lastIndexOf('.');
  if (i < 1) return null;
  const sid = raw.slice(0, i), sig = raw.slice(i + 1);
  return timingEq(sig, hmac(sid)) ? sid : null;
}
function readCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

/* End of the current Pacific workday (the locked "type once, in for the day"). */
function endOfPacificDay() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  const h = +parts.find(p => p.type === 'hour').value % 24;
  const m = +parts.find(p => p.type === 'minute').value;
  const minutesLeft = (24 * 60) - (h * 60 + m);
  return new Date(Date.now() + minutesLeft * 60e3);
}

/* ── Brute-force: per-IP limiter + global circuit breaker ───────────────── */
const ipFails = new Map();            // ip -> [timestamps]
let  globalFails = [];                // timestamps
let  lockedUntil = 0;
const IP_MAX = 10, IP_WINDOW = 15 * 60e3;
const GLOBAL_WARN = 30, GLOBAL_MAX = 50, GLOBAL_WINDOW = 60 * 60e3, LOCK_MS = 15 * 60e3;
let warned = false;

function noteFailure(ip) {
  const now = Date.now();
  const arr = (ipFails.get(ip) || []).filter(t => now - t < IP_WINDOW); arr.push(now); ipFails.set(ip, arr);
  globalFails = globalFails.filter(t => now - t < GLOBAL_WINDOW); globalFails.push(now);
  logEvent('failed_pin', { ip, ipCount: arr.length, globalCount: globalFails.length });
  if (globalFails.length === GLOBAL_WARN && !warned) { warned = true; alert('pin_attack_warning', { msg: `${GLOBAL_WARN} failed PIN attempts in the last hour — lockout at ${GLOBAL_MAX}. If this is the team mistyping, no action needed.`, globalCount: globalFails.length }); }
  if (globalFails.length >= GLOBAL_MAX && Date.now() > lockedUntil) {
    lockedUntil = now + LOCK_MS; warned = false;
    alert('gate_lockout', { msg: `Gate LOCKED for 15 minutes after ${GLOBAL_MAX} failed attempts/hour. Existing logged-in sessions still work. Operator reset: redeploy/restart the gate service (Railway), or wait it out. Consider rotating ENTRY_PIN.`, until: new Date(lockedUntil).toISOString() });
  }
}
function checkLimits(ip) {
  const now = Date.now();
  if (now < lockedUntil) return 'locked';
  const arr = (ipFails.get(ip) || []).filter(t => now - t < IP_WINDOW);
  return arr.length >= IP_MAX ? 'ip' : null;
}

/* ── Path guard (Codex-hardened): normalize, reject tricks, containment ─── */
function safePathname(rawUrl) {
  let p;
  try { p = new URL(rawUrl, 'http://x').pathname; } catch { return null; }
  if (/%2f|%5c|%2e%2e|%00/i.test(p)) return null;        // encoded slash/backslash/dotdot/null
  try { p = decodeURIComponent(p); } catch { return null; }
  if (p.includes('\\') || p.includes('\0')) return null;
  if (p.split('/').some(seg => seg === '..' )) return null;
  if (p.split('/').some(seg => seg.startsWith('.') && seg.length > 1)) return null; // dotfiles
  return path.posix.normalize(p);
}
function containedIn(prefixDir, pathname) {
  const full = path.resolve(STATIC_ROOT, '.' + pathname);
  const base = path.resolve(STATIC_ROOT, '.' + prefixDir);
  return full === base || full.startsWith(base + path.sep);
}
const isPublic  = p => PUBLIC_EXACT.includes(p)  || PUBLIC_PREFIXES.some(pre => p.startsWith(pre) && containedIn(pre, p));
const isDenied  = p => DENY_EXACT.includes(p)    || DENY_PREFIXES.some(pre => p.startsWith(pre));
const isFinance = p => FINANCE_EXACT.includes(p) || FINANCE_PREFIXES.some(pre => p.startsWith(pre));

/* ── Login pages (branded, CSRF double-submit) ──────────────────────────── */
const PA_SVG = fs.readFileSync(path.join(STATIC_ROOT, 'frontdoor', 'index.html'), 'utf8').match(/<svg viewBox="-270[^]*?<\/svg>/)?.[0] || '';
function loginPage({ finance, csrf, redirect, msg }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Planet Apparel</title><style>
body{margin:0;background:#111;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{text-align:center;max-width:320px;padding:24px}.card svg{height:52px;width:auto;color:#F7BE00}
h1{margin:14px 0 2px;font-size:24px}p{margin:0 0 16px;color:#9aa4b2;font-size:13px}
input{width:100%;box-sizing:border-box;padding:12px 14px;font-size:20px;text-align:center;letter-spacing:6px;border-radius:10px;border:1px solid #374151;background:#1f2937;color:#fff;outline:none}
input:focus{border-color:#F7BE00}
button{margin-top:12px;width:100%;padding:11px;border-radius:10px;border:0;background:#F7BE00;color:#000;font-weight:800;font-size:14px;cursor:pointer}
.err{margin-top:10px;color:#fca5a5;font-size:12.5px}.note{margin-top:18px;font-size:10.5px;color:#6b7280}
</style></head><body><div class="card">${PA_SVG}
<h1>Planet Apparel</h1><p>${finance ? 'Financials — enter the finance PIN' : 'Enter the team PIN'}</p>
<form method="POST" action="${finance ? '/gate/finance' : '/gate'}">
<input type="password" name="pin" inputmode="numeric" autocomplete="off" maxlength="24" autofocus>
<input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="r" value="${redirect}">
${msg ? `<div class="err">${msg}</div>` : ''}
<button type="submit">Enter</button></form>
<div class="note">${finance ? 'Separate lock on the money zone · re-asks after 60 idle minutes' : 'One PIN, once a day · problems? check /health-public'}</div>
</div></body></html>`;
}
function issueCsrf(res) {
  const t = crypto.randomBytes(16).toString('base64url');
  res.append('Set-Cookie', `pa_csrf=${t}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900`);
  return t;
}
function safeRedirect(r) {
  const p = safePathname(String(r || '/frontdoor/'));
  return (p && !p.startsWith('//')) ? p : '/frontdoor/';
}

/* ── Session lookup middleware ──────────────────────────────────────────── */
const DB_DOWN = Symbol('session-store-unavailable');   // distinct from "not logged in"
async function loadSession(req) {
  const sid = parseSignedCookie(readCookies(req).pa_s);
  if (!sid) return null;
  try {
    const r = await pool.query('SELECT sid, expires_at, finance_until FROM gate_sessions WHERE sid=$1 AND expires_at > NOW()', [sid]);
    return r.rows[0] || null;
  } catch (e) {
    logEvent('session_lookup_failed', { error: e.message });   // DB down ≠ logged out — callers decide
    return DB_DOWN;
  }
}
function hasFinanceUnlock(session) {
  if (!session || session === DB_DOWN) return false;
  const fu = session.finance_until && new Date(session.finance_until).getTime();
  return !!fu && fu > Date.now();
}

/* ── Routes: health ─────────────────────────────────────────────────────── */
app.get('/healthz', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));   // pure liveness — heartbeat target

app.get('/health-public', async (req, res) => {                                            // plain language, never gated
  let db = true; try { await pool.query('SELECT 1'); } catch { db = false; }
  res.set('Cache-Control', 'no-store');
  res.send(`<!DOCTYPE html><meta charset="utf-8"><title>Planet Apparel — status</title>
<body style="font-family:sans-serif;padding:40px;background:#f4f4f5">
<h2>${db ? '🟢 The Planet Apparel app is up.' : '🟠 The app is having trouble — the team has been alerted.'}</h2>
<p>If you can't log in and this page says 🟢, your PIN may have changed — ask Holly.<br>
If it says 🟠, wait a few minutes; the system alerts the 🚨 channel automatically.</p></body>`);
});

app.get('/readyz', async (req, res) => {                                                    // dependency detail — gated
  const s = await loadSession(req);
  if (!s || s === DB_DOWN) return res.status(401).json({ error: 'auth required' });
  const checks = {};
  try { await pool.query('SELECT 1'); checks.db = 'ok'; } catch (e) { checks.db = 'FAIL: ' + e.message; }
  try { const r = await fetch(process.env.STATE_API_URL + '/health', { signal: AbortSignal.timeout(5000) }); checks.stateApi = r.ok ? 'ok' : 'HTTP ' + r.status; } catch (e) { checks.stateApi = 'FAIL: ' + e.message; }
  checks.alertWebhook = process.env.ALERT_WEBHOOK_URL ? 'configured' : 'NOT CONFIGURED';
  const ok = Object.values(checks).every(v => v === 'ok' || v === 'configured');
  res.status(ok ? 200 : 503).json({ ok, checks, ts: new Date().toISOString() });
});

/* ── Routes: the gate ───────────────────────────────────────────────────── */
app.get('/gate', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.send(loginPage({ finance: false, csrf: issueCsrf(res), redirect: safeRedirect(req.query.r), msg: '' }));
});
app.get('/gate/finance', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.send(loginPage({ finance: true, csrf: issueCsrf(res), redirect: safeRedirect(req.query.r), msg: '' }));
});

async function handlePinPost(req, res, { finance }) {
  res.set('Cache-Control', 'no-store');
  const ip = req.ip;
  const redirect = safeRedirect(req.body.r);
  const expectedPin = finance ? FINANCE_PIN : ENTRY_PIN;
  if (!expectedPin || !SESSION_SECRET) { await alert('gate_misconfigured', { msg: 'ENTRY_PIN/FINANCE_PIN/SESSION_SECRET env vars missing' }); return res.status(500).send('Gate misconfigured — env vars missing.'); }

  const limited = checkLimits(ip);
  if (limited) { logEvent('rate_limited', { ip, kind: limited }); return res.status(429).send(loginPage({ finance, csrf: issueCsrf(res), redirect, msg: limited === 'locked' ? 'Too many attempts — the gate is paused ~15 min. Your logged-in teammates are unaffected.' : 'Too many tries from this device — wait 15 minutes.' })); }

  const csrfOk = req.body.csrf && timingEq(req.body.csrf, readCookies(req).pa_csrf || '');
  if (!csrfOk || !timingEq(req.body.pin || '', expectedPin)) {
    noteFailure(ip);
    return res.status(401).send(loginPage({ finance, csrf: issueCsrf(res), redirect, msg: "That's not it — try again." }));
  }

  if (finance) {
    const session = await loadSession(req);
    if (!session || session === DB_DOWN) return res.redirect('/gate?r=' + encodeURIComponent(redirect));
    await pool.query('UPDATE gate_sessions SET finance_until = NOW() + $1::interval WHERE sid=$2', [`${FINANCE_IDLE_MIN} minutes`, session.sid]).catch(e => logEvent('finance_update_failed', { error: e.message }));
    logEvent('finance_unlock', { ip });
    return res.redirect(redirect);
  }

  // entry: fresh sid on every successful login (fixation guard)
  try {
    const sid = crypto.randomBytes(24).toString('base64url');
    const expires = endOfPacificDay();
    await pool.query('INSERT INTO gate_sessions (sid, expires_at, created_ip) VALUES ($1,$2,$3)', [sid, expires, ip]);
    res.append('Set-Cookie', `pa_s=${signedCookieValue(sid)}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}`);
    logEvent('login_ok', { ip });
    return res.redirect(redirect);
  } catch (e) {
    await alert('login_db_error', { msg: 'Correct PIN but the session database is unreachable — logins are failing. RUNBOOK #1.', error: e.message });
    return res.status(503).send(loginPage({ finance, csrf: issueCsrf(res), redirect, msg: 'Right PIN, but the system is having trouble — the team has been alerted. Try again in a few minutes.' }));
  }
}
app.post('/gate',         (req, res) => handlePinPost(req, res, { finance: false }));
app.post('/gate/finance', (req, res) => handlePinPost(req, res, { finance: true }));

/* ── Credential-holding proxies (P0 fixes) — require a team session ─────── */
async function requireSession(req, res) {
  const s = await loadSession(req);
  if (s === DB_DOWN) { res.status(503).json({ error: 'session_store_unavailable' }); return null; }
  if (!s) { res.status(401).json({ error: 'auth required' }); return null; }
  return s;
}
const SS_SECRET_FIELDS = ['shipStationApiKey', 'shipStationApiSecret'];
function scrubState(obj) {                       // creds never round-trip through browsers again
  if (obj && obj.fulfillment) SS_SECRET_FIELDS.forEach(f => { delete obj.fulfillment[f]; });
  return obj;
}
function stateHeaders() { return { 'Content-Type': 'application/json', 'x-api-key': process.env.STATE_API_KEY }; }

app.get(['/api/state', '/api/state/:key'], async (req, res) => {
  if (!await requireSession(req, res)) return;
  try {
    const url = process.env.STATE_API_URL + '/api/state' + (req.params.key ? '/' + encodeURIComponent(req.params.key) : '');
    const r = await fetch(url, { headers: stateHeaders() });
    const data = await r.json();
    res.set('Cache-Control', 'no-store, private').status(r.status).json(scrubState(data));
  } catch (e) { res.status(502).json({ error: 'state-api unreachable: ' + e.message }); }
});
app.post(['/api/state', '/api/state/:key'], async (req, res) => {
  if (!await requireSession(req, res)) return;
  try {
    const url = process.env.STATE_API_URL + '/api/state' + (req.params.key ? '/' + encodeURIComponent(req.params.key) : '');
    const r = await fetch(url, { method: 'POST', headers: stateHeaders(), body: JSON.stringify(scrubState(req.body)) });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(502).json({ error: 'state-api unreachable: ' + e.message }); }
});

/* ── Home summary: the ONE endpoint the front-door home reads ───────────────
   v1 = gate health + state-api probe + registry STALE/WIP notices + finance
   classification. Phase 2 enriches THIS payload server-side (schedule/arrivals/
   goals/live alarms) — the client contract never changes shape. */
let regCache = { mtime: 0, data: null };
function readRegistry() {
  const p = path.join(STATIC_ROOT, 'frontdoor', 'registry.json');
  const mt = fs.statSync(p).mtimeMs;
  if (mt !== regCache.mtime) regCache = { mtime: mt, data: JSON.parse(fs.readFileSync(p, 'utf8')) };
  return regCache.data;
}
function walkNodes(nodes, fn) { for (const n of nodes || []) { fn(n); walkNodes(n.children, fn); } }
function financeIdsFromRegistry(reg) {
  // Authoritative: resolve each node URL relative to /frontdoor/ and apply the
  // gate's own finance route rules. Registry `access` labels are display-only,
  // but we UNION them in — over-redaction is fail-safe, the reverse leaks.
  const ids = new Set();
  walkNodes(reg.tree, n => {
    if (n.access === 'pin') ids.add(n.id);
    if (n.kind === 'surface' && n.url) {
      try { if (isFinance(new URL(n.url, 'https://gate.local/frontdoor/').pathname)) ids.add(n.id); } catch { /* unparseable → skip */ }
    }
  });
  return [...ids];
}
app.get('/api/home/summary', async (req, res) => {
  res.set('Cache-Control', 'no-store, private');
  res.set('Vary', 'Cookie');
  const session = await requireSession(req, res);
  if (!session) return;                                  // 401/503 already sent (headers above apply to those too)

  const health = { gate: 'ok', stateApi: 'skipped' };
  if (process.env.STATE_API_URL) {
    try {
      const r = await fetch(new URL('/health', process.env.STATE_API_URL), { signal: AbortSignal.timeout(2000) });
      health.stateApi = r.ok ? 'ok' : 'down';
    } catch { health.stateApi = 'down'; }
  }

  const financeUnlocked = hasFinanceUnlock(session);
  let flags = [], financeSurfaceIds = [];
  try {
    const reg = readRegistry();
    financeSurfaceIds = financeIdsFromRegistry(reg);
    const finSet = new Set(financeSurfaceIds);
    walkNodes(reg.tree, n => {
      if (n.kind !== 'surface') return;
      if (finSet.has(n.id) && !financeUnlocked) return; // redact: no finance names/labels for entry-only sessions
      if (n.status === 'stale') flags.push({ tier: 'amber', label: `${n.name} — data is stale`, surfaceId: n.id });
      else if (n.status === 'wip') flags.push({ tier: 'info', label: `${n.name} — work in progress`, surfaceId: n.id });
    });
  } catch (e) { logEvent('home_summary_registry_failed', { error: e.message }); }
  if (health.stateApi === 'down') flags.unshift({ tier: 'red', label: 'The app’s data service (state-api) is unreachable — the board and schedule may not load', surfaceId: 'floor-board' });

  res.json({ health, flags, financeUnlocked, financeSurfaceIds });
});

app.post('/api/shipstation/sync', async (req, res) => {
  if (!await requireSession(req, res)) return;
  const key = process.env.SHIPSTATION_KEY, secret = process.env.SHIPSTATION_SECRET;
  if (!key || !secret) return res.status(500).json({ error: 'ShipStation creds not configured on the gate (Railway env vars)' });
  try {
    const r = await fetch(process.env.SS_PROXY_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key, apiSecret: secret, orderStatus: req.body.orderStatus || 'awaiting_shipment' }),
    });
    res.set('Cache-Control', 'no-store, private').status(r.status).json(await r.json());
  } catch (e) { res.status(502).json({ error: 'shipstation proxy unreachable: ' + e.message }); }
});

/* ── Auth middleware BEFORE static — every non-public path needs a session ─ */
app.use(async (req, res, next) => {
  const p = safePathname(req.originalUrl);
  if (!p) { logEvent('denied_path', { raw: req.originalUrl, ip: req.ip }); return res.status(400).send('Bad path'); }
  if (isDenied(p)) { logEvent('denied_path', { path: p, ip: req.ip }); return res.status(404).send('Not found'); }

  if (isPublic(p)) {
    res.set('Cache-Control', p.startsWith('/signature/') ? 'public, max-age=86400' : 'public, max-age=300');
    return next();
  }

  const session = await loadSession(req);
  if (!session || session === DB_DOWN) {           // DB down: can't verify → same as logged out for pages (login POST shows the trouble message)
    if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) return res.redirect('/gate?r=' + encodeURIComponent(p));
    return res.status(401).send('auth required');
  }

  if (isFinance(p)) {
    if (!hasFinanceUnlock(session)) {
      if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) return res.redirect('/gate/finance?r=' + encodeURIComponent(p));
      return res.status(403).send('finance unlock required');
    }
    pool.query('UPDATE gate_sessions SET finance_until = NOW() + $1::interval WHERE sid=$2', [`${FINANCE_IDLE_MIN} minutes`, session.sid]).catch(()=>{}); // idle refresh
  }

  res.set('Cache-Control', 'no-store, private');
  res.set('Vary', 'Cookie');
  next();
});

/* static AFTER the middleware above (headers already set per tier) */
app.use(express.static(STATIC_ROOT, { dotfiles: 'deny', index: 'index.html', redirect: true, setHeaders(res, filePath) { /* headers set upstream */ } }));

app.use((req, res) => res.status(404).send('Not found'));

app.listen(PORT, () => console.log(`frontdoor-gate listening on ${PORT} · static root ${STATIC_ROOT}`));
