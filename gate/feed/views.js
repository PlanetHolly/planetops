/* Feed Router — Build #6a: gated READ endpoints (PLAN-FEED-ROUTER.md items 8-9, read half).
   Two views, no writes:
   - GET /api/feed/incoming — feeds the Incoming board (feed_incoming, dispatcher-populated).
   - GET /api/feed/ledger   — audit read over feed_ledger (newest first).
   Upload UI / ledger HTML page / frontdoor registry nodes are Build #6b. */

const express = require('express');
const { feedRawKey, decryptRaw, FINANCE_CATEGORIES } = require('./intake');

function isFinanceCategory(category) {
  return FINANCE_CATEGORIES.includes(String(category || ''));
}

function sanitizeValidatorResults(validatorResults) {
  if (!validatorResults || typeof validatorResults !== 'object') return validatorResults || null;
  return {
    checks: validatorResults.checks || {},
    reasons: Array.isArray(validatorResults.reasons) ? validatorResults.reasons : [],
  };
}

function sanitizeLedgerRow(row, financeUnlocked) {
  const isFinance = isFinanceCategory(row.detected_category) || isFinanceCategory(row.declared_category);
  const sanitized = {
    ...row,
    validator_results: sanitizeValidatorResults(row.validator_results),
  };
  if (isFinance && !financeUnlocked) {
    return {
      intake_id: row.intake_id,
      doc_type: row.detected_category || null,
      created_at: row.created_at,
      decision: row.decision && typeof row.decision === 'object' ? { stage: row.decision.stage || null, reasons: row.decision.reasons || [] } : row.decision,
      validator_results: sanitized.validator_results,
    };
  }
  return sanitized;
}

function decryptReviewPayload(row) {
  if (!row.payload_enc) return row.payload || null;
  const key = feedRawKey();
  if (!key) throw new Error('FEED_RAW_KEY is required to decrypt finance review payloads');
  const parsed = JSON.parse(decryptRaw(key, row.payload_enc).toString('utf8'));
  return parsed && Object.prototype.hasOwnProperty.call(parsed, 'fact') ? parsed.fact : parsed;
}

/* ── Router factory (same mount style as gate/feed/intake.js) ───────────── */
function feedViewsRouter(pool, requireSession, requireFinance) {
  if (typeof requireFinance !== 'function') {
    throw new Error('feedViewsRouter requires a finance gate for /api/feed/review');
  }
  const router = express.Router();

  router.get('/api/feed/incoming', async (req, res) => {
    if (!await requireSession(req, res)) return;
    res.set('Cache-Control', 'no-store, private');
    try {
      const { rows } = await pool.query(
        `SELECT fact_id, vendor, job, customer, summary, total, line_count, eta, status, received_at, doc_refs
           FROM feed_incoming
          ORDER BY received_at DESC NULLS LAST
          LIMIT 500`);
      res.json({
        generated_at: new Date().toISOString(),
        items: rows.map(r => ({
          ...r,
          total: r.total === null ? null : Number(r.total),                    // pg NUMERIC → string
          eta:   r.eta ? new Date(r.eta).toISOString().slice(0, 10) : null,    // TIMESTAMPTZ → bare YYYY-MM-DD (board's parseEta format)
        })),
      });
    } catch (e) {
      console.error('feed/incoming read failed:', e);
      res.status(500).json({ error: 'incoming unavailable' });
    }
  });

  router.get('/api/feed/ledger', async (req, res) => {
    if (!await requireSession(req, res)) return;
    res.set('Cache-Control', 'no-store, private');
    try {
      const { rows } = await pool.query(
        `SELECT id, intake_id, content_hash, detected_category, declared_category, extractor_version, model, token_usage, validator_results, decision, created_at
           FROM feed_ledger
          ORDER BY created_at DESC
          LIMIT 200`);
      res.json({ items: rows.map(row => sanitizeLedgerRow(row, false)) });
    } catch (e) {
      console.error('feed/ledger read failed:', e);
      res.status(500).json({ error: 'ledger unavailable' });
    }
  });

  router.get('/api/feed/review', async (req, res) => {
    if (!await requireFinance(req, res)) return;
    res.set('Cache-Control', 'no-store, private');
    try {
      const { rows } = await pool.query(
        `SELECT r.id, r.intake_id, r.reason, r.payload, r.payload_enc, r.created_at,
                i.doc_type, i.declared_category, i.status, i.review_reason
           FROM feed_review r
           LEFT JOIN feed_intake i ON i.id = r.intake_id
          WHERE r.resolved_at IS NULL
          ORDER BY r.created_at DESC
          LIMIT 200`);
      res.json({
        generated_at: new Date().toISOString(),
        items: rows.map(row => ({ ...row, payload: decryptReviewPayload(row), payload_enc: undefined })),
      });
    } catch (e) {
      console.error('feed/review read failed:', e);
      res.status(500).json({ error: 'review unavailable' });
    }
  });

  return router;
}

module.exports = feedViewsRouter;
module.exports.sanitizeLedgerRow = sanitizeLedgerRow;
module.exports.sanitizeValidatorResults = sanitizeValidatorResults;
