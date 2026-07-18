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

## Build #4b — Step 4 part 2 (validation = the MONEY-SAFETY GATE)  [EXECUTOR: Fable]

### Act 3 — Fable build (model=fable)
- NEW gate/feed/migrations/003_feed_validation.sql — feed_intake.semantic_key TEXT + validator_results JSONB + semantic_key index.
- NEW gate/feed/validate.js — PURE normalizeVendor / semanticKey(per doc_type, null when components missing) / evaluate(fact,ctx) [fail-closed core] + env readers + thin DB helpers isKnownVendor / addPendingVendor(ON CONFLICT DO NOTHING) / seedKnownVendors(rollout upsert→known) / findDuplicate.
- NEW gate/feed/validate_selftest.js — 58 pure tests.
- MOD gate/feed/worker.js — success branch now runs the validation stage inline: semanticKey → normalizeVendor → isKnownVendor (no vendor ⇒ known) → first-seen self-registers pending + trips review → findDuplicate → evaluate → ONE collapsed UPDATE landing 'validated'|'review' (never 'extracted'); ledger gains semantic_key+validator_results; validation stage try/caught ⇒ DB error falls to 'review' (fail closed). All #4a paths intact.

### Act 4 — Claude review (real diff, hardest review of the build)
- evaluate() reviewed trigger-by-trigger: unvalidatable guard catches null/array/no-doc_type; high_dollar inclusive >=; low_confidence strict <; finance via doc_type OR declared; category_mismatch both-present-and-differ; duplicate strict ===true; reasons in stable TRIGGERS order; ANY trigger ⇒ review. FAITHFUL + fail-closed.
- semanticKey: composed only from real Fact fields, null when missing (never invented), 'other'/unknown→null. Correct.
- vendor helpers: isKnownVendor status='known' only; addPendingVendor won't downgrade a known row; seed promotes→known. findDuplicate excludes failed/review as dup-source.
- worker diff: validation stage inserted after recordTokens + refusal branch (token accounting + all #4a paths preserved); vendor/dup DB calls try/caught → review on error (fail closed); persist collapsed to one UPDATE; ledger audit columns added. No regression.
- Independently re-ran: validate_selftest 58/58, extract_selftest 20/20, parity PASS, node --check clean.
- Fix rounds: 0.

### Minor defensive notes (non-blocking; logged for a later hardening)
- unknown_vendor uses `ctx.knownVendor === false` (fail-OPEN if knownVendor were ever undefined). Worker always passes a boolean or falls to review, so safe today; `!== true` would be strictly fail-closed.
- findDuplicate excludes 'review' rows as a dup-source; a 2nd copy of an under-review doc could validate — but identical content trips identical deterministic triggers anyway, so practical impact ~nil. Consider including 'review' in the dup-source set later.

### NOT verified (pending staging w/ real Postgres)
- DB helpers (isKnownVendor/addPendingVendor/seedKnownVendors/findDuplicate), live validation-stage wiring end-to-end incl. the validation_error fallback under a real DB fault, 003 DDL. Plus carried-forward #4a STAGING-CRITICAL flag 1 (structured-output nullable-type-array acceptance).

VERDICT: Build #4b APPROVED by Claude (0 fix rounds). The money-safety gate is fail-closed and each review-trigger is independently proven. DB paths unproven until staging.

## Build #5a — Step 6 part 1 (routeDoc wiring + outbox enqueue + INTERNAL writers)  [EXECUTOR: Fable]

### Act 3 — Fable build (model=fable)
- NEW gate/feed/route_stage.js — PURE outboxTargets (drops ledger+review), incomingRow (exact feed_incoming shape, type-guarded), safeTimestamp (free-text eta → ISO-or-null, DATE_LIKE regex guard before Date.parse).
- NEW gate/feed/dispatch.js — 2nd self-scheduling concurrency-1 loop; claims 'pending' INTERNAL-destination outbox rows FOR UPDATE SKIP LOCKED → 'sent' → writes feed_incoming (upsert on fact_id) / feed_expense_hold (append) → 'acked'; bounded retry → 'failed'+alert; planetiq never claimed; zero fetch.
- NEW gate/feed/route_stage_selftest.js (51 tests).
- MOD gate/feed/worker.js — validated path runs routeDoc({...fact}, loadRegistry()); FOLD-IN: finalize UPDATE + feed_outbox enqueue (idempotency_key `${id}:${dest}`, ON CONFLICT DO NOTHING) commit in ONE txn → row never stranded at 'validated'; route.js review-downgrade lands review+feed_review atomically; any route error fails CLOSED to review (route_error). #4b review path byte-identical.
- MOD gate/index.js — one line: startOutboxDispatcher(pool, alert).

### Act 4 — Claude review (real diff) + 1 fix round
- routeDoc fold-in verified atomic + fail-closed; safeTimestamp guard correct; dispatcher claim/ack/retry correct.
- FIX (round 1, Fable): dispatcher had NO reaper for a delivery that crashes between claim('sent') and ack → orphaned internal write (violates "nothing gets lost"). Fixed: claimBatch also reclaims stale 'sent' rows (updated_at < now() - FEED_OUTBOX_STALE_MS default 5min), parameterized interval math. Re-verified all green.
- Independently re-ran: route_stage 51/51, validate 58/58, extract 20/20, parity PASS; node --check all clean.

### Notes / accepted edges
- Routing is now doc_type-driven (extract.js emits no `note`, so registry note_keywords are inert at this seam). Every validated row has a doc_type; injecting the note could let a keyword steal a rule from a correct doc_type match — deliberately not done. Flag for registry review.
- feed_expense_hold is at-least-once (no natural unique key): a dup row only if insert succeeds but ack fails, or a genuinely-alive delivery exceeds FEED_OUTBOX_STALE_MS. Accepted for an internal hold table; feed_incoming is upsert so harmless there.

### NOT verified (pending staging w/ real Postgres)
- routeDoc live wiring end-to-end; outbox claim→sent→deliver→acked incl. the stale-'sent' reclaim and SKIP-LOCKED across instances; feed_incoming upsert + feed_expense_hold insert. Plus carried-forward flags (#4a structured-output schema; all DB paths).

VERDICT: Build #5a APPROVED by Claude (1 fix round). Internal pipeline complete in code: drop→store→extract→validate→route→outbox→internal write. External sink = #5b.

## Build #5b — Step 6/7 (external n8n SINK — the real-money write path)  [EXECUTOR: Fable]

### Act 3 — Fable build (model=fable)
- NEW gate/feed/migrations/004_feed_outbox_held.sql — add 'held' to feed_outbox state CHECK (DROP+ADD constraint).
- NEW gate/feed/sink.js — 3rd concurrency-1 self-scheduling loop for EXTERNAL destinations ('planetiq'). Config-halt (no FEED_SINK_URL/SECRET → claim nothing, dedupe log, no dead-letter). releaseHeld step (held→pending once doc_type graduated). Claim pending+stale-'sent' external rows (SKIP LOCKED, same reclaim). Graduation gate (feed_graduation.external_writes_enabled; fail-closed: missing/false/null-doc_type → held+shadow log). Graduated → POST FEED_SINK_URL (x-feed-secret header, buildSinkBody, AbortSignal.timeout); 2xx→acked, else retry→failed+alert. setGraduation ops helper. Pure buildSinkBody/buildSinkHeaders/sinkUrl for the selftest.
- NEW gate/feed/sink_selftest.js (21 tests).
- MOD gate/index.js — one line: startExternalDispatcher(pool, alert).

### Act 4 — Claude review (hardest — real-money path)
- URL DISCIPLINE verified 3 ways (selftest + my read): POST target = sinkUrl()=env FEED_SINK_URL only; buildSinkBody has NO url field; fact/intake never read for a URL; secret in x-feed-secret header, never URL. This is the load-bearing security property.
- Graduation gate fail-closed incl. null doc_type (WHERE doc_type=NULL matches nothing → held). Shadow-first: feed_graduation empty by default → every external row held.
- Config-halt never dead-letters; releaseHeld delivers backlog on graduation; claim + stale-'sent' reclaim correct; idempotency_key contract makes retried POST replay-safe; state-write-fail → row stays 'sent' → reclaimed.
- Independently re-ran: sink 21/21, route_stage 51/51, validate 58/58, extract 20/20, parity PASS; node --check clean.
- Fix rounds: 0.

### Accepted edge
- deliver() re-checks url/secret before POST; a config removed AFTER claim within one cycle → retry path (attempt++). Config-halt is the primary guard (claims nothing unconfigured), so this only bites on mid-cycle unset — extremely rare, defensive-only.

### NOT verified (pending staging: real Postgres + FEED_SINK_URL/SECRET + a graduated doc_type + live n8n)
- 004 DDL; graduation gate + releaseHeld + claim→sent→POST→acked incl. stale reclaim & SKIP-LOCKED across instances; shadow-'held' path; setGraduation upsert; live n8n POST (2xx ack, retry→failed, n8n secret-reject + UPSERT-by-idempotency-key). Plus all carried-forward flags.

VERDICT: Build #5b APPROVED by Claude (0 fix rounds). FULL PIPELINE now exists in code (internal + external, shadow-gated). External writes are SHADOW until Holly runs setGraduation per doc_type. Remaining: #6 (board live + upload UI + feed-guide fix), #7 (packaging + staging deploy — where everything unproven gets proven).
