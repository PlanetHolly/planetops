# PLAN — Sorting Hat, Round 1 (staging blockers)

**Base:** `origin/brain-incoming-board` · **Work branch:** `feed-router-round1`
**Source of findings:** `~/Dropbox/PlanetApparel/PlanetIQ/REDTEAM-FEED-ROUTER-2026-07-18.md`
**Scope rule:** this round unblocks *staging in shadow mode only*. It does NOT make the system safe for real payroll (Round 2) or for flipping graduation (Round 3). Do not expand scope.

## Working-tree isolation (do this first)

Both existing checkouts are occupied — `~/github/planetops-floor` is on `media-center` with uncommitted work owned by another terminal, `~/github/planetops` is on `planet-graphics-templates`. **Do not touch either.**

```
git -C ~/github/planetops-floor worktree add \
  /private/tmp/claude-501/-Users-hollytrevino/5a740be1-7bc7-4917-9cb1-a9043d0d2459/scratchpad/wt-round1 \
  -b feed-router-round1 origin/brain-incoming-board
```

All edits happen in that worktree. Never force-push. Do not merge to `main`.

---

## D1 — Review queue must be visible (blocker B1)

**Problem:** gate-triggered reviews only UPDATE `feed_intake.status='review'`. No `feed_review` row, no alert, no read path. Every payroll and financials document lands here by design and becomes invisible.

**Fix:**
1. `worker.js:295-302` and `:232-241` — INSERT into `feed_review` on these paths, matching the shape the route-downgrade path already writes at `:330-334`. One shared helper; do not duplicate the SQL.
2. Fire `alert()` on every transition into `review`, with `intake_id`, `doc_type`, and the trigger reason. Never include extracted amounts, vendor, customer, or filename in the alert body — the alert webhook is an ungated external channel (report LOW-1) and this is the payroll path.
3. Add `GET /api/feed/review` to `views.js` listing open review rows.

**Access-control constraint (non-negotiable):** this endpoint exposes payroll metadata, so it must be **finance-gated**, not `requireSession` alone. `/api/feed/*` is currently absent from `FINANCE_PREFIXES` (`gate/index.js:55`). Gate this new route on the finance session the same way `/planetiq/` is gated. Do **not** copy the existing `views.js` auth pattern — that pattern is itself finding B7.

**Acceptance:** a doc tripping `high_dollar` produces (a) a `feed_review` row, (b) one alert with no financial values in it, (c) a row in `GET /api/feed/review`, and (d) a 403 from that endpoint for a session holding only the entry PIN.

**Out of scope:** resolving/clearing a review. Staging can leave resolution as manual SQL. Say so in the runbook rather than half-building it.

---

## D2 — Poison document must not crash-loop the shared app (blocker B2)

**Problem:** the attempt cap lives only inside a caught exception (`worker.js:208-214`). A doc that kills the process never reaches a catch, is reclaimed every 5 min forever, and `ORDER BY created_at` re-serves it first. The workers share a process with the login gate and Ship Deck.

**Fix — all three parts, they are interdependent:**
1. **Claim-time cap.** Add `AND attempt_count < $MAX` to the claim query (`worker.js:106-137`). A row past the cap is no longer claimable.
2. **Sweeper.** A periodic pass moves `status='processing' AND locked_until < now() AND attempt_count >= MAX` to `failed`, with an alert. Without this, capped rows sit in `processing` forever — trading one invisible state for another.
3. **SIGTERM handler.** On shutdown, release the in-flight claim (`status → received`, decrement `attempt_count`) before exiting.

**Why part 3 is mandatory, not a nice-to-have:** finding M8 shows reclaims already burn attempts without a real attempt — four routine Railway redeploys landing mid-extraction reach `attempt_count=4` with zero completed attempts. Adding a claim-time cap *without* SIGTERM release converts ordinary deploy churn into dead-lettered healthy payroll documents. Ship 1 and 3 together or ship neither.

**Acceptance:** a doc that hard-kills the worker reaches `failed` with an alert after MAX reclaims, not an infinite loop; and a clean SIGTERM during extraction leaves `attempt_count` unchanged from before the claim.

---

## D3 — Fix extraction error classification (blocker B3)

**Problem:** `extract.js:156-159` classifies anything that is not 429/5xx as permanent. 401/403 are environmental faults, so a five-minute bad-key window dead-letters every document uploaded in it, forever.

**Fix — explicit map, no catch-all:**

| Status | Class | Behavior |
|---|---|---|
| 401, 403 | **config halt** | Stop the worker loop, alert once, leave the row untouched and re-claimable. Mirror the existing `not_configured` halt at `worker.js:201-207`. |
| 404 | **config halt** | Only realistic cause is a bad `FEED_EXTRACT_MODEL`. Env fault, not a document fault. |
| 400 | permanent | Dead-letter + alert. Genuinely malformed request. |
| 413 | permanent | Dead-letter + alert naming the size, so the intake cap can be tuned. |
| 429, ≥500 | retryable | Unchanged. |
| network/timeout/parse | retryable | Unchanged. |

Add a source comment recording the union-typed-parameter budget (16/request; the schema currently uses 10) so a future schema expansion doesn't silently walk into a permanent 400. See report M16.

**Acceptance:** a mocked 401 halts the loop and leaves the row `received` with `attempt_count` unchanged; a mocked 400 dead-letters with an alert.

---

## D4 — Dead-letter must have a way out (blocker B4)

**Problem:** re-uploading a failed document hits the `content_hash` UNIQUE and returns `200 {duplicate:true, status:'failed'}` while doing nothing. Recovery requires manual SQL behind a response that looks like success.

**Fix:** on `ON CONFLICT (content_hash)` (`intake.js:209-220`), branch on the existing row's status:
- `failed` → requeue it: `status → received`, `attempt_count → 0`, clear `last_error`. Return a response that plainly says *requeued*, not *duplicate*.
- `routed` → return duplicate, unchanged. **Never requeue a routed document** — that is a double-route and, post-graduation, a double external write.
- `review`, `processing`, `received` → return duplicate with the current status, unchanged.

**Acceptance:** re-uploading a failed doc processes it again; re-uploading a routed doc does not.

---

## D5 — Boot-migration failure must be visible and recoverable (blocker H6)

**Problem:** `migrate.js:70-95` caches the rejected promise forever, so a transient Postgres blip during deploy bricks the router for the process lifetime. `/healthz` returns hardcoded `ok:true` (`gate/index.js:242`); `/readyz` is session-gated (`:254`), so Railway's healthcheck cannot see it.

**Fix:**
1. Do not cache a *rejected* migration promise. Cache success; allow a later attempt to retry.
2. Alert on migration failure. Currently it is `console.error` only.
3. Expose schema readiness on an unauthenticated path — either make `/readyz` public or add a public boolean. **Expose only `schema_ok: true|false`.** No table names, no error strings, no connection detail; the gate is internet-facing.

**Do not make `/healthz` fail on schema-absent.** It is Railway's liveness target (`PUBLIC_EXACT`, `gate/index.js:48`); failing it would trigger a restart loop on exactly the condition a restart cannot fix.

**Acceptance:** with migrations forced to fail, the public readiness path reports `schema_ok:false`, an alert fires, `/healthz` still returns 200, and a subsequent successful migration flips it true without a restart.

---

## D6 — Wire the parity guard and lock the registry order (blockers H10, H11)

**Problem A (H10):** nothing runs the parity test. No CI, no test script in the root `package.json` Railway actually builds, no start-time check, no golden outputs, and `PLAN-FEED-ROUTER-ROLLOUT.md` — the deploy Holly follows — never mentions it.

**Problem B (H11):** `R-period-expense` must precede `R-expense` or Holly's 7/16 UPS ruling silently dies. Ordering is enforced only by row position in a JSON file. Proven: sorting the registry alphabetically breaks it, **and Python and Node still produce byte-identical output, so the parity test passes.** Parity tests agreement, not correctness.

**Fix:**
1. `"test": "sh gate/feed/parity_test.sh"` in the **root** `package.json`.
2. Commit **golden expected outputs** for the parity fixtures. Parity alone cannot catch a reorder; only golden outputs can.
3. **Node-only start-time self-check** in `gate/index.js`: run the fixtures through `route.js`, compare against the goldens, and additionally assert `R-period-expense` appears before `R-expense` in the loaded registry. Node-only because the Railway image may not have Python — this was already required by the original plan (item 4) and never built.
4. On mismatch: refuse to start the feed workers, alert, and report `schema_ok:false`-style unreadiness. **Do not take down the whole gate** — the login gate and Ship Deck must survive a bad registry.
5. Add an explicit parity/self-check step to `PLAN-FEED-ROUTER-ROLLOUT.md`.

**Acceptance:** alphabetically sorting `routing_registry.json` makes both `npm test` and boot fail loudly, while `/gate` login still works.

---

## D7 — Record the destination-idempotency decision (design note only, no code)

Cross-terminal insight, adopted. The Round 3 fix for B9 was going to be *"n8n upserts by idempotency_key before any side effect."* **Reject the upsert; use read-then-append.**

An upsert writes to an existing row. The moment any human column is added to a destination sheet — a "Received" checkbox, a note — the upsert clobbers it. That is exactly the Ph2b blocker already on record for the Incoming board: check-off is app-owned state, facts are router-owned, and a regenerating writer destroys the human's marks. Read-then-append never rewrites a row, so human columns are structurally safe. Cost is one extra read.

**Verified today:** `buildSinkBody` (`sink.js:73-82`) already ships both `idempotency_key` and `content_hash`. **Read-then-append is implementable on the n8n side with zero payload change.** Free to adopt.

Write this into `PLAN-FEED-ROUTER.md` as the recorded contract for the unbuilt n8n workflow. No code this round — the sink is shadow-gated and the workflow does not exist yet.

---

## Explicitly NOT in this round

- **B5/B6/B7** — the FINANCE_PIN declared-category bypass, plaintext extracted contents, unguarded ledger read. Round 2, before any real payroll or financials document is uploaded. *(D1 pulls the finance gate forward for the one new endpoint only, because building a new leak would be absurd.)*
- **B8/B9/B10** — graduation backlog replay, destination idempotency, `feed_expense_hold` duplicates. Round 3, before graduation is ever flipped. B8 works retroactively off `created_at`, so shadow test documents accumulating during staging are fine *provided the age cutoff exists before the flip.*
- **H1–H5, H9, M1–M5** — semantic sanity layer, currency, confidence bounds, duplicate double-pay paths, lease/timeout, prompt injection, dead `note_keywords`. Round 4.
- **M1 needs a ruling from Holly, not a patch.** `note_keywords` is dead code, and the naive fix — passing `row.note` into the router — makes the submitter's free-text box a routing channel into an external destination, because `ruleMatches` is doc_type **OR** note. A note containing "spend" would route any document to PlanetIQ. Do not "fix" this opportunistically while in these files.

---

## Global constraints for the builder

- **Tests must fail before they pass.** Every acceptance check above gets a test that is demonstrated red against current `origin/brain-incoming-board` first. The report's central lesson is that all five existing suites are pure-function-only and prove almost nothing — `validate_selftest.js` contains two tests that encode bugs as intended behavior. Do not add more of the same.
- **No new npm dependencies.** The build has held zero-new-deps so far.
- **No schema-destructive migrations.** New migrations are additive only, idempotent, and run under the existing advisory lock.
- **Do not touch** `~/github/planetops-floor` or `~/github/planetops`.
- Report what was NOT done, and anything found that contradicts this plan.
