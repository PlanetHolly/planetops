# Plan Review Log: Feed Brain → company-wide inbound document router
Started 2026-07-17 (session). MAX_ROUNDS=5. PLAN_FILE=PLAN-FEED-ROUTER.md.

## Round 1 — Codex

**Findings**

1. Prompt-injection mitigation is hand-wavy. “Forced structured JSON” does not stop a PDF from poisoning extracted fields, and `note_keywords` makes user-supplied notes part of routing. Fix: treat LLM output as untrusted evidence, use deterministic validators per doc type, disable note-driven money routing, and auto-route only after schema plus cross-field checks pass.

2. The auth model is too weak for money-touching automation. The existing gate is a shared PIN session in [gate/index.js](/Users/hollytrevino/github/planetops-floor/gate/index.js:309), while Ship Deck money routes add Origin and CSRF checks. The proposed upload route only says `requireSession()`. Fix: add a `requireFeedPost` equivalent with same-origin, per-session CSRF, rate limits, and finance/PIN-tier controls for payroll/financial docs.

3. No per-user attribution exists. `gate_sessions` stores `sid`, expiry, and IP only, so “submitter from the session” is not a person. Fix: add an explicit operator identity step or per-user login before claiming audit-grade attribution.

4. The worker claim pattern is incomplete. `SELECT ... FOR UPDATE SKIP LOCKED` only protects rows inside a transaction; doing LLM work inside that transaction holds DB locks for seconds/minutes, while doing it outside loses the claim. Fix: claim by atomically updating `status='processing'`, `locked_until`, `attempt_count`, and `worker_id` in one transaction, then process outside the lock.

5. Partial destination writes are not recoverable. A single `feed_intake.status = routed|review|failed` cannot represent “incoming wrote, n8n timed out, ledger wrote.” Fix: add a destination outbox table with one row per sink, unique idempotency keys, state, attempts, last error, and replay logic.

6. “Fire-and-forget POST to n8n” is unsafe. If the webhook accepts but later fails, or the gate times out after n8n writes, the ledger lies and retries can duplicate external effects. Fix: make n8n sinks acknowledge a durable idempotency key and record response status before marking that destination complete.

7. Content-hash idempotency is insufficient. Same logical invoice re-exported with different metadata bytes will reprocess and can double-post. Fix: add semantic idempotency keys per doc type, such as vendor plus invoice/PO/order number plus date/amount, with collision review.

8. Deduping by `content_hash` alone can also suppress legitimate repeats. Two identical template docs or repeated payroll files for different periods could collapse incorrectly if fields differ only by note/context. Fix: include extracted canonical keys and route-specific uniqueness, not only raw bytes.

9. The plan assumes router source files that are not in this repo. `brain_router.py` and `routing_registry.json` are referenced in [PLAN-FEED-ROUTER.md](/Users/hollytrevino/github/planetops-floor/PLAN-FEED-ROUTER.md:10), but only `incoming-data.json` exists locally. Fix: first import the registry and reference tests into the repo, then make parity tests block deployment.

10. The “graphics pattern” is the wrong precedent. [gate/graphics.js](/Users/hollytrevino/github/planetops-floor/gate/graphics.js:68) is CRUD plus BYTEA images, not background processing, LLM calls, external money sinks, or auditable workflows. Fix: use graphics only for route mounting style; design feed as a queue/outbox subsystem.

11. Boot-time `CREATE TABLE IF NOT EXISTS` is not a migration strategy for the live shared DB. The current gate already uses best-effort DDL, but adding five tables, indexes, constraints, and worker state this way can silently mismatch schemas. Fix: add versioned migrations, explicit indexes, schema validation on startup, and fail readiness if the feed schema is wrong.

12. `CREATE TABLE IF NOT EXISTS` hides incompatible prior tables. If a table exists with the wrong columns or constraints, the app starts and fails later. Fix: use `schema_migrations` plus exact DDL checks.

13. Raw payroll/financial docs in Postgres BYTEA create privacy, backup, and bloat risk. The shared `DATABASE_URL` is used by gate and state-api, and 25 MB uploads will quickly inflate backups and query performance. Fix: store raw files in encrypted object storage or a separate restricted schema with retention and delete policy.

14. MIME validation is spoofable. Accepting by client MIME allows renamed executables, malformed PDFs, huge page-count PDFs, or decompression bombs. Fix: sniff magic bytes, parse page/image dimensions, cap pages, reject encrypted/active-content PDFs, and quarantine parse failures.

15. LLM cost is unbounded. A 25 MB PDF can mean many pages/images, and the plan has no queue concurrency, per-day budget, token cap, or model fallback. Fix: enforce page/token/image limits before calling the model, add per-session and global quotas, and record token usage.

16. Extraction has no timeout/cancellation/retry semantics. A stalled Anthropic request can tie up a worker slot indefinitely. Fix: use `AbortSignal.timeout`, bounded concurrency, exponential backoff, and a dead-letter state.

17. “Ledger always appended” is underspecified. It does not say whether the ledger records prompt version, registry version, model, token counts, source hashes, raw response, validation failures, per-destination outcomes, or replay IDs. Fix: ledger every state transition with correlation ID, registry commit/hash, extractor version, model, usage, validator results, and sink outcomes.

18. Confidence is not a safety control. LLM confidence is not calibrated and can be high on wrong extractions. Fix: route by deterministic required-field validators and reconciliation checks, using model confidence only as a weak signal.

19. `on_missing: "review"` is too narrow. Wrong-but-present fields, wrong doc type, injected vendor names, or hallucinated PO numbers will bypass “missing” checks. Fix: add `on_low_confidence`, `on_conflict`, `on_unknown_vendor`, `on_amount_mismatch`, and `on_duplicate_semantic_key` review paths.

20. Incoming board contract is not planned. [incoming/index.html](/Users/hollytrevino/github/planetops-floor/incoming/index.html:185) expects `items`, `generated_at`, `job`, `vendor`, `eta`, `line_count`, etc.; the plan only says `feed_incoming` without defining the API shape or indexes. Fix: define the exact `/api/feed/incoming` response contract and DB projection before implementation.

21. The frontdoor registry change is incomplete. `frontdoor/app.js` only falls back to `feed-guide`; adding `feed-upload` also needs a glyph, status/access decision, URL validation, and cache behavior. Fix: add the registry node and matching icon/UI handling as a separate verified frontdoor change.

22. The new dependency is missing from gate packaging. `gate/package.json` currently has only `express` and `pg`; the plan adds `multer` but does not mention lockfile/install/deploy validation. Fix: add dependency and verify Railway installs from the correct package root.

23. Finance-zone interaction is ignored. Payroll, financials, invoices, and pricing-sensitive docs probably belong behind `FINANCE_PIN`, but `/api/feed/intake` would be team-PIN only unless explicitly gated. Fix: classify upload route or doc categories requiring finance unlock before accepting or before auto-routing.

24. External sink secrets/auth are not specified. Existing Ship Deck uses `x-shipdeck-secret`; the plan only says n8n webhook POST. Fix: use per-sink shared secrets, allowlisted URLs from env, no document-derived URLs, and alert on rejected sink auth.

25. Simpler safer v1 exists. The plan jumps straight to fully automatic external writes. Fix: first ship gated upload, durable storage, extraction, ledger, and Incoming/review queues only; enable external writes per doc type after validation data proves accuracy.

VERDICT: REVISE
### Claude's response (Round 1 → revision)

Accepted and folded in: #1,#2,#3,#4,#5,#6,#7,#8,#9,#10,#13,#14,#15,#16,#17,#18,#19,#20,#21,#22,#23,#24.
- #9 promoted to a hard Step-0 prerequisite: import registry+brain+tests into the repo (repo becomes SoT), Node/Python parity test blocks deploy.
- #5/#6/#24 → single feed_outbox table (per intake×destination, idempotency_key/state/attempts/last_error), per-sink shared secret + env URL allowlist.
- #1/#18 → deterministic per-doc-type validators are the auto-route gate; LLM confidence demoted to weak signal.
- #20 → /api/feed/incoming returns the EXACT shape incoming/index.html consumes (verified in code).
Partial / arbiter push-back:
- A1 (#25 phasing): Holly explicitly chose fully-automatic. Kept fully-automatic INTERNAL routing day one; external irreversible writes graduate per-doc-type after shadow-proven validators. Flagged for Holly, NOT silently imposed as a human gate.
- A2 (#11/#12): rejected a full migration framework as over-build vs this repo's boot-DDL convention; compromise = feed_schema_version guard + explicit DDL + /readyz hard-fail on mismatch.
- A3 (#7/#8): content_hash (exact) + per-doc-type semantic key (logical); collisions → review, not silent collapse.
- D3 (#13): raw docs in a restricted table + retention/purge, object storage deferred (not rejected).

## Round 2 — Codex

**Findings**

1. R1 is still a blocker, not a resolved risk. The plan makes known-vendor validation central at [PLAN-FEED-ROUTER.md](/Users/hollytrevino/github/planetops-floor/PLAN-FEED-ROUTER.md:36), then admits the vendor catalog does not exist at line 78. Fix: define the vendor/expected-field catalog source, ownership, update workflow, and “first-seen vendor = review” rule before implementation.

2. R2 is unresolved and affects idempotency correctness. “Semantic key” is required for duplicate safety, but payroll and other docs have no defined key. Fix: make semantic key extraction a required per-doc-type interface with tests and mark any doc type without a key as review-only or internal-only.

3. R3 is not implementable as written. “Finance doc categories require FINANCE_PIN” happens after extraction, but the upload route receives arbitrary bytes before it knows the category. Fix: either require finance unlock for all feed uploads, or require a user-selected category before upload and treat finance-category mismatch as review plus alert.

4. The required “submitter name” is spoofable. The revised architecture says “drop file + note + submitter name” and “required name field,” but `gate_sessions` only proves a shared PIN session, not identity. Fix: add per-user identity/auth, or explicitly label audit actor as session/IP plus untrusted display name.

5. R4 remains under-specified. “Raw kept only until routed + a short reprocessing grace” has no number and can conflict with failed outbox replay, audits, and prompt-injection investigations. Fix: set a concrete state-based retention policy, e.g. purge only after all outbox rows are `acked` plus N days, with legal/payroll exceptions.

6. “Restricted schema” is not a real protection unless DB roles change. The existing gate uses one `DATABASE_URL` pool in [gate/index.js](/Users/hollytrevino/github/planetops-floor/gate/index.js:76); a schema in the same DB does not restrict the compromised app. Fix: use a separate DB role/schema with least privilege, or encrypt raw bytes with a key not available to normal read endpoints.

7. R5 is still open and material. An in-gate interval worker doing OCR/LLM work can starve the web service, and Railway may run multiple instances. Fix: choose now: separate worker process/queue for production, or hard-limit in-gate concurrency to 1 with readiness/load safeguards.

8. R6 is not adequately mitigated. Deterministic validators cannot distinguish a forged but internally consistent invoice from a real one when any PIN holder can upload arbitrary docs. Fix: require trusted-source provenance or review for first-seen vendors, high-dollar docs, payroll, financials, and any external write path.

9. “Shadow-proven validators” has no promotion criteria. External writes are enabled “once proven accurate,” but there is no sample size, threshold, owner, or rollback rule. Fix: define per-doc-type promotion gates, such as 50 real docs, zero critical misroutes, reconciliation pass, and explicit config review.

10. CSRF implementation is incomplete. Ship Deck has a GET route that returns `csrfFor(s.sid)` in [gate/index.js](/Users/hollytrevino/github/planetops-floor/gate/index.js:447); the feed plan says “mirror Ship Deck” but does not specify how `/feed-upload/` obtains the token. Fix: add `GET /api/feed/session` or equivalent returning the feed CSRF token and upload limits.

11. Outbox ack semantics are still vague for n8n. “Acked” only helps if n8n durably records the same idempotency key before doing side effects. Fix: specify the n8n contract: reject missing key/secret, upsert by key before action, return durable status, and expose reconciliation.

12. The deploy-blocking parity test is aspirational. This repo’s `gate/package.json` has no test script or CI/deploy gate. Fix: add the exact test command, fixture location, and deployment check that prevents Railway promotion on failure.

13. MIME and PDF safety are named but not actionable. “Reject encrypted/active PDFs, decompression-bomb guard” needs concrete libraries and limits. Fix: pick the parser/sniffer libraries and define max pages, max pixels, max extracted text bytes, and failure behavior.

14. The plan still deletes `incoming-data.json`, which removes the current direct-file fallback described by [PLAN-INCOMING.md](/Users/hollytrevino/github/planetops-floor/PLAN-INCOMING.md:62). Fix: keep a sample fallback for local/dev or update the board contract and docs explicitly.

15. Schema compromise is still too loose for live gate. Rejecting a migration framework may be fine, but “explicit DDL + readyz fail” does not cover additive changes, index creation, rollback, or partial DDL failure. Fix: create a small `gate/feed/migrations` runner with transactional versioned migrations, even if it is not a full framework.

VERDICT: REVISE
### Claude's response (Round 2 → revision)

Accepted all 15; converted open risks R1-R6 into concrete decisions (§Resolved):
- #1 vendor catalog: feed_vendors seeded from Printavo/Streak; first-seen→review→promotes.
- #2 semantic key: required per-doc-type fn; no-key doc types are internal/review-only. Payroll key = provider|period_end|net_total.
- #3 finance PIN: category DECLARED at upload; payroll/financials need FINANCE_PIN; declared!=detected → review+alert.
- #4 identity: honest v1 actor = session+ip+UNTRUSTED name; per-user login flagged as separate effort (A4).
- #5 retention: state-based; transient purge after acked+30d; payroll/financials retained encrypted (legal).
- #6 raw at rest: AES-GCM encryption (FEED_RAW_KEY), worker-only decrypt, NO raw-download endpoint exists.
- #7 worker: in-gate concurrency=1, claim-based multi-instance-safe; separate dyno = scale path.
- #8 forged docs: review-triggers (first-seen vendor/high-dollar/payroll/financials/external-write) force review regardless of validator pass.
- #9 promotion: >=50 docs, 0 misroutes, reconciliation, Holly config review.
- #10 CSRF: GET /api/feed/session returns token+limits.
- #11 n8n ack: sink contract = reject missing key/secret, UPSERT-by-key before side-effect, durable status, replay-until-acked.
- #12 parity test: gate npm 'test' script + documented predeploy check + start-time self-check backstop.
- #13 MIME/PDF: file-type sniff + pdf-lib (<=20pg, reject encrypted/JS, <=8000px, <=200KB text, quarantine).
- #14 incoming-data.json: KEPT as local/dev offline fallback; PLAN-INCOMING.md to be updated.
- #15 migrations: upgraded A2 to a minimal transactional versioned runner (numbered .sql + feed_schema_migrations + readyz hard-fail).
Left to Holly as numbers (defaults set, non-blocking): high-dollar threshold, payroll retention, purge delay, FINANCE_PIN holders, promotion bar.

## Round 3 — Codex

The Round 2 plan is materially stronger. The remaining issues I see are implementation constraints that should be captured during build, not reasons to redesign the plan again.

**Implementation Checks**

1. Finance category enforcement still depends on honest declaration at upload. A non-finance user can declare “PO” and upload a payroll file; extraction mismatch sends it to review + alert, but the file has already entered the system. Fix: make mismatch quarantine hard, suppress extracted details from non-finance contexts, and consider “all feed uploads require FINANCE_PIN” if confidentiality matters more than self-serve convenience.

2. “AES-GCM encryption protects raw docs” is only true against DB/backups, not against a compromised gate process because `FEED_RAW_KEY` is in the same runtime. Fix: document the threat model clearly; use separate DB role/KMS later if app-compromise protection is required.

3. “HARD concurrency=1” is per process, not global, if Railway runs multiple instances. Claim locking prevents duplicate row processing, so this is acceptable, but cost budgets must be global in Postgres. Fix: enforce budget counters transactionally in DB before each LLM call.

4. The parity self-check can become a deploy hazard if Python is unavailable in the Railway gate image. Fix: either ensure Python is available in the gate runtime or make startup check use committed JSON fixture outputs generated in test.

5. `pdf-lib` may not reliably prove “no embedded JS/active content” across all PDFs. Fix: treat PDF active-content detection as best-effort and default suspicious/parse-failed PDFs to review.

6. The vendor promotion path now implies a real review action, even though review UI is “beyond review queue” scope. Fix: include the minimal queue action needed to mark `feed_vendors.status='known'`.

7. The `feed_vendors` seed source is plausible but not pinned. Fix: define the exact seed command/source tables or APIs during Step 0/DDL work.

None of those are plan-level blockers. The plan now has concrete decisions for prompt-injection residual risk, idempotency, worker races, migrations, observability, cost controls, finance gating, and external-write graduation.

VERDICT: APPROVED
### Convergence
APPROVED after 3 rounds (findings 25 → 15 → 0 blockers). 7 R3 items folded in as implementation checks. Awaiting Holly sign-off.
