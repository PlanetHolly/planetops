# PLAN — Planet Graphics module (Seps.IO-style, hosted on the Railway app)

**Owner:** Holly · **Draft:** Opus + Fable-sharpened (via /orchestrate) · **Date:** 2026-07-14
**Builder target:** Codex (via /codex-build) · **Reviewer:** Opus/Sonnet subagent

---

## Goal (Holly's words, locked)

Rebuild the "Planet Graphics" tool she started on App Script and stopped. **Simple design work
only** — the everyday Seps.IO class:

- Add a **logo to a template** → get a clean **mockup**
- Do an **ink / colorway change** to a mockup (v1 = **pick a different real flat**, not recolor pixels)
- Show a **PMS Solid Coated callout** on the proof
- **Take orders** for **bandanas first, then apparel**

**NOT** complex custom art, **NOT** production/separation artwork — those still route to Seps.IO.
The bar is a proof "good enough to get a yes." (Boundary copied from `Graphics/CLAUDE.md` +
`Mockup_Engine/README.md`.)

## Host decision (locked by Holly, 2026-07-14)

- **Model the UI after Seps.IO** (23 reference screenshots in `Graphics/Reference Images/`).
- **Host on the Planet Apparel Railway app** = `~/github/planetops` (frontdoor-gate, Node/Express).
  Planet Graphics = one more module folder `/graphics/`, behind the existing PIN gate, orders in
  the existing **Postgres**.

## Architecture rationale (code-minimalism)

App is **Node/Express + pg**, not Python; existing engine is Python/Pillow. `Mockup_Studio.html`
already composites **client-side (Canvas)**. So: mockup + PMS proof **in the browser**; server only
**stores order + finished proof**. No Python on Railway, no server image lib, one deploy. Python
`mockup.py`/`proofsheet.py` = the **reference spec** for imprint zones, fold shading, PMS layout.

---

## Integration with the real gate (verified against `gate/index.js`)

- **Static serving:** `express.static` serves the **entire repo** behind the session gate, minus
  `DENY_PREFIXES` / `FINANCE_PREFIXES`. → **Just creating `graphics/` serves it. No serving-config
  change.** `/graphics/` is not finance-gated, so it inherits the normal team PIN. ✅
- **Server code goes in `gate/graphics.js`** (a router required by `index.js` with ONE line:
  `app.use(require('./graphics')(pool, requireSession))`). It MUST live under `gate/` because
  `/gate/` is deny-listed — a server file placed inside `graphics/` would be **served as a static
  download**. Do not inline routes/table-init into the hardened `index.js`.
- **Every route self-guards:** start each with `if (!await requireSession(req,res)) return;`
  (copy the `/api/state` pattern, gate/index.js ~319–335). This is the correct tier — **NOT** the
  Ship Deck CSRF/secret tier (that's for the money path). Without this the create/patch routes are
  **open to the internet** (the catch-all session middleware runs *after* registered routes).
- **Routes namespaced `/api/graphics/*`** (matches the existing `/api/*` convention; keeps API paths
  clear of the static handler + HTML-redirect logic).
- **`.md` policy:** the shared-workspace rule mandates a `CHANGELOG.md` per tracked build, and any
  `.md` in `graphics/` **would be served**. → Add `graphics/CHANGELOG.md`, `graphics/*.md` to the
  gate's deny rules (one-line addition to `DENY_PREFIXES` handling, or a `DENY` glob), so build docs
  stay team-internal, not public.
- **Registry `access: "open"`** (display-only label; server prefixes do the real gating). Do NOT use
  `access:"pin"` or the surface gets redacted from the home summary for entry-tier sessions.

**Routes (all self-guarded):**
- `GET  /api/graphics/orders`      → list + status counts (**excludes `proof_png`** from SELECT)
- `POST /api/graphics/orders`      → create (intake + proof image); **server-side size cap**
- `GET  /api/graphics/orders/:id`  → detail
- `PATCH /api/graphics/orders/:id` → status/edit; SQL sets `updated_at = NOW()` explicitly
- `GET  /api/graphics/proof/:id`   → the proof image; header `Cache-Control: no-store, private`

**Postgres table** (init in `gate/graphics.js`, same pattern as `gate_sessions`):
```
graphics_orders(
  id SERIAL PK, order_no TEXT, title TEXT,
  status TEXT,                 -- Submitted | Working | Revision Requested | Complete
  customer TEXT, product TEXT, -- bandana | apparel
  intake JSONB,                -- tasks, turnaround, garment rows, print-location rows,
                               --   PMS colors, notes, AND art-file refs (filename/metadata ONLY)
  notes  JSONB DEFAULT '[]',   -- append-only Details-tab thread
  proof_img BYTEA,             -- JPEG/WebP ~q90 (NOT png); served via /api/graphics/proof/:id
  created_at TIMESTAMPTZ DEFAULT NOW(), started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ DEFAULT NOW()
)
```
*Proof as bytea (Railway FS is ephemeral). Art files are **metadata only** in v1 — real art runs to
60MB and can't live in a JSON body; the "Files" tab lists refs + the generated proof. Binary art
storage (Drive via n8n) is a parked later phase.*

---

## The four screens (match Seps.IO)

**1. Dashboard (`index.html`)** — KPI tiles **Pending / Open / Completed** (drop "Subscriptions").
Recent-orders table: Title · Status badge · Created · Updated · Completed. **New request** top-right.
Badge colors mirror Seps.IO (Submitted amber, Working blue, Revision amber-outline, Complete green).

**2. New Request (`new.html`)** — intake form (left) + live Mockup Studio (right):
- Job Request Name (`order#_Client_ProductType`) · Tasks (Proof, Art Adjust, **Add Logo to
  Template**, **Colorway/Ink Change**) · Turnaround (Normal | Rush) · Final Format (Profile | PDF | PNG).
- Garment Details table (Brand · Style# · Color) · **Print Locations** table (Location · #Colors ·
  Width · **Colors/PMS** ← PMS picker) · Upload Artwork (drives the live mockup) · Notes (250w).
- Studio: pick product → **bandana (19 real flats)** / **apparel (tee blanks)**, drop art, imprint
  slider → live composite → **Generate Proof** (branded PA e-proof, PMS callout top-right) → **Submit**
  (POST intake + proof → status **Submitted**).

**3. Order Detail (`order.html`)** — 3 tabs like Seps.IO: **Details** (append-only notes thread) ·
**Project data** (read-only intake) · **Files** (art refs + proof download). Sidebar: Number ·
Created · Started · Completed · **People (free-text** — shared PIN = a device, not a person) ·
editable status badge.

**4. PMS Solid Coated callout** — `pms.json` = **curated Solid Coated subset** (the 19 bandana
Pantones already named in `mockup.py`'s BANDANA dict + PA inks + 7408 C); code · name · sRGB hex.
Search "7408" → swatch + **PMS 7408 C** → adds a chip; chips render in the proof callout box. (Full
~2,100-swatch set is off the table: Pantone-proprietary + unnecessary.)

---

## Build phases (for Codex)

- **P0 — Assets + manifest (Python does the pixel math once, offline):** slug-rename the 19 bandana
  flats + tee blanks, convert to **WebP** (alpha, ~5–10× smaller; lazy-load only the selected color —
  never preload 19). Emit `assets/manifest.json` = per-flat **precomputed fabric bounds + imprint
  zone** (so `studio.js` never pixel-scans). Build curated `pms.json`. Bundle Montserrat woff2.
- **P1a — Canvas compositor (`studio.js`), highest risk:** port `mockup.py` exactly —
  - fold shading = the **mean-normalized formula** `mod = 1 − strength·(mean−lum)/mean`, mean over
    ink pixels only, asymmetric clip `[1−s, 1+0.4s]`, thresholds **16** (shade) / **8** (trim), via a
    per-pixel `getImageData` loop. **Forbid** a plain `multiply` blend (darkens everywhere ≠ folds).
  - **stepped half-size downscale** (no true LANCZOS in Canvas); aspect-preserving fit to zone.
  - final **`destination-in`** draw of the template alpha (re-apply cut-out + drop shadow; avoid black halos).
  - **live preview at reduced res / cheap shading; exact full-res pass only on Generate.**
  - **Dev/test over HTTP (the gate), never `file://`** — `getImageData` on `file://` assets throws
    (canvas taint). Accept: **visual side-by-side parity** with the Python output (not pixel-diff).
- **P1b — Proof sheet + PMS callout (`studio.js`):** port `proofsheet.py` (PA header, Ø icon, PMS
  callout top-right, colorway as a **text spec row** — not a swatch strip). `await document.fonts.load()`
  before drawing text.
- **P1.5 — Deploy smoke test:** commit static studio + assets, deploy, verify it loads behind the PIN
  before building the server layer.
- **P2 — Intake page (`new.html`):** Seps.IO form wired to the live studio; Submit builds the payload.
- **P3 — Server + DB (`gate/graphics.js`):** table + 5 self-guarded routes; proof size cap; JPEG/WebP.
- **P4 — Dashboard + Order detail:** list + status counts, 3-tab detail, status changes, notes append.
- **P5 — Register + brand:** add to `frontdoor/registry.json` (`access:"open"`); PA brand via `app.css`.
- **P6 — Apparel:** tee path end-to-end (black blank; `TEE_ZONE` is fixed-fraction, no bounds detection).

## Acceptance check

Behind the gate on Railway, a team member can: open **Planet Graphics** → **New Request** → fill the
Seps.IO-style intake + drop a logo → pick **bandana + color**, set a **PMS Solid Coated** callout, see
a **live mockup** → **Generate** a branded e-proof → **Submit** → see it on the **Dashboard** as
**Submitted**, open the **3-tab detail**, download the proof. Then repeat for **apparel (tee, black)**.
P1a passes when the Canvas mockup is **visually indistinguishable side-by-side** from `mockup.py`'s output.

## OUT of scope (v1)

Generative AI · production seps/vectorize/EMB digitizing · resolution gate + rescue · Pantone Connect
API · full Solid-Coated set · wrinkle displacement · `--tint` pixel recolor · paisley/belly-band fills ·
multi-location complex layouts · binary art storage · Printavo/n8n auto-attach. Complex jobs → Seps.IO.

---

## ADDENDUM — expanded requirements (Holly, 2026-07-14 evening, while Codex built P0–P6)

These are folded in **after** the base build via review + fix rounds. Priority order for
"usable tomorrow": base seps.io flow working FIRST, then (1) SKU grounding, (2) Paisley templates,
(3) correct naming, (4) layouts/shapes, (5) product-photo export.

### 1. Ground products in the REAL bandana SKU catalog (reuse, don't invent)
- **Lift `SKU_DICTIONARY` + `slugify` + `buildFilename` + `displayName` verbatim** from
  `~/Dropbox/PlanetApparel/Website/_Internal/photo-namer.html` (Holly's photo-namer tool). 21 SKUs:
  PL2216/19/22 (Cotton 22x22 Square), US2116/19/21 (USA Cotton 21x21), ORG2416/19/24 (Organic 24x24),
  OV2722/SUB27 (27x27), TRIBAN22/USTRIBAN/DIGTRISC/SUBTRI (Triangle **Doggie**), SUB1/SUB2 (Poly
  Square Sublimated), DIG22/DIGCR25/CUSTOMDIGBAN (Digital), BELBAN (Belly band).
- Each SKU carries: `fabric, size, shape (Square|Triangle), product_type (Standard|Doggie),
  made_in_usa, default_print_method (Screen-Printed|Sublimated|Digitally Printed), default_ink`.
- New Request product picker = **SKU dropdown** (`displayName` labels), which drives imprint size,
  fabric, shape, and default print method.

### 2. Full template library — Paisley "drop your logo on the template" (the headline need)
- Support the real `Graphics/Templates/` types, not just blank colors: **Paisley (21 layouts)**,
  Bandana Colors (19 flats), Bandana Design, **Belly Band**, Mockup Templates, Proof Templates.
- **Paisley = the interactive feature** the static `bandana-templates` page's roadmap named
  ("Option B: drop your logo on the template preview"). Tiles already exist at
  `~/github/planetops/bandana-templates/tiles/template_01..21.png` — reuse them as selectable
  template bases; the logo composites into the template's center.
- **Layouts:** Centered / Tiled / Cowboy-Style. **Shapes:** Square + Triangle (Doggie).
- **Imprint sizes** from SKU: 22x22, 21x21, 24x24, 27x27, 22x25, 9x18, 22x22x31.

### 3. File naming — CRITICAL correction (overrides the plan's "E-Proof" naming)
- **"Proof" is officially RETIRED** per the File Naming Guide (`file-naming/index.html`:
  "✗ Proof — we don't do proofs"). **Never** name output "Proof" or "Eproof".
- Our generated mockup file = **`Mockup_<Project Name>`** (`+ V2…` for revisions).
- **Job/Design nickname** follows the guide: Bandana **drops "Print"** (`Egg Icon Bandana`,
  `Egg Icon USA Made Bandana`); Apparel = `Name/Logo + Garment + Service` (`Egg Icon Tank Top Print`).
- **Product-photo export** (for the CPB catalog use case) uses `buildFilename`:
  `{brand}-{printmethod}-{color}-{fabric}-{size}-{layout}-{style}.ext`
  → e.g. `bree-paulsen-screen-printed-black-cotton-22x22-centered-flat.jpg`.

### 4. Brand styling — match the existing PA pages
White page · black bandana squares · `#F7BE00` accent only · Ø icon header+footer · ALL-CAPS
Mr Eaves / Montserrat. Mirror `file-naming/index.html` + `bandana-templates/index.html` exactly.

---

## Resolved choices

1. **Proof storage:** Postgres **bytea**, JPEG/WebP q90, excluded from list SELECT, `no-store` on the route.
2. **PMS depth:** **curated** Solid Coated subset (bandana Pantones + PA inks), expandable. (Licensing = why not full set.)
3. **Order #:** manual free-text now; Printavo pull is a later phase.
4. **Web resolution:** proofs render from ~1200px WebP flats (a deliberate step down from the CLI's 2000px — accepted for "good enough to get a yes").
