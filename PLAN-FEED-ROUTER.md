# Plan: Feed Brain → company-wide, self-serve, fully-automatic inbound document router
_Round 2 — revised after Codex rounds 1 (25) + 2 (15). Open risks R1–R6 are now resolved decisions (§Resolved). Arbiter notes in §Arbiter._

## Goal
Turn the single-person Feed prototype (files land in Holly's local Dropbox `PlanetIQ/Feed/Intake/`; Holly runs the `/feed` CLI on her Mac) into a **company-wide, self-serve inbound document router**: anyone on the team, from any machine, drops a document (PO, Amazon order, payroll, financials, invoice), declares its category, and the system stores it, reads it with an LLM, **validates the extraction deterministically**, routes it per a registry, dispatches through a durable outbox, and records every decision in an audit ledger. Drop-surface intake only (email later).

## "Fully automatic" — the definition we build to
Submitter drops a file and walks away; no human clicks in the normal path. The auto-route safety gate is **deterministic per-doc-type validation** (not a human, not LLM confidence). PASS → routes automatically. FAIL or a **review-trigger** (below) → the `review` queue. Internal destinations (Incoming board, ledger, review — Postgres, observable, reversible) are fully automatic day one. **External irreversible writes** (Printavo, shared Sheets) route automatically **only for doc types that have graduated** (§Resolved R6/#9). — This graduation is a safety sequence, not a human-in-the-loop step; it qualifies "day-one automatic for money leaving the system" and is **flagged for Holly (§Arbiter A1)**.

**Review-triggers (any one → review, even if extraction "succeeded"):** first-seen vendor · amount ≥ high-dollar threshold · doc category ∈ {payroll, financials} · declared-vs-detected category mismatch · semantic-duplicate collision · any not-yet-graduated external-write path. (Codex R2 #8.)

## Non-negotiables
Reuse over build; no new credential for upload (reuse PIN session). Don't destabilize the live gate — confirm deploy trigger before push, never force-push. Money + automatic ⇒ correctness/auditability are first-class.

## Step 0 — Prerequisite (Codex R1 #9): import the brain into the repo
`brain_router.py` + `routing_registry.json` live only in Dropbox. Import them + the test suite into `gate/feed/` (**repo = single source of truth**; Dropbox Python CLI re-pointed at the repo copy). Port `route()` to Node reading the same JSON. **Parity test** (shared fixtures → identical Python/Node decisions) wired as a **`gate` npm `test` script** and a **documented predeploy check** (`npm --prefix gate test` must pass before push/promotion); a **start-time self-check** is the backstop if Railway can't gate on CI (Codex R2 #12).

## Architecture: one brain in the gate; n8n is a downstream SINK
```
[Team member] → /feed-upload/ : file + note + submitter-name + DECLARED CATEGORY  (behind PIN; payroll/financials require FINANCE_PIN — R2 #3)
   │  GET /api/feed/session → CSRF token + limits (mirrors Ship Deck csrfFor — R2 #10)
   │  POST /api/feed/intake  (same-origin + CSRF + per-IP/global rate-limit)
   ▼  gate/feed/*.js  (mount-style from graphics; processing = QUEUE/OUTBOX, NOT graphics CRUD — R1 #10)
   • multipart (busboy); sniff magic bytes (`file-type`); PDF guard (`pdf-lib`): ≤20 pages, reject encrypted/JS-embedded,
     ≤8000px/side, ≤200KB extracted text, quarantine parse-fail → review (R2 #13)
   • content_hash=sha256(bytes); ENCRYPT raw at rest (AES-GCM, key=FEED_RAW_KEY env; NO endpoint ever returns raw to a browser — R2 #6)
   • INSERT feed_intake (enc raw, declared_category, submitter-name[UNTRUSTED display], session_id, ip, status='received') ← durable FIRST
   • 201 {intake_id,status}
   ▼  WORKER (in-gate, HARD concurrency=1; multi-instance-safe via claim — R2 #7)
   • CLAIM (one txn): UPDATE status='processing', worker_id, locked_until, attempt_count++  (no LLM in txn — R1 #4)
   • EXTRACT: Anthropic Messages API — AbortSignal.timeout, backoff, dead-letter; page/token caps; per-session+global daily budget;
     record token usage (R1 #15/#16); forced JSON schema; extracted text ONLY fills fields, never drives actions (R1 #1)
   • VALIDATE (deterministic, per-doc-type = the gate — R1 #1/#18): required fields · amounts parse · line-sum=total ·
     known-vendor (feed_vendors) · semantic_key present · declared==detected category. Fail → review w/ typed reason.
   • ROUTE: routeDoc(fact, routing_registry.json) — Node port; ledger ALWAYS appended; expanded on_* review paths (R1 #19)
   • DISPATCH via feed_outbox (one row per intake×destination: idempotency_key, state pending→sent→acked|failed, attempts, last_error — R1 #5/#6):
       internal sinks = Postgres writers; external sink = n8n POST w/ x-feed-secret + env-allowlisted URL (never doc-derived — R1 #24),
       n8n contract: reject missing key/secret, UPSERT by idempotency_key BEFORE side-effect, return durable status; replay until acked (R2 #11)
   • LEDGER every transition: correlation_id, content_hash, semantic_key, declared+detected category, registry_commit, extractor_version,
     model, token_usage, validator_results, decision, per-destination outcomes, enc-raw ref (R1 #17)
```

## Resolved (were R1–R6 / new R2 findings — now decisions)
- **Vendor catalog (R1 #1):** `feed_vendors` table seeded from existing Printavo/Streak vendor names (one-time import). **First-seen vendor → review**, which adds it as `pending`; approving in the review queue promotes it to known. Owner = whoever clears review (ops). Deterministic, self-growing.
- **Semantic key (R2 #2):** a **required per-doc-type function** `semanticKey(doc_type, fact)`; a doc type without one is **internal/review-only, never auto external-write**. Keys: PO/order/invoice = `vendor|doc#|amount|date`; payroll = `provider|period_end|net_total`; financials = `source|period|report_type`. Collision → review (never silent collapse) (R1 #7/#8).
- **Finance gating (R2 #3):** category is **declared at upload** (dropdown). Payroll/financials require FINANCE_PIN to submit. Extraction disagreeing with the declared category → review + alert. (Solves "category unknown before extraction.")
- **Submitter identity (R2 #4):** v1 actor = `session_id + ip + UNTRUSTED submitter-name`. We do **not** claim per-person cryptographic attribution — true per-user login is a separate effort (**flagged, §Arbiter A4**).
- **Raw retention (R2 #5):** state-based. Transient docs (PO/order/invoice): purge encrypted raw only after **all outbox rows `acked` + 30 days**. Payroll/financials: **retained encrypted (legal record-keeping), not purged** — number is Holly's (§Numbers). Failed/under-investigation intakes are never purged.
- **Raw at rest (R2 #6):** app-level **AES-GCM encryption**, key in `FEED_RAW_KEY` env, decrypt only in the worker; **no raw-download endpoint exists**. (Separate DB role deferred — encryption gives the protection without DB-admin changes.)
- **Worker model (R2 #7):** in-gate loop, **concurrency=1**, claim-based (SKIP LOCKED) so multiple Railway instances are safe; readiness backpressure. Separate worker dyno = the scale path, not v1.
- **Forged-doc provenance (R2 #8):** covered by the review-triggers list above — first-seen vendor / high-dollar / payroll / financials / external-write all force review regardless of validator pass.
- **Promotion criteria (R2 #9):** per doc type, external writes graduate after **≥50 real docs, 0 critical misroutes, a reconciliation pass, and explicit config review (Holly)**. Tracked in a `feed_graduation` config.
- **Migrations (R2 #15, upgrades A2):** a **minimal transactional versioned runner** — numbered `.sql` in `gate/feed/migrations/`, a `feed_schema_migrations` table, applied in-order in a transaction at boot; `/readyz` **hard-fails** on pending/failed/partial DDL. Lightweight, not a framework, but transactional + versioned.

## Approach (concrete build order)
1. Step 0 (registry+brain into repo, parity test + `test` script).
2. Migrations runner + DDL: `feed_intake, feed_outbox, feed_ledger, feed_incoming, feed_review, feed_expense_hold, feed_vendors, feed_graduation`; `/readyz` schema guard.
3. `GET /api/feed/session` (CSRF+limits); `POST /api/feed/intake` (multipart, sniff+PDF guard, declared category, FINANCE_PIN for finance categories, rate-limit, encrypt+store, dedupe on content_hash).
4. Worker (claim/lock/attempt/dead-letter, concurrency=1); Anthropic extraction (caps+budget+timeout+usage).
5. Deterministic validators + `feed_vendors` seed + `semanticKey` per doc type.
6. Node `routeDoc` on repo registry; expanded `on_*` review triggers.
7. `feed_outbox` dispatch + internal writers + n8n sink contract (secret, UPSERT-by-key, allowlisted URL).
8. **Incoming board live:** `GET /api/feed/incoming` returns the exact shape the board consumes — `{generated_at, items:[{fact_id, vendor, job, customer, summary, total, line_count, eta, status, received_at, doc_refs}]}` (verified in `incoming/index.html`); board fetches API, **falls back to committed `incoming-data.json` for local/dev** (keep it as the offline sample — R2 #14; update `PLAN-INCOMING.md`).
9. `GET /api/feed/ledger` + gated ledger page.
10. Frontdoor: add `feed-upload` node (glyph, status/access, same-origin URL validation, `no-store`); build `/feed-upload/index.html`; **ship the `feed-guide/` fix in the same deploy** (kills live "localhost refused to connect").
11. Packaging: add `busboy`+`file-type`+`pdf-lib` to `gate/package.json` + lockfile; verify Railway installs from `gate/`.
12. Rollout: confirm Railway deploy trigger BEFORE push; set env `ANTHROPIC_API_KEY`, `FEED_SINK_SECRET`, `FEED_RAW_KEY`; stage → `/readyz` green → walk one real doc per category end-to-end (external writes in shadow) → prod. Never force-push.

## Numbers that need Holly's call (defaults in brackets — not blockers)
- High-dollar review threshold [$5,000].
- Payroll/financials raw retention period [legal minimum — Holly/Kelly to confirm].
- Transient-doc purge delay [acked + 30 days].
- Who holds FINANCE_PIN / which categories are "finance" [payroll, financials].
- Promotion bar per doc type [≥50 docs, 0 misroutes].

## Arbiter notes
- **A1 (#25):** kept Holly's fully-automatic INTERNAL routing day one; external irreversible writes graduate per-doc-type. Flagged, not silently imposed.
- **A2 (#11/#12→#15):** upgraded from "boot DDL guard" to a minimal transactional versioned migration runner after R2 #15.
- **A4 (R2 #4):** true per-person attribution = a separate per-user-login effort; v1 is honestly labeled session/IP + untrusted name.

## Risks that remain (accepted, monitored — not blockers)
- Extraction accuracy on messy scans → mitigated by validators + review-triggers + shadow graduation; measured via the ledger.
- A forged, internally-consistent doc from a first-seen vendor at low dollar could route internally (not external) before review catches it → ledger + reconciliation catch it; acceptable for INTERNAL destinations only.
- Railway CI may not hard-block on the parity test → start-time self-check backstop.

## Out of scope
Email intake; registry → Google Sheet; per-user login; human-approval UI beyond `review`; historical backfill; object storage for raw docs.

## Implementation checks (Codex R3 — APPROVED; fold in during build, not redesign)
1. Declared-category is honest-input: on declared≠detected, **hard-quarantine** (not just alert), suppress extracted detail from non-finance contexts; if confidentiality > convenience, consider FINANCE_PIN for ALL feed uploads. (Holly call — §Numbers.)
2. `FEED_RAW_KEY` in-process protects DB/backups, NOT a compromised gate process — document that threat model; DB-role/KMS is the later upgrade.
3. Concurrency=1 is per-process; LLM **cost/budget counters must be enforced transactionally in Postgres** (global), not in-process.
4. Parity self-check must not assume Python in the Railway gate image — either ensure Python present OR have the start-time check compare against **committed JSON fixture outputs** generated during test.
5. PDF active-content detection via `pdf-lib` is **best-effort**; suspicious/parse-failed PDFs default to review.
6. Vendor promotion needs a **minimal review-queue action** to set `feed_vendors.status='known'` (the one bit of review UI in v1 scope).
7. Pin the exact `feed_vendors` seed source (Printavo/Streak tables/APIs) during Step 0/DDL.

---
_STATUS: Codex-APPROVED after 3 rounds (25 → 15 → approved). Awaiting Holly sign-off (human gate #2) before any code._
