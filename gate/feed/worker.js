/* Feed Router — Build #4a worker + Build #4b validation stage + Build #5a
   routing stage.
   Claims one 'received' feed_intake row at a time (FOR UPDATE SKIP LOCKED —
   safe across multiple Railway instances), decrypts it, sends it to Claude
   via extract.js, then runs the deterministic validation stage (validate.js
   — the MONEY-SAFETY GATE) inline. A validation-stage DB error falls back to
   'review' (fail closed — never auto-validate on error).

   Build #5a: a row that validates clean is ROUTED in the same cycle —
   routeDoc (route.js) decides its destinations; the finalize UPDATE and the
   feed_outbox enqueue commit in ONE transaction (FOLDED IN), so a row is
   never left stranded at 'validated': it always lands 'routed' / 'review' /
   'failed'. A routing error fails CLOSED to 'review' (review_reason=
   'route_error'). Outbox rows are drained by dispatch.js (internal
   destinations in #5a; external 'planetiq' waits for #5b).

   HARD concurrency = 1: the loop is self-scheduling — the next tick is only
   armed after the current cycle fully finishes, so at most one extraction is
   ever in flight in this process; the claim query serializes across processes.

   Env:
     FEED_DAILY_TOKEN_BUDGET  default 2,000,000 (input+output tokens per day)
     FEED_MAX_ATTEMPTS        default 5 (then dead-letter)
     FEED_RAW_KEY             same 32-byte key intake.js encrypted with
*/

const crypto = require('crypto');
const os = require('os');
const { feedRawKey, encryptRaw, decryptRaw, FINANCE_CATEGORIES } = require('./intake');
const { extract } = require('./extract');
const { evaluate, semanticKey, normalizeVendor, highDollarThreshold,
        isKnownVendor, addPendingVendor, findDuplicate } = require('./validate');
const { routeDoc, loadRegistry } = require('./route');
const { outboxTargets } = require('./route_stage');

const EXTRACTOR_VERSION = 'feed-4b-v1';
const POLL_MS   = 5_000;    // idle poll
const BACKOFF_MS = 30_000;  // after a retryable failure
const HALT_MS   = 60_000;   // budget exhausted / not configured

/* ── module state ───────────────────────────────────────────────────────── */
const WORKER_ID = `${os.hostname()}-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
let timer = null;
let sweeperTimer = null;
let stopped = true;
let cycleRunning = false;
let haltLogged = null;   // dedupe config/budget halt logs: 'budget:<day>' | 'not_configured'
let inFlightClaim = null;
let sigtermHandlerInstalled = false;

function log(event, detail) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, worker_id: WORKER_ID, ...detail }));
}

function schedule(pool, alert, ms) {
  if (stopped) return;
  timer = setTimeout(() => { runCycle(pool, alert); }, ms);
  if (timer.unref) timer.unref();   // never hold the process open
}

function maxAttempts() {
  return parseInt(process.env.FEED_MAX_ATTEMPTS, 10) || 5;
}

/* ── ledger helper (append-only; never throws into the cycle) ───────────── */
async function ledger(pool, row, fields) {
  try {
    await pool.query(
      `INSERT INTO feed_ledger (intake_id, content_hash, semantic_key, declared_category, detected_category, extractor_version, model, token_usage, validator_results, decision)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [row.id, row.content_hash, fields.semantic_key || null, row.declared_category, fields.detected_category || null,
       EXTRACTOR_VERSION, fields.model || null,
       fields.token_usage ? JSON.stringify(fields.token_usage) : null,
       fields.validator_results ? JSON.stringify(fields.validator_results) : null,
       JSON.stringify(fields.decision)]
    );
  } catch (e) { log('feed_ledger_write_failed', { intake_id: row.id, error: e.message }); }
}

/* ── budget ─────────────────────────────────────────────────────────────── */
function dailyBudget() {
  return parseInt(process.env.FEED_DAILY_TOKEN_BUDGET, 10) || 2_000_000;
}
async function budgetExhausted(pool) {
  const r = await pool.query('SELECT tokens_used FROM feed_token_budget WHERE day = CURRENT_DATE');
  const used = r.rows[0] ? Number(r.rows[0].tokens_used) : 0;
  return used >= dailyBudget();
}
async function recordTokens(pool, usage) {
  const n = (usage && (Number(usage.input_tokens) || 0) + (Number(usage.output_tokens) || 0)) || 0;
  if (!n) return;
  await pool.query(
    `INSERT INTO feed_token_budget (day, tokens_used) VALUES (CURRENT_DATE, $1)
     ON CONFLICT (day) DO UPDATE SET tokens_used = feed_token_budget.tokens_used + EXCLUDED.tokens_used`,
    [n]
  );
}

/* ── claim: one transaction, no LLM inside it ───────────────────────────── */
async function claimRow(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sel = await client.query(
      `SELECT id, content_hash, declared_category, mime, note, filename, enc_raw, attempt_count, finance_unlocked_at_upload
       FROM feed_intake
       WHERE (status = 'received' OR (status = 'processing' AND locked_until < now()))
         AND attempt_count < $1
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
      [maxAttempts()]
    );
    if (!sel.rows[0]) { await client.query('COMMIT'); return null; }
    const row = sel.rows[0];
    const upd = await client.query(
      `UPDATE feed_intake
       SET status='processing', worker_id=$2, locked_until=now() + interval '5 minutes',
           attempt_count = attempt_count + 1, updated_at=now()
       WHERE id=$1
       RETURNING attempt_count`,
      [row.id, WORKER_ID]
    );
    await client.query('COMMIT');
    row.attempt_count = upd.rows[0].attempt_count;
    inFlightClaim = { pool, id: row.id };
    return row;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

/* Release a claimed row back to 'received'. burnAttempt=false undoes the
   attempt_count increment (config/budget halts must never dead-letter). */
async function releaseRow(pool, id, burnAttempt) {
  await pool.query(
    `UPDATE feed_intake
     SET status='received', locked_until=NULL, worker_id=NULL,
         attempt_count = ${burnAttempt ? 'attempt_count' : 'GREATEST(attempt_count - 1, 0)'},
         updated_at=now()
     WHERE id=$1 AND status='processing'`,
    [id]
  );
}

async function releaseInFlightClaimForShutdown() {
  const claim = inFlightClaim;
  if (!claim) return;
  inFlightClaim = null;
  await releaseRow(claim.pool, claim.id, false);
}

function _setInFlightClaimForTest(claim) {
  inFlightClaim = claim;
}

function installSigtermHandler() {
  if (sigtermHandlerInstalled) return;
  sigtermHandlerInstalled = true;
  process.once('SIGTERM', async () => {
    stopped = true;
    if (timer) { clearTimeout(timer); timer = null; }
    if (sweeperTimer) { clearInterval(sweeperTimer); sweeperTimer = null; }
    try { await releaseInFlightClaimForShutdown(); }
    catch (e) { log('feed_sigterm_release_failed', { error: e.message }); }
    process.exit(0);
  });
}

async function insertReviewRow(db, { intake_id, reason, payload, row }) {
  const storage = prepareReviewStorage(row || {}, row && row.filename, payload);
  await db.query(
    `INSERT INTO feed_review (intake_id, reason, payload, payload_enc) VALUES ($1,$2,$3,$4)`,
    [intake_id, String(reason || 'review').slice(0, 500), storage.payload, storage.payload_enc]
  );
}

async function recordReview(pool, alert, { intake_id, doc_type, reason, payload }) {
  await insertReviewRow(pool, { intake_id, reason, payload, row: { declared_category: doc_type, filename: null } });
  await alert('feed_review_required', {
    msg: 'Feed doc requires finance review.',
    intake_id,
    doc_type: doc_type || null,
    reason: String(reason || 'review').slice(0, 500),
  });
}

async function sweepExpiredCappedRows(pool, alert) {
  const r = await pool.query(
    `UPDATE feed_intake
       SET status='failed',
           last_error='max attempts reached after stale processing locks',
           locked_until=NULL,
           worker_id=NULL,
           updated_at=now()
     WHERE status='processing'
       AND locked_until < now()
       AND attempt_count >= $1
     RETURNING id, doc_type, attempt_count`,
    [maxAttempts()]
  );
  for (const row of r.rows || []) {
    await alert('feed_extract_deadletter', {
      msg: 'Feed doc failed extraction after repeated worker exits.',
      intake_id: row.id,
      doc_type: row.doc_type || null,
      attempts: row.attempt_count,
    });
  }
  return r.rowCount || 0;
}

function isFinanceCategory(category) {
  return FINANCE_CATEGORIES.includes(String(category || ''));
}

function isFinanceFact(row, fact) {
  return isFinanceCategory(row && row.declared_category) || isFinanceCategory(fact && fact.doc_type);
}

function requireRawKeyForFinanceStorage() {
  const key = feedRawKey();
  if (!key) throw new Error('FEED_RAW_KEY is required for finance fact encryption');
  return key;
}

function prepareFactStorage(row, fact) {
  if (isFinanceFact(row, fact)) {
    return {
      extracted: null,
      extracted_enc: encryptRaw(requireRawKeyForFinanceStorage(), Buffer.from(JSON.stringify(fact))),
    };
  }
  return {
    extracted: fact ? JSON.stringify(fact) : null,
    extracted_enc: null,
  };
}

function hashedFilename(filename) {
  if (!filename) return null;
  return 'sha256:' + crypto.createHash('sha256').update(String(filename)).digest('hex');
}

function prepareReviewStorage(row, originalFilename, payload) {
  if (isFinanceFact(row, payload)) {
    const wrapped = { original_filename: originalFilename || null, fact: payload || null };
    return {
      payload: null,
      payload_enc: encryptRaw(requireRawKeyForFinanceStorage(), Buffer.from(JSON.stringify(wrapped))),
      filenameForStorage: hashedFilename(originalFilename),
    };
  }
  return {
    payload: payload ? JSON.stringify(payload) : null,
    payload_enc: null,
    filenameForStorage: originalFilename || null,
  };
}

function financeMismatch(row, fact) {
  return isFinanceCategory(fact && fact.doc_type)
    && !isFinanceCategory(row && row.declared_category)
    && !Boolean(row && row.finance_unlocked_at_upload);
}

function reviewReasonsWithFinanceMismatch(reasons, row, fact) {
  const out = Array.isArray(reasons) ? reasons.slice() : [];
  if (financeMismatch(row, fact) && !out.includes('finance_declared_mismatch')) out.push('finance_declared_mismatch');
  return out;
}

function financeMismatchAlert(row, fact) {
  return {
    event: 'feed_finance_category_mismatch',
    detail: {
      msg: 'Feed doc was uploaded without a finance unlock but extraction detected a finance category. Content sensitivity cannot be fully determined at upload time; this row requires finance review.',
      intake_id: row && row.id,
      declared_category: row && row.declared_category || null,
      detected_category: fact && fact.doc_type || null,
    },
  };
}

/* ── one cycle ──────────────────────────────────────────────────────────── */
async function runCycle(pool, alert) {
  if (stopped || cycleRunning) return;
  cycleRunning = true;
  let nextMs = POLL_MS;
  let row = null;
  try {
    /* DAILY BUDGET — checked before claiming, so a budget halt never touches
       a row and can never consume an attempt or dead-letter a doc. */
    if (await budgetExhausted(pool)) {
      const key = 'budget:' + new Date().toISOString().slice(0, 10);
      if (haltLogged !== key) {
        haltLogged = key;
        log('feed_budget_exhausted', { budget: dailyBudget() });
      }
      nextMs = HALT_MS;
      return;
    }

    row = await claimRow(pool);
    if (!row) return;   // nothing to do → poll again in POLL_MS

    const key = feedRawKey();
    if (!key) {
      // Config halt (same class as missing API key): release without burning the attempt.
      await releaseRow(pool, row.id, false);
      if (haltLogged !== 'raw_key') { haltLogged = 'raw_key'; log('feed_worker_not_configured', { missing: 'FEED_RAW_KEY' }); }
      nextMs = HALT_MS;
      return;
    }

    let bytes;
    try {
      bytes = decryptRaw(key, row.enc_raw);
    } catch (e) {
      // Wrong key / corrupt ciphertext — retrying cannot help: permanent.
      await pool.query(
        `UPDATE feed_intake SET status='failed', last_error=$2, locked_until=NULL, updated_at=now() WHERE id=$1`,
        [row.id, 'decrypt failed: ' + e.message]
      );
      await alert('feed_extract_failed', { msg: 'Feed doc could not be decrypted (wrong FEED_RAW_KEY or corrupt data).', intake_id: row.id, error: e.message });
      await ledger(pool, row, { decision: { stage: 'failed', reason: 'decrypt: ' + e.message } });
      return;
    }

    let out;
    try {
      out = await extract(bytes, row.mime, row.note);
    } catch (e) {
      if (e && e.notConfigured) {
        // Missing ANTHROPIC_API_KEY: budget-style halt — release, no attempt burned, never dead-letters.
        await releaseRow(pool, row.id, false);
        const key = e.configHalt || 'not_configured';
        if (haltLogged !== key) {
          haltLogged = key;
          log('feed_worker_not_configured', { reason: key, status: e.status || null });
          await alert('feed_worker_not_configured', { msg: 'Feed extraction is not configured correctly; rows are being released for retry.', reason: key, status: e.status || null });
        }
        nextMs = HALT_MS;
        return;
      }
      if (e && e.retryable && row.attempt_count < maxAttempts()) {
        await releaseRow(pool, row.id, true);   // attempt stands; another try later
        log('feed_extract_retry', { intake_id: row.id, attempt: row.attempt_count, error: e.message });
        nextMs = BACKOFF_MS;
        return;
      }
      // PERMANENT error, or retryable that exhausted its attempts → dead-letter.
      await pool.query(
        `UPDATE feed_intake SET status='failed', last_error=$2, locked_until=NULL, updated_at=now() WHERE id=$1`,
        [row.id, String(e.message || e).slice(0, 2000)]
      );
      await alert('feed_extract_deadletter', {
        msg: 'Feed doc failed extraction' + (e && e.permanent ? ' (permanent error).' : ` after ${row.attempt_count} attempts.`),
        intake_id: row.id, doc_type: row.doc_type || null, attempts: row.attempt_count, error: String(e.message || e).slice(0, 500),
      });
      await ledger(pool, row, { decision: { stage: 'failed', reason: String(e.message || e).slice(0, 500) } });
      return;
    }

    // Tokens were spent whether or not we got a fact — count them against the budget.
    try { await recordTokens(pool, out.usage); }
    catch (e) { log('feed_budget_write_failed', { intake_id: row.id, error: e.message }); }

    if (!out.fact) {
      // refusal / max_tokens: human review, no retry.
      await pool.query(
        `UPDATE feed_intake SET status='review', review_reason=$2, extractor_model=$3, extractor_version=$4,
                token_usage=$5, locked_until=NULL, updated_at=now() WHERE id=$1`,
        [row.id, out.stop_reason, out.model, EXTRACTOR_VERSION, out.usage ? JSON.stringify(out.usage) : null]
      );
      await ledger(pool, row, { model: out.model, token_usage: out.usage, decision: { stage: 'review', reason: out.stop_reason } });
      await insertReviewRow(pool, { intake_id: row.id, reason: out.stop_reason, payload: null, row });
      await alert('feed_review_required', {
        msg: 'Feed doc requires finance review.',
        intake_id: row.id,
        doc_type: null,
        reason: String(out.stop_reason || 'review').slice(0, 500),
      });
      log('feed_extract_review', { intake_id: row.id, reason: out.stop_reason });
      return;
    }

    /* ── Build #4b: validation stage — the MONEY-SAFETY GATE ─────────────
       Runs inline after a successful extract; the row lands in its FINAL
       pre-routing state: 'validated' (safe to auto-route in #5) or 'review'
       (human must see it) — never left at 'extracted'. A DB error inside
       this stage fails CLOSED: the Fact is kept, status becomes 'review'
       with review_reason='validation_error'. Never auto-validate on error. */
    const fact = out.fact;
    let sk = null;
    let verdict, valInputs;
    try {
      sk = semanticKey(fact.doc_type, fact, row.content_hash);
      const nvendor = normalizeVendor(fact.entities && fact.entities.vendor);
      // No vendor named ⇒ don't trip unknown_vendor.
      const known = nvendor ? await isKnownVendor(pool, nvendor) : true;
      if (nvendor && !known) {
        // First-seen vendor: self-register as 'pending' (human promotes to
        // 'known' when clearing review); it still trips unknown_vendor below.
        await addPendingVendor(pool, nvendor, fact.entities.vendor);
      }
      const dup = await findDuplicate(pool, sk, row.id);
      const threshold = highDollarThreshold();
      verdict = evaluate(fact, {
        declared_category: row.declared_category,
        knownVendor: known, duplicate: dup, threshold,
      });
      valInputs = { semantic_key: sk, normalized_vendor: nvendor || null, known_vendor: known, duplicate: dup, threshold };
    } catch (e) {
      log('feed_validation_error', { intake_id: row.id, error: e.message });
      verdict = { status: 'review', reasons: ['validation_error'], results: { validation_error: true } };
      valInputs = { semantic_key: sk, error: String(e.message || e).slice(0, 500) };
    }
    const validatorResults = { checks: verdict.results, inputs: valInputs, reasons: verdict.reasons };
    const reviewReasons = reviewReasonsWithFinanceMismatch(verdict.reasons, row, fact);
    if (reviewReasons.length !== verdict.reasons.length) {
      verdict = {
        ...verdict,
        status: 'review',
        reasons: reviewReasons,
        results: { ...verdict.results, finance_declared_mismatch: true },
      };
      validatorResults.checks = verdict.results;
      validatorResults.reasons = verdict.reasons;
      const mismatch = financeMismatchAlert(row, fact);
      await alert(mismatch.event, mismatch.detail);
    }
    const factStorage = prepareFactStorage(row, fact);
    const reviewStorage = prepareReviewStorage(row, row.filename, fact);
    const filenameForStorage = isFinanceFact(row, fact) ? reviewStorage.filenameForStorage : row.filename || null;

    /* Same finalize UPDATE as #4b, now parameterized by the FINAL
       post-routing status and reused by every branch below. */
    const finalizeSql =
      `UPDATE feed_intake SET extracted=$2, extracted_enc=$3, doc_type=$4, confidence=$5, extractor_model=$6, extractor_version=$7,
              token_usage=$8, extracted_at=now(), semantic_key=$9, validator_results=$10,
              status=$11, review_reason=$12, filename=$13, locked_until=NULL, updated_at=now()
       WHERE id=$1`;
    const finalizeParams = (status, reviewReason) => [
      row.id, factStorage.extracted, factStorage.extracted_enc, fact.doc_type || null,
      (typeof fact.confidence === 'number' ? fact.confidence : null),
      out.model, EXTRACTOR_VERSION, out.usage ? JSON.stringify(out.usage) : null,
      sk, JSON.stringify(validatorResults), status, reviewReason, filenameForStorage,
    ];
    const ledgerBase = {
      detected_category: fact.doc_type || null, model: out.model, token_usage: out.usage,
      semantic_key: sk, validator_results: validatorResults,
    };

    if (verdict.status === 'review') {
      /* Validation said review — Build #4b path, unchanged. */
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(finalizeSql, finalizeParams('review', verdict.reasons.join(',')));
        await insertReviewRow(client, { intake_id: row.id, reason: verdict.reasons.join(','), payload: fact, row });
        await client.query('COMMIT');
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw e;
      } finally { client.release(); }
      await alert('feed_review_required', {
        msg: 'Feed doc requires finance review.',
        intake_id: row.id,
        doc_type: fact.doc_type || null,
        reason: verdict.reasons.join(',').slice(0, 500),
      });
      await ledger(pool, row, { ...ledgerBase, decision: { stage: 'review', reasons: verdict.reasons } });
      log('feed_validated', {
        intake_id: row.id, doc_type: fact.doc_type, confidence: fact.confidence,
        status: 'review', reasons: verdict.reasons,
      });
    } else {
      /* ── Build #5a: routing stage (validated rows only) ────────────────
         FOLD-IN: finalize + routing writes commit atomically, so the row is
         NEVER left at 'validated'. Any error here fails CLOSED to 'review'
         (review_reason='route_error') — never auto-route on error, never
         lose the validated Fact. */
      log('feed_validated', {
        intake_id: row.id, doc_type: fact.doc_type, confidence: fact.confidence,
        status: 'validated', reasons: verdict.reasons,
      });
      let decision = null;
      let routeErr = null;
      try {
        /* routeDoc MUTATES its input (adds .status/.routing) — pass a shallow
           copy so the stored `extracted` JSON keeps its #4b shape. */
        decision = routeDoc({ ...fact }, loadRegistry());
      } catch (e) { routeErr = e; }

      try {
        if (!decision) throw new Error('routeDoc failed: ' + String(routeErr && routeErr.message || routeErr));

        if (decision.status === 'review') {
          /* route.js downgrade (required_fields missing / fallback rule) —
             a doc can pass #4b's triggers and still land here; intended. */
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await client.query(finalizeSql, finalizeParams('review', ('route:' + decision.matched_rule).slice(0, 500)));
            await insertReviewRow(client, { intake_id: row.id, reason: decision.matched_rule, payload: fact, row });
            await client.query('COMMIT');
          } catch (e) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            throw e;
          } finally { client.release(); }
          await alert('feed_review_required', {
            msg: 'Feed doc requires finance review.',
            intake_id: row.id,
            doc_type: fact.doc_type || null,
            reason: String(decision.matched_rule).slice(0, 500),
          });
          await ledger(pool, row, { ...ledgerBase, decision: { stage: 'review', reasons: [decision.matched_rule] } });
          log('feed_route_review', { intake_id: row.id, doc_type: fact.doc_type, matched_rule: decision.matched_rule });
        } else {
          /* routed → enqueue outbox rows (idempotent) + finalize, one txn.
             'planetiq' rows are enqueued here too but only #5b will send
             them; the #5a dispatcher claims INTERNAL destinations only. */
          const targets = outboxTargets(decision.destinations);
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await client.query(finalizeSql, finalizeParams('routed', null));
            for (const target of targets) {
              await client.query(
                `INSERT INTO feed_outbox (intake_id, destination, idempotency_key, state)
                 VALUES ($1,$2,$3,'pending')
                 ON CONFLICT (idempotency_key) DO NOTHING`,
                [row.id, target, `${row.id}:${target}`]
              );
            }
            await client.query('COMMIT');
          } catch (e) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            throw e;
          } finally { client.release(); }
          await ledger(pool, row, {
            ...ledgerBase,
            decision: { stage: 'routed', matched_rule: decision.matched_rule, destinations: decision.destinations },
          });
          log('feed_routed', {
            intake_id: row.id, doc_type: fact.doc_type,
            matched_rule: decision.matched_rule, destinations: decision.destinations, enqueued: targets,
          });
        }
      } catch (e) {
        /* FAIL CLOSED: keep the Fact, land the row in review. If even this
           UPDATE fails (DB down), it throws to the cycle catch — the row
           stays 'processing' and is re-claimed after its lock expires. */
        log('feed_route_error', { intake_id: row.id, error: e.message });
        await pool.query(finalizeSql, finalizeParams('review', 'route_error'));
        await ledger(pool, row, { ...ledgerBase, decision: { stage: 'review', reasons: ['route_error'] } });
        try {
          await insertReviewRow(pool, { intake_id: row.id, reason: 'route_error', payload: fact, row });
          await alert('feed_review_required', {
            msg: 'Feed doc requires finance review.',
            intake_id: row.id,
            doc_type: fact.doc_type || null,
            reason: 'route_error',
          });
        }
        catch (e2) { log('feed_review_write_failed', { intake_id: row.id, error: e2.message }); }
      }
    }
    inFlightClaim = null;
    nextMs = 250;   // more work may be queued — come back fast
  } catch (e) {
    // Never let one bad row / DB hiccup kill the loop.
    log('feed_worker_cycle_error', { error: e.message });
    try { await alert('feed_worker_error', { msg: 'Unexpected error in feed extraction worker loop.', error: e.message, intake_id: row ? row.id : null }); } catch (_) {}
    nextMs = BACKOFF_MS;
  } finally {
    if (row && inFlightClaim && inFlightClaim.id === row.id) inFlightClaim = null;
    cycleRunning = false;
    schedule(pool, alert, nextMs);
  }
}

/* ── public API ─────────────────────────────────────────────────────────── */
function startFeedWorker(pool, alert) {
  if (!stopped) return;           // idempotent
  stopped = false;
  const safeAlert = typeof alert === 'function' ? alert : async () => {};
  log('feed_worker_started', { poll_ms: POLL_MS });
  installSigtermHandler();
  sweepExpiredCappedRows(pool, safeAlert).catch(e => log('feed_sweeper_failed', { error: e.message }));
  sweeperTimer = setInterval(() => {
    sweepExpiredCappedRows(pool, safeAlert).catch(e => log('feed_sweeper_failed', { error: e.message }));
  }, 60_000);
  if (sweeperTimer.unref) sweeperTimer.unref();
  schedule(pool, safeAlert, POLL_MS);
}

function stopFeedWorker() {
  stopped = true;
  if (timer) { clearTimeout(timer); timer = null; }
  if (sweeperTimer) { clearInterval(sweeperTimer); sweeperTimer = null; }
}

module.exports = {
  startFeedWorker, stopFeedWorker, feedRawKey, WORKER_ID, EXTRACTOR_VERSION,
  claimRow, releaseRow, releaseInFlightClaimForShutdown, sweepExpiredCappedRows,
  recordReview, insertReviewRow, _setInFlightClaimForTest,
  prepareFactStorage, prepareReviewStorage, isFinanceFact, financeMismatch,
  reviewReasonsWithFinanceMismatch, financeMismatchAlert,
};
