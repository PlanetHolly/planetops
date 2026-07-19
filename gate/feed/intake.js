/* Feed Router — Build #3: intake endpoint (PLAN-FEED-ROUTER.md Step 3 ONLY).
   Stores an uploaded document durably + safely. Nothing is processed here —
   worker/extraction/routing/outbox/UI are later increments.

   Decisions honored (architect override of plan §D4):
   - base64-in-JSON upload (the app's existing pattern) — NO multipart, NO busboy,
     NO file-type, NO pdf-lib. Node built-ins + express + pg only.
   - Money-route hardening mirrored from gate/index.js requireShipdeckPost:
     sameOrigin + per-session CSRF (namespaced ':feed') + alerts on violations.
   - Raw bytes AES-256-GCM-encrypted at rest (FEED_RAW_KEY env, 32 bytes as
     base64 or hex). NO endpoint anywhere returns raw bytes to a browser.
   - Idempotent on content_hash (sha256 of the raw bytes).

   Env:
     FEED_RAW_KEY   32-byte key, base64 or hex. Missing/invalid → 500 on intake.
*/

const express = require('express');
const crypto  = require('crypto');

/* ── Limits & categories ────────────────────────────────────────────────── */
const MAX_RAW_BYTES = 25 * 1024 * 1024;   // decoded document cap
const MAX_FILENAME  = 256;
const MAX_NOTE      = 2000;
const MAX_SUBMITTER = 200;

const CATEGORIES = ['inbound_order', 'purchase_order', 'analytics_report', 'period_expense', 'expense', 'payroll', 'financials', 'other'];
const FINANCE_CATEGORIES = ['payroll', 'financials'];   // require the finance unlock (plan §Resolved R2 #3)

/* Declared mime → sniff class. Anything not in this map is rejected. */
const MIME_TO_TYPE = {
  'application/pdf': 'pdf',
  'image/png':       'png',
  'image/jpeg':      'jpeg',
  'image/jpg':       'jpeg',
  'text/csv':        'text',
  'text/plain':      'text',
};
const CANONICAL_MIME = { pdf: 'application/pdf', png: 'image/png', jpeg: 'image/jpeg' };

/* ── FEED_RAW_KEY (32 bytes, base64 or hex) ─────────────────────────────── */
function feedRawKey() {
  const v = process.env.FEED_RAW_KEY || '';
  if (!v) return null;
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, 'hex');
  if (/^[A-Za-z0-9+/=_-]+$/.test(v)) {
    const b = Buffer.from(v, 'base64');
    if (b.length === 32) return b;
  }
  return null;
}

/* ── Pure functions (exported below for intake_selftest.js) ─────────────── */

/* Magic-byte sniff — true type from bytes, no deps. Returns
   'pdf' | 'png' | 'jpeg' | 'text' | null (unrecognized/binary-unknown). */
function sniffType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return null;
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'pdf';   // %PDF
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.includes(0)) return null;                       // NUL byte → not text, not a known binary
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return 'text'; } catch { return null; }
}

/* PDF safety guard — conservative substring scans on the raw bytes (accepted
   and intended per spec; pdf-lib deliberately NOT added). Returns an error
   string to reject with, or null if the PDF passes. */
function pdfGuard(buf) {
  const s = buf.toString('latin1');
  if (s.includes('/Encrypt')) return 'encrypted PDFs are not accepted';
  if (s.includes('/JavaScript') || s.includes('/JS') || s.includes('/OpenAction')) return 'PDFs with embedded scripts are not accepted';
  let pages = (s.match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length;   // /Type/Page and /Type /Page, not /Pages
  for (const m of s.matchAll(/\/Count\s+(\d+)/g)) pages = Math.max(pages, parseInt(m[1], 10));
  const hasObjectStreams = /\/ObjStm\b/.test(s) || (/\/Type\s*\/XRef\b/.test(s) && /\/Filter\b/.test(s));
  if (hasObjectStreams && pages === 0) return 'PDF page count indeterminate due to compressed object streams';
  if (pages > 40) return 'PDF too long';
  return null;
}

/* AES-256-GCM: enc_raw = iv(12) ‖ authTag(16) ‖ ciphertext */
function encryptRaw(key, buf) {
  const iv = crypto.randomBytes(12);
  const c  = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}
/* Decrypt counterpart — used by the WORKER (later increment) and the selftest.
   NOT wired to any endpoint: no route ever returns raw bytes to a browser. */
function decryptRaw(key, enc) {
  const iv = enc.subarray(0, 12), tag = enc.subarray(12, 28), ct = enc.subarray(28);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

/* ── Intake rate limit — self-contained; MUST NOT touch the gate's login
      brute-force lockout (checkLimits/noteFailure). A burst of uploads can
      never lock the whole app. ─────────────────────────────────────────── */
const IP_MAX = 20,  IP_WINDOW = 5 * 60e3;       // 20 uploads / 5 min per IP
const GLOBAL_MAX = 200, GLOBAL_WINDOW = 60 * 60e3;   // 200 / hour global
const ipHits = new Map();                        // ip -> [timestamps]
let globalHits = [];
function intakeLimited(ip) {
  const now = Date.now();
  globalHits = globalHits.filter(t => now - t < GLOBAL_WINDOW);
  const arr = (ipHits.get(ip) || []).filter(t => now - t < IP_WINDOW);
  if (arr.length >= IP_MAX || globalHits.length >= GLOBAL_MAX) { ipHits.set(ip, arr); return true; }
  arr.push(now); ipHits.set(ip, arr); globalHits.push(now);
  return false;
}
// housekeeping: drop stale per-IP entries (unref so requiring this module never holds node open)
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of ipHits) {
    const live = arr.filter(t => now - t < IP_WINDOW);
    if (live.length) ipHits.set(ip, live); else ipHits.delete(ip);
  }
}, 10 * 60e3).unref();

/* ── Router factory (same mount style as gate/graphics.js) ──────────────── */
module.exports = function feedIntakeRouter(pool, requireSession, helpers) {
  const router = express.Router();
  const csrfForFeed = sid => helpers.hmac(sid + ':feed');   // namespaced sibling of Ship Deck's csrfFor

  /* GET /api/feed/session — the ONLY place the feed CSRF token is handed out.
     A cross-origin attacker cannot read this response, so they can never
     obtain the token. */
  router.get('/api/feed/session', async (req, res) => {
    const s = await requireSession(req, res);
    if (!s) return;
    res.set('Cache-Control', 'no-store, private').set('Vary', 'Cookie');
    res.json({
      csrf: csrfForFeed(s.sid),
      limits: { maxBytes: MAX_RAW_BYTES, allowedCategories: CATEGORIES, financeCategories: FINANCE_CATEGORIES },
    });
  });

  /* POST /api/feed/intake — mirrors requireShipdeckPost hardening, in order:
     session → sameOrigin → CSRF → intake rate limit → body parser → config guard → validate
     → sniff → PDF guard → hash → encrypt → idempotent INSERT. */
  async function preBodyIntakeGuard(req, res, next) {
    try {
      const s = await requireSession(req, res);            // 401/503 already sent on failure
      if (!s) return;
      res.set('Cache-Control', 'no-store, private');

      if (!helpers.sameOrigin(req)) {
        await helpers.alert('feed_bad_origin', { msg: 'Feed intake was called with a foreign/absent Origin — a valid session cookie was presented. Investigate.', ip: req.ip, origin: req.headers.origin || null });
        return res.status(403).json({ error: 'bad origin' });
      }
      if (!helpers.timingEq(String(req.headers['x-csrf-token'] || ''), csrfForFeed(s.sid))) {
        await helpers.alert('feed_bad_csrf', { msg: 'Feed intake was called without a valid per-session CSRF token.', ip: req.ip });
        return res.status(403).json({ error: 'bad csrf token' });
      }
      if (intakeLimited(req.ip)) return res.status(429).json({ error: 'too many uploads, slow down' });
      req.feedSession = s;
      next();
    } catch (e) {
      await helpers.alert('feed_intake_error', { msg: 'Unexpected error before feed intake body parsing.', ip: req.ip, error: e.message });
      if (!res.headersSent) res.status(500).json({ error: 'intake failed' });
    }
  }

  router.post('/api/feed/intake', preBodyIntakeGuard, express.json({ limit: '35mb' }), async (req, res) => {
    try {
      const s = req.feedSession;
      if (!s) return res.status(401).json({ error: 'auth required' });

      const key = feedRawKey();
      if (!key) return res.status(500).json({ error: 'feed intake not configured (FEED_RAW_KEY)' });

      /* body: { filename, mime, category, note, submitter_name, data } */
      const body = req.body || {};
      const category = String(body.category || '');
      if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'unknown category' });
      if (typeof body.submitter_name !== 'string' || !body.submitter_name.trim()) {
        return res.status(400).json({ error: 'submitter_name required' });
      }
      const submitterName = body.submitter_name.trim().slice(0, MAX_SUBMITTER);   // UNTRUSTED display only — never auth
      const filename = String(body.filename || '').slice(0, MAX_FILENAME);
      const note     = String(body.note || '').slice(0, MAX_NOTE);

      /* FINANCE GATE: payroll/financials need a live finance unlock on the session. */
      if (FINANCE_CATEGORIES.includes(category)) {
        let sess = s;
        if (!sess || typeof sess !== 'object' || !('finance_until' in sess)) sess = await helpers.loadSession(req);
        const fu = sess && typeof sess === 'object' && sess.finance_until && new Date(sess.finance_until).getTime();
        if (!fu || fu <= Date.now()) {
          return res.status(403).json({ error: 'finance PIN required for payroll/financials', need: 'finance' });
        }
      }

      /* data URL → bytes */
      const m = String(body.data || '').match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return res.status(400).json({ error: 'data must be a base64 data URL' });
      const buf = Buffer.from(m[2], 'base64');
      if (!buf.length) return res.status(400).json({ error: 'empty file' });
      if (buf.length > MAX_RAW_BYTES) return res.status(413).json({ error: 'file too large (25MB max)' });

      /* magic-byte sniff must agree with the declared mime */
      const sniffed = sniffType(buf);
      const declaredMime = String(body.mime || m[1]).toLowerCase().trim();
      const dataUrlMime  = m[1].toLowerCase().trim();
      const mismatch =
        !sniffed ||
        MIME_TO_TYPE[declaredMime] !== sniffed ||
        (MIME_TO_TYPE[dataUrlMime] !== undefined && MIME_TO_TYPE[dataUrlMime] !== sniffed);
      if (mismatch) return res.status(400).json({ error: 'file type not recognized or does not match declared type' });

      if (sniffed === 'pdf') {
        const bad = pdfGuard(buf);
        if (bad) return res.status(400).json({ error: bad });
      }

      /* store: sniffed canonical mime (declared csv/plain kept for text — the sniff cannot tell them apart) */
      const storedMime = CANONICAL_MIME[sniffed] || declaredMime;
      const contentHash = crypto.createHash('sha256').update(buf).digest('hex');
      const encRaw = encryptRaw(key, buf);

      /* idempotent on content_hash — never a double-store */
      const ins = await pool.query(
        `INSERT INTO feed_intake (content_hash, declared_category, submitter_name, session_id, ip, filename, mime, note, enc_raw, finance_unlocked_at_upload, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'received')
         ON CONFLICT (content_hash) DO NOTHING
         RETURNING id`,
        [contentHash, category, submitterName, s.sid, req.ip, filename, storedMime, note, encRaw, FINANCE_CATEGORIES.includes(category)]
      );
      if (ins.rows[0]) return res.status(201).json({ intake_id: ins.rows[0].id, status: 'received' });

      const dup = await pool.query('SELECT id, status FROM feed_intake WHERE content_hash=$1', [contentHash]);
      if (!dup.rows[0]) throw new Error('intake conflict but no existing row for content_hash');
      if (dup.rows[0].status === 'failed') {
        const rq = await pool.query(
          `UPDATE feed_intake
              SET status='received',
                  attempt_count=0,
                  last_error=NULL,
                  locked_until=NULL,
                  worker_id=NULL,
                  updated_at=now()
            WHERE id=$1 AND status='failed'
            RETURNING id, status`,
          [dup.rows[0].id]
        );
        if (rq.rows[0]) return res.status(200).json({ intake_id: rq.rows[0].id, status: rq.rows[0].status, requeued: true });
      }
      return res.status(200).json({ intake_id: dup.rows[0].id, status: dup.rows[0].status, duplicate: true });
    } catch (e) {
      await helpers.alert('feed_intake_error', { msg: 'Unexpected error in feed intake.', ip: req.ip, error: e.message });
      if (!res.headersSent) res.status(500).json({ error: 'intake failed' });
    }
  });

  /* Scoped error handler: body-parser errors (oversize/bad JSON) on /api/feed
     paths — including ones raised by the app-level parser upstream — return
     clean JSON instead of leaking a stack. */
  router.use('/api/feed', (err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'upload too large' });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON body' });
    helpers.alert('feed_intake_error', { msg: 'Unhandled error on a feed route.', ip: req.ip, error: err && err.message }).catch(() => {});
    res.status(500).json({ error: 'intake failed' });
  });

  return router;
};

/* Pure exports for intake_selftest.js (and the later worker increment). */
module.exports.sniffType    = sniffType;
module.exports.pdfGuard     = pdfGuard;
module.exports.feedRawKey   = feedRawKey;
module.exports.encryptRaw   = encryptRaw;
module.exports.decryptRaw   = decryptRaw;
module.exports.MIME_TO_TYPE = MIME_TO_TYPE;
module.exports.CATEGORIES   = CATEGORIES;
module.exports.FINANCE_CATEGORIES = FINANCE_CATEGORIES;
module.exports.MAX_RAW_BYTES = MAX_RAW_BYTES;
