/* Feed Router — Build #5b external n8n sink (EXTERNAL destinations ONLY).
   THIS IS THE REAL-MONEY EXTERNAL WRITE PATH. Default posture: SHADOW.

   A THIRD self-scheduling loop, separate from the extraction worker and the
   internal outbox dispatcher, that drains feed_outbox rows whose destination
   is EXTERNAL ('planetiq' — route_stage.EXTERNAL_DESTINATIONS). Each claimed
   row passes the GRADUATION GATE (feed_graduation.external_writes_enabled per
   doc_type):
     NOT graduated → state='held' + a 'feed_sink_held' shadow would-write log.
                     NOTHING leaves the process. feed_graduation has NO rows
                     by default, so every doc_type starts held (plan §A1).
     graduated     → POST to FEED_SINK_URL with the x-feed-secret header and
                     an idempotency_key body; 2xx ⇒ 'acked', otherwise bounded
                     retry ('pending') until FEED_OUTBOX_MAX_ATTEMPTS, then
                     'failed' + alert (dead-letter).
   A cheap RELEASE step runs every cycle: 'held' rows whose doc_type is NOW
   graduated flip back to 'pending', so turning graduation on delivers the
   accumulated backlog.

   URL DISCIPLINE (plan R1 #24): the POST target is FEED_SINK_URL — an env
   allowlist of exactly one — and is NEVER derived from the document, the
   fact, or any DB row. The shared secret rides in the x-feed-secret header
   (mirroring the ship-deck x-shipdeck-secret precedent), never in the URL;
   n8n rejects + alerts when it is missing.

   CONFIG HALT: with FEED_SINK_URL or FEED_SINK_SECRET unset, the loop claims
   NOTHING and sleeps HALT_MS — external rows simply wait, exactly like the
   extraction worker waits without ANTHROPIC_API_KEY. Nothing dead-letters on
   missing config.

   Delivery semantics mirror dispatch.js: claim 'pending' external rows (and
   ORPHAN-RECLAIM stale 'sent' rows older than FEED_OUTBOX_STALE_MS) with
   FOR UPDATE SKIP LOCKED → 'sent' in one committed txn; attempts increment on
   every claim so a row that repeatedly crashes mid-POST dead-letters instead
   of looping. The n8n side of the contract (enforced there): reject missing
   secret/idempotency_key, UPSERT by idempotency_key BEFORE any side-effect,
   return 2xx only once the write is durable — so a retried POST is replay-safe.

   HARD concurrency = 1 in-process (own cycleRunning guard); all timers
   .unref() so the loop never holds the process open. */

const crypto = require('crypto');
const os = require('os');
const { EXTERNAL_DESTINATIONS } = require('./route_stage');

const POLL_MS    = 5_000;    // idle poll
const BUSY_MS    = 250;      // fast re-poll after doing work
const BACKOFF_MS = 30_000;   // after a cycle-level error
const HALT_MS    = 60_000;   // unconfigured (no FEED_SINK_URL/SECRET)
const BATCH_SIZE = 10;

const SINK_ID = `${os.hostname()}-${process.pid}-sink-${crypto.randomBytes(3).toString('hex')}`;

let timer = null;
let stopped = true;
let cycleRunning = false;
let haltLogged = false;   // dedupe the unconfigured log

function log(event, detail) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, sink_id: SINK_ID, ...detail }));
}

/* ── env (all read at call time, never cached) ──────────────────────────── */
function sinkUrl()    { return process.env.FEED_SINK_URL || ''; }      // the ONLY POST target — env-only, never doc-derived
function sinkSecret() { return process.env.FEED_SINK_SECRET || ''; }
function timeoutMs()  { return parseInt(process.env.FEED_SINK_TIMEOUT_MS, 10) || 15_000; }
function maxAttempts(){ return parseInt(process.env.FEED_OUTBOX_MAX_ATTEMPTS, 10) || 5; }
function staleMs()    { return parseInt(process.env.FEED_OUTBOX_STALE_MS, 10) || 300_000; }

/* ── pure helpers (unit-tested in sink_selftest.js) ─────────────────────── */
// The POST body. Exactly these six fields — NO URL of any kind lives here or
// is read from here; the target is sinkUrl() alone.
function buildSinkBody(obRow, intake, fact) {
  return {
    idempotency_key: obRow.idempotency_key || `${obRow.intake_id}:${obRow.destination}`,
    destination: obRow.destination,
    doc_type: intake.doc_type ?? null,
    intake_id: obRow.intake_id,
    content_hash: intake.content_hash ?? null,
    fact,
  };
}

// Secret travels as a header, never in the URL (ship-deck precedent).
function buildSinkHeaders(secret) {
  return { 'content-type': 'application/json', 'x-feed-secret': secret };
}

function schedule(pool, alert, ms) {
  if (stopped) return;
  timer = setTimeout(() => { runCycle(pool, alert); }, ms);
  if (timer.unref) timer.unref();
}

/* ── release: held rows whose doc_type has since graduated → pending ────── */
async function releaseHeld(pool) {
  const r = await pool.query(
    `UPDATE feed_outbox o SET state='pending', updated_at=now()
     FROM feed_intake i, feed_graduation g
     WHERE o.state='held' AND o.destination = ANY($1::text[])
       AND o.intake_id = i.id AND g.doc_type = i.doc_type AND g.external_writes_enabled = true`,
    [EXTERNAL_DESTINATIONS]
  );
  if (r.rowCount) log('feed_sink_released', { count: r.rowCount });
}

/* ── claim: one txn — pending external rows → 'sent' (in-flight) ────────── */
async function claimBatch(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sel = await client.query(
      `SELECT id FROM feed_outbox
       WHERE destination = ANY($1)
         AND ( state = 'pending'
               OR (state = 'sent' AND updated_at < now() - ($2 * interval '1 millisecond')) )
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT ${BATCH_SIZE}`,
      [EXTERNAL_DESTINATIONS, staleMs()]
    );
    if (!sel.rows.length) { await client.query('COMMIT'); return []; }
    const ids = sel.rows.map((r) => r.id);
    const upd = await client.query(
      `UPDATE feed_outbox
       SET state='sent', attempts=attempts+1, updated_at=now()
       WHERE id = ANY($1)
       RETURNING id, intake_id, destination, attempts, idempotency_key`,
      [ids]
    );
    await client.query('COMMIT');
    return upd.rows;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

/* ── deliver ONE claimed row: gate → hold OR POST; never throws upward ──── */
async function deliver(pool, alert, obRow) {
  let intake = null;
  try {
    const ir = await pool.query(
      `SELECT id, content_hash, doc_type, declared_category, extracted
       FROM feed_intake WHERE id = $1`,
      [obRow.intake_id]
    );
    intake = ir.rows[0];
    if (!intake) throw new Error(`intake row ${obRow.intake_id} not found`);
    const fact = intake.extracted;   // JSONB → already an object via pg
    if (!fact || typeof fact !== 'object') throw new Error(`intake row ${obRow.intake_id} has no extracted fact`);

    // GRADUATION GATE — fail closed. No feed_graduation row, or a row with
    // external_writes_enabled !== true, or a null doc_type ⇒ NOT graduated.
    const gr = await pool.query(
      `SELECT external_writes_enabled FROM feed_graduation WHERE doc_type = $1`,
      [intake.doc_type]
    );
    const graduated = gr.rows.length > 0 && gr.rows[0].external_writes_enabled === true;

    if (!graduated) {
      // SHADOW: record the would-write, hold the row, POST nothing.
      await pool.query(
        `UPDATE feed_outbox SET state='held', updated_at=now() WHERE id = $1`,
        [obRow.id]
      );
      log('feed_sink_held', {
        outbox_id: obRow.id, intake_id: obRow.intake_id,
        doc_type: intake.doc_type ?? null, destination: obRow.destination,
        note: 'shadow would-write — doc_type not graduated; held until released',
      });
      return true;
    }

    // Graduated ⇒ the real external POST. URL is env-only (see header).
    const url = sinkUrl();
    const secret = sinkSecret();
    if (!url || !secret) throw new Error('FEED_SINK_URL/FEED_SINK_SECRET unset mid-cycle');   // → retry path; config-halt catches it next cycle
    const res = await fetch(url, {
      method: 'POST',
      headers: buildSinkHeaders(secret),
      body: JSON.stringify(buildSinkBody(obRow, intake, fact)),
      signal: AbortSignal.timeout(timeoutMs()),
    });
    if (!(res.status >= 200 && res.status < 300)) {
      throw new Error(`sink responded ${res.status}`);
    }

    await pool.query(
      `UPDATE feed_outbox SET state='acked', last_error=NULL, updated_at=now() WHERE id = $1`,
      [obRow.id]
    );
    log('feed_sink_delivered', {
      outbox_id: obRow.id, intake_id: obRow.intake_id,
      doc_type: intake.doc_type, destination: obRow.destination, status: res.status,
    });
    return true;
  } catch (e) {
    const msg = String(e.message || e).slice(0, 2000);
    try {
      if (obRow.attempts < maxAttempts()) {
        await pool.query(
          `UPDATE feed_outbox SET state='pending', last_error=$2, updated_at=now() WHERE id = $1`,
          [obRow.id, msg]
        );
        log('feed_sink_retry', { outbox_id: obRow.id, intake_id: obRow.intake_id, destination: obRow.destination, attempt: obRow.attempts, error: msg.slice(0, 500) });
      } else {
        await pool.query(
          `UPDATE feed_outbox SET state='failed', last_error=$2, updated_at=now() WHERE id = $1`,
          [obRow.id, msg]
        );
        await alert('feed_sink_failed', {
          msg: `Feed external sink delivery to '${obRow.destination}' failed permanently after ${obRow.attempts} attempts.`,
          outbox_id: obRow.id, intake_id: obRow.intake_id, destination: obRow.destination,
          doc_type: intake ? (intake.doc_type ?? null) : null, error: msg.slice(0, 500),
        });
      }
    } catch (e2) {
      // Even the state write failed (DB down) — the row stays 'sent' and the
      // stale-'sent' reclaim in claimBatch picks it up after FEED_OUTBOX_STALE_MS.
      log('feed_sink_state_write_failed', { outbox_id: obRow.id, error: String(e2.message || e2).slice(0, 500) });
    }
    return false;
  }
}

/* ── one cycle ──────────────────────────────────────────────────────────── */
async function runCycle(pool, alert) {
  if (stopped || cycleRunning) return;
  cycleRunning = true;
  let nextMs = POLL_MS;
  try {
    // CONFIG HALT — claim nothing without both env knobs; rows just wait.
    if (!sinkUrl() || !sinkSecret()) {
      if (!haltLogged) {
        log('feed_sink_unconfigured', { msg: 'FEED_SINK_URL/FEED_SINK_SECRET unset — external sink halted; outbox rows wait (nothing dead-letters).' });
        haltLogged = true;
      }
      nextMs = HALT_MS;
      return;   // finally still schedules
    }
    if (haltLogged) { haltLogged = false; log('feed_sink_configured', {}); }

    await releaseHeld(pool);
    const batch = await claimBatch(pool);
    if (batch.length) {
      for (const obRow of batch) {
        await deliver(pool, alert, obRow);   // per-row try/catch inside
      }
      nextMs = BUSY_MS;   // more may be queued — come back fast
    }
  } catch (e) {
    log('feed_sink_cycle_error', { error: e.message });
    try { await alert('feed_sink_cycle_error', { msg: 'Unexpected error in feed external sink loop.', error: e.message }); } catch (_) {}
    nextMs = BACKOFF_MS;
  } finally {
    cycleRunning = false;
    schedule(pool, alert, nextMs);
  }
}

/* ── ops: graduate / un-graduate a doc_type (Holly's entry point) ───────── */
async function setGraduation(pool, doc_type, enabled) {
  if (typeof doc_type !== 'string' || !doc_type) throw new Error('setGraduation: doc_type (non-empty string) required');
  await pool.query(
    `INSERT INTO feed_graduation (doc_type, external_writes_enabled, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (doc_type) DO UPDATE
       SET external_writes_enabled = EXCLUDED.external_writes_enabled, updated_at = now()`,
    [doc_type, enabled === true]
  );
}

/* ── public API ─────────────────────────────────────────────────────────── */
function startExternalDispatcher(pool, alert) {
  if (!stopped) return;   // idempotent
  stopped = false;
  const safeAlert = typeof alert === 'function' ? alert : async () => {};
  log('feed_sink_started', { poll_ms: POLL_MS, destinations: EXTERNAL_DESTINATIONS, configured: Boolean(sinkUrl() && sinkSecret()) });
  schedule(pool, safeAlert, POLL_MS);
}

function stopExternalDispatcher() {
  stopped = true;
  if (timer) { clearTimeout(timer); timer = null; }
}

module.exports = {
  startExternalDispatcher, stopExternalDispatcher, setGraduation,
  buildSinkBody, buildSinkHeaders, sinkUrl,
  SINK_ID,
};
