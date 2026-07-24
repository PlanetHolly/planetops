# Plan: Media Center — Printavo-as-source-of-truth intake redesign
_Locked via grill — by Claude + Holly, 2026-07-22 · rev.4 (post Codex round 3)_

## Goal
Replace the vision-guessing intake path with a deterministic one keyed on the Printavo **invoice number**. When a photographer drops a photo of a completed bandana, they enter the invoice # (always physically on the job), pick which line item (and imprint, if more than one) the photo shows, and the system fills ground-truth brand / SKU / blank-color / method / ink-type from Printavo, composes the published filename via the unchanged `gate/media/name.js`, and appends one idempotent row to the append-only index Sheet. No photo-vision on this new lane. The 338-photo backlog is untouched (stays vision-draft). Build stays shadow-gated exactly as today — nothing external is written until Holly wires the sink.

## Approach

### 0. Pre-build field verification (do FIRST, before coding the mapper)
Run the exact planned GraphQL against **one real completed bandana invoice** via the printavo-proxy and confirm these fields resolve as assumed — the repo proves some only indirectly: `LineItem.category.name` (method), `lineItemGroup.id` + `.position`, `lineItem.id` + item position, `imprint.id` + `.position` + `.details` (🎨 ink type), `status.type` (INVOICE), and `nickname`. If any field name differs, adjust the mapper spec before implementation.

### 1. New server lookup endpoint `POST /api/media/invoice` (in `gate/media.js`)
- Input `{ visualId }`, **validated `^\d{1,9}$` and rejected otherwise** before any use.
- Build the GraphQL for the **validated-numeric** visualId. **Prefer a query `variable`; if the printavo-proxy does not forward `variables` (repo usage only shows `{ query }`), interpolate the already strictly-validated `^\d{1,9}$` numeric** — injection-safe because a pure integer cannot carry GraphQL syntax. Call the proxy with an **`AbortSignal.timeout` (~8s)**.
- **Per-session/IP rate limiter** + **short-TTL in-memory cache** (e.g. 60s keyed by visualId) so a shared-session browser hammering **Load** can't burn the proxy's 10 req/5s budget.
- Query **both** `invoices(query:)` and `quotes(query:)`; keep only the record whose `visualId` **exactly** matches. **Precedence: require an INVOICE-type record** (`status.type == INVOICE`) — a completed-project photo must map to a real order. **Reject quote-only records** (a quote-stage visualId ⇒ same "not found" block path). Fail **closed** on any proxy error, ambiguity, or no exact INVOICE match ⇒ HTTP 4xx, no fallback.
- **Return shape mirrors the real Printavo model — `lineItemGroup` is the join boundary; `imprints` and `lineItems` are SIBLING collections under the group, NOT nested.** Response: `[{ groupId, groupPosition, nickname, lineItems:[{ lineItemId, itemPosition, sku(itemNumber), color, method(LineItem.category.name) }], imprints:[{ imprintId, imprintPosition, inkType(parsed 🎨 from imprint.details) }] }]`. **`method` rides the line item (`category.name`); the imprint carries only `inkType`** (imprint has `typeOfWork`/`details`, not `category`). **`nickname` (brand) is returned at record level.** Persist **stable `group.id` / `lineItem.id` / `imprint.id` plus positions** — positions alone are weak provenance (invoice edits reorder them).

### 2. Intake page rewrite (`media/index.html`)
- Invoice # field + **Load** → validate → **group picker** (auto-selected when one group) → within the group, **line-item picker** (SKU/color, auto when one) **and** **imprint picker** (method/ink-type, auto when one). Both are siblings of the group, chosen independently.
- Auto-filled **editable** fields (brand, SKU, color, method, ink-type) pre-filled from the selected line item + imprint, overridable; optional **template** `<select>` (21 catalog + "Not sure"); optional **description**.
- **Client computes `SHA-256(imageBytes)` after photo selection** and sends it as `contentHash`; the filename preview and submit stay disabled until it exists. **The preview is advisory only — on submit the server returns the authoritative final filename (from server-recomputed image bytes); the UI shows that and flags any mismatch with its preview.**
- Live filename preview via `POST /api/media/preview` (always passed `contentHash`).

### 3. Filename composition (unchanged `name.js`)
- **Printavo lane ignores any client `sourceId`.** The server forces `sourceId = SHA-256(imageBytes).slice(0,8)` and passes it explicitly — **no `rawSourceId-hashPrefix` concat** on this lane. name.js is **not modified** (never enters its fallback).
- Tokens: `brand`←record `nickname`, `printMethod`←selected line item's `method`(`category.name`) + selected imprint's `inkType` (method-only if no imprint selected/parsable), `color`←selected `LineItem.color`, `fabric`←blank when Printavo doesn't give it, `sourceId`←8-hex image hash. Matches the proven 54-file convention (`…-polyester-379a6832.jpg`).

### 4. Vocab authority (resolve the validator conflict)
- On the Printavo lane, **Printavo values are authoritative and BYPASS the local `skus.json` / `colors.json` allowlist validators** (`gate/media.js:61` currently rejects unknowns — that must not reject a real Printavo value). Keep soft slug-normalization; a value with no local mapping is tagged `unmapped` (logged), never rejected. The legacy manual/vision lane keeps its allowlist.

### 5. Submit-time server re-verification (trust boundary)
- **`/api/media/intake` does NOT trust the client's claimed Printavo facts.** On submit, the server re-loads the `visualId` (or uses its trusted TTL-cached lookup from Load), **verifies the submitted `group.id` / `lineItem.id` / `imprint.id` actually exist** in that invoice, and **computes `edited_fields` server-side** by diffing the submitted brand/SKU/color/method/ink-type against the server's Printavo facts. If the invoice doesn't resolve to an INVOICE-type record or the IDs don't exist ⇒ reject (no forged `source=printavo` rows). The server-recomputed facts are what get persisted; client values only stand where flagged in `edited_fields`.

### 6. Persistence + migrations (`gate/media.js`)
- Replace reliance on `CREATE TABLE IF NOT EXISTS` with explicit **`ALTER TABLE … ADD COLUMN IF NOT EXISTS`** for every new field, and update all INSERT / SELECT / public-row paths.
- New columns: `invoice_visualid`, `line_group_id`, `line_group_position`, `line_item_id`, `line_item_position`, `imprint_id`, `imprint_position`, `sku`, `blank_color`, `method`, `ink_type`, `brand_nickname`, `template`, `description`, `content_hash`, `filename`, `source`(=`printavo`), `edited_fields`, `printavo_snapshot`(the raw resolved facts), `created_at`.
- **Satisfy the existing `NOT NULL` legacy columns** (`asset_group`, `cat`, `color` at `gate/media.js:197`): Printavo-lane inserts always write `asset_group='Bandanas'`, `cat='Bandanas'`, `color=blank_color` — no constraint migration needed, no legacy SELECT/public-row path breaks.

### 7. Sink payload + idempotency
- Define a **versioned v2 sink payload** carrying the new machineColumns (the current `sinkPayload` at `media.js:155` sends `group/cat/fabric/default_ink/source_id` — mismatched). Version it so gate + the n8n append workflow are updated **together**.
- **The sink must be idempotent on `content_hash`** (a persistent ledger / upsert / update-if-exists) **before acknowledging** — Sheet read-then-append alone is NOT retry-safe under an uncertain POST. Human columns `Used?` / `Publish?` / `Notes` are **omitted** from the payload (never machine-written).

### 8. Observability
- Emit structured events for: Printavo lookup status (found-invoice / quote-rejected / not-found / proxy-error), ambiguous/multi-imprint selection, ink-parse confidence (parsed vs unmapped), and dead-letter/undelivered sink rows. Extend `/api/media/outbox/stats` to expose these counts **before the sink is turned on**.

### 9. Shadow gate preserved
- `MEDIA_SINK_URL` unset and `MEDIA_DRIVE_ENABLED=false` remain defaults; the new lane queues locally and writes nothing external until Holly configures the sink and the n8n workflow.

## Key decisions & tradeoffs
- **Invoice # sole key; block on not-found AND on quote-only; no fallback.** Every new-lane row is a Printavo INVOICE-verified record.
- **Photo → group → (line item, imprint) siblings, picked at intake.** Mirrors the real Printavo shape (imprints and line items are siblings under a `lineItemGroup`, not nested); positions persisted so no false FK is implied. Keeps `inkType` deterministic; method-only token when no imprint selected.
- **sourceId = server-only 8-hex image-bytes hash; invoice # in the Sheet, not the filename.** Consistent with the 54 indexed files, no internal id in a public URL, idempotent on identical re-drop.
- **Brand ← `nickname`** (matches proven convention + existing name.js collapse). Tradeoff: nicknames can be messy.
- **name.js NOT rewritten** — server always supplies sourceId, so the buggy metadata-hash fallback is unreachable.
- **Auto-fields editable, with per-row `edited_fields` provenance** so verified vs. edited rows stay auditable.
- **Printavo overrides local vocab on this lane** — real Printavo SKUs/colors are never rejected by the allowlist.
- **Template optional, Sheet-only** (no filename slot; manual capture — no per-order source exists).
- **Product Master join dropped for v1**; human `Publish?` checkbox is the sole gate to the public Pages repo.
- **Sink idempotency on content_hash**, not read-then-append, is the durability contract.

## Risks / open questions
- **printavo-proxy is an unauthenticated public webhook** + WAF workaround (complexity cap 25k, 10 req/5s). Mitigated by numeric-only visualId, limiter, TTL cache, timeout, fail-closed — but the lane hard-depends on it.
- **Ink-type parse is free-text** (`imprint.details` emoji block). Mitigated by imprint-granular selection + `unmapped` tagging, but a malformed details block yields method-only naming.
- **Image-bytes hash is exact** — re-encoding/resizing the same photo yields a new hash ⇒ new filename ("same photo" = same bytes). Accepted.
- **EXIF/GPS stripping** is NOT part of v1 intake (photos sit in Postgres BYTEA, shadow-gated); it MUST be handled at the eventual public-Pages publish step, before any image reaches the public repo.
- **n8n append workflow** (v2 payload, content-hash upsert) is Holly's build; the gate side ships shadow-gated and inert until then.

## Out of scope (v1)
- Product Master join / Publicize gate; fabric enrichment beyond Printavo.
- Any vision/AI naming on the new lane; re-keying the 338 backlog (stays vision-draft).
- Ink **colors** (only ink type + method captured).
- Template auto-fill (no per-order source exists).
- Non-bandana streams (apparel/promo), v2 sub-cuts.
- The actual public-Pages publish push + EXIF stripping (separate, human-gated step).
- Wiring the live sink (Holly's hands; build stays shadow-gated).
