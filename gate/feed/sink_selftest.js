/* Build #5b selftest — exercises the PURE pieces of the external sink with
   NO DB and NO network. What needs Postgres or a live n8n webhook (graduation
   gate, release, claim/POST/ack, held path, config-halt) is NOT faked here —
   it is verified in staging.
   Run: node gate/feed/sink_selftest.js */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildSinkBody, buildSinkHeaders, sinkUrl } = require('./sink');

let n = 0, failed = 0;
function ok(cond, desc) {
  n++;
  if (cond) { console.log(`ok ${n} - ${desc}`); }
  else { failed++; console.log(`NOT OK ${n} - ${desc}`); }
}
function eq(a, b, desc) { ok(JSON.stringify(a) === JSON.stringify(b), `${desc} (got ${JSON.stringify(a)})`); }

/* ── fixtures — a hostile fact that TRIES to smuggle a URL/secret ───────── */
const obRow = { id: 7, intake_id: 42, destination: 'planetiq', attempts: 1, idempotency_key: '42:planetiq' };
const intake = { id: 42, content_hash: 'abc123', doc_type: 'vendor_invoice', declared_category: 'general', extracted: null };
const hostileFact = {
  doc_type: 'vendor_invoice',
  url: 'https://evil.example/exfil',
  webhook_url: 'https://evil.example/hook',
  sink_url: 'https://evil.example/sink',
  secret: 'stolen',
  entities: { vendor: 'Max Apparel' },
  amounts: { total: 1234.56 },
};

/* ── buildSinkBody: exact POST body shape ───────────────────────────────── */
const body = buildSinkBody(obRow, intake, hostileFact);
eq(Object.keys(body).sort(),
   ['content_hash', 'destination', 'doc_type', 'fact', 'idempotency_key', 'intake_id'],
   'body has EXACTLY the six contract fields');
eq(body.idempotency_key, '42:planetiq', 'idempotency_key taken from the outbox row');
eq(body.destination, 'planetiq', 'destination from the outbox row');
eq(body.doc_type, 'vendor_invoice', 'doc_type from the intake row');
eq(body.intake_id, 42, 'intake_id from the outbox row');
eq(body.content_hash, 'abc123', 'content_hash from the intake row');
ok(body.fact === hostileFact, 'fact passed through as-is (data, not routing)');

/* ── idempotency_key fallback + null tolerance ──────────────────────────── */
const bodyNoKey = buildSinkBody({ id: 8, intake_id: 43, destination: 'planetiq', attempts: 1 },
                                { id: 43, doc_type: null, content_hash: undefined }, { a: 1 });
eq(bodyNoKey.idempotency_key, '43:planetiq', 'missing idempotency_key reconstructed as `${intake_id}:${destination}`');
eq(bodyNoKey.doc_type, null, 'null doc_type stays null (never invented)');
eq(bodyNoKey.content_hash, null, 'missing content_hash -> null');

/* ── THE URL IS NEVER TAKEN FROM THE FACT ───────────────────────────────── */
// 1. The body carries no URL field at any top level, no matter what the fact holds.
ok(!('url' in body) && !('webhook_url' in body) && !('sink_url' in body),
   'no url/webhook_url/sink_url field at the top of the POST body');
// 2. sinkUrl() takes ZERO arguments — it CANNOT see a fact, intake, or row.
eq(sinkUrl.length, 0, 'sinkUrl() takes no arguments (cannot be fed a document)');
// 3. sinkUrl() reads only the env var, verbatim.
const prev = process.env.FEED_SINK_URL;
process.env.FEED_SINK_URL = 'https://n8n.example/webhook/feed-sink';
eq(sinkUrl(), 'https://n8n.example/webhook/feed-sink', 'sinkUrl() returns FEED_SINK_URL verbatim');
delete process.env.FEED_SINK_URL;
eq(sinkUrl(), '', 'sinkUrl() with env unset -> empty string (config-halt trigger)');
if (prev !== undefined) process.env.FEED_SINK_URL = prev;
// 4. Source-level: sink.js contains exactly ONE fetch call, its target is the
//    sinkUrl() local, and no fact/intake property is ever used as a URL.
const src = fs.readFileSync(path.join(__dirname, 'sink.js'), 'utf8');
const fetchCalls = src.match(/\bfetch\s*\(/g) || [];
eq(fetchCalls.length, 1, 'sink.js contains exactly one fetch call');
ok(/const url = sinkUrl\(\);[\s\S]*?fetch\(url,/.test(src), 'the one fetch targets the env-derived sinkUrl() value');
ok(!/fetch\(\s*(fact|intake|obRow|body)/.test(src), 'fetch is never called with a fact/intake/row-derived target');
ok(!/(fact|intake)\s*\.\s*(url|webhook|endpoint|sink_url)/.test(src), 'no fact/intake URL-ish property is ever read');

/* ── buildSinkHeaders: secret rides in the header, never the URL ────────── */
const headers = buildSinkHeaders('s3cret');
eq(headers, { 'content-type': 'application/json', 'x-feed-secret': 's3cret' },
   'headers = content-type json + x-feed-secret');
ok(!JSON.stringify(body).includes('s3cret'), 'the secret never appears in the POST body');
ok(!src.includes('FEED_SINK_SECRET}') && !/\$\{.*sinkSecret/.test(src),
   'the secret is never interpolated into a URL/template string in sink.js');

/* ── NOT unit-testable without a DB or network (stated, not faked) ──────── */
// - releaseHeld / claimBatch / graduation gate / held-state write / acked-state
//   write / setGraduation: all require real Postgres.
// - The live POST, 2xx/non-2xx handling, AbortSignal timeout, retry-to-failed
//   + alert: require a reachable FEED_SINK_URL.
// - Config-halt loop timing: requires the running process.
// These are verified in staging, per the build instructions.

console.log(failed === 0 ? `\nALL ${n} PASSED` : `\n${failed}/${n} FAILED`);
process.exit(failed === 0 ? 0 : 1);
