/* Build #5a selftest — exercises the PURE routing-stage mappers with NO DB.
   Run: node gate/feed/route_stage_selftest.js */

'use strict';

const {
  INTERNAL_DESTINATIONS, EXTERNAL_DESTINATIONS,
  outboxTargets, safeTimestamp, incomingRow,
} = require('./route_stage');

let n = 0, failed = 0;
function ok(cond, desc) {
  n++;
  if (cond) { console.log(`ok ${n} - ${desc}`); }
  else { failed++; console.log(`NOT OK ${n} - ${desc}`); }
}
function eq(a, b, desc) { ok(JSON.stringify(a) === JSON.stringify(b), `${desc} (got ${JSON.stringify(a)})`); }

/* ── destination constants ──────────────────────────────────────────────── */
eq(INTERNAL_DESTINATIONS, ['app_incoming', 'expense_hold'], 'INTERNAL_DESTINATIONS = app_incoming, expense_hold');
eq(EXTERNAL_DESTINATIONS, ['planetiq'], 'EXTERNAL_DESTINATIONS = planetiq');

/* ── outboxTargets ──────────────────────────────────────────────────────── */
eq(outboxTargets(['app_incoming', 'ledger']), ['app_incoming'], 'outboxTargets drops ledger');
eq(outboxTargets(['review', 'ledger']), [], 'outboxTargets [review,ledger] -> [] (downgrade path, no outbox rows)');
eq(outboxTargets(['expense_hold', 'planetiq', 'ledger']), ['expense_hold', 'planetiq'],
   'outboxTargets keeps expense_hold + planetiq (external enqueued for #5b)');
eq(outboxTargets(['app_incoming', 'review', 'ledger']), ['app_incoming'], 'outboxTargets drops review AND ledger together');
eq(outboxTargets([]), [], 'outboxTargets empty -> []');
eq(outboxTargets(undefined), [], 'outboxTargets undefined -> []');
eq(outboxTargets(null), [], 'outboxTargets null -> []');

/* ── safeTimestamp ──────────────────────────────────────────────────────── */
eq(safeTimestamp('2026-08-01'), '2026-08-01T00:00:00.000Z', 'safeTimestamp ISO date -> ISO string (UTC midnight)');
eq(safeTimestamp('2026-08-01T14:30:00Z'), '2026-08-01T14:30:00.000Z', 'safeTimestamp full ISO -> ISO string');
eq(safeTimestamp('2026-08-01T14:30:00-07:00'), '2026-08-01T21:30:00.000Z', 'safeTimestamp offset ISO -> UTC ISO');
ok(safeTimestamp('8/1/2026') !== null, 'safeTimestamp US slash date parses (got ' + safeTimestamp('8/1/2026') + ')');
ok(safeTimestamp('Aug 1, 2026') !== null, 'safeTimestamp "Aug 1, 2026" parses (got ' + safeTimestamp('Aug 1, 2026') + ')');
eq(safeTimestamp('next week'), null, 'safeTimestamp "next week" -> null');
eq(safeTimestamp('ASAP'), null, 'safeTimestamp "ASAP" -> null');
eq(safeTimestamp('mid August'), null, 'safeTimestamp "mid August" -> null');
eq(safeTimestamp('TBD'), null, 'safeTimestamp "TBD" -> null');
eq(safeTimestamp(''), null, 'safeTimestamp empty string -> null');
eq(safeTimestamp('   '), null, 'safeTimestamp whitespace-only -> null');
eq(safeTimestamp(null), null, 'safeTimestamp null -> null');
eq(safeTimestamp(undefined), null, 'safeTimestamp undefined -> null');
eq(safeTimestamp(42), null, 'safeTimestamp number -> null');
eq(safeTimestamp('1'), null, 'safeTimestamp bare "1" -> null (V8 Date.parse would say year 2001)');
eq(safeTimestamp('garbage 123 xyz'), null, 'safeTimestamp garbage -> null');
eq(safeTimestamp('2026-99-99'), null, 'safeTimestamp date-like but invalid (2026-99-99) -> null');
eq(safeTimestamp(new Date('2026-08-01T00:00:00Z')), '2026-08-01T00:00:00.000Z', 'safeTimestamp Date object -> ISO');
eq(safeTimestamp(new Date('nope')), null, 'safeTimestamp Invalid Date -> null');

/* ── incomingRow ────────────────────────────────────────────────────────── */
const intake = {
  id: 42,
  content_hash: 'abc123',
  declared_category: 'orders',
  created_at: '2026-07-17T10:00:00.000Z',
};
const fullFact = {
  doc_type: 'inbound_order',
  entities: { job: 'J-1001', customer: 'Iron & Velvet', vendor: 'Max Apparel', project: null },
  amounts: { total: 1200.5, currency: 'USD', line_count: 3 },
  dates: { eta: '2026-08-01', period: null, invoice_dates: [] },
  summary: '48pc hoodie order', confidence: 0.95,
};

const r1 = incomingRow(intake, fullFact, 'routed');
eq(r1.fact_id, '42', 'incomingRow fact_id = String(intake.id)');
ok(typeof r1.fact_id === 'string', 'incomingRow fact_id is a string');
eq(r1.vendor, 'Max Apparel', 'incomingRow vendor from entities.vendor');
eq(r1.job, 'J-1001', 'incomingRow job from entities.job');
eq(r1.customer, 'Iron & Velvet', 'incomingRow customer from entities.customer');
eq(r1.summary, '48pc hoodie order', 'incomingRow summary passes through');
eq(r1.total, 1200.5, 'incomingRow numeric total passes through');
eq(r1.line_count, 3, 'incomingRow integer line_count passes through');
eq(r1.eta, '2026-08-01T00:00:00.000Z', 'incomingRow eta coerced via safeTimestamp');
eq(r1.status, 'routed', 'incomingRow status = passed-in status');
eq(r1.received_at, '2026-07-17T10:00:00.000Z', 'incomingRow received_at = intake.created_at');
eq(r1.doc_refs, { intake_id: 42, content_hash: 'abc123' }, 'incomingRow doc_refs = {intake_id, content_hash}');

const badFact = {
  doc_type: 'expense',
  entities: {},
  amounts: { total: '1200', currency: 'USD', line_count: 3.5 },
  dates: { eta: 'ASAP', period: null, invoice_dates: [] },
  summary: null, confidence: 0.4,
};
const r2 = incomingRow(intake, badFact, 'routed');
eq(r2.vendor, null, 'incomingRow missing vendor -> null');
eq(r2.job, null, 'incomingRow missing job -> null');
eq(r2.customer, null, 'incomingRow missing customer -> null');
eq(r2.summary, null, 'incomingRow null summary -> null');
eq(r2.total, null, 'incomingRow string total "1200" -> null (type-guarded)');
eq(r2.line_count, null, 'incomingRow non-integer line_count 3.5 -> null');
eq(r2.eta, null, 'incomingRow eta "ASAP" -> null (never reaches TIMESTAMPTZ)');

const r3 = incomingRow(intake, { amounts: { total: NaN, line_count: 2 } }, 'routed');
eq(r3.total, null, 'incomingRow NaN total -> null');
eq(r3.line_count, 2, 'incomingRow line_count works without full fact shape');

const r4 = incomingRow(intake, null, 'routed');
eq(r4.fact_id, '42', 'incomingRow tolerates null fact (fact_id still set)');
eq(r4.total, null, 'incomingRow null fact -> null total');

/* ── summary ────────────────────────────────────────────────────────────── */
console.log(`\n${n - failed}/${n} passed`);
if (failed) { console.log('SELFTEST FAILED'); process.exit(1); }
console.log('SELFTEST PASSED');
