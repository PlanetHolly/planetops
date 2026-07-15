# Planet Graphics Changelog

## 2026-07-14 — v1 build (overnight, orchestrated)

Built the Planet Graphics module from `_planning/planet_graphics_PLAN.md` (Opus planned,
Fable sharpened, Codex built, Opus reviewed + browser-verified). Isolated on branch
`planet-graphics-build` off `frontdoor-gate`. NOT deployed.

### What it is
A Seps.IO-style module for **simple** mockups only — drop a logo on a bandana/paisley/tee
template, do a colorway/ink change, add a PMS Solid Coated callout, and take the order.
Complex/custom + production separation art still goes to Seps.IO. Hosted as `/graphics/` in the
Railway app, behind the existing PIN gate, orders in the existing Postgres.

### Base build
- Static screens: `index.html` (dashboard: Pending/Open/Completed tiles + recent-orders table),
  `new.html` (Seps.IO intake form + live Canvas mockup studio), `order.html` (3-tab detail).
- `gate/graphics.js`: `graphics_orders` Postgres table + 5 self-guarded `/api/graphics/*` routes
  (list/create/get/patch/proof). Every route calls `requireSession`. Only 1 line added to
  `gate/index.js` (the router mount). Registry entry updated to live.
- `studio.js`: client-side Canvas compositor ported from `Mockup_Engine/mockup.py` +
  `proofsheet.py` — exact mean-normalized fold-shading, alpha thresholds 8/16, stepped downscale,
  `destination-in` alpha mask, preview-vs-full-res split. 19 bandana flats + 2 tee blanks as WebP,
  `manifest.json` with precomputed fabric bounds + imprint zones. Curated 23-swatch `pms.json`.

### Round A — naming, brand, SKU
- Output is a **Mockup**, never a "Proof" (per the File Naming Guide — "we don't do proofs").
  Header/label/footer/filename all say Mockup. Download = `Mockup_<Job Request Name>.png`.
- Real Planet Apparel Ø logo (`assets/pa-mark.svg`) in page headers + Canvas sheet (fallback kept).
- `sku.js`: real 21-SKU catalog + `buildFilename`/`slugify`/`displayName` reused from Holly's
  `photo-namer.html`. SKU/Style dropdown drives fabric/size/shape/print-method + width autofill.
- Product-photo export named the CPB way:
  `brand-printmethod-color-fabric-size-layout-style.png`.

### Round B — Paisley templates
- 21 Paisley templates (`assets/templates/paisley/paisley-01..21.webp`) from `bandana-templates/`.
- "Paisley Bandana" product → clickable 21-tile browser; logo composites into the center field.
- Fold-shading skipped for flat art (`flat:true`) so paisley line-art doesn't distort the logo.
- Layout (Centered/Tiled/Cowboy-Style) + SKU shape ride in the intake JSON (v1: naming only).

### Verified (real Chrome, local static server)
- New Request renders; logo -> navy & red bandana flats with fabric-fold shading; PMS callout.
- Paisley: logo dropped into template 03 center, no distortion.
- Dashboard KPI tiles + orders table render (graceful no-backend state).
- SKU dropdown (21), Mockup labels, Layout dropdown, product-photo export.
- Server/DB round-trip (submit -> dashboard -> detail) verified by CODE REVIEW only — no local
  Postgres available. Confirms on first Railway deploy.

### Not in v1 (by design)
Generative AI · production seps/vectorize/EMB · resolution rescue · Pantone Connect API · full
Solid-Coated set · true tiled/cowboy compositing (metadata only) · binary art storage (art = refs)
· Printavo/n8n auto-attach.
