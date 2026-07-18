/* Feed Router — Build #5a routing-stage PURE mappers.
   No DB, no I/O, no env — every export is a pure function so the whole file
   is testable offline (route_stage_selftest.js). Used by:
     - worker.js  (validated path): outboxTargets() to turn a routeDoc
       decision into feed_outbox rows.
     - dispatch.js (outbox dispatcher): incomingRow() to map an intake row +
       extracted Fact into the exact feed_incoming shape.

   CRITICAL: fact.dates.eta is free text from the LLM ("2026-08-01",
   "next week", "ASAP") but feed_incoming.eta is TIMESTAMPTZ. safeTimestamp()
   coerces to a real ISO string or null — an unparseable string must NEVER
   reach the DB and error the insert. */

const INTERNAL_DESTINATIONS = ['app_incoming', 'expense_hold'];
const EXTERNAL_DESTINATIONS = ['planetiq'];   // enqueued in #5a, dispatched in #5b

/* Destinations that become feed_outbox rows = decision.destinations minus
   'ledger' (always appended by route.js; written by the worker's ledger
   helper) and minus 'review' (handled by the worker's downgrade path,
   never an outbox row). PURE. */
function outboxTargets(destinations) {
  if (!Array.isArray(destinations)) return [];
  return destinations.filter((d) => d !== 'ledger' && d !== 'review');
}

/* Guard against V8's promiscuous Date.parse: bare numbers ("1" → year 2001),
   month names alone, etc. A value must LOOK like a date before we trust
   Date.parse on it. */
const DATE_LIKE = [
  /\d{4}-\d{1,2}-\d{1,2}/,                                  // 2026-08-01 / ISO
  /\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/,                      // 8/1/2026, 8-1-26
  /[A-Za-z]{3,9}\.?,?\s+\d{1,2}(st|nd|rd|th)?,?\s+\d{4}/i,  // Aug 1, 2026
  /\d{1,2}(st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?,?\s+\d{4}/i,    // 1 Aug 2026
];

/* string/Date → ISO string if it genuinely parses as a date, else null. PURE. */
function safeTimestamp(v) {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString();
  }
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  if (!DATE_LIKE.some((re) => re.test(s))) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/* intake row + extracted Fact → the exact feed_incoming column shape.
   Type-guards every money/count/date field: a wrong-typed LLM value becomes
   null, never a DB error. PURE. */
function incomingRow(intakeRow, fact, status) {
  fact = (fact && typeof fact === 'object') ? fact : {};
  const ent = fact.entities || {};
  const amounts = fact.amounts || {};
  const dates = fact.dates || {};
  return {
    fact_id: String(intakeRow.id),
    vendor: ent.vendor ?? null,
    job: ent.job ?? null,
    customer: ent.customer ?? null,
    summary: fact.summary ?? null,
    total: (typeof amounts.total === 'number' && Number.isFinite(amounts.total)) ? amounts.total : null,
    line_count: Number.isInteger(amounts.line_count) ? amounts.line_count : null,
    eta: safeTimestamp(dates.eta),
    status,
    received_at: intakeRow.created_at ?? null,
    doc_refs: { intake_id: intakeRow.id, content_hash: intakeRow.content_hash },
  };
}

module.exports = { INTERNAL_DESTINATIONS, EXTERNAL_DESTINATIONS, outboxTargets, safeTimestamp, incomingRow };
