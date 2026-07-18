/* Feed Router — Build #4b: deterministic validation (the MONEY-SAFETY GATE).

   Takes an EXTRACTED Fact and decides: safe to auto-route ('validated') or
   must a human see it first ('review')? It routes NOTHING (that's Build #5),
   and it does NOT re-implement route.js's required_fields / rule matching —
   this is the ADDITIONAL fail-closed layer routing does not do:

     review-triggers  — any ONE trips 'review', even if extraction succeeded:
       unknown_vendor · high_dollar · finance_category · category_mismatch ·
       duplicate · low_confidence
     semantic key     — per-doc-type logical identity for duplicate detection
     vendor catalog   — feed_vendors; first-seen vendors self-register as
                        'pending' AND force review; a human promotes to 'known'

   FAIL CLOSED: malformed/missing input → 'review', never 'validated'.

   evaluate() and semanticKey() and normalizeVendor() are PURE (no I/O).
   The feed_vendors / duplicate helpers at the bottom are thin DB wrappers.

   Env:
     FEED_HIGH_DOLLAR_THRESHOLD  default 5000 (USD; total >= threshold → review)
     FEED_MIN_CONFIDENCE         default 0.6  (confidence <  min → review)
*/

'use strict';

/* ── constants / env ────────────────────────────────────────────────────── */
const HIGH_DOLLAR_DEFAULT = 5000;
const MIN_CONFIDENCE_DEFAULT = 0.6;
const FINANCE_CATEGORIES = ['payroll', 'financials'];

/* Trigger order is the order reasons are reported in. */
const TRIGGERS = ['unknown_vendor', 'high_dollar', 'finance_category',
                  'category_mismatch', 'duplicate', 'low_confidence'];

function highDollarThreshold() {
  const v = Number(process.env.FEED_HIGH_DOLLAR_THRESHOLD);
  // 0 is a legal operator choice (= review everything); negative/NaN → default.
  return Number.isFinite(v) && v >= 0 ? v : HIGH_DOLLAR_DEFAULT;
}

function minConfidence() {
  const v = Number(process.env.FEED_MIN_CONFIDENCE);
  return Number.isFinite(v) ? v : MIN_CONFIDENCE_DEFAULT;
}

/* ── normalizeVendor — PURE ─────────────────────────────────────────────── */
/* Lowercased, trimmed, internal whitespace collapsed; '' for empty/non-string.
   Used BOTH for feed_vendors matching and for semantic-key building. */
function normalizeVendor(name) {
  if (typeof name !== 'string') return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/* ── semanticKey — PURE ─────────────────────────────────────────────────── */
/* Per-doc-type logical identity, composed ONLY from Fact fields that exist
   in EXTRACTION_SCHEMA (there is no doc#/invoice# field). Returns null when
   the key components are missing — null means SKIP the duplicate check; a
   key is never invented. 'other' (and unknown doc types) → null: never
   dup-blocked. contentHash is accepted for signature stability but is NOT
   used as a fallback component (content-hash dedupe already happens at
   intake; inventing keys from it would fake logical identity).            */
function semanticKey(doc_type, fact /* , contentHash */) {
  if (!doc_type || !fact || typeof fact !== 'object') return null;
  const ent = fact.entities || {};
  const amounts = fact.amounts || {};
  const dates = fact.dates || {};
  const nvendor = normalizeVendor(ent.vendor);
  const njob = normalizeVendor(ent.job);      // same normalization as vendor
  const nperiod = normalizeVendor(dates.period);
  const total = amounts.total;
  const hasTotal = typeof total === 'number' && Number.isFinite(total);

  switch (doc_type) {
    case 'purchase_order':
    case 'inbound_order':
      return (nvendor && hasTotal) ? `${doc_type}|${nvendor}|${njob}|${total}` : null;
    case 'expense':
    case 'period_expense':
      return (nvendor && hasTotal) ? `${doc_type}|${nvendor}|${total}|${nperiod}` : null;
    case 'payroll':
      return (nperiod && hasTotal) ? `payroll|${nvendor}|${nperiod}|${total}` : null;
    case 'financials':
      return nperiod ? `financials|${nvendor}|${nperiod}` : null;
    case 'analytics_report':
      return nperiod ? `analytics|${nvendor}|${nperiod}` : null;
    default:
      return null;
  }
}

/* ── evaluate — PURE, the core fail-closed decision ─────────────────────── */
/* ctx = { declared_category, knownVendor:boolean, duplicate:boolean, threshold:number }
   Returns { status:'validated'|'review', reasons:[typed strings], results:{...} }.
   ANY tripped trigger ⇒ 'review'. results records every check's boolean
   outcome for the audit ledger. Malformed fact / missing doc_type ⇒
   'review' + ['unvalidatable'] — NEVER 'validated' on bad input.          */
function evaluate(fact, ctx) {
  ctx = ctx || {};

  if (!fact || typeof fact !== 'object' || Array.isArray(fact) || !fact.doc_type) {
    return { status: 'review', reasons: ['unvalidatable'], results: { unvalidatable: true } };
  }

  const ent = fact.entities || {};
  const amounts = fact.amounts || {};
  const threshold = (typeof ctx.threshold === 'number' && Number.isFinite(ctx.threshold) && ctx.threshold >= 0)
    ? ctx.threshold : highDollarThreshold();

  const vendorPresent = normalizeVendor(ent.vendor) !== '';

  const results = {
    // 1. vendor named but not status='known' in feed_vendors (first-seen ⇒ review)
    unknown_vendor: vendorPresent && ctx.knownVendor === false,
    // 2. numeric total at or above the high-dollar threshold
    high_dollar: typeof amounts.total === 'number' && amounts.total >= threshold,
    // 3. money-critical category, whether detected or declared
    finance_category: FINANCE_CATEGORIES.includes(fact.doc_type)
                   || FINANCE_CATEGORIES.includes(ctx.declared_category),
    // 4. submitter said one thing, extractor saw another
    category_mismatch: Boolean(ctx.declared_category) && Boolean(fact.doc_type)
                    && ctx.declared_category !== fact.doc_type,
    // 5. semantic-key collision found by the worker
    duplicate: ctx.duplicate === true,
    // 6. weak extra signal — NOT the primary gate
    low_confidence: typeof fact.confidence === 'number' && fact.confidence < minConfidence(),
  };

  const reasons = TRIGGERS.filter((t) => results[t] === true);
  return { status: reasons.length ? 'review' : 'validated', reasons, results };
}

/* ── vendor catalog helpers (thin DB wrappers) ──────────────────────────── */
/* true only if a feed_vendors row with that normalized_name is status='known'. */
async function isKnownVendor(pool, normalized) {
  if (!normalized) return false;
  const r = await pool.query(
    `SELECT 1 FROM feed_vendors WHERE normalized_name = $1 AND status = 'known'`,
    [normalized]
  );
  return r.rowCount > 0;
}

/* First-seen vendors self-register as 'pending'; a human promotes to 'known'
   when clearing review. Never overwrites an existing row. */
async function addPendingVendor(pool, normalized, display) {
  if (!normalized) return;
  await pool.query(
    `INSERT INTO feed_vendors (normalized_name, display_name, status, source)
     VALUES ($1, $2, 'pending', 'auto')
     ON CONFLICT (normalized_name) DO NOTHING`,
    [normalized, (typeof display === 'string' && display.trim()) ? display.trim() : normalized]
  );
}

/* ROLLOUT seeding entry point (the later Printavo/Streak vendor import calls
   this). Upserts each name as status='known'. Returns how many were seeded. */
async function seedKnownVendors(pool, names) {
  let seeded = 0;
  for (const name of Array.isArray(names) ? names : []) {
    const normalized = normalizeVendor(name);
    if (!normalized) continue;   // skip empty/blank
    await pool.query(
      `INSERT INTO feed_vendors (normalized_name, display_name, status, source)
       VALUES ($1, $2, 'known', 'seed')
       ON CONFLICT (normalized_name) DO UPDATE SET status = 'known', source = 'seed'`,
      [normalized, String(name).trim()]
    );
    seeded++;
  }
  return seeded;
}

/* ── semantic-duplicate check ───────────────────────────────────────────── */
/* true if ANOTHER feed_intake row shares this semantic_key and is not itself
   failed/review (a prior validated/extracted/routed row with the same key ⇒
   this new one is a logical duplicate ⇒ review). null key ⇒ no dup check. */
async function findDuplicate(pool, semKey, selfId) {
  if (!semKey) return false;
  const r = await pool.query(
    `SELECT 1 FROM feed_intake
     WHERE semantic_key = $1 AND id <> $2 AND status NOT IN ('failed', 'review')
     LIMIT 1`,
    [semKey, selfId]
  );
  return r.rowCount > 0;
}

module.exports = {
  HIGH_DOLLAR_DEFAULT,
  MIN_CONFIDENCE_DEFAULT,
  FINANCE_CATEGORIES,
  highDollarThreshold,
  minConfidence,
  normalizeVendor,
  semanticKey,
  evaluate,
  isKnownVendor,
  addPendingVendor,
  seedKnownVendors,
  findDuplicate,
};
