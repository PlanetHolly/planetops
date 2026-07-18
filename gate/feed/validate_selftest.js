/* Build #4b selftest — exercises the PURE validation logic with NO DB.
   Run: node gate/feed/validate_selftest.js */

'use strict';

const {
  normalizeVendor, semanticKey, evaluate,
  highDollarThreshold, HIGH_DOLLAR_DEFAULT, FINANCE_CATEGORIES,
} = require('./validate');

let n = 0, failed = 0;
function ok(cond, desc) {
  n++;
  if (cond) { console.log(`ok ${n} - ${desc}`); }
  else { failed++; console.log(`NOT OK ${n} - ${desc}`); }
}
function eq(a, b, desc) { ok(JSON.stringify(a) === JSON.stringify(b), `${desc} (got ${JSON.stringify(a)})`); }

/* ── normalizeVendor ────────────────────────────────────────────────────── */
eq(normalizeVendor('  Bear  Designz '), 'bear designz', 'normalizeVendor lowercases, trims, collapses spaces');
eq(normalizeVendor('MAX\t\nApparel'), 'max apparel', 'normalizeVendor collapses tabs/newlines');
eq(normalizeVendor('acme'), 'acme', 'normalizeVendor passes clean name through');
eq(normalizeVendor(''), '', 'normalizeVendor empty string -> \'\'');
eq(normalizeVendor('   '), '', 'normalizeVendor whitespace-only -> \'\'');
eq(normalizeVendor(null), '', 'normalizeVendor null -> \'\'');
eq(normalizeVendor(42), '', 'normalizeVendor non-string -> \'\'');

/* ── semanticKey ────────────────────────────────────────────────────────── */
function fact(over) {
  return Object.assign({
    doc_type: 'purchase_order',
    entities: { job: 'J-100', customer: null, vendor: 'Max Apparel', project: null },
    amounts: { total: 1200.5, currency: 'USD', line_count: 3 },
    dates: { eta: null, period: null, invoice_dates: [] },
    summary: 'test doc', confidence: 0.95,
  }, over);
}

eq(semanticKey('purchase_order', fact()), 'purchase_order|max apparel|j-100|1200.5',
   'semanticKey purchase_order = doc_type|vendor|job|total');
eq(semanticKey('inbound_order', fact({ doc_type: 'inbound_order' })), 'inbound_order|max apparel|j-100|1200.5',
   'semanticKey inbound_order same shape');
eq(semanticKey('purchase_order', fact({ entities: { job: null, customer: null, vendor: null, project: null } })), null,
   'semanticKey PO missing vendor -> null');
eq(semanticKey('purchase_order', fact({ amounts: { total: null, currency: null, line_count: null } })), null,
   'semanticKey PO missing total -> null');
eq(semanticKey('expense', fact({ doc_type: 'expense', dates: { eta: null, period: '2026-06', invoice_dates: [] } })),
   'expense|max apparel|1200.5|2026-06', 'semanticKey expense = doc_type|vendor|total|period');
eq(semanticKey('period_expense', fact({ doc_type: 'period_expense', entities: { job: null, customer: null, vendor: null, project: null } })), null,
   'semanticKey period_expense missing vendor -> null');
eq(semanticKey('payroll', fact({ doc_type: 'payroll', entities: { job: null, customer: null, vendor: 'Gusto', project: null }, dates: { eta: null, period: '2026-06-15', invoice_dates: [] } })),
   'payroll|gusto|2026-06-15|1200.5', 'semanticKey payroll = payroll|vendor|period|total');
eq(semanticKey('payroll', fact({ doc_type: 'payroll' })), null,
   'semanticKey payroll missing period -> null');
eq(semanticKey('financials', fact({ doc_type: 'financials', dates: { eta: null, period: 'Q2 2026', invoice_dates: [] } })),
   'financials|max apparel|q2 2026', 'semanticKey financials = financials|vendor|period');
eq(semanticKey('financials', fact({ doc_type: 'financials' })), null,
   'semanticKey financials missing period -> null');
eq(semanticKey('analytics_report', fact({ doc_type: 'analytics_report', dates: { eta: null, period: 'June 2026', invoice_dates: [] } })),
   'analytics|max apparel|june 2026', 'semanticKey analytics_report = analytics|vendor|period');
eq(semanticKey('other', fact({ doc_type: 'other' })), null, "semanticKey 'other' -> null (never dup-blocked)");
eq(semanticKey('mystery_type', fact()), null, 'semanticKey unknown doc_type -> null');
eq(semanticKey(null, fact()), null, 'semanticKey no doc_type -> null');
eq(semanticKey('purchase_order', null), null, 'semanticKey null fact -> null');

/* ── evaluate: clean routable fact ──────────────────────────────────────── */
const cleanCtx = { declared_category: 'purchase_order', knownVendor: true, duplicate: false, threshold: 5000 };
let v = evaluate(fact(), cleanCtx);
eq(v.status, 'validated', 'clean fact (known vendor, small $, matching cat, high conf, no dup) -> validated');
eq(v.reasons, [], 'clean fact -> no reasons');
eq(Object.keys(v.results).sort(),
   ['category_mismatch', 'duplicate', 'finance_category', 'high_dollar', 'low_confidence', 'unknown_vendor'],
   'results records all 6 checks');
ok(Object.values(v.results).every((x) => x === false), 'clean fact -> all 6 checks false');

/* ── each review-trigger INDEPENDENTLY forces review ────────────────────── */
// 1. unknown_vendor
v = evaluate(fact(), { ...cleanCtx, knownVendor: false });
eq(v.status, 'review', 'unknown_vendor: first-seen vendor -> review');
eq(v.reasons, ['unknown_vendor'], 'unknown_vendor is the only reason');
// ...but no vendor named must NOT trip it
v = evaluate(fact({ entities: { job: 'J-100', customer: null, vendor: null, project: null } }), { ...cleanCtx, knownVendor: false });
eq(v.status, 'validated', 'no vendor named -> unknown_vendor does NOT trip');

// 2. high_dollar
v = evaluate(fact({ amounts: { total: 5000, currency: 'USD', line_count: 1 } }), cleanCtx);
eq(v.status, 'review', 'high_dollar: total == threshold -> review (>= is inclusive)');
eq(v.reasons, ['high_dollar'], 'high_dollar is the only reason');
v = evaluate(fact({ amounts: { total: 4999.99, currency: 'USD', line_count: 1 } }), cleanCtx);
eq(v.status, 'validated', 'total just under threshold -> validated');
v = evaluate(fact({ amounts: { total: null, currency: null, line_count: null } }), cleanCtx);
eq(v.status, 'validated', 'null total -> high_dollar does not trip (route.js owns required-fields)');

// 3. finance_category — via detected doc_type AND via declared category
v = evaluate(fact({ doc_type: 'payroll' }), { ...cleanCtx, declared_category: 'payroll' });
eq(v.status, 'review', 'finance_category: doc_type payroll -> review');
eq(v.reasons, ['finance_category'], 'finance_category is the only reason (declared matches, small $)');
v = evaluate(fact({ doc_type: 'financials', amounts: { total: null, currency: null, line_count: null } }),
             { ...cleanCtx, declared_category: 'financials' });
eq(v.reasons, ['finance_category'], 'finance_category: financials trips too');
v = evaluate(fact(), { ...cleanCtx, declared_category: 'payroll' });
ok(v.status === 'review' && v.reasons.includes('finance_category'),
   'finance_category: DECLARED payroll trips even when detected is not finance');

// 4. category_mismatch
v = evaluate(fact({ doc_type: 'expense' }), { ...cleanCtx, declared_category: 'purchase_order' });
eq(v.status, 'review', 'category_mismatch: declared purchase_order vs detected expense -> review');
eq(v.reasons, ['category_mismatch'], 'category_mismatch is the only reason');
v = evaluate(fact(), { ...cleanCtx, declared_category: undefined });
eq(v.status, 'validated', 'no declared category -> mismatch does not trip');

// 5. duplicate
v = evaluate(fact(), { ...cleanCtx, duplicate: true });
eq(v.status, 'review', 'duplicate: semantic-key collision -> review');
eq(v.reasons, ['duplicate'], 'duplicate is the only reason');

// 6. low_confidence
v = evaluate(fact({ confidence: 0.3 }), cleanCtx);
eq(v.status, 'review', 'low_confidence: 0.3 < 0.6 -> review');
eq(v.reasons, ['low_confidence'], 'low_confidence is the only reason');
v = evaluate(fact({ confidence: 0.6 }), cleanCtx);
eq(v.status, 'validated', 'confidence exactly 0.6 -> validated (strict <)');

/* ── multiple triggers stack ────────────────────────────────────────────── */
v = evaluate(fact({ doc_type: 'payroll', amounts: { total: 99999, currency: 'USD', line_count: 1 }, confidence: 0.2 }),
             { declared_category: 'expense', knownVendor: false, duplicate: true, threshold: 5000 });
eq(v.status, 'review', 'many triggers at once -> review');
eq(v.reasons, ['unknown_vendor', 'high_dollar', 'finance_category', 'category_mismatch', 'duplicate', 'low_confidence'],
   'all 6 reasons reported in stable order');

/* ── fail-closed cases ──────────────────────────────────────────────────── */
v = evaluate(null, cleanCtx);
eq(v.status, 'review', 'FAIL CLOSED: null fact -> review');
eq(v.reasons, ['unvalidatable'], 'null fact -> unvalidatable');
v = evaluate({ entities: {}, amounts: {}, dates: {} }, cleanCtx);
eq(v.status, 'review', 'FAIL CLOSED: fact without doc_type -> review');
eq(v.reasons, ['unvalidatable'], 'no doc_type -> unvalidatable');
v = evaluate('not an object', cleanCtx);
eq(v.status, 'review', 'FAIL CLOSED: non-object fact -> review');
v = evaluate([], cleanCtx);
eq(v.status, 'review', 'FAIL CLOSED: array fact -> review');

/* Contract note: unknown_vendor trips ONLY on ctx.knownVendor === false (per
   spec); the worker ALWAYS supplies ctx with an explicit boolean. Missing ctx
   leaves the trigger untripped — documented behavior, not a gate the worker
   can reach. */
v = evaluate(fact(), undefined);
eq(v.results.unknown_vendor, false, 'ctx missing -> unknown_vendor untripped (worker always passes explicit boolean)');

/* ── env threshold ──────────────────────────────────────────────────────── */
eq(highDollarThreshold(), HIGH_DOLLAR_DEFAULT, 'highDollarThreshold default 5000 (env unset)');
process.env.FEED_HIGH_DOLLAR_THRESHOLD = '2500';
eq(highDollarThreshold(), 2500, 'FEED_HIGH_DOLLAR_THRESHOLD=2500 respected');
process.env.FEED_HIGH_DOLLAR_THRESHOLD = '-5';
eq(highDollarThreshold(), HIGH_DOLLAR_DEFAULT, 'negative env value rejected -> default');
delete process.env.FEED_HIGH_DOLLAR_THRESHOLD;

eq(FINANCE_CATEGORIES, ['payroll', 'financials'], 'FINANCE_CATEGORIES frozen list');

console.log(`\nvalidate_selftest: ${n - failed}/${n} passed${failed ? ' — FAILURES ABOVE' : ''}`);
process.exit(failed ? 1 : 0);
