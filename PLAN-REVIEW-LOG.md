# Plan Review Log: Media Center — Printavo-as-source-of-truth intake redesign
Act 1 (grill) complete — plan locked with Holly. MAX_ROUNDS=5.

## Round 1 — Codex
VERDICT: REVISE. 11 findings (all grounded in real code reads):
1. Sheet read-then-append not at-least-once safe under retry; DB uniqueness only dedupes local outbox, not duplicate sink appends. Fix: sink idempotent on content_hash (ledger/upsert) before ack.
2. `CREATE TABLE IF NOT EXISTS` (gate/media.js:186) won't add new columns to deployed tables. Fix: explicit ALTER TABLE ADD COLUMN IF NOT EXISTS + update INSERT/SELECT/payload paths.
3. Sink payload contract mismatch (media.js:155 sends group/cat/fabric/default_ink/source_id). Fix: define versioned v2 payload, update gate + n8n together.
4. sourceId: client fills from filename (index.html:202), server concats rawSourceId-hashPrefix (media.js:77) → breaks planned 8-hex tail. Fix: Printavo lane ignores client sourceId, server-only hash.
5. Live preview provisional without contentHash (media.js:393); page computes none (index.html:151). Fix: compute SHA-256 client-side after photo select, gate final preview/submit on it.
6. Local vocab validators reject unknown SKU/color (media.js:61) — contradicts "Printavo is truth." Fix: Printavo lane bypasses allowlist / normalization with unmapped handling.
7. imprint→line-item mapping unresolved but inkType is in deterministic filename. Fix: picker selects exact imprint/surface too, or omit inkType from filename until deterministic.
8. /api/media/invoice hits 10req/5s unauthenticated proxy with no throttle/cache/timeout. Fix: numeric visualId validation, per-session/IP limiter, short-TTL cache, AbortSignal.timeout.
9. GraphQL injection: art-namer/cli.py:65 interpolates invoice text into query. Fix: strict numeric visualId regex + GraphQL variables.
10. invoices-vs-quotes precedence undefined; repo treats quotes as unconverted. Fix: require INVOICE-type record for completed-photo intake, reject quote-only.
11. No observability for lookup failures/ambiguous matches/parse misses/dead sink rows. Fix: structured events + /api/media/outbox/stats coverage.

### Claude's response
Accepted ALL 11 — every one is grounded in a real code read and none are wrong. Revised PLAN.md accordingly: server-only sourceId hash (ignore client), ALTER-TABLE migrations + versioned v2 sink payload, content-hash sink idempotency, client-side SHA-256 gating preview/submit, Printavo-lane vocab bypass, imprint-granular picker (inkType only in filename when unambiguous), proxy hardening (numeric-only visualId + variables + limiter + TTL cache + timeout), INVOICE-type-only precedence rejecting quote-only, and an observability/stats section. Rejected nothing.

## Round 2 — Codex
VERDICT: REVISE. Prior 11 confirmed addressed. 4 remaining (all grounded):
1. line-item↔imprint: Printavo shape is `lineItemGroups { imprints{nodes} lineItems{nodes} }` — SIBLINGS, not nested (index.html:5808). rev.2 implied a false FK. Fix: model picker around lineItemGroup as join boundary; expose siblings separately; persist positions.
2. Legacy NOT NULL cols asset_group/cat/color (media.js:197) — Printavo inserts fail. Fix: write asset_group='Bandanas', cat='Bandanas', color=blank_color for Printavo rows (or migrate constraints).
3. GraphQL variables may not be forwarded by proxy (repo only shows {query}, art-namer:65). Fix: verify proxy forwards variables; else keep strict numeric validation + safely interpolate only the numeric.
4. Client contentHash preview vs server-computed bytes hash can diverge on a buggy client. Fix: server returns final filename on submit; UI treats preview as advisory unless it matches.

### Claude's response
Accepted all 4. Revised PLAN.md: picker modeled around lineItemGroup with sibling lineItems + imprints (positions persisted, no false FK); Printavo rows populate legacy NOT NULL columns (asset_group/cat='Bandanas', color=blank_color); GraphQL prefers variables but falls back to interpolating the strictly-validated `^\d{1,9}$` numeric (injection-safe since it cannot carry GraphQL syntax); server returns the authoritative final filename on submit and the UI treats the client preview as advisory, flagging any mismatch. Rejected nothing.

## Round 3 — Codex
VERDICT: REVISE. Round-2 confirmed addressed. 4 new (all grounded):
1. Submit under-specified: /api/media/intake never re-verifies submitted invoice/positions vs Printavo before writing source=printavo → client can forge Printavo rows. Fix: server re-loads/uses cached lookup, verifies selected positions/IDs exist, computes edited_fields server-side by diffing submitted vs server facts.
2. method schema name: imprint has typeOfWork{name}/details, not category (index.html:5808). Fix: use verified field — method = LineItem.category.name (per printavo memory), inkType = imprint.details; do NOT put method on imprint.
3. Positions are weak provenance (invoice edits reorder). Fix: persist stable group.id/lineItem.id/imprint.id + positions.
4. brandNickname dropped from rev.3 response shape but UI still auto-fills brand. Fix: include order nickname explicitly in lookup response + persisted snapshot.

### Claude's response
Accepted all 4. Revised PLAN.md: (1) submit-time server re-verification against a trusted TTL-cached/re-loaded lookup, positions/IDs must exist, edited_fields computed server-side, else reject — closes the forged-row hole; (2) method = LineItem.category.name (line item), inkType = imprint.details (imprint) — corrected the misplaced method; (3) persist stable groupId/lineItemId/imprintId + positions + a Printavo snapshot; (4) nickname restored to the response shape and snapshot. Rejected nothing.

## Round 4 — Codex
VERDICT: APPROVED. All round-3 blockers addressed (server-side submit verification, sibling lineItems/imprints, stable IDs + positions, nickname returned/persisted, legacy NOT NULL satisfied). No remaining material design flaw. One non-negotiable implementation check: run the exact planned GraphQL against one real invoice before coding the mapper — confirm LineItem.category.name, group.id, lineItem.id, imprint.id (repo proves some only indirectly).

### Claude's response
Accepted. Added Step 0 (pre-build field verification) to PLAN.md. Plan converged in 4 rounds — APPROVED.
