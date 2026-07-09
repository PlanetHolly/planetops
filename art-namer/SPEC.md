# Art Namer — SPEC

**What it is:** the single naming engine that turns a produced-job bandana mockup into a
Google/LLM-optimized public asset (clean filename + title + alt + SKU metadata) and routes it
to the website-ready store. One engine, two entry points — the CLI (live today) and the
PlanetOps Feed lane (future, this spec).

## Components
- `engine.py` — pure logic. `parse_internal()` (internal filename → design/client/invoice/color),
  `decode_sku()` (SKU prefix → fabric/method, per `Pricing/Products/SKU_Dictionary.md` §2),
  `build_name()` (the schema: slug, title, alt, idempotency key, collision rule). No I/O.
- `cli.py` — batch entry. Scans folders/files → catalog + staged renames + review contact sheet.

## The schema (contract — BOTH lanes must produce exactly this)
- **Public filename:** `custom-{fabric}-bandana-{color}[-screen-printed]-{entity}.jpg`
  - fabric ∈ `cotton` | `made-in-usa-cotton` | `organic-cotton`; sublimation/digital = NO fabric/method
    tokens in slug (spec-only terms, per SEMrush data). Hyphens only, all lowercase.
  - entity = design name minus noise words (bandana/print/the), fallback client name.
- **alt:** natural entity-rich sentence: "*{Color} custom {fabric} bandana, screen printed for
  {Client} by Planet Apparel.*" (LLM/AEO: real brand + product + method in one readable line.)
- **SKU:** attached as metadata, NOT in the slug (Phelan keeps a SKU column; SEO stays clean).
- **Idempotency key:** `{invoice}-{color}`. Re-processing updates the same record, never duplicates.
- **Collision rule:** append distinguishing attribute (shape, then client slug) — never `-1`/`-2`.

## Stores
- **Catalog (provenance ledger):** `~/Dropbox/PlanetApparel/Website/_Internal/Art_Namer/art_catalog.md`
  — public name ↔ SKU ↔ invoice ↔ ART source path. Same `### key` + `- field:` format the
  lookbook uses.
- **Staging:** `~/Dropbox/PlanetApparel/Website/Bandana_Images/` (renamed copies, pre-approval).
- **Final (website-ready, Phelan-visible):** Google Shared Drive **"Planet Apparel Website"**
  (`0AKztajy-cjm8Uk9PVA`) → `Website_Ready/Bandanas/`. Upload AFTER Holly approves the contact
  sheet. Chosen over Dropbox because: vendor-isolated external access; n8n Google (tech@) creds
  reach Shared Drives while Dropbox app-folder creds cannot reach shared `PlanetApparel/` paths.

## Conversion gate (authoritative — do not re-derive)
Only work that went forward may reach the website. seps.io produces mockups for jobs that never
convert, so `~/Dropbox/ART/` is NOT a safe source on its own.

**Truth = Printavo `status.type` + which connection the record lives in:**
- exact `visualId` in `invoices` with `status.type == "INVOICE"` → **converted**
- exact `visualId` in `quotes` → **never converted** (e.g. `🔵 Art (Seps.io)` is a QUOTE-type status)
- in neither, or Printavo unreachable → **unverifiable**

The gate **fails closed**: process only on `converted is True`. Every skip is reported with a reason.

Two verified traps:
- **`paidInFull` is NOT conversion.** Inv 20200 = "Delivered / Picked up", `paidInFull: false` (net terms).
  Gating on payment silently drops delivered work.
- **`invoices(query:"5")` does not return quote 5** — that arg is a fuzzy search returning unrelated
  invoices. Match `visualId` exactly, and query both connections.

## Flow — NOW (CLI lane, live)
1. Point at bandana project folder(s) in `~/Dropbox/ART/…`.
2. `python3 cli.py <folder> --upload` — conversion gate + SKU auto-fetched from Printavo per invoice,
   proof sheet auto-cropped, named, cataloged, uploaded. (`--sku` overrides; `--vision` merges facts.)
3. Holly reviews `art_contact_sheet.html` (click-to-cut).
4. Rows go to Phelan's import sheet (`WORK_` columns ONLY — never his formula columns);
   Phelan imports to WordPress.

## Flow — FUTURE (Feed lane; implements when Front Door Part C is built)
1. In-app Feed drop (mockup image + optional note) → gate `POST /api/upload` (session-gated,
   base64, same pattern as the specced PlanetIQ feed upload).
2. Gate forwards to a new n8n webhook `/webhook/art-namer`.
3. n8n: Claude API vision call (color/shape/design facts) → apply THIS schema (port of
   `build_name()`; keep field-for-field parity with engine.py — engine.py is canonical) →
   look up SKU from the Printavo line item by invoice# (already in the internal filename) →
   write renamed file to `Website_Ready/Bandanas/` (tech@ Drive cred) → append catalog row →
   chat ping for Holly's approve/reject.
4. Same catalog, same store, same schema — the CLI and Feed lanes are interchangeable.

## Roadmap hooks (not built)
- **Auto-harvest:** seps.io "Order updated" emails / Printavo imprint mockups per converted invoice.
- **Vision pass:** `--vision` is a hook only. Implement to confirm color/shape and to fix auto-crop
  on white/cream bandanas (current crop is tuned for dark art on white proof sheets; light art
  flags `crop:none` rather than cropping wrong).
- **Apparel/promo extension:** schema keeps the `sku` field; apparel uses garment style numbers
  (no encoded SKU system exists for apparel — see SKU_Dictionary §9b split-out note).
- **Scheduler surfacing:** once named assets carry invoice#, the scheduler can show artwork per job.

✅ **Conversion filter is BUILT** (see gate above) — was a roadmap item, now live in `cli.py`.
