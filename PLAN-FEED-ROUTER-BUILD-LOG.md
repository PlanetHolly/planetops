# Feed Router — Build Log
Plan: PLAN-FEED-ROUTER.md (Codex-approved, 3 rounds). Builder: Codex (workspace-write). Reviewer/arbiter: Claude.
Staged build — one reviewable increment per round.

## Pre-build (Claude, full access)
- Located canonical brain at Dropbox/PlanetApparel/PlanetIQ/Feed_Brain/ (byte-identical to _Skills copy; no drift).
- Imported into gate/feed/: brain_router.py, routing_registry.json, scan_feed.py, test_feed_brain.py.
- Reference suite is unittest-based (runs on plain python3; pytest NOT installed — parity guard must not depend on it).

## Build #1 — Step 0 (brain import + Node port + parity guard)

### Act 3 — Codex build (thread 019f721d-104a-7cb0-8bb1-a4bb61614193, sandbox workspace-write)
Codex wrote (foreground run hit the 2-min wall AFTER writing all files; no resume needed):
- gate/feed/route.js — CommonJS port of route() + helpers (value/note/rule matches, nested_get, non_empty), loads the same routing_registry.json
- gate/feed/parity_fixtures.json — 13 shared fixtures
- gate/feed/parity_check.py — python3/stdlib runner over brain_router.route()
- gate/feed/parity_check.js — node runner over route.js
- gate/feed/parity_test.sh — runs both, diff -u, exit 1 on any divergence (deploy-blocking guard)
- gate/package.json — added scripts.test = "sh feed/parity_test.sh"

### Act 4 — Claude review
- Read route.js line-by-line vs brain_router.py: faithful. doc_type OR note match; R-fallback skipped-then-used-last; ledger always appended; missing required_fields → exactly ["review","ledger"] + status review + matched_rule "<id> (missing required fields: ...)"; status review-if-review-else-routed. nested_get early-return parity holds. non_empty sidesteps the bool/int subclass trap.
- Verified parity_test.sh is a REAL guard (not rigged to pass).
- Ran INDEPENDENT adversarial fixtures (not Codex's): both-null doc_type/note → fallback; amounts.total=0 → routes (present); amounts.total="" → review (missing); uppercase doc_type → fallback (case-sensitive doc_type replicated); case-insensitive note. Normalized diff: EXACT MATCH 6/6.
- Official `npm test` parity guard: PASS.
- Fix rounds needed: 0.

### Faithful-replication notes to carry forward
- doc_type match is CASE-SENSITIVE; note match is case-insensitive. Build #4 extractor MUST emit lowercase doc_type or docs silently fall to fallback/review.
- amounts.total=0 passes the required-field check (correct); a $0 "sanity" flag, if wanted, belongs in Build #4 deterministic validators, not here.

### Deferred (Step 0 sub-item, NOT done — touches live /feed)
- Re-point the Dropbox Python CLI (~/Dropbox/.../Feed_Brain + _Skills/feed) at the repo copy so the repo is the single source of truth. Deliberately not done silently; flagged for Holly since it alters the live local /feed skill.

VERDICT: Build #1 APPROVED by Claude. Parity guard green.

## Build #2 — Steps 1-2 (migration runner + DDL + /readyz guard)

### Act 3 — Codex build (thread 019f723d-ce17-78f1-b32e-8b72d83dbede, sandbox workspace-write)
- gate/feed/migrations/001_feed_core.sql — 8 tables (feed_intake, feed_outbox, feed_ledger, feed_incoming, feed_review, feed_expense_hold, feed_vendors, feed_graduation) with required cols/constraints + sensible extras (state/status CHECK enums, non-negative counters, worker-claim index feed_intake(status,locked_until), outbox(state,created_at), eta index).
- gate/feed/migrate.js — transactional versioned runner; feed_schema_migrations(version PK); pg_advisory_xact_lock re-taken per migration under which it re-checks applied-state (multi-instance safe); ROLLBACK on error, stops; feedSchemaStatus() = pending|ok|FAIL:.
- gate/index.js — import runner; fire runFeedMigrations(pool) at boot (same style as gate_sessions); /readyz gains checks.feed_schema=feedSchemaStatus() (503 while pending/failed); /healthz + /health-public untouched.

### Act 4 — Claude review
- migrate.js: advisory lock is transaction-scoped and re-checked per migration → real double-apply protection; DDL runs inside txn (Postgres DDL is transactional → clean rollback mid-file); inFlight guard prevents in-process double-run; returns exactly 'ok' to satisfy /readyz every()-gate. FAITHFUL.
- SQL: valid Postgres, all required columns/constraints/FKs/eta-index present. CHECK enums are a welcome hardening.
- index.js wiring minimal, non-restructuring; liveness endpoints untouched.
- Independent regression: node --check (both) OK; module loads + sees 001; parity guard STILL PASS.
- Fix rounds: 0.

### Verified vs NOT
- Verified statically + module-load + regression. NOT verified: live-Postgres execution of the DDL (no local psql/docker/pg_ctl on this machine; will NOT run against prod). Live-DB run is deferred to the staging step (Build #7) and must be treated as unproven until then — NOT silently "done".

VERDICT: Build #2 APPROVED by Claude (schema unverified against a live DB by design; deferred to staging).

## Build #3 — Step 3 (intake endpoint)  [EXECUTOR: Fable, open-window]
Model pivot: Codex → Fable (open Fable window through Sun 2026-07-19; Opus still architect+reviewer). No-delegation block pasted into Fable's goal-prompt.

### Act 3 — Fable build (general-purpose subagent, model=fable)
Architecture override of plan §D4: base64-in-JSON upload (reuse app pattern), ZERO new deps.
- NEW gate/feed/intake.js — Express router: GET /api/feed/session (CSRF issue) + POST /api/feed/intake. Ship-Deck-style guard (sameOrigin + per-session csrfForFeed(sid)=hmac(sid+':feed') + alerts); FINANCE_PIN gate for payroll/financials (fails closed); inline magic-byte sniff (declared mime must agree) + PDF guard (/Encrypt,/JS,/JavaScript,/OpenAction, >40pp); AES-256-GCM at rest (iv‖tag‖ct, FEED_RAW_KEY); sha256 content_hash; idempotent INSERT ON CONFLICT(content_hash); isolated rate limiter (never trips login lockout); scoped error handler. decryptRaw is a pure export only — no route returns raw bytes.
- NEW gate/feed/intake_selftest.js — pure-fn tests.
- MOD gate/index.js — mount feed router after graphics (helper bag); + fix round.

### Act 4 — Claude review (real diff, not summary)
- Read intake.js line-by-line: crypto correct (random-IV GCM, decrypt never routed); guard faithfully mirrors requireShipdeckPost; mismatch check strict (declared AND data-url mime must both agree with sniffed); rate limiter isolated from checkLimits/noteFailure. CLEAN.
- Independently re-ran selftest → 21/21; parity → PASS; index.js diff = as specified.
- 1 REAL defect found + fixed (round 1, Fable): global express.json(10mb) at index.js:33 preceded the route, silently capping uploads at ~7.5MB not 25MB. Fixed: global parser now bypasses exactly /api/feed/intake so the route-local 35mb parser + 25MB decoded cap govern; all other routes stay 10mb. Re-verified: node --check OK, parity PASS, selftest 21/21.
- Minor accepted: /JS substring guard can false-positive (fails closed — acceptable v1); empty→400; submitter_name capped 200.

### Verified vs NOT
- Verified: static + pure-fn selftest (crypto/sniff/pdf-guard) + regression. NOT verified: live-DB INSERT/dedupe + end-to-end HTTP behind a real session — no local Postgres; deferred to staging (Build #7). Also FEED_RAW_KEY env must be set at rollout.

VERDICT: Build #3 APPROVED by Claude (1 fix round). Live-DB + HTTP path unproven until staging.

## Build #4a — Step 4 part 1 (worker + LLM extraction)  [EXECUTOR: Fable]
Split of plan Step 4-5: #4a = worker + extraction (this); #4b = validators + feed_vendors + semanticKey (next).

### Act 3 — Fable build (model=fable)
- NEW gate/feed/migrations/002_feed_extraction.sql — 9 nullable extraction cols on feed_intake (extracted JSONB, doc_type, confidence, extractor_model/version, token_usage, extracted_at, review_reason, last_error) + feed_token_budget(day PK, tokens_used).
- NEW gate/feed/extract.js — raw fetch → /v1/messages; output_config.format json_schema (EXTRACTION_SCHEMA mirrors the Fact); no thinking/sampling (Opus 4.8); buildContent (pdf=document-before-text, png/jpeg=image, csv/text=inline capped 200k); typed ExtractError (retryable/permanent/not_configured); refusal|max_tokens → fact:null.
- NEW gate/feed/worker.js — startFeedWorker(pool, alert); concurrency-1 self-scheduling loop (unref timers); claim = txn SELECT status='received' OR stale 'processing' FOR UPDATE SKIP LOCKED → processing+worker_id+locked_until+attempt++; budget checked BEFORE claim; config halts release without burning attempt; success→extracted; refusal/max_tokens→review; retryable<max→release+backoff, else dead-letter fail+alert; ledger per outcome; cycle try/caught so one row can't kill loop.
- NEW gate/feed/extract_selftest.js.
- MOD gate/index.js — one edit: startFeedWorker(pool, alert) inside the existing runFeedMigrations().then, after 'feed_schema ready'.

### Act 4 — Claude review (real diff)
- worker.js: SKIP-LOCKED claim + stale-row reclaim = correct, multi-instance safe; concurrency-1 verified; budget-before-claim (dev #1) sound; config halts undo the attempt increment (never dead-letter on missing key) = correct; attempt math gives exactly FEED_MAX_ATTEMPTS real tries; ledger writer can't throw into cycle; releaseRow's interpolated attempt expr uses an internal boolean literal (no injection). feedRawKey reimpl matches intake.js byte-for-byte.
- extract.js: endpoint/headers/body correct vs claude-api ref; stop_reason guarded before content; error classification right. Selftest 20/20 re-run by me; parity still PASS; node --check clean.
- Deviations #1-6 in Fable's report all reviewed and accepted.
- Fix rounds: 0.

### FLAGS (not fix-now; carried to Holly + staging)
1. **STAGING-CRITICAL:** EXTRACTION_SCHEMA uses nullable `type:["string","null"]`. If Anthropic's structured-output compiler rejects type-arrays (prefers anyOf), the first live call returns 400 → classified permanent → dead-letters that doc. VERIFY on the very first staging call; if it 400s on schema, swap nullable fields to anyOf:[{type:X},{type:null}]. (2-line change.)
2. **Sharp edge:** a wrong-but-valid-format FEED_RAW_KEY marks every doc permanently 'failed' + fires an alert per doc (decrypt failure = permanent), rather than halting — noisy/destructive for a recoverable misconfig. Consider halt-on-systemic-decrypt-failure in a later hardening. Current behavior fails safe (nothing routed, alerts fire).

### NOT verified (pending staging: real ANTHROPIC_API_KEY + Postgres)
- Live Anthropic call + structured-output acceptance (see FLAG 1), refusal/max_tokens paths, real usage numbers.
- 002 DDL on live Postgres; claim/SKIP-LOCKED/reclaim; all status transitions; ledger inserts; daily-budget read+upsert; worker boot wiring.

VERDICT: Build #4a APPROVED by Claude (0 fix rounds). 2 flags for staging/Holly. Live API + DB unproven until staging.
