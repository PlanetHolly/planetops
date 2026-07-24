'use strict';
/*
 * REAL integration test harness for gate/media.js
 *
 * Run:  node gate/media.integration.test.js
 *
 * No test framework, no supertest, no database. Uses only Node built-ins plus
 * express (already in gate/node_modules). The router's two injected
 * dependencies — the pg pool and requireSession — are faked here:
 *
 *   - The fake pool pattern-matches the exact SQL media.js issues and keeps
 *     in-memory media_assets / media_outbox tables, returning {rows, rowCount}
 *     shaped as pg does. It is STRICT: any SQL it does not recognize (or whose
 *     shape drifts from what it emulates) throws loudly instead of returning
 *     empty rows, so a schema/query change cannot silently fake a pass.
 *
 *   - requireSession has an allow variant (returns a truthy session) and a
 *     deny variant that sends 401 and returns null, mirroring gate/index.js.
 *
 * The real router is mounted on a real express app on an ephemeral port and
 * driven with real fetch requests. globalThis.fetch is wrapped so that ANY
 * outbound request not aimed at our own test servers throws — proving the
 * outbox pump never calls a sink while MEDIA_SINK_URL is unset.
 */

process.env.NODE_ENV = 'test';
delete process.env.MEDIA_SINK_URL;
delete process.env.MEDIA_SINK_SECRET;
delete process.env.MEDIA_DRIVE_ENABLED;

const crypto = require('crypto');
const assert = require('assert');
const express = require('express');
const mediaRouter = require('./media.js');
const { buildFilename } = require('./media/name.js');

const MAX_PHOTO_BYTES = mediaRouter._internals.MAX_PHOTO_BYTES;

/* ── outbound-fetch guard (installed BEFORE any router timer can fire) ───── */
const realFetch = globalThis.fetch.bind(globalThis);
const blockedOutbound = [];
let allowedPrefixes = [];
globalThis.fetch = (input, init) => {
  const u = typeof input === 'string' ? input : (input && input.url) || String(input);
  if (!allowedPrefixes.some(p => u.startsWith(p))) {
    blockedOutbound.push(u);
    throw new Error('test harness BLOCKED outbound fetch: ' + u);
  }
  return realFetch(input, init);
};

/* ── strict fake pg pool ─────────────────────────────────────────────────── */
function makeFakePool(name) {
  const state = { assets: [], outbox: [], seqA: 0, seqO: 0, log: [], name };

  const ASSET_RETURNING = [
    'id', 'content_hash', 'filename', 'mime', 'brand', 'sku', 'asset_group', 'cat', 'color',
    'fabric', 'print_method', 'default_ink', 'description', 'source_id', 'status',
    'drive_view_url', 'drive_download_url', 'pages_url', 'created_at', 'updated_at',
    'invoice_visualid', 'line_group_id', 'line_group_position', 'line_item_id',
    'line_item_position', 'imprint_id', 'imprint_position', 'blank_color', 'method',
    'ink_type', 'brand_nickname', 'template', 'source', 'edited_fields', 'printavo_snapshot'
  ];
  const project = (row, cols) => Object.fromEntries(cols.map(c => [c, row[c]]));

  async function query(sqlRaw, params = []) {
    const sql = String(sqlRaw).replace(/\s+/g, ' ').trim();
    state.log.push(sql);

    if (/^CREATE TABLE IF NOT EXISTS media_assets \(/.test(sql)) return { rows: [], rowCount: 0 };
    if (/^CREATE TABLE IF NOT EXISTS media_outbox \(/.test(sql)) return { rows: [], rowCount: 0 };
    if (/^ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS /.test(sql)) return { rows: [], rowCount: 0 };

    // Transaction wrapping (intake INSERT + enqueue run on one client) — the
    // fake is single-store, so these are no-ops here.
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };

    if (/^INSERT INTO media_assets /.test(sql)) {
      // Refuse to guess if the statement's shape drifts from what we emulate.
      if (!sql.includes('ON CONFLICT (content_hash) DO UPDATE') ||
          !sql.includes('(xmax = 0) AS inserted') ||
          !sql.includes('RETURNING')) {
        throw new Error(`[fake-pool ${name}] media_assets INSERT shape changed — refusing to guess: ${sql}`);
      }
      if (!Array.isArray(params) || params.length !== 14) {
        throw new Error(`[fake-pool ${name}] media_assets INSERT expected 14 params, got ${params && params.length}`);
      }
      const [content_hash, filename, mime, photo, brand, sku, asset_group, cat, color,
             fabric, print_method, default_ink, description, source_id] = params;
      if (!Buffer.isBuffer(photo)) throw new Error(`[fake-pool ${name}] photo param is not a Buffer (bytea)`);
      let row = state.assets.find(r => r.content_hash === content_hash);
      let inserted = false;
      if (!row) {
        inserted = true;
        const now = new Date();
        row = {
          id: ++state.seqA, content_hash, filename, mime, photo, brand, sku, asset_group, cat, color,
          fabric, print_method, default_ink, description, source_id,
          status: 'pending_sink', drive_view_url: null, drive_download_url: null, pages_url: null,
          created_at: now, updated_at: now, invoice_visualid: null, line_group_id: null,
          line_group_position: null, line_item_id: null, line_item_position: null,
          imprint_id: null, imprint_position: null, blank_color: null, method: null,
          ink_type: null, brand_nickname: null, template: null, source: 'manual',
          edited_fields: null, printavo_snapshot: null
        };
        state.assets.push(row);
      }
      // conflict path: DO UPDATE SET updated_at=media_assets.updated_at is a no-op;
      // RETURNING yields the EXISTING row and xmax<>0 → inserted=false.
      return { rows: [{ ...project(row, ASSET_RETURNING), inserted }], rowCount: 1 };
    }

    if (/^INSERT INTO media_outbox /.test(sql)) {
      if (!sql.includes('ON CONFLICT (idempotency_key) DO NOTHING')) {
        throw new Error(`[fake-pool ${name}] media_outbox INSERT shape changed — refusing to guess: ${sql}`);
      }
      const [asset_id, idempotency_key] = params;
      if (state.outbox.some(o => o.idempotency_key === idempotency_key)) return { rows: [], rowCount: 0 };
      const now = new Date();
      state.outbox.push({
        id: ++state.seqO, asset_id, idempotency_key, status: 'queued', attempts: 0,
        last_error: null, next_attempt_at: now, acked_at: null, created_at: now, updated_at: now
      });
      return { rows: [], rowCount: 1 };
    }

    if (sql.startsWith('SELECT a.id, a.content_hash') &&
        sql.includes('LEFT JOIN media_outbox o ON o.idempotency_key = a.content_hash')) {
      const limit = Number(params[0]);
      if (!Number.isFinite(limit)) throw new Error(`[fake-pool ${name}] recent SELECT: bad LIMIT param ${params[0]}`);
      const rows = [...state.assets]
        .sort((x, y) => (y.created_at - x.created_at) || (y.id - x.id))
        .slice(0, limit)
        .map(a => {
          const o = state.outbox.find(ob => ob.idempotency_key === a.content_hash);
          return { ...project(a, ASSET_RETURNING), sink_status: o ? o.status : null };
        });
      return { rows, rowCount: rows.length };
    }

    if (sql.includes('FROM media_outbox o JOIN media_assets a')) {
      // The outbox drain must NEVER run in this harness: MEDIA_SINK_URL is unset
      // and processOutboxOnce() returns before querying. If we get here, that
      // guard in media.js regressed.
      throw new Error(`[fake-pool ${name}] outbox drain SELECT ran with MEDIA_SINK_URL unset — sink guard regressed`);
    }

    throw new Error(`[fake-pool ${name}] UNRECOGNIZED SQL — fake refuses to guess: ${sql} :: params=` +
      JSON.stringify((params || []).map(p => Buffer.isBuffer(p) ? `<Buffer ${p.length}b>` : p)));
  }

  // pool.connect() → client with the same strict query + a release() no-op,
  // mirroring pg's contract for the intake transaction.
  const connect = async () => ({ query, release() {} });

  return { query, connect, state };
}

/* ── fake sessions (mirror gate/index.js requireSession contract) ────────── */
const allowSession = async () => ({ user: 'harness', sid: 'test-sid' });          // truthy → proceed
const denySession = async (req, res) => { res.status(401).json({ error: 'auth required' }); return null; };

/* ── helpers ─────────────────────────────────────────────────────────────── */
const jpegBytes = tag => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('harness-' + tag)]);
const pngBytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('not-a-jpeg')]);
const dataUrl = (mime, buf) => `data:${mime};base64,${buf.toString('base64')}`;
const sha256hex = buf => crypto.createHash('sha256').update(buf).digest('hex');

function apparelBody(photoBuf, extra = {}) {
  return {
    brand: 'Rivian / Rivian Compass',
    group: 'Apparel', cat: 'Tees', color: 'Black',
    fabric: 'Organic Cotton', print_method: 'Screen-Printed', default_ink: 'Water-Based',
    description: 'harness test tee',
    photo: dataUrl('image/jpeg', photoBuf),
    ...extra
  };
}

async function api(base, method, p, body, headers) {
  const opts = { method, headers: { ...(headers || {}) } };
  if (body !== undefined) {
    if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await realFetch(base + p, opts);   // realFetch: guard only watches the ROUTER's outbound calls
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON (e.g. body-parser HTML error) */ }
  return { status: res.status, json };
}

/* ── runner ──────────────────────────────────────────────────────────────── */
const failures = [];
const findings = [];
async function t(name, fn) {
  try { await fn(); console.log('PASS  ' + name); }
  catch (e) { failures.push(name); console.log('FAIL  ' + name + '\n      ' + (e && e.stack ? e.message : e)); }
}

async function main() {
  // Two real servers: one with a passing session, one with a rejecting session.
  const poolA = makeFakePool('allow');
  const appA = express();
  appA.use(express.json({ limit: '35mb' }));               // mirrors gate/index.js:32
  appA.use(mediaRouter(poolA, allowSession));
  const srvA = appA.listen(0, '127.0.0.1');

  const poolD = makeFakePool('deny');
  const appD = express();
  appD.use(express.json({ limit: '35mb' }));
  appD.use(mediaRouter(poolD, denySession));
  const srvD = appD.listen(0, '127.0.0.1');

  await new Promise(r => setImmediate(r));
  const baseA = `http://127.0.0.1:${srvA.address().port}`;
  const baseD = `http://127.0.0.1:${srvD.address().port}`;
  allowedPrefixes = [baseA, baseD];

  /* 1 ── valid drop, no SKU (apparel) → success + filename matches name.js exactly */
  const photo1 = jpegBytes('case1-apparel');
  const hash1 = sha256hex(photo1);
  const expected1 = buildFilename({
    brand: 'Rivian / Rivian Compass', printMethod: 'Screen-Printed', color: 'Black',
    fabric: 'Organic Cotton', sourceId: hash1.slice(0, 8), ext: 'jpg'
  });
  let firstDropStatus = null;
  await t('valid drop (no SKU) succeeds with the exact filename name.js computes', async () => {
    const r = await api(baseA, 'POST', '/api/media/intake', apparelBody(photo1));
    firstDropStatus = r.status;
    assert([200, 201].includes(r.status), `expected 2xx success, got ${r.status}: ${JSON.stringify(r.json)}`);
    assert.strictEqual(r.json.duplicate, false, 'first drop must not be flagged duplicate');
    assert.strictEqual(r.json.queued, true);
    assert.strictEqual(r.json.sink, 'shadow-gated', 'MEDIA_SINK_URL unset → sink must report shadow-gated');
    assert.strictEqual(r.json.asset.content_hash, hash1);
    assert.strictEqual(r.json.asset.filename, expected1,
      `endpoint filename ${r.json.asset.filename} != pure buildFilename() ${expected1}`);
    assert.strictEqual(r.json.asset.group, 'Apparel');
    const row = poolA.state.assets.find(a => a.content_hash === hash1);
    assert(row && row.filename === expected1, 'asset row missing or filename mismatch in table');
  });
  if (firstDropStatus === 201) {
    findings.push('Fresh drop returns HTTP 201 (Created), not the plan\'s literal "200"; duplicates return 200. ' +
      'Harness accepts both as success — flagging so the acceptance wording can be reconciled.');
  }

  /* 2 ── valid drop with a known SKU → sku defaults (material/print/ink) applied */
  await t('valid drop with known SKU applies SKU defaults and correct filename', async () => {
    const buf = jpegBytes('case2-sku');
    const h = sha256hex(buf);
    const r = await api(baseA, 'POST', '/api/media/intake', {
      brand: 'Planet Apparel', sku: 'pl2216',            // lowercase on purpose: router uppercases
      group: 'Bandanas', cat: 'Bandanas', color: 'Red',
      description: 'sku default test', photo: dataUrl('image/jpeg', buf)
    });
    assert([200, 201].includes(r.status), `got ${r.status}: ${JSON.stringify(r.json)}`);
    assert.strictEqual(r.json.asset.sku, 'PL2216');
    assert.strictEqual(r.json.asset.fabric, 'Cotton', 'fabric should default from skus.json material');
    assert.strictEqual(r.json.asset.print_method, 'Screen-Printed');
    assert.strictEqual(r.json.asset.default_ink, 'Plastisol');
    const expected = buildFilename({
      brand: 'Planet Apparel', printMethod: 'Screen-Printed', color: 'Red',
      fabric: 'Cotton', sourceId: h.slice(0, 8), ext: 'jpg'
    });
    assert.strictEqual(r.json.asset.filename, expected);
  });

  /* 3 ── explicit blank SKU is accepted (v1: apparel/promo have no SKU) */
  await t('blank sku ("") accepted for promo drop', async () => {
    const buf = jpegBytes('case3-promo');
    const r = await api(baseA, 'POST', '/api/media/intake', {
      brand: 'Death Wish Coffee', sku: '', group: 'Promo', cat: 'Drinkware', color: 'White',
      fabric: '', print_method: 'Laser Engraved', photo: dataUrl('image/jpeg', buf)
    });
    assert([200, 201].includes(r.status), `got ${r.status}: ${JSON.stringify(r.json)}`);
    assert.strictEqual(r.json.asset.sku, '');
  });

  /* 4 ── unauthenticated intake rejected, and NO asset row created */
  await t('unauthenticated intake → 401 and zero rows written', async () => {
    const r = await api(baseD, 'POST', '/api/media/intake', apparelBody(jpegBytes('case4-noauth')));
    assert.strictEqual(r.status, 401, `got ${r.status}`);
    assert.strictEqual(poolD.state.assets.length, 0, 'deny-server pool must have no asset rows');
    assert.strictEqual(poolD.state.outbox.length, 0, 'deny-server pool must have no outbox rows');
  });

  /* 5 ── unknown SKU rejected, no row */
  await t('unknown SKU → 400 "unknown sku", no row written', async () => {
    const before = poolA.state.assets.length;
    const r = await api(baseA, 'POST', '/api/media/intake',
      apparelBody(jpegBytes('case5-badsku'), { sku: 'ZZZ999' }));
    assert.strictEqual(r.status, 400, `got ${r.status}: ${JSON.stringify(r.json)}`);
    assert(/unknown sku/i.test(r.json.error), `error was: ${r.json.error}`);
    assert.strictEqual(poolA.state.assets.length, before, 'row count changed on rejected drop');
  });

  /* 6 ── group not in groups.json rejected */
  await t('group not in groups.json → 400 "invalid group"', async () => {
    const r = await api(baseA, 'POST', '/api/media/intake',
      apparelBody(jpegBytes('case6-badgroup'), { group: 'Website' }));
    assert.strictEqual(r.status, 400, `got ${r.status}: ${JSON.stringify(r.json)}`);
    assert(/invalid group/i.test(r.json.error), `error was: ${r.json.error}`);
  });

  /* 7 ── cat not in cats.json rejected */
  await t('cat not in cats.json → 400 "invalid category"', async () => {
    const r = await api(baseA, 'POST', '/api/media/intake',
      apparelBody(jpegBytes('case7-badcat'), { cat: 'Socks' }));
    assert.strictEqual(r.status, 400, `got ${r.status}: ${JSON.stringify(r.json)}`);
    assert(/invalid category/i.test(r.json.error), `error was: ${r.json.error}`);
  });

  /* 8 ── declared image/jpeg with PNG magic bytes rejected */
  await t('declared jpeg with real PNG bytes → 400 magic-byte mismatch, no row', async () => {
    const before = poolA.state.assets.length;
    const r = await api(baseA, 'POST', '/api/media/intake',
      apparelBody(pngBytes /* PNG signature bytes */, { photo: dataUrl('image/jpeg', pngBytes) }));
    assert.strictEqual(r.status, 400, `got ${r.status}: ${JSON.stringify(r.json)}`);
    assert(/does not match/i.test(r.json.error), `error was: ${r.json.error}`);
    assert.strictEqual(poolA.state.assets.length, before);
    assert(!poolA.state.assets.some(a => a.content_hash === sha256hex(pngBytes)));
  });

  /* 9 ── same photo dropped twice → exactly ONE asset row, ONE outbox row */
  await t('duplicate drop → 200 duplicate:true, exactly 1 asset row + 1 outbox row', async () => {
    const buf = jpegBytes('case9-duplicate');
    const h = sha256hex(buf);
    const body = apparelBody(buf, { description: 'dup test' });
    const r1 = await api(baseA, 'POST', '/api/media/intake', body);
    assert([200, 201].includes(r1.status));
    assert.strictEqual(r1.json.duplicate, false);
    const r2 = await api(baseA, 'POST', '/api/media/intake', body);
    assert.strictEqual(r2.status, 200, `duplicate drop got ${r2.status}`);
    assert.strictEqual(r2.json.duplicate, true);
    assert.strictEqual(r2.json.asset.id, r1.json.asset.id, 'duplicate must return the SAME asset row');
    assert.strictEqual(r2.json.asset.filename, r1.json.asset.filename);
    // Row counts, not just the response:
    assert.strictEqual(poolA.state.assets.filter(a => a.content_hash === h).length, 1, 'asset row count != 1');
    assert.strictEqual(poolA.state.outbox.filter(o => o.idempotency_key === h).length, 1, 'outbox row count != 1');
  });

  /* 10 ── oversize photo (> MAX_PHOTO_BYTES) rejected with 413 */
  await t(`oversize photo (${MAX_PHOTO_BYTES + 1} bytes) → 413, no row`, async () => {
    const big = Buffer.alloc(MAX_PHOTO_BYTES + 1);
    big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;          // valid JPEG SOI so only SIZE trips
    const before = poolA.state.assets.length;
    const r = await api(baseA, 'POST', '/api/media/intake', apparelBody(big));
    assert.strictEqual(r.status, 413, `got ${r.status}: ${JSON.stringify(r.json)}`);
    assert(/too large/i.test((r.json && r.json.error) || ''), `error was: ${JSON.stringify(r.json)}`);
    assert.strictEqual(poolA.state.assets.length, before);
  });

  /* 11 ── GET /api/media/recent returns the created asset; session-gated */
  await t('GET /api/media/recent returns created asset with queued sink_status', async () => {
    const r = await api(baseA, 'GET', '/api/media/recent?limit=50');
    assert.strictEqual(r.status, 200, `got ${r.status}`);
    const found = r.json.assets.find(a => a.content_hash === hash1);
    assert(found, 'case-1 asset missing from /recent');
    assert.strictEqual(found.filename, expected1);
    assert.strictEqual(found.group, 'Apparel');
    assert.strictEqual(found.sink_status, 'queued');
    assert.strictEqual(found.status, 'pending_sink');
  });
  await t('GET /api/media/recent is session-gated (401 unauthenticated)', async () => {
    const r = await api(baseD, 'GET', '/api/media/recent');
    assert.strictEqual(r.status, 401, `got ${r.status}`);
  });

  /* 12 ── GET /api/media/options gated + serves vocabularies */
  await t('GET /api/media/options serves vocab when authed, 401 when not', async () => {
    const ok = await api(baseA, 'GET', '/api/media/options');
    assert.strictEqual(ok.status, 200);
    assert(Array.isArray(ok.json.groups) && ok.json.groups.includes('Apparel'));
    const no = await api(baseD, 'GET', '/api/media/options');
    assert.strictEqual(no.status, 401);
  });

  /* 13 ── MEDIA_SINK_URL unset: drops succeeded & queued, NO outbound fetch,
   *       and the outbox drain SQL never ran (strict fake would have thrown). */
  await t('MEDIA_SINK_URL unset → queued rows, zero outbound fetches, no drain SQL', async () => {
    assert(poolA.state.outbox.length >= 1, 'expected queued outbox rows');
    assert(poolA.state.outbox.every(o => o.status === 'queued'), 'all outbox rows must stay queued');
    assert.strictEqual(blockedOutbound.length, 0,
      'router attempted outbound fetch(es): ' + blockedOutbound.join(', '));
    assert(!poolA.state.log.some(q => q.includes('FROM media_outbox o JOIN media_assets a')),
      'outbox drain SELECT was issued despite MEDIA_SINK_URL being unset');
  });

  /* 14 ── malformed request bodies must be 4xx, never 5xx (bug probe) */
  await t('non-JSON body (no parsed req.body) → 4xx, not 500', async () => {
    const r = await api(baseA, 'POST', '/api/media/intake', 'not json at all',
      { 'Content-Type': 'text/plain' });
    assert(r.status >= 400 && r.status < 500,
      `expected 4xx for malformed request, got ${r.status}: ${JSON.stringify(r.json)}`);
  });
  await t('JSON body missing photo → 400', async () => {
    const r = await api(baseA, 'POST', '/api/media/intake',
      { group: 'Apparel', cat: 'Tees', color: 'Black' });
    assert.strictEqual(r.status, 400, `got ${r.status}: ${JSON.stringify(r.json)}`);
    assert(/data URL/i.test(r.json.error), `error was: ${r.json.error}`);
  });

  /* 15 ── observation: does /preview predict the /intake filename? (warn only) */
  {
    const meta = apparelBody(photo1);
    delete meta.photo;
    const pv = await api(baseA, 'POST', '/api/media/preview', { ...meta, ext: 'jpg' });
    if (pv.status === 200 && pv.json.filename !== expected1) {
      findings.push('OBSERVATION: /api/media/preview and /api/media/intake produce DIFFERENT filenames for ' +
        `identical metadata when sourceId is omitted (preview: ${pv.json.filename}, intake: ${expected1}). ` +
        'Preview falls back to a metadata-hash id (name.js:54) while intake uses the photo content-hash prefix ' +
        '(media.js:67). If preview is meant to show the final name, this diverges by design of the injected hash.');
    }
  }

  /* ── teardown & summary ── */
  await new Promise(r => srvA.close(r));
  await new Promise(r => srvD.close(r));
  globalThis.fetch = realFetch;

  console.log('');
  if (findings.length) {
    console.log('FINDINGS (not pass/fail):');
    for (const f of findings) console.log('  - ' + f);
    console.log('');
  }
  if (failures.length) {
    console.log(`RESULT: ${failures.length} FAILED — ` + failures.join(' | '));
    process.exit(1);
  }
  console.log('RESULT: all cases passed');
  process.exit(0);
}

main().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
