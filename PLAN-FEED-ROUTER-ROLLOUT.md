# Feed Router — Staging Rollout Runbook (Build #7)

**This is the deploy Holly runs.** Every "NOT verified" note across builds #1–#6 gets proven *here* — all DB paths, the live Anthropic extraction + structured-output acceptance, the n8n POST, and the browser upload flow. Nothing has run against a real database or the real API yet.

**Golden rules (from the plan + memory):**
- **Confirm the Railway deploy trigger BEFORE any push. Never force-push.** Multiple working copies of this repo exist → FF-race risk.
- The feed system is **additive** (new tables, new `/api/feed/*` routes, 3 background loops). The gate's core — PIN auth, existing routes — is untouched. If anything misbehaves, unsetting an env var halts a stage cleanly; nothing is lost.
- **External writes stay SHADOW** until you explicitly graduate a doc-type. Deploying does NOT write to Sheets/Printavo.

---

## 0. Packaging — already done (no-op)
Zero new npm dependencies were added (we used base64 + node built-ins instead of busboy/pdf-lib). `gate/package.json` deps are still just `express` + `pg`. Railway's existing install works unchanged. Nothing to do here.

---

## 1. Set env vars (Railway → the gate service)

**Required for the pipeline to actually run** (without them, the worker just parks rows — nothing breaks, nothing processes):
| Var | What | How to make it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude extraction | your Anthropic key |
| `FEED_RAW_KEY` | AES-256-GCM key that encrypts stored docs at rest | `openssl rand -base64 32` (32 bytes, base64 or hex). **Save it somewhere safe — if it's lost or changed, already-stored docs can't be decrypted.** |

**Required only when you're ready to test REAL external writes** (leave unset → the external sink halts safely, everything holds as shadow):
| Var | What |
|---|---|
| `FEED_SINK_URL` | the n8n webhook that receives routed docs |
| `FEED_SINK_SECRET` | shared secret sent as `x-feed-secret` (n8n must reject without it) |

**Already set on the gate (do not touch):** `DATABASE_URL`, `ENTRY_PIN`, `FINANCE_PIN`, `SESSION_SECRET`, `ALERT_WEBHOOK_URL`.

**Optional tuning (all have safe defaults — skip unless you want to change one):**
`FEED_EXTRACT_MODEL` (default `claude-opus-4-8`; swap to `claude-sonnet-5`/`claude-haiku-4-5` for cost), `FEED_DAILY_TOKEN_BUDGET` (2M), `FEED_HIGH_DOLLAR_THRESHOLD` (5000), `FEED_MIN_CONFIDENCE` (0.6), `FEED_EXTRACT_TIMEOUT_MS` (60000), `FEED_EXTRACT_MAX_TOKENS` (4096), `FEED_MAX_ATTEMPTS` (5), `FEED_OUTBOX_MAX_ATTEMPTS` (5), `FEED_OUTBOX_STALE_MS` (300000), `FEED_SINK_TIMEOUT_MS` (15000).

> Tip: set `ANTHROPIC_API_KEY` + `FEED_RAW_KEY` first, leave the two `FEED_SINK_*` unset. That deploys the whole internal pipeline in shadow with no external writes possible.

---

## 2. Deploy
1. **Confirm which branch/trigger the gate service deploys from.** This work is on `brain-incoming-board`; the front-door `main` is frozen. Do NOT push until you know exactly what deploying does.
2. Push `brain-incoming-board` (or the confirmed deploy branch). **Never force-push.**
3. Watch the boot logs. You should see, in order: migrations apply (`001`→`004`) under the advisory lock → `feed_schema ready` → `feed_worker_started` → `feed_dispatcher_started` → `feed_sink_started` (with `configured:false` if the sink env is unset — that's correct).

---

## 3. Verify — in order (each step proves a previously-unproven path)

**3a. Schema guard.** Hit `GET /readyz` (behind the PIN). Confirm `checks.feed_schema === "ok"`. If it's not `ok`, a migration failed — read the boot logs, fix, redeploy. **Do not proceed until green.**

**3b. 🔴 THE structured-output schema smoke-test (the #4a flag — do this FIRST).**
Upload ONE small simple doc (a 1-page PDF or a tiny CSV) via `/feed-upload/`. Watch the worker log for that intake:
- **Extracts cleanly** (`feed_extracted` / `feed_validated`) → the schema is accepted, flag cleared, continue.
- **First call returns a 400 on the schema** → this is the flag. Fix: in `gate/feed/extract.js`, change the nullable fields in `EXTRACTION_SCHEMA` from `type: ["string","null"]` to `anyOf: [{type:"string"},{type:"null"}]` (same for number/integer). ~2-line change, redeploy, retry. It dead-letters that one test doc — expected; re-upload after the fix.

**3c. Walk one real doc per category.** Upload one of each and confirm where it lands (check `feed_intake.status`, the `feed_ledger` row, and the destination table / board):
| Upload | Expected |
|---|---|
| a PO / vendor order | → `app_incoming` → appears on the **Incoming board** (`/incoming/`) |
| an expense / invoice | → `feed_expense_hold` |
| an analytics report | → `planetiq` = **HELD** (external, shadow — nothing graduated) |
| a payroll/financials doc (upload behind FINANCE_PIN) | → **review** (finance_category trigger); without finance unlock the upload is refused |
| anything from a **first-seen vendor** | → **review** (unknown_vendor) + the vendor self-registers `pending` in `feed_vendors` |
| anything **≥ $5,000** | → **review** (high_dollar) |
| a garbled / unreadable doc | → **review** or **failed** with a reason — never silently routed |

**3d. Confirm SHADOW.** Verify NO external write happened: every `planetiq` row in `feed_outbox` is `state='held'`, `feed_graduation` is empty. (This is the money-safety promise — check it explicitly.)

**3e. Board + ledger + guide.**
- `/incoming/` shows the routed items with correct ETAs.
- `GET /api/feed/ledger` returns the audit rows (extracted fields, decision, validator_results).
- `/feed-guide/` no longer shows "localhost refused to connect" (the committed fix is now live).
- The front-door "Feed the system" tile opens `/feed-upload/`, not the guide.

---

## 4. Seed vendors + graduate to REAL writes (only when ready, per doc-type)

**4a. Seed known vendors (optional, reduces review noise).** Until seeded, every vendor is first-seen → review (safe, just noisy). Run `seedKnownVendors(pool, [...vendor names])` (from `gate/feed/validate.js`) with your Printavo/Streak vendor list — a one-time ops script. *(Pulling that vendor list from Printavo/Streak is its own small task; ask me when you want it.)*

**4b. Graduate a doc-type to real external writes — ONE at a time, after shadow-proving it.**
`setGraduation(pool, '<doc_type>', true)` (from `gate/feed/sink.js`) flips a doc-type live; its held backlog then auto-delivers to n8n. **Start with one low-risk doc-type**, watch the ledger, and follow the plan's promotion bar (~50 clean docs, 0 misroutes, a reconciliation pass) before graduating any money-sensitive type. `setGraduation(pool, '<doc_type>', false)` reverses it instantly.

---

## 5. Rollback
- **Halt extraction:** unset `ANTHROPIC_API_KEY` → the worker parks rows, nothing lost.
- **Halt external writes:** unset `FEED_SINK_URL` → the sink holds everything as shadow.
- **Full rollback:** redeploy the prior commit. The feed tables are additive and harmless if unused.

---

## Deferred / known items (carry-forward, not blockers)
- **Wrong-`FEED_RAW_KEY` noise** (#4a flag 2): a *wrong* (not missing) key marks docs `failed` + alerts per doc. Get the key right at 1a and this never fires.
- **`note`-keyword routing inert** (#5a): routing is doc_type-driven now (extraction emits no note). Fine as long as extraction classifies doc_type well — watch the ledger's detected doc_types on real docs.
- **`unknown_vendor === false` / dup-source excludes `review`** (#4b minor): defensive-hardening candidates, safe today.
- **Sink stale-'sent' UTC/date edges, expense_hold at-least-once** (#5a/#5b): accepted for internal/hold tables.

Everything else marked "NOT verified" in `PLAN-FEED-ROUTER-BUILD-LOG.md` is proven by §3 above.
