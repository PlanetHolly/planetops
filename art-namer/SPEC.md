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

## Flow — NOW (CLI lane, live)
1. Holly points at converted bandana project folder(s) in `~/Dropbox/ART/…` (she knows what converted).
2. `python3 cli.py <folder> --sku PL2216 [--vision vision.json]` — vision facts (color/shape
   confirmation) come from a Claude vision pass over the images, merged via JSON.
3. Holly reviews `art_contact_sheet.html` (click-to-cut) → pastes APPROVED list.
4. Approved files upload to `Website_Ready/Bandanas/` via `gws`; rows go to Phelan's import sheet
   (`WORK_` columns ONLY — never his formula columns); Phelan imports to WordPress.

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
- **Conversion filter:** Printavo `paidInFull` / production status by invoice# (via Railway proxy).
- **Apparel/promo extension:** schema keeps the `sku` field; apparel uses garment style numbers
  (no encoded SKU system exists for apparel — see SKU_Dictionary §9b split-out note).
- **Scheduler surfacing:** once named assets carry invoice#, the scheduler can show artwork per job.
