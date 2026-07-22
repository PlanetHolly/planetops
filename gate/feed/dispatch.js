/* Feed Router — Build #5a outbox dispatcher (INTERNAL destinations ONLY).
   A SECOND self-scheduling loop, separate from the extraction worker, that
   drains feed_outbox rows for gate-owned Postgres destinations:
     app_incoming → feed_incoming      (upsert on fact_id — replay-safe)
     expense_hold → feed_expense_hold  (append; at-least-once, see below)
   EXTERNAL destinations ('planetiq') are NOT claimed here — they stay
   'pending' until Build #5b adds the outbound POST sink. NO outbound fetch
   anywhere in this file.

   Delivery semantics: a batch of 'pending' internal rows is claimed with
   FOR UPDATE SKIP LOCKED and flipped to state='sent' (the in-flight marker)
   in one committed txn — safe across multiple Railway instances. Each row is
   then written to its destination table and acked ('acked'); a write error
   returns it to 'pending' for retry until FEED_OUTBOX_MAX_ATTEMPTS (default
   5), then 'failed' + alert. ORPHAN RECLAIM: a crash between claim and ack
   would strand a row at 'sent' forever, so claimBatch ALSO re-claims 'sent'
   rows whose updated_at is older than FEED_OUTBOX_STALE_MS (default 5 min) —
   the outbox analog of the extraction worker's stale-'processing' reclaim
   (feed_outbox has no locked_until, so updated_at is the staleness clock).
   Each re-claim still increments attempts, so a row that repeatedly crashes
   mid-delivery dead-letters at FEED_OUTBOX_MAX_ATTEMPTS instead of looping. feed_expense_hold has no natural unique key, so
   its insert is gated by the pending→sent claim; a duplicate can only appear
   if the ack UPDATE itself fails after a successful insert — acceptable
   at-least-once for an internal hold table.

   HARD concurrency = 1 in-process (own cycleRunning guard); all timers
   .unref() so the loop never holds the process open. */

const crypto = require('crypto');
const os = require('os');
const { INTERNAL_DESTINATIONS, incomingRow } = require('./route_stage');

const POLL_MS    = 2_000;    // idle poll
const BUSY_MS    = 250;      // fast re-poll after doing work
const BACKOFF_MS = 30_000;   // after a cycle-level error
const BATCH_SIZE = 10;

const DISPATCHER_ID = `${os.hostname()}-${process.pid}-outbox-${crypto.randomBytes(3).toString('hex')}`;

let timer = null;
let stopped = true;
let cycleRunning = false;

function log(event, detail) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, dispatcher_id: DISPATCHER_ID, ...detail }));
}

function maxAttempts() {
  return parseInt(process.env.FEED_OUTBOX_MAX_ATTEMPTS, 10) || 5;
}

function staleMs() {
  return parseInt(process.env.FEED_OUTBOX_STALE_MS, 10) || 300_000;   // 5 min
}

function schedule(pool, alert, ms) {
  if (stopped) return;
  timer = setTimeout(() => { runCycle(pool, alert); }, ms);
  if (timer.unref) timer.unref();
}

/* ── claim: one txn — pending internal rows → 'sent' (in-flight) ────────── */
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
      [INTERNAL_DESTINATIONS, staleMs()]
    );
    if (!sel.rows.length) { await client.query('COMMIT'); return []; }
    const ids = sel.rows.map((r) => r.id);
    const upd = await client.query(
      `UPDATE feed_outbox
       SET state='sent', attempts=attempts+1, updated_at=now()
       WHERE id = ANY($1)
       RETURNING id, intake_id, destination, attempts`,
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

/* ── destination writers (both idempotent-or-gated; see header) ─────────── */
async function writeIncoming(pool, intake, fact) {
  const r = incomingRow(intake, fact, 'routed');
  await pool.query(
    `INSERT INTO feed_incoming (fact_id, vendor, job, customer, summary, total, line_count, eta, status, received_at, doc_refs)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (fact_id) DO UPDATE SET
       vendor=EXCLUDED.vendor, job=EXCLUDED.job, customer=EXCLUDED.customer,
       summary=EXCLUDED.summary, total=EXCLUDED.total, line_count=EXCLUDED.line_count,
       eta=EXCLUDED.eta, status=EXCLUDED.status, received_at=EXCLUDED.received_at,
       doc_refs=EXCLUDED.doc_refs`,
    [r.fact_id, r.vendor, r.job, r.customer, r.summary, r.total, r.line_count,
     r.eta, r.status, r.received_at, JSON.stringify(r.doc_refs)]
  );
}

async function writeExpenseHold(pool, intake, fact) {
  const ent = (fact && fact.entities) || {};
  const amounts = (fact && fact.amounts) || {};
  const dates = (fact && fact.dates) || {};
  await pool.query(
    `INSERT INTO feed_expense_hold (intake_id, vendor, total, period, payload)
     VALUES ($1,$2,$3,$4,$5)`,
    [intake.id,
     ent.vendor ?? null,
     (typeof amounts.total === 'number' && Number.isFinite(amounts.total)) ? amounts.total : null,
     dates.period ?? null,
     JSON.stringify(fact ?? null)]
  );
}

/* ── deliver ONE claimed outbox row; never throws into the cycle ────────── */
async function deliver(pool, alert, obRow) {
  try {
    const ir = await pool.query(
      `SELECT id, content_hash, declared_category, created_at, extracted
       FROM feed_intake WHERE id = $1`,
      [obRow.intake_id]
    );
    const intake = ir.rows[0];
    if (!intake) throw new Error(`intake row ${obRow.intake_id} not found`);
    const fact = intake.extracted;   // JSONB → already an object via pg
    if (!fact || typeof fact !== 'object') throw new Error(`intake row ${obRow.intake_id} has no extracted fact`);

    if (obRow.destination === 'app_incoming') {
      await writeIncoming(pool, intake, fact);
    } else if (obRow.destination === 'expense_hold') {
      await writeExpenseHold(pool, intake, fact);
    } else {
      throw new Error(`unexpected internal destination: ${obRow.destination}`);
    }

    await pool.query(
      `UPDATE feed_outbox SET state='acked', last_error=NULL, updated_at=now() WHERE id = $1`,
      [obRow.id]
    );
    log('feed_outbox_delivered', { outbox_id: obRow.id, intake_id: obRow.intake_id, destination: obRow.destination });
    return true;
  } catch (e) {
    const msg = String(e.message || e).slice(0, 2000);
    try {
      if (obRow.attempts < maxAttempts()) {
        await pool.query(
          `UPDATE feed_outbox SET state='pending', last_error=$2, updated_at=now() WHERE id = $1`,
          [obRow.id, msg]
        );
        log('feed_outbox_retry', { outbox_id: obRow.id, intake_id: obRow.intake_id, destination: obRow.destination, attempt: obRow.attempts, error: msg.slice(0, 500) });
      } else {
        await pool.query(
          `UPDATE feed_outbox SET state='failed', last_error=$2, updated_at=now() WHERE id = $1`,
          [obRow.id, msg]
        );
        await alert('feed_outbox_failed', {
          msg: `Feed outbox delivery to '${obRow.destination}' failed permanently after ${obRow.attempts} attempts.`,
          outbox_id: obRow.id, intake_id: obRow.intake_id, destination: obRow.destination, error: msg.slice(0, 500),
        });
      }
    } catch (e2) {
      // Even the state write failed (DB down) — the row stays 'sent' and the
      // stale-'sent' reclaim in claimBatch picks it up after FEED_OUTBOX_STALE_MS.
      log('feed_outbox_state_write_failed', { outbox_id: obRow.id, error: String(e2.message || e2).slice(0, 500) });
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
    const batch = await claimBatch(pool);
    if (batch.length) {
      for (const obRow of batch) {
        await deliver(pool, alert, obRow);   // per-row try/catch inside
      }
      nextMs = BUSY_MS;   // more may be queued — come back fast
    }
  } catch (e) {
    log('feed_dispatch_cycle_error', { error: e.message });
    try { await alert('feed_dispatch_error', { msg: 'Unexpected error in feed outbox dispatcher loop.', error: e.message }); } catch (_) {}
    nextMs = BACKOFF_MS;
  } finally {
    cycleRunning = false;
    schedule(pool, alert, nextMs);
  }
}

/* ── public API ─────────────────────────────────────────────────────────── */
function startOutboxDispatcher(pool, alert) {
  if (!stopped) return;   // idempotent
  stopped = false;
  const safeAlert = typeof alert === 'function' ? alert : async () => {};
  log('feed_dispatcher_started', { poll_ms: POLL_MS, destinations: INTERNAL_DESTINATIONS });
  schedule(pool, safeAlert, POLL_MS);
}

function stopOutboxDispatcher() {
  stopped = true;
  if (timer) { clearTimeout(timer); timer = null; }
}

module.exports = { startOutboxDispatcher, stopOutboxDispatcher, DISPATCHER_ID };
