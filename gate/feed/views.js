/* Feed Router — Build #6a: gated READ endpoints (PLAN-FEED-ROUTER.md items 8-9, read half).
   Two views, no writes:
   - GET /api/feed/incoming — feeds the Incoming board (feed_incoming, dispatcher-populated).
   - GET /api/feed/ledger   — audit read over feed_ledger (newest first).
   Upload UI / ledger HTML page / frontdoor registry nodes are Build #6b. */

const express = require('express');

/* ── Router factory (same mount style as gate/feed/intake.js) ───────────── */
module.exports = function feedViewsRouter(pool, requireSession) {
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
      res.json({ items: rows });
    } catch (e) {
      console.error('feed/ledger read failed:', e);
      res.status(500).json({ error: 'ledger unavailable' });
    }
  });

  return router;
};
