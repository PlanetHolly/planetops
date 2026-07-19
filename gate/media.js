'use strict';

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildFilename, slugify } = require('./media/name.js');

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const ROOT = path.join(__dirname, 'media');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const CATS = JSON.parse(fs.readFileSync(path.join(ROOT, 'cats.json'), 'utf8'));
const COLORS = JSON.parse(fs.readFileSync(path.join(ROOT, 'colors.json'), 'utf8'));
const SKUS = JSON.parse(fs.readFileSync(path.join(ROOT, 'skus.json'), 'utf8'));
const GROUP_SET = new Set(GROUPS);
const CAT_SET = new Set(CATS);
const COLOR_SET = new Set(COLORS);
const SKU_SET = new Set(Object.keys(SKUS));

function cleanText(v, max = 500) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function decodePhoto(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw Object.assign(new Error('photo must be JPEG, PNG, or WebP data URL'), { status: 400 });
  const declaredMime = m[1] === 'jpg' ? 'image/jpeg' : `image/${m[1]}`;
  // Size-check the base64 STRING before decoding — never materialize an
  // oversized buffer. (4*ceil(MAX/3) is the longest base64 a MAX-byte photo
  // can produce; the exact post-decode check below still guards the edge.)
  if (m[2].length > 4 * Math.ceil(MAX_PHOTO_BYTES / 3)) {
    throw Object.assign(new Error('photo is too large'), { status: 413 });
  }
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) throw Object.assign(new Error('photo is empty'), { status: 400 });
  if (buf.length > MAX_PHOTO_BYTES) throw Object.assign(new Error('photo is too large'), { status: 413 });
  const realMime = sniffMime(buf);
  if (realMime !== declaredMime) {
    throw Object.assign(new Error(`declared mime ${declaredMime} does not match ${realMime}`), { status: 400 });
  }
  return { buf, mime: declaredMime, ext: declaredMime.split('/')[1].replace('jpeg', 'jpg') };
}

function sniffMime(buf) {
  if (buf?.[0] === 0xff && buf?.[1] === 0xd8 && buf?.[2] === 0xff) return 'image/jpeg';
  if (buf?.[0] === 0x89 && buf?.[1] === 0x50 && buf?.[2] === 0x4e && buf?.[3] === 0x47 &&
      buf?.[4] === 0x0d && buf?.[5] === 0x0a && buf?.[6] === 0x1a && buf?.[7] === 0x0a) return 'image/png';
  if (buf?.slice(0, 4).toString('ascii') === 'RIFF' && buf?.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function normalizeSku(raw) {
  return cleanText(raw, 80).toUpperCase();
}

function normalizeAssetInput(body, photoInfo) {
  const sku = normalizeSku(body.sku);
  if (sku && !SKU_SET.has(sku)) throw Object.assign(new Error('unknown sku'), { status: 400 });
  const skuInfo = sku ? SKUS[sku] : null;
  const group = cleanText(body.group, 80);
  const cat = cleanText(body.cat, 120);
  const color = cleanText(body.color, 120);
  if (!GROUP_SET.has(group)) throw Object.assign(new Error('invalid group'), { status: 400 });
  if (!CAT_SET.has(cat)) throw Object.assign(new Error('invalid category'), { status: 400 });
  if (!COLOR_SET.has(color)) throw Object.assign(new Error('invalid color'), { status: 400 });
  const fabric = cleanText(body.fabric, 120) || skuInfo?.material || '';
  const printMethod = cleanText(body.print_method, 120) || skuInfo?.default_print_method || '';
  const defaultInk = cleanText(body.default_ink, 120) || skuInfo?.default_ink || '';
  // sourceId is free text auto-filled from camera filenames (IMG_1234.jpg from
  // two cameras collides) — ALWAYS suffix the short content-hash so two
  // different photos can never compute the same filename/Drive targetPath.
  // Applies to NEW drops only; the 54 published filenames are never regenerated.
  const rawSourceId = cleanText(body.sourceId, 180);
  const hashPrefix = photoInfo?.hash ? photoInfo.hash.slice(0, 8) : '';
  const sourceId = rawSourceId && hashPrefix ? `${rawSourceId}-${hashPrefix}` : (rawSourceId || hashPrefix);
  return {
    brand: cleanText(body.brand, 180),
    sku,
    group,
    cat,
    color,
    fabric,
    print_method: printMethod,
    default_ink: defaultInk,
    description: cleanText(body.description, 2000),
    sourceId,
    ext: photoInfo?.ext || cleanText(body.ext, 12) || 'jpg'
  };
}

// Google Drive caps names at 255 bytes; worst-case joined tokens measure 728.
// Cap the stem at 200 bytes BEFORE the extension. Truncates only the joined
// brand/print/color/fabric tokens — never the extension or the id suffix.
const MAX_STEM_BYTES = 200;
function capFilename(name, idToken) {
  const dot = name.lastIndexOf('.');
  const ext = name.slice(dot);                       // '.jpg'
  const stem = name.slice(0, dot);                   // slugified → pure ASCII
  if (stem.length <= MAX_STEM_BYTES) return name;
  const suffix = '-' + idToken;
  const head = stem.slice(0, stem.length - suffix.length);
  const budget = Math.max(0, MAX_STEM_BYTES - suffix.length);
  return head.slice(0, budget).replace(/-+$/, '') + suffix + ext;
}

function filenameFor(assetInput) {
  const name = buildFilename({
    brand: assetInput.brand,
    printMethod: assetInput.print_method,
    color: assetInput.color,
    fabric: assetInput.fabric,
    sourceId: assetInput.sourceId,
    ext: assetInput.ext
  });
  // The id token name.js appended: the slugified sourceId, or (when sourceId
  // was blank) its 8-char metadata-hash fallback — i.e. the stem's last token.
  const idToken = slugify(assetInput.sourceId) || name.slice(0, name.lastIndexOf('.')).split('-').pop();
  return capFilename(name, idToken);
}

function publicAssetRow(row) {
  return {
    id: row.id,
    filename: row.filename,
    content_hash: row.content_hash,
    mime: row.mime,
    status: row.status,
    sink_status: row.sink_status || null,
    drive_view_url: row.drive_view_url || null,
    drive_download_url: row.drive_download_url || null,
    pages_url: row.pages_url || null,
    brand: row.brand,
    sku: row.sku,
    group: row.asset_group,
    cat: row.cat,
    color: row.color,
    fabric: row.fabric,
    print_method: row.print_method,
    default_ink: row.default_ink,
    description: row.description,
    sourceId: row.source_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// NOTE: no humanColumnsBlank ('Used?'/'Publish?'/Notes) — the sink is
// at-least-once, so this payload can arrive twice; an upserting workflow would
// overwrite Holly's hand-typed marks with blanks. A value never transmitted
// cannot be clobbered.
function sinkPayload(row, photoBuf) {
  return {
    idempotencyKey: row.content_hash,
    driveEnabled: String(process.env.MEDIA_DRIVE_ENABLED || '').toLowerCase() === 'true',
    filename: row.filename,
    targetPath: `Media_Center/${row.sku || row.asset_group}/${slugify(row.color)}/${row.filename}`,
    machineColumns: {
      origin: 'media-center',
      filename: row.filename,
      content_hash: row.content_hash,
      sku: row.sku || '',
      group: row.asset_group,
      cat: row.cat,
      color: row.color,
      fabric: row.fabric,
      print_method: row.print_method,
      default_ink: row.default_ink,
      source_id: row.source_id,
      mime: row.mime,
      created_at: row.created_at
    },
    seededOnceColumns: {
      Description: row.description || ''
    },
    photo: {
      mime: row.mime,
      base64: Buffer.from(photoBuf).toString('base64')
    }
  };
}

function initTables(pool) {
  return Promise.all([
    pool.query(`
      CREATE TABLE IF NOT EXISTS media_assets (
        id SERIAL PRIMARY KEY,
        content_hash TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        mime TEXT NOT NULL,
        photo BYTEA NOT NULL,
        brand TEXT,
        sku TEXT,
        asset_group TEXT NOT NULL,
        cat TEXT NOT NULL,
        color TEXT NOT NULL,
        fabric TEXT,
        print_method TEXT,
        default_ink TEXT,
        description TEXT,
        source_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending_sink',
        drive_view_url TEXT,
        drive_download_url TEXT,
        pages_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `),
    pool.query(`
      CREATE TABLE IF NOT EXISTS media_outbox (
        id SERIAL PRIMARY KEY,
        asset_id INT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
        idempotency_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'queued',
        attempts INT NOT NULL DEFAULT 0,
        last_error TEXT,
        next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
        acked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
  ]);
}

async function enqueueOutbox(pool, assetId, contentHash) {
  await pool.query(`
    INSERT INTO media_outbox (asset_id, idempotency_key)
    VALUES ($1,$2)
    ON CONFLICT (idempotency_key) DO NOTHING
  `, [assetId, contentHash]);
}

const MAX_SINK_ATTEMPTS = 20;   // transient failures cap; after this → 'dead'

async function processOutboxOnce(pool) {
  const url = process.env.MEDIA_SINK_URL;
  if (!url) return { skipped: true, reason: 'MEDIA_SINK_URL unset' };
  // MEDIA_SINK_SINCE (optional, ISO timestamp): skip outbox rows whose asset
  // predates it — the first graduation flip must not replay dev/test drops.
  // An unparseable value fails SAFE (drain halts) rather than replaying.
  let since = null;
  if (process.env.MEDIA_SINK_SINCE) {
    const t = Date.parse(process.env.MEDIA_SINK_SINCE);
    if (!Number.isFinite(t)) {
      console.error('media outbox: MEDIA_SINK_SINCE is not a valid ISO timestamp — drain halted');
      return { skipped: true, reason: 'MEDIA_SINK_SINCE invalid' };
    }
    since = new Date(t).toISOString();
  }
  const secret = process.env.MEDIA_SINK_SECRET || '';
  // ATOMIC single-row claim. FOR UPDATE SKIP LOCKED serializes across
  // PROCESSES (Railway overlaps two containers on every deploy; the in-memory
  // `pumping` flag only covers one). Advancing next_attempt_at means a row
  // abandoned mid-flight ('sending') is reclaimed only after 10 minutes,
  // not re-POSTed on the very next tick.
  const claim = await pool.query(`
    UPDATE media_outbox
    SET status='sending', attempts=attempts+1,
        next_attempt_at=NOW() + interval '10 minutes', updated_at=NOW()
    WHERE id IN (
      SELECT o.id FROM media_outbox o
      JOIN media_assets a ON a.id = o.asset_id
      WHERE o.status NOT IN ('acked','dead') AND o.next_attempt_at <= NOW()
        AND ($1::timestamptz IS NULL OR a.created_at >= $1::timestamptz)
      ORDER BY o.created_at
      LIMIT 1
      FOR UPDATE OF o SKIP LOCKED
    )
    RETURNING id, asset_id, idempotency_key, attempts
  `, [since]);
  let sent = 0;
  for (const claimed of claim.rows) {
    try {
      // Explicit columns — NEVER the photo BYTEA in a batch select (a 25MB
      // photo ×base64 ×JSON.stringify was ~333MB/tick → OOM'd the whole gate).
      const ar = await pool.query(`
        SELECT id, content_hash, filename, mime, brand, sku, asset_group, cat, color,
               fabric, print_method, default_ink, description, source_id, status, created_at
        FROM media_assets WHERE id=$1
      `, [claimed.asset_id]);
      const row = ar.rows[0];
      if (!row) throw Object.assign(new Error('asset row missing for outbox entry'), { permanent: true });
      // Photo bytes fetched per-row, only when actually sending.
      const pr = await pool.query('SELECT photo FROM media_assets WHERE id=$1', [claimed.asset_id]);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-media-secret': secret },
        body: JSON.stringify(sinkPayload(row, pr.rows[0].photo)),
        signal: AbortSignal.timeout(60000)
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw Object.assign(new Error(data.error || `sink returned HTTP ${resp.status}`), { httpStatus: resp.status });
      }
      await pool.query(`
        UPDATE media_assets
        SET status='filed',
            drive_view_url=COALESCE($2, drive_view_url),
            drive_download_url=COALESCE($3, drive_download_url),
            pages_url=COALESCE($4, pages_url),
            updated_at=NOW()
        WHERE id=$1
      `, [claimed.asset_id, data.drive_view_url || data.driveViewUrl || null, data.drive_download_url || data.driveDownloadUrl || null, data.pages_url || data.pagesUrl || null]);
      await pool.query(`
        UPDATE media_outbox
        SET status='acked', acked_at=NOW(), last_error=NULL, updated_at=NOW()
        WHERE id=$1
      `, [claimed.id]);
      sent++;
    } catch (e) {
      // 4xx (except 408/429) = the sink REJECTED the payload — retrying the
      // same bytes forever can never succeed. Attempts cap catches the rest.
      const permanent = e.permanent === true ||
        (e.httpStatus >= 400 && e.httpStatus < 500 && e.httpStatus !== 408 && e.httpStatus !== 429);
      if (permanent || claimed.attempts >= MAX_SINK_ATTEMPTS) {
        await pool.query(`
          UPDATE media_outbox
          SET status='dead', last_error=$2, updated_at=NOW()
          WHERE id=$1
        `, [claimed.id, e.message.slice(0, 1000)]);
        // 'dead' surfaces in GET /api/media/recent via the sink_status join.
        console.error(`media outbox #${claimed.id} marked dead after ${claimed.attempts} attempt(s): ${e.message}`);
      } else {
        await pool.query(`
          UPDATE media_outbox
          SET status='queued',
              last_error=$2,
              next_attempt_at=NOW() + (LEAST(60, GREATEST(1, attempts)) || ' minutes')::interval,
              updated_at=NOW()
          WHERE id=$1
        `, [claimed.id, e.message.slice(0, 1000)]);
      }
    }
  }
  return { sent };
}

/* ── Intake rate limit — self-contained, ported from gate/feed/intake.js; MUST
      NOT touch the gate's login brute-force lockout. One valid PIN session can
      no longer loop 25MB uploads unbounded (each photo differs, so the
      content-hash dedupe never trips). ─────────────────────────────────────── */
const IP_MAX = 20, IP_WINDOW = 5 * 60e3;             // 20 uploads / 5 min per IP
const GLOBAL_MAX = 200, GLOBAL_WINDOW = 60 * 60e3;   // 200 / hour global
const ipHits = new Map();                            // ip -> [timestamps]
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

function mediaRouter(pool, requireSession) {
  const router = express.Router();

  initTables(pool).then(() => console.log('media tables ready'))
    .catch(err => console.error('media tables init failed:', err.message));

  let pumping = false;
  async function pump() {
    if (pumping) return;
    pumping = true;
    try { await processOutboxOnce(pool); }
    catch (e) { console.error('media outbox pump failed:', e.message); }
    finally { pumping = false; }
  }
  setInterval(pump, 60e3).unref();
  setTimeout(pump, 2500).unref();

  router.get('/api/media/options', async (req, res) => {
    if (!await requireSession(req, res)) return;
    res.set('Cache-Control', 'no-store, private').json({ groups: GROUPS, cats: CATS, colors: COLORS, skus: SKUS });
  });

  router.post('/api/media/preview', async (req, res) => {
    if (!await requireSession(req, res)) return;
    try {
      // Optional client-supplied content hash (sha256 hex of the photo bytes)
      // so the previewed filename matches what intake will save. Without it the
      // sourceId hash suffix can't be computed → the name is PROVISIONAL.
      const clientHash = cleanText(req.body.contentHash || req.body.content_hash, 64).toLowerCase();
      const hash = /^[0-9a-f]{64}$/.test(clientHash) ? clientHash : '';
      const input = normalizeAssetInput(req.body || {}, { ext: cleanText(req.body.ext, 12) || 'jpg', hash: hash || undefined });
      res.set('Cache-Control', 'no-store, private').json({ filename: filenameFor(input), input, provisional: !hash });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  // Route-scoped 35mb parser (gate/index.js's global parser skips this path) —
  // the big limit applies to THIS endpoint only, exactly as feed/intake.js:141.
  router.post('/api/media/intake', express.json({ limit: '35mb' }), async (req, res) => {
    if (!await requireSession(req, res)) return;
    if (intakeLimited(req.ip)) return res.status(429).json({ error: 'too many uploads, slow down' });
    try {
      const photo = decodePhoto(req.body.photo);
      const contentHash = sha256(photo.buf);
      const input = normalizeAssetInput(req.body, { ext: photo.ext, hash: contentHash });
      const filename = filenameFor(input);
      // Asset INSERT + outbox enqueue in ONE transaction: a failure between
      // them must never strand a photo in Postgres with no outbox row (nothing
      // ever rescans for orphans — the asset could never reach the Sheet).
      const client = await pool.connect();
      let r;
      try {
        await client.query('BEGIN');
        r = await client.query(`
        INSERT INTO media_assets
          (content_hash, filename, mime, photo, brand, sku, asset_group, cat, color,
           fabric, print_method, default_ink, description, source_id, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending_sink')
        ON CONFLICT (content_hash) DO UPDATE SET
          updated_at=media_assets.updated_at
        RETURNING id, content_hash, filename, mime, brand, sku, asset_group, cat, color,
                  fabric, print_method, default_ink, description, source_id, status,
                  drive_view_url, drive_download_url, pages_url, created_at, updated_at,
                  (xmax = 0) AS inserted
      `, [
          contentHash, filename, photo.mime, photo.buf, input.brand, input.sku, input.group, input.cat, input.color,
          input.fabric, input.print_method, input.default_ink, input.description, input.sourceId
        ]);
        await enqueueOutbox(client, r.rows[0].id, contentHash);
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }
      pump();
      res.status(r.rows[0].inserted ? 201 : 200).set('Cache-Control', 'no-store, private').json({
        asset: publicAssetRow(r.rows[0]),
        duplicate: !r.rows[0].inserted,
        queued: true,
        sink: process.env.MEDIA_SINK_URL ? 'configured' : 'shadow-gated'
      });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  router.get('/api/media/recent', async (req, res) => {
    if (!await requireSession(req, res)) return;
    try {
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 25));
      const r = await pool.query(`
        SELECT a.id, a.content_hash, a.filename, a.mime, a.brand, a.sku, a.asset_group, a.cat,
               a.color, a.fabric, a.print_method, a.default_ink, a.description, a.source_id,
               a.status, a.drive_view_url, a.drive_download_url, a.pages_url, a.created_at,
               a.updated_at, o.status AS sink_status
        FROM media_assets a
        LEFT JOIN media_outbox o ON o.idempotency_key = a.content_hash
        ORDER BY a.created_at DESC
        LIMIT $1
      `, [limit]);
      res.set('Cache-Control', 'no-store, private').json({ assets: r.rows.map(publicAssetRow) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Gated outbox visibility — acceptance check 8c: never flip the sink on blind.
  router.get('/api/media/outbox/stats', async (req, res) => {
    if (!await requireSession(req, res)) return;
    try {
      const r = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='queued')::int  AS queued,
          COUNT(*) FILTER (WHERE status='sending')::int AS sending,
          COUNT(*) FILTER (WHERE status='acked')::int   AS acked,
          COUNT(*) FILTER (WHERE status='dead')::int    AS dead,
          MIN(created_at) FILTER (WHERE status='queued') AS oldest_queued_at
        FROM media_outbox
      `);
      res.set('Cache-Control', 'no-store, private').json(r.rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Scoped error handler: body-parser errors (oversize/bad JSON) on media
  // routes return clean JSON instead of an HTML stack (mirrors feed/intake.js).
  router.use('/api/media', (err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'upload too large' });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON body' });
    next(err);
  });

  return router;
}

mediaRouter._internals = {
  MAX_PHOTO_BYTES,
  GROUPS,
  CATS,
  COLORS,
  SKUS,
  cleanText,
  decodePhoto,
  sniffMime,
  sha256,
  normalizeAssetInput,
  filenameFor,
  sinkPayload,
  processOutboxOnce
};

module.exports = mediaRouter;
