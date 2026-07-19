#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');

const root = path.resolve(__dirname, '..', '..');

function test(name, fn) {
  test.tests.push({ name, fn });
}
test.tests = [];

async function request(app, method, route, { headers = {}, body = null } = {}) {
  const req = {
    method,
    url: route,
    originalUrl: route,
    path: route,
    body,
    query: {},
  };
  req.headers = {
    host: 'example.test',
    ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
  };
  req.ip = '127.0.0.1';

  const chunks = [];
  const headersOut = {};
  let finished = false;
  const res = {
    statusCode: 200,
    headersSent: false,
    set(name, value) { headersOut[String(name).toLowerCase()] = value; return this; },
    setHeader(name, value) { headersOut[String(name).toLowerCase()] = value; },
    getHeader(name) { return headersOut[String(name).toLowerCase()]; },
    getHeaders() { return { ...headersOut }; },
    status(code) { this.statusCode = code; return this; },
    json(value) { headersOut['content-type'] = headersOut['content-type'] || 'application/json; charset=utf-8'; chunks.push(Buffer.from(JSON.stringify(value))); this.headersSent = true; finished = true; return this; },
    send(value) { chunks.push(Buffer.from(String(value || ''))); this.headersSent = true; finished = true; return this; },
  };

  const stack = app.stack || (app._router && app._router.stack) || [];
  const layer = stack.find(l => l.route && l.route.path === route && l.route.methods[String(method).toLowerCase()]);
  if (!layer) return { status: 404, text: '', json: null, headers: {} };
  const handlers = layer.route.stack.map(s => s.handle).filter(h => h.name !== 'jsonParser');
  let idx = 0;
  await new Promise((resolve, reject) => {
    const next = err => {
      if (err) return reject(err);
      const handler = handlers[idx++];
      if (!handler || finished) return resolve();
      Promise.resolve(handler(req, res, next)).then(() => { if (finished) resolve(); }).catch(reject);
    };
    next();
  });
  const text = Buffer.concat(chunks).toString('utf8');
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  return { status: res.statusCode, text, json, headers: res.getHeaders() };
}

function makeTextUpload() {
  return {
    filename: 'retry.txt',
    mime: 'text/plain',
    category: 'other',
    submitter_name: 'Acceptance Test',
    note: '',
    data: 'data:text/plain;base64,' + Buffer.from('hello').toString('base64'),
  };
}

test('D1: high-dollar review writes feed_review, sends redacted alert, and finance-gates GET /api/feed/review', async () => {
  const { recordReview } = require('./worker');
  assert.strictEqual(typeof recordReview, 'function', 'worker exports shared recordReview helper');

  const queries = [];
  const alerts = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [{ id: 10, intake_id: 77, reason: 'high_dollar', payload: { doc_type: 'expense' }, created_at: new Date().toISOString() }], rowCount: 1 };
    },
  };
  await recordReview(pool, async (event, detail) => alerts.push({ event, detail }), {
    intake_id: 77,
    doc_type: 'expense',
    reason: 'high_dollar',
    payload: {
      doc_type: 'expense',
      entities: { vendor: 'Sensitive Vendor', customer: 'Sensitive Customer' },
      amounts: { total: 99999 },
    },
  });

  assert(queries.some(q => /INSERT\s+INTO\s+feed_review/i.test(q.sql)), 'recordReview inserts feed_review');
  assert.strictEqual(alerts.length, 1, 'one review alert is sent');
  assert.deepStrictEqual(Object.keys(alerts[0].detail).sort(), ['doc_type', 'intake_id', 'msg', 'reason'].sort(), 'alert body is metadata-only');
  assert(!JSON.stringify(alerts[0]).includes('99999'), 'alert excludes financial values');
  assert(!JSON.stringify(alerts[0]).includes('Sensitive Vendor'), 'alert excludes vendor/customer names');

  const views = require('./views');
  assert.throws(
    () => views(pool, async () => ({ sid: 'entry-only' })),
    /requires a finance gate/,
    'review route cannot silently downgrade when requireFinance is missing'
  );
  let sessionCalls = 0;
  let financeCalls = 0;
  const app = views(pool,
    async (_req, _res) => { sessionCalls++; return { sid: 'entry-only' }; },
    async (_req, res) => { financeCalls++; res.status(403).json({ error: 'finance unlock required' }); return null; }
  );
  const denied = await request(app, 'GET', '/api/feed/review');
  assert.strictEqual(denied.status, 403, 'entry-only session is forbidden');
  assert.strictEqual(financeCalls, 1, 'review endpoint uses finance gate');
  assert.strictEqual(sessionCalls, 0, 'review endpoint does not use requireSession-only gate');

  const okApp = views(pool, async () => { throw new Error('must not be used'); }, async () => ({ sid: 'finance' }));
  const listed = await request(okApp, 'GET', '/api/feed/review');
  assert.strictEqual(listed.status, 200, 'finance session can list open reviews');
  assert(Array.isArray(listed.json.items), 'review response contains items array');
});

test('D2: claim cap, sweeper dead-letter, and shutdown release keep attempts correct', async () => {
  process.env.FEED_MAX_ATTEMPTS = '4';
  const { claimRow, sweepExpiredCappedRows, releaseInFlightClaimForShutdown, _setInFlightClaimForTest } = require('./worker');
  assert.strictEqual(typeof claimRow, 'function', 'worker exports claimRow for integration testing');
  assert.strictEqual(typeof sweepExpiredCappedRows, 'function', 'worker exports sweeper');
  assert.strictEqual(typeof releaseInFlightClaimForShutdown, 'function', 'worker exports shutdown release');

  const claimQueries = [];
  const fakeClient = {
    async query(sql, params) {
      claimQueries.push({ sql, params });
      if (/SELECT id, content_hash/.test(sql)) {
        assert(/attempt_count\s*</i.test(sql), 'claim SELECT caps attempt_count before claiming');
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  await claimRow({ connect: async () => fakeClient });

  const alerts = [];
  const sweepPool = {
    async query(sql, params) {
      assert(/status='failed'/i.test(sql), 'sweeper marks capped stale rows failed');
      assert(/attempt_count\s*>=/i.test(sql), 'sweeper only dead-letters capped rows');
      return { rows: [{ id: 55, doc_type: 'payroll', attempt_count: params[0] }], rowCount: 1 };
    },
  };
  await sweepExpiredCappedRows(sweepPool, async (event, detail) => alerts.push({ event, detail }));
  assert.strictEqual(alerts.length, 1, 'sweeper alerts once for capped row');

  let releaseSql = '';
  const releasePool = {
    async query(sql, params) {
      releaseSql = sql;
      assert.deepStrictEqual(params, [99]);
      return { rows: [], rowCount: 1 };
    },
  };
  _setInFlightClaimForTest({ pool: releasePool, id: 99 });
  await releaseInFlightClaimForShutdown();
  assert(/GREATEST\(attempt_count - 1, 0\)/.test(releaseSql), 'SIGTERM release decrements the claim attempt');
});

test('D3: extractor classifies 401/404 as config halt and 400 as permanent dead-letter', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const { extract } = require('./extract');
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: false, status: 401, text: async () => 'bad key' });
    await assert.rejects(
      () => extract(Buffer.from('x'), 'text/plain', ''),
      err => err && err.notConfigured && !err.permanent && /401/.test(err.message),
      '401 is a config halt'
    );

    global.fetch = async () => ({ ok: false, status: 404, text: async () => 'bad model' });
    await assert.rejects(
      () => extract(Buffer.from('x'), 'text/plain', ''),
      err => err && err.notConfigured && !err.permanent && /404/.test(err.message),
      '404 is a config halt'
    );

    global.fetch = async () => ({ ok: false, status: 400, text: async () => 'schema error' });
    await assert.rejects(
      () => extract(Buffer.from('x'), 'text/plain', ''),
      err => err && err.permanent && !err.retryable && /400/.test(err.message),
      '400 is permanent'
    );
  } finally {
    global.fetch = originalFetch;
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test('D4: re-uploading failed content requeues it, while routed duplicates stay duplicate', async () => {
  const intakeRouter = require('./intake');
  process.env.FEED_RAW_KEY = crypto.randomBytes(32).toString('base64');
  const queries = [];
  let duplicateStatus = 'failed';
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/INSERT INTO feed_intake/.test(sql)) return { rows: [], rowCount: 0 };
      if (/SELECT id, status FROM feed_intake/.test(sql)) return { rows: [{ id: 123, status: duplicateStatus }], rowCount: 1 };
      if (/UPDATE feed_intake/.test(sql)) return { rows: [{ id: 123, status: 'received' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  };
  const helpers = {
    hmac: v => crypto.createHmac('sha256', 'secret').update(v).digest('base64url'),
    timingEq: (a, b) => a === b,
    sameOrigin: () => true,
    alert: async () => {},
    loadSession: async () => ({ sid: 'sid' }),
  };
  const app = intakeRouter(pool, async () => ({ sid: 'sid' }), helpers);
  const csrf = helpers.hmac('sid:feed');

  const failedResp = await request(app, 'POST', '/api/feed/intake', { headers: { 'x-csrf-token': csrf, origin: 'http://127.0.0.1' }, body: makeTextUpload() });
  assert.strictEqual(failedResp.status, 200);
  assert.strictEqual(failedResp.json.status, 'received');
  assert.strictEqual(failedResp.json.requeued, true);
  assert(!failedResp.json.duplicate, 'failed reupload is not reported as a no-op duplicate');
  assert(queries.some(q => /attempt_count\s*=\s*0/i.test(q.sql) && /last_error\s*=\s*NULL/i.test(q.sql)), 'failed row is reset for processing');

  duplicateStatus = 'routed';
  const routedResp = await request(app, 'POST', '/api/feed/intake', { headers: { 'x-csrf-token': csrf, origin: 'http://127.0.0.1' }, body: makeTextUpload() });
  assert.strictEqual(routedResp.status, 200);
  assert.strictEqual(routedResp.json.status, 'routed');
  assert.strictEqual(routedResp.json.duplicate, true);
  assert(!routedResp.json.requeued, 'routed duplicate is never requeued');
  delete process.env.FEED_RAW_KEY;
});

test('D5: migration failure alerts, readiness is public boolean-only, healthz stays live, and retry can recover', async () => {
  delete require.cache[require.resolve('./migrate')];
  const { runFeedMigrations, feedSchemaReady } = require('./migrate');
  assert.strictEqual(typeof feedSchemaReady, 'function', 'migrate exports boolean schema readiness');

  let shouldFail = true;
  const pool = {
    async connect() {
      return {
        async query() {
          if (shouldFail) throw new Error('transient postgres blip');
          return { rows: [], rowCount: 0 };
        },
        release() {},
      };
    },
  };
  const alerts = [];
  await assert.rejects(() => runFeedMigrations(pool, async (event, detail) => alerts.push({ event, detail })), /transient postgres blip/);
  assert.strictEqual(feedSchemaReady(), false, 'schema readiness false after failure');
  assert.strictEqual(alerts.length, 1, 'migration failure sends alert');
  shouldFail = false;
  await runFeedMigrations(pool, async (event, detail) => alerts.push({ event, detail }));
  assert.strictEqual(feedSchemaReady(), true, 'subsequent migration retry succeeds without restart');

  const indexSrc = fs.readFileSync(path.join(root, 'gate', 'index.js'), 'utf8');
  assert(/app\.get\('\/healthz'[\s\S]*?res\.json\(\{\s*ok:\s*true/.test(indexSrc), '/healthz remains pure liveness');
  assert(/schema_ok/.test(indexSrc), 'a public readiness response exposes schema_ok');
});

test('D6: root npm test uses golden parity and startup self-check rejects bad registry without killing gate', async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.scripts && pkg.scripts.test, 'sh gate/feed/parity_test.sh');

  const goldenPath = path.join(__dirname, 'parity_expected.jsonl');
  assert(fs.existsSync(goldenPath), 'golden expected parity output is committed');

  const { runFeedStartupSelfCheck } = require('./startup_selfcheck');
  const { readyzResponse } = require('./readiness');
  const ok = runFeedStartupSelfCheck();
  assert.strictEqual(ok.ok, true, 'current registry passes startup self-check');

  const registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'routing_registry.json'), 'utf8'));
  registry.rules.sort((a, b) => String(a.rule_id).localeCompare(String(b.rule_id)));
  const tmp = path.join(process.env.TMPDIR || '/tmp', `registry-sorted-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify(registry));
  try {
    const bad = runFeedStartupSelfCheck({ registryPath: tmp });
    assert.strictEqual(bad.ok, false, 'sorted registry fails startup self-check');
    assert(/R-period-expense/.test(bad.error), 'failure names the registry ordering contract');
    const readyz = readyzResponse(true, bad.ok);
    assert.strictEqual(readyz.status, 200, 'bad registry does not make infrastructure readiness fail');
    assert.deepStrictEqual(readyz.body, { schema_ok: true, feed_workers_ok: false }, 'readyz body separates schema and feed worker health');
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('D7: n8n destination idempotency contract is read-then-append documentation only', async () => {
  const plan = fs.readFileSync(path.join(root, 'PLAN-FEED-ROUTER.md'), 'utf8');
  assert(/read-then-append/i.test(plan), 'PLAN-FEED-ROUTER records read-then-append');
  assert(!/UPSERT by idempotency_key BEFORE side-effect/i.test(plan), 'old upsert contract is removed');
});

(async () => {
  let failed = 0;
  for (const { name, fn } of test.tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (err) {
      failed++;
      console.error(`FAIL ${name}`);
      console.error(err && err.stack || err);
    }
  }
  if (failed) {
    console.error(`\n${failed} failure(s)`);
    process.exit(1);
  }
  console.log(`\n${test.tests.length} acceptance tests passed`);
})();
