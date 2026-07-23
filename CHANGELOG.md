# PlanetOps — Change Log

Shared, append-only. Newest at top. Per the Planet Apparel Build Change Log Discipline (`~/Dropbox/PlanetApparel/CLAUDE.md`).

## 2026-07-22 — Outsourced packaging imprints now show in the QUEUE (✓ arrived no longer gates entry; the G1 vendor/in-house leg split still does) — branch `jean/queue-outsourced-visibility`, NOT committed/pushed, no PR yet
- Who:    Jean (via Claude, Opus)
- What:   `schedule/index.html` — `renderList()`'s `inQueue` predicate excluded any job that already had a `station` set, and Printavo pre-stamps `Station = "Post Production"` on outsourced packaging imprints (e.g. sublimated bandana `-2` legs) before the outsourced/arrived check ever ran, so the row was invisible to the Queue no matter what. Final rule: `const inQueue=j=>!j.placeholder&&!j.date&&(isOut(j)?invReleasable(j):!j.station);`. Normal (non-outsourced) jobs are unaffected — still gated on having no station. Outsourced jobs are no longer gated on station at all (that pre-stamped value is never consulted for them, fixing the bug) and no longer gated on ✓ arrived (`store.arrived[...]` dropped out of the expression entirely — arrived stays only an arrival stamp, the "📦 landed" badge is untouched); instead they're gated by the **pre-existing `invReleasable` (G1) helper**, preserved verbatim: an invoice marked "no 2nd service" (`store.invsvc[inv]==='none'`) never releases; once any sibling imprint on the invoice carries a real Post-Pro label, only the labeled sibling(s) release — the unlabeled pure-vendor leg stays Arrivals-only; if no sibling is labeled yet, all release (legacy flow, unchanged). Outsourced jobs now enter the Queue and Arrivals at the same time (once `invReleasable`), from the moment they appear, and leave the Queue when given a **production date** (placed on the board).
- Why:    Verified against the live feed (`power_scheduler_2026-07-22_2039.csv`): `27155 - 2` and 11 other outsourced packaging imprints were sitting in Arrivals but never reachable from the Queue, so their packaging time could never be set before the goods arrived — and the Arrivals hint text promising "the job then joins the QUEUE" on ✓ arrived was false for every one of them. First pass at this fix wrongly deleted `invReleasable` as dead code; round-1 review (Jean's own worked example, `27155-1` vendor print vs `27155-2` labeled packaging) caught that it does load-bearing work unrelated to the ✓ arrived gate, and it's restored.
- Arrivals copy corrected too (Jean green-lit editing it, 7/22 — TEXT ONLY, no Arrivals logic/markup/handlers touched): the Arrivals section hint and two `invGroup` chip tooltips all described queue-joining as something that happens ON ✓ arrived, which is no longer true. Rewritten to say the in-house leg is already in the QUEUE before the goods land — set its Post-Pro type, ⏱ time and station now — and that ✓ arrived only stamps the 📦 landed date and moves the row into arrived history. The "📪 no 2nd service" tooltip keeps its (still-true) never-joins-the-queue meaning, minus the on-arrival framing.
- Proof:  `tests/test_inqueue.js` extracts the live `OUTSOURCED`/`isOut`/`invReleasable`/`pptOf`/`realPP`/`inQueue` source out of `schedule/index.html` by regex/brace-balancing and evaluates it as real functions against 10 cases: the original bug case, dated-outsourced regression, normal stationed/unstationed regression guards, placeholder, `27155-1` (unlabeled vendor leg) staying OUT while `27155-2` (labeled packaging) is IN on the same invoice, an `invsvc==='none'` invoice staying OUT, and an unlabeled invoice's siblings releasing together (legacy path). `node tests/test_inqueue.js` → 10/10 PASS, exit 0.
- Build doc updated?  no — this entry + the matching `Power_Scheduler/CHANGELOG.md` entry in Dropbox are the record. Not committed or pushed per instruction; left in the working tree on `jean/queue-outsourced-visibility` for review/commit/PR against `frontdoor-gate`.

## 2026-07-14 — QC section on the front door + the QC Gate goes live (sublimation/outsourced form)
- Who:    Holly (via Claude)
- What:   **(1) New `qc/` surface.** `PlanetApparel/QC/QC_Gate_Form.html` (Malia's production QC instrument, stranded on `file://` since it was built) moved into the repo as `qc/index.html` and is now served behind the gate. **(2) New QC hub in the registry** under PlanetOps, holding the live `qc-gate-form` plus the old `qc-invoice` trainer (re-nested, now labelled as superseded). Two new hand-drawn glyphs (`qc`, `qc-gate-form`) in `frontdoor/app.js`. **(3) The form itself gained a sublimation/outsourced mode.** The project picker went from three types (Bandana / Apparel·In-House / Apparel·Outsourced) to **two products x an Outsourced toggle** — the two apparel forms rendered *identical* checks, so "outsourced" was a type that keyed off nothing. It is now a toggle that does real work. **Bandana + Outsourced = the sublimation form** (24 checks / 28 with reorder): date triangle -> date SQUARE (4th date = goods back from the vendor), a new Purchase Order zone (PO attached / actually sent / read / carries the vendor's "Date to arrive to PA"), the PMS check replaced by mock-up vs. the customer-PROVIDED file (sublimation has no colour requirement), a required second imprint line for packaging, and a reorder branch that compares mock-up-to-mock-up hunting for a swap instead of pulling a physical sample.
- Why:    Ride-along #3 with Malia on invoice 27437 (sublimated bandana, outsourced). Holly: "we need a separate form for sublimation because it's outsourced." Hosting was the ONE thing blocking Malia from running the gate solo — the form persists state in `localStorage`, which needs a real origin; `file://` cannot hold it (and Chrome will not even open `file://` for automation). Behind the front door it finally persists.
- Access: **Team-level.** `/qc/` is not in `PUBLIC_PREFIXES`, not in `DENY_PREFIXES`, and not in `FINANCE_PREFIXES` — so it sits behind the entry PIN only, with no second PIN. Confirmed against `gate/index.js:45-54`.
- Proof:  Registry validated against the app's own rules (75 nodes, 0 bad enums, 0 duplicate ids); both new emojis confirmed unused. Driven in Chrome on a local server: all four forms render with no duplicate checks (Bandana 21/26 UNCHANGED — the only trialed form, verified against regression), flags route to Jean correctly, N/A stays out of the copied findings, "never marked" still warns, and a run **survives a reload inside the shell's iframe** on a real origin. A run saved under the pre-toggle schema still restores onto the right checks (IDs were not renumbered). Zero console errors in the shell. `node --check` clean.
- Caught:  My own first cut showed Apparel-Outsourced BOTH the date triangle and the date square — the square supersedes it. Fixed before push.
- Left open: The sublimation form is **built but NOT trialed with Malia** — 5 judgment calls I made unilaterally are listed at the bottom of `QC_Gate_Rebuild_Spec_2026-07-14.md` (dropped the base-colour and blanks-ordered checks from sublimation; added #16; kept "seps file" naming though sublimation has no separations; gave Apparel-Outsourced the PO zone too). Also: the registry's "every emoji is unique" assert the BUILD_LOG promises **is not actually running** — 9 emoji are already duplicated across the 75 nodes. Mine are not among them, but the invariant has drifted.
- Build doc updated?  yes — this entry + `QC/CANONICAL_SOURCE.md` in Dropbox (the Dropbox HTML is now a stale copy; repo is SoT).

## 2026-07-09 — Security: fix pre-auth reflected XSS on the gate login page + stored XSS in the clock pages
- Who:    Holly (via Claude)
- What:   **(1) HIGH — reflected XSS, pre-auth, live in prod (`gate/index.js:181`).** `safeRedirect(req.query.r)` was interpolated raw into `<input name="r" value="${redirect}">`. Its guard `safePathname()` is a *filesystem* containment check, not an output encoder, and it actively defeated itself: the WHATWG URL parser percent-encodes `"` `<` `>`, the blocklist only tested `%2f|%5c|%2e%2e|%00`, then `decodeURIComponent` decoded the metacharacters straight back. With no CSP, `/gate?r=/x"><script>…` executed on the gate origin — the same origin as the PIN form. Fixed three ways: added `escHtml()` (escapes `& < > " '`) and applied it to `redirect`, `csrf` and `msg` at the sink; added a fail-closed `if (/["'<>\`]/.test(p)) return null` to `safePathname` so `safeRedirect` falls back to `/frontdoor/`; and added a login-page-scoped CSP via a new `sendLogin()` helper wrapping all five call sites. **(2) MEDIUM — stored XSS in `clock/admin.html`, `clock/report.html`, `clock/index.html`.** Roster/time-card fields from the `timesheets-*` webhooks (Google Sheet backed) went into `innerHTML` unescaped; `emp_id` also landed in a `data-e="…"` attribute. Added a one-line `esc()` to each page and wrapped every remote field.
- Why:    `/security-review` on this branch found both; each was independently re-verified against the real code before any edit. `frontdoor-gate` auto-deploys to Railway, so (1) was exploitable in production: a crafted link to any teammate could keylog the ENTRY_PIN or FINANCE_PIN as they typed it. (2) let anyone with Sheet edit access — not just a Manager-PIN holder — plant `<img src=x onerror=…>` in an employee name and steal `ts_admin_key` out of the manager's `sessionStorage`, escalating sheet-editor → full timesheet admin.
- Note:   The existing `esc()` in `frontdoor/app.js` escapes only `& < >`, **not `"`**. Both sinks here are double-quoted attribute contexts, so reusing it verbatim would have left the breakout open (`?r=/x" autofocus onfocus=alert(1) x="` needs no angle brackets). The helpers added here escape quotes. `frontdoor/app.js` is unchanged — it uses `esc()` in text context and was reviewed clean.
- Proof:  Gate booted locally: both payloads (`/x"><script>alert(1)</script>` and the no-angle-bracket `/x" autofocus onfocus=alert(1) x="`) now render `value="/frontdoor/"` with zero `<script>`/`onfocus` in the body; benign `?r=/frontdoor/schedule/` still round-trips; CSP present on `/gate`, absent on `/healthz`; login page renders intact (logo, PIN field, Enter button) on 200/401/503 paths; bad-PIN error escapes to `That&#39;s not it`. Clock: headless-Chrome DOM test rendering the real admin row template with a malicious roster → `PWNED=false`, 0 injected `<img>`, 0 injected `<script>`, no `onmouseover` attribute, and `data-e` round-trips exactly so the Edit button still resolves its employee. `node --check` clean on `gate/index.js` and all three extracted inline scripts.
- Left open: `clock/report.html:104` still passes the manager `admin_key` in a query string (`?k=…`), contradicting the P0-3 comment above it. Fixing it requires the live n8n `timesheets-report` workflow to read a POST body — deliberately out of scope here.
- Build doc updated?  yes — this entry.

## 2026-07-09 — Front door: Floor section view (click-through) + sub-flyout hover fix + registry type fix — GO-LIVE
- Who:    Holly (via Claude)
- What:   **(1) Section view:** clicking a sub-hub (The Floor, Time & Labor) in the flyout now NAVIGATES into it instead of just re-fanning the flyout — the section's keys (Scheduler, Board, Pre-Press, Running, Reports, Fulfillment, Calculator, Availability) render as a left side-nav beside the embedded app (`.sectionNav` in `renderPane`), active key highlighted, breadcrumb follows; a bare section hash (`#/planetops/floor`) forwards to its first embeddable key. **(2) Hover fix:** the sub-flyout was unreachable — plain sibling rows' `mouseenter` scheduled `hideSubFlyout()` and the 220ms hide raced the diagonal mouse path from "The Floor" to the sub-menu. Plain rows no longer touch the sub-flyout; the sub-flyout now overlaps its parent by 4px (no dead gap) and hide delays went 220→350ms. **(3) Registry fix:** `command-center` carried `type:"app"` (not in the validator enum) — the hard-fail validation banner would have blanked the whole front door on next deploy; corrected to `live-app`. Also commits last night's until-now-uncommitted front-door work (home summary + finance lock + recents + PlanetOps/RH/IQ glyph set + gate `/api/home/summary`).
- Why:    Holly's design feedback while working with Jean: "click on the floor to display only the floor with its keys on the left" and "I can't hover over Scheduler from the flyout — the only way into the Scheduler is search."
- Proof:  Driven end-to-end in Chrome against a local serve: flyout → hover The Floor → sub-flyout stays open while the pointer sits on a sibling row for 1s (old code hid it at 220ms) → click Scheduler → `#/planetops/floor/schedule` renders keys-left + Scheduler embedded; clicking "The Floor" row lands on the same view; clicking Board in the side-nav swaps the frame + active key + breadcrumb. `node --check` clean on app.js + gate/index.js; registry passes its own validator (renders, no red banner).
- Build doc updated?  yes — this entry.

## 2026-07-09 — Command Center Data API: Gate-2 hardening (honest staleness · partial-read guard · real sanitizer · sanitized-parity)
- Who:    Holly (via Claude)
- What:   Applied the Codex Gate-2 critique to the deployed n8n workflow **"Command Center — Data API"** (`uVO85DuKcSzbEU4g`, ACTIVE), findings 1–4 + the sample-data half of 6. **Finding 1 (honest staleness):** rebuild outcome is now persisted in static data as `sd.lastRebuild = {ok, at, error}`. `Serve Cached` computes `stale` from it — `stale=true` if the LAST rebuild FAILED **or** cache age > 15 min (was hard-coded `false`). Cached responses always carry `meta.generatedAt`, `servedAt`, `servedFrom`, `lastRebuildOk` (plus `lastRebuildError/At` when the last rebuild failed). **Finding 2 (partial-read guard):** `Transform` now verifies ALL EIGHT tabs read successfully AND meet minimum shape (SCRIPTS≥10, TOUCHPOINTS≥20, JOURNEYS≥20, stages≥6, SCRIPT_FIELDS/TOUCHPOINT_SCRIPTS/BEHAVIOR_TRIGGERS/META≥1) BEFORE overwriting `sd.lastGood`. Any tab error / short read → mirror is NOT clobbered, `lastRebuild` records the failure, and stored last-good is served stale. **Finding 3 (real sanitizer):** replaced the regex pass with a strict tokenizer/allowlist parser (Node, no DOM) — parses tags, keeps only an allowlist, per-tag attribute allowlist (`a`: href [https:// or mailto: after entity-decode + control/whitespace strip + lowercase] with `rel="noopener noreferrer" target="_blank"` FORCED, plus the style allowlist so the button stays styled; structural tags: style-only), style values pass a property allowlist (background, color, padding*, margin*, border*, border-radius, font-*, text-*, display, width, max-width, line-height, letter-spacing) with charset `[-#%a-zA-Z0-9 .,:;!]` and hard reject of `url(` / `expression` / `javascript` / `data:`. `img`/`src`/`srcset` dropped entirely (no external fetches); `script`/`style`/`iframe`/… dropped with contents. **Finding 4 (sanitized-parity):** merge-field parity now compares fields extracted from the SANITIZED html vs bodyText; a merge field present in raw but removed by sanitization is gated as `sanitizer-removed-field:[X]`. **Sample regen (finding 6 half):** `revenue-house/command/sample-data.json` regenerated verbatim from the fresh post-deploy transformer payload (+ snapshot `meta.note`) so the static fallback is transformer-identical and carries `schemaVersion` + full staleness meta. Deployed via GET→PUT (static-data reset to force a clean cold/fresh build).
- Why:    Codex Gate-2 flagged four "runs green, serves wrong / serves unsafe" classes: cache reported fresh before knowing the rebuild's fate; a partial Sheet read could overwrite last-good with a thin-but-"healthy" payload; the regex sanitizer still allowed `<img src>`, `style:url()`, `data:`/encoded `javascript:` and other external-fetch/XSS surface; and parity was checked on raw (pre-sanitize) HTML, so a field could pass validation yet vanish from what actually renders/sends.
- Proof:  15/15 sanitizer unit tests pass (real ^review button + adversarial: entity/control-char `javascript:`, `<img onerror>`, `style:url()`/`expression`/`data:`, `<script>`/`<style>` content drop, `onclick`, http-not-https href dropped, mailto kept, non-allowed tag stripped keeping text, table/tr/td survive). 4/4 transform-logic tests pass (healthy stores mirror stale=false; SCRIPTS=4 short-read serves stale, does NOT clobber, records `lastRebuild.ok=false`; no-prior-mirror partial read returns empty stale; `sanitizer-removed-field` detected + gated). LIVE curls post-deploy: cold `200` 5.06s `servedFrom:fresh stale:false lastRebuildOk:true validationErrors:0`; warm `200` 0.23s `servedFrom:cache stale:false`; `^review` yellow `<a>` survives with `background:#F7BE00`, forced `rel="noopener noreferrer" target="_blank"`, https href intact, all three merge fields preserved, parity passes (validationErrors 0). Counts shifted as expected from tonight's 3 react-qc rows (touchpoints 30→31, journeys 27→28, touchpoint_scripts 21→22). Python structural deep-compare live-vs-new-sample = identical across all 8 collections + meta.
- Build doc updated?  yes — this entry; canonical contract `revenue-house/command/sample-data.json` regenerated (now carries schemaVersion + staleness meta). Findings 5, 7, 8, 9, 10 (index.html badge/routing/detail-view/lifecycle/search) are OUT of this scope (page-side, separate owner).

## 2026-07-09 — Command Center Data API: schema alignment + respond-first (kiosk fast path)
- Who:    Holly (via Claude)
- What:   Fixed the deployed n8n workflow **"Command Center — Data API"** (`uVO85DuKcSzbEU4g`) on two integration bugs the kiosk-page builder found, against the canonical contract `revenue-house/command/sample-data.json`. **Fix 1 (schema):** `Transform + Validate` now emits `scripts[].aliases` as an ARRAY (was a comma-string), adds `scripts[].sheetRow` (int, from the Sheets `row_number`), adds `meta.gids` (tab-id map) + `meta.sheetId`, and reshapes `gaps[]` to the canonical `{code,name,channel,publishStatus,reason,notes,sheetRow,kind}` — planned scripts now emit `kind:"script"` (the page filters gaps on exactly this, so it previously rendered ZERO gaps) with a derived `reason`, while validation failures emit `kind:"invalid"` carrying BOTH `reason` (joined errors) and `errors[]` (kept for the alert). Coerced `script_fields.required` and `behavior_triggers.neverAutoReply` to real booleans (a string `"false"` was truthy — latent "never auto-reply" chip bug). **Stale bug:** a healthy rebuild now always sets `meta.stale=false`; `stale:true` is emitted ONLY when serving stored last-good after a failed/empty rebuild. **Fix 2 (respond-first):** restructured to Webhook → `Serve Cached` (reads last-good from static data) → **Respond Cached immediately** → THEN the 8 Sheets reads → `Transform` re-stores the mirror; first-ever call (or an old-schema mirror, gated by `schemaVersion`) falls through to cold build-then-respond. `meta.servedFrom` = `cache|fresh`, plus the build timestamp. Added `errors:[]` to the 7 `sample-data.json` gaps so the canonical fallback and live payload are byte-for-schema identical.
- Why:    Kiosk page treats `sample-data.json` as the contract; the live payload diverged (aliases string, no sheetRow, no gids, gaps invisible) AND the 8 chained Sheets reads took ~6s cold, past the page's 3s hard timeout — so the kiosk was silently falling back to sample data on every load.
- Proof:  curl ×N on the live webhook: cold first build 200 in ~6.0s (full valid payload, `servedFrom:fresh`, `stale:false`, `validationErrors:0`); every subsequent call ~0.2–0.3s (`servedFrom:cache`, `stale:false`); background refresh verified advancing `generatedAt` (07:08:28 → 07:08:51 → 07:09:00) while serves stayed <0.3s. Python deep-compare of key sets: ALL 8 collections (scripts, script_fields, touchpoints, touchpoint_scripts, journeys, stages, behavior_triggers, gaps) now schema-identical between live and sample-data; 18/18 scripts, 7/7 gaps; aliases arrays, sheetRow ints, meta.gids + meta.sheetId present, gaps[].reason + errors[] present.
- Build doc updated?  yes — this entry; canonical contract `revenue-house/command/sample-data.json` (gaps gained `errors:[]`)

## 2026-07-08 — Art Namer: conversion gate corrected + full automation + docs
- Who:    Holly (via Claude)
- What:   `cli.py` now runs the whole pipeline in one command (`--upload`): conversion gate → auto SKU from Printavo → auto-crop → name → catalog → idempotent Drive upload. **Corrected a latent silent-wrong bug found during verification:** the gate originally used `paidInFull`, which is NOT conversion — inv 20200 is "Delivered / Picked up" with `paidInFull:false` (net terms), so real delivered work would have been silently dropped. Conversion truth = Printavo `status.type` (`INVOICE` vs `QUOTE`) AND which connection the record lives in; `invoices(query:"5")` is a fuzzy search that does NOT return quote 5, so the code queries `invoices` + `quotes` and matches visualId exactly. Gate now FAILS CLOSED (tri-state: True process / False quote / None unverified → both skip with a printed reason). Notably `🔵 Art (Seps.io)` is a QUOTE-type status — seps.io mockups exist for jobs that never convert, exactly what the filter excludes. Added `README.md` (build doc) + `FEED_INTEGRATION.md` (app briefing). Retired the throwaway plan file.
- Why:    Holly: only capture projects that CONVERTED; name them for Google + LLM search; have the infrastructure ready to drop into the PlanetOps Feed surface later.
- Proof:  Gate verified on 4 real records — 27062 (Order Shipped, paid) → PROCESS w/ SKU PL2219; 20200 (Delivered, paidInFull:false) → PROCESS w/ SKU ORG2417 (would have been wrongly dropped by the old logic); quote 5 (Archived Quote) → BLOCK; 99999 (nonexistent) → BLOCK unverified. Canal Trust end-to-end with `--upload`: both colorways named, cropped 2550×3300→1940×1940 (visually verified), uploaded to Website_Ready/Bandanas/, re-run produced 0 duplicate Drive files. Collision/idempotency/sublimation/USA-fabric assertions pass.
- Build doc updated?  yes — art-namer/README.md (new) + SPEC.md (conversion gate section rewritten)

## 2026-07-08 — Art Namer engine (new component: `art-namer/`)
- Who:    Holly (via Claude)
- What:   New naming engine that turns produced-job bandana mockups into Google/LLM-optimized web assets: `art-namer/engine.py` (pure logic: internal-filename parse, SKU decode per SKU_Dictionary §2, slug/title/alt schema, collision + idempotency rules), `cli.py` (batch lane: catalog + auto-crop proof-sheets to product image + staging + review contact sheet), `SPEC.md` (contract for the future Feed lane — Part C calls the SAME engine). Slug pattern `custom-{fabric}-bandana-{color}[-screen-printed]-{entity}.jpg`; SKU rides as metadata, never in slug. Catalog: `Website/_Internal/Art_Namer/art_catalog.md`. Final store: Website Shared Drive → `Website_Ready/Bandanas/` (folder created; Phelan-visible). Registry: `art-namer` node added under PlanetOps hub (uncommitted, rides with frontdoor WIP).
- Why:    Holly: produced-art photos must be named for Google + AI search (Phelan's filename-driven WordPress import; his scheme lacked the internal SKU). Pilot for the bigger harvest→feed→scheduler vision.
- Proof:  Canal Trust invoice 27062 end-to-end (see corrected entry above for the final verified state).
- Build doc updated?  yes — art-namer/SPEC.md is the build doc (new component)

## 2026-07-08 — The Floor cascade (branch `frontdoor-gate`, staging only)
- Who:    Holly (via Claude)
- What:   "The Floor" is now a HUB in registry.json — hovering it in the PlanetOps flyout fans out a second-level cascade flyout (`#subflyout`, `cascadeRow`/`showSubFlyout` in frontdoor/app.js): Scheduler · Board · Pre-Press · Running · Reports · Fulfillment · Calculator · Availability, each with a bespoke flat glyph. Scheduler/Calculator/Availability open their real pages; the floor-native rows open ../index.html (section deep-links like `#prepress` in the registry are inert until the floor app learns to read them — see handoff below). Time & Labor sub-hub gets the same cascade. Node ids: schedule/estimator/capacity MOVED under floor; new ids floor-board/-prepress/-running/-reports/-fulfillment.
- Why:    Holly: hovering The Floor should show its sub-dashboards, Scheduler first. Floor-app-side pieces (rail emoji→glyphs, deep-link reader in index.html) are deliberately PAUSED for Jean's board+scheduler rebuild (branch `jean/intake-feed-merge`) — do not build them on this branch.
- Proof:  Staging browser-verified: PlanetOps flyout shows "The Floor ›", hover fans the cascade, Scheduler-first order, click embeds w/ 3-level breadcrumb (PlanetOps › The Floor › Scheduler), zero console errors.
- Build doc updated?  yes — this entry; registry schema unchanged (hubs nest recursively by design)

## 2026-07-08 — Front door v3: QuickBooks nav + full glyph set + HOME canvas (branch `frontdoor-gate`, staging only)
- Who:    Holly (via Claude)
- What:   (1) Slim tucked left rail (icon + short label) with QuickBooks-style hover FLYOUTS replacing the tile grid; (2) unique hand-drawn flat SVG glyph for ALL 61 registry nodes — emoji fully retired from the front door; "Floor App" renamed "The Floor"; (3) NEW home canvas: welcome band · "Needs attention" alarm board · Quick Access (pins + recents) · Feed card · Browse (hubs accordion) · Ø logo → home from anywhere; (4) NEW gate endpoint `GET /api/home/summary` (session-gated; gate health + state-api probe + registry STALE/WIP notices + `financeUnlocked`/`financeSurfaceIds` for server-enforced finance redaction; `no-store, private` + `Vary: Cookie` always). `loadSession()` now distinguishes DB-down (503 `session_store_unavailable`) from logged-out on API routes.
- Why:    Holly's design direction (7/8): flat QuickBooks-style marks over emoji, hover-flyout nav, tucked rail, home = control tower ("sections that show the alarm"). Plan Codex-reviewed adversarially — 4 rounds, 37 findings, APPROVED.
- Proof:  Staging (`frontdoor-gate-staging`) browser-verified: home renders, flyouts work, accordion works, embed + Ø-logo→home round trip, recents chip appears, ZERO console errors. curl battery: entry-only summary → `financeUnlocked:false`, 9 finance ids, 0 finance-named flags; finance PIN unlock → `true` + finance flags visible; no-cookie → 401; headers correct incl. errors. NOT live-tested: Postgres-down 503 path (staging Postgres is shared with prod state-api — not safe to pause) and state-api-down probe (env change blocked); both code-reviewed only. The static "run /feed" nudge from the plan was deliberately NOT built (permanent fake-urgency).
- Build doc updated?  yes — frontdoor/BUILD_LOG.md still accurate for registry schema; home + summary endpoint documented here + in `~/.claude/plans/i-want-you-to-snuggly-cloud.md` (Codex-approved spec)

## 2026-07-08 — Branded circular icons + Floor App nav (bottom tabs → left rail)
- Who:    Holly (via Claude, Fable 5) — staging feedback
- What:   (1) FRONT DOOR: every icon now sits in a dark round Ø circle (.iconBadge);
          ~10 hubs + the Floor App got hand-built flat SVG glyphs (GLYPHS map),
          surfaces keep emoji-in-circle. QuickBooks-branded look.
          (2) FLOOR APP (index.html, live SPA): the bottom tab bar became a collapsible
          LEFT icon-rail (.bottom-nav → .side-nav; .app-shell content wrapped in
          .content-row row layout) — thin icons by default, hover expands labels.
          switchTab() + the 3 count badges (#prepress/#active/#fulfillment) + the
          :nth-child(2) Pre-Press ref all preserved. Clock tab REMOVED (redundant with
          the front-door top clock). Tabs kept: Board·Pre-Press·Running·Reports·
          Fulfillment·Estimator·Schedule·Availability.
- Why:    Bland identical tiles; Floor App bottom bar should collapse "like the key."
- Proof:  Verified on staging in Chrome: rail + tiles show custom hub glyphs (PlanetOps,
          Revenue House, PlanetIQ, Systems, Training, References, Growth, Brain) + Floor App
          glyph in dark circles, surfaces emoji-in-circle. Floor App embeds with the new left
          icon-rail; hover expands labels; clicking Board→Pre-Press switches panels; count
          badges (8/1) intact; Clock gone. Only console errors = benign extension noise +
          expected ShipStation 500 (no creds on staging).
- ⚠ Floor-app nav is a UX change for the production floor; they get it at cutover
  (heads-up/retrain then; verify tablet ergonomics — was thumb-friendly bottom bar).
- Build doc updated?  yes — frontdoor/BUILD_LOG.md "Branded circular icons".
- Who:    Holly (via Claude, Fable 5) — her staging aesthetic feedback ("tiles look bland")
- What:   Every one of the 61 registry nodes now carries a UNIQUE, function-matched emoji
          (Floor 🎛️ · Schedule 🗓️ · Signals 📡 · Retention 🧲 · Save Touch 🆘 · Pipeline 🚰
          · Agent OS 🤖 · KPI 🎯 …). Tiles reshaped so the emoji + bold name lead at the top
          (QuickBooks feel); the pinned quick-bar now shows those emojis as tabs for free.
          A build-time Python assert guarantees no emoji repeats (incl. hub emojis).
- Why:    Surfaces all fell back to the same 📄 — indistinguishable and dull.
- Proof:  Verified on staging in Chrome: PlanetOps + Revenue House hubs show every tile with
          a distinct emoji, name prominent; pinned chip shows its emoji. Only console output
          = benign browser-extension "message channel" noise (:0:0, no app stack) — not the app.
- Build doc updated?  yes — frontdoor/BUILD_LOG.md "Emojis" section (keep new surfaces unique).
- Who:    Holly (via Claude, Fable 5 high) — her staging feedback
- What:   Clicking an internal surface tile now loads it EMBEDDED in the main pane
          (iframe) with the left rail persistent + breadcrumb + ‹Back + ⤢Full-screen,
          instead of window.open new-tab. Browser Back works in-shell. Rail is
          collapsible (☰ topbar toggle, persisted) with a far-left hover-reveal drawer.
          External surfaces (docs.google.com) still new-tab, marked with ↗. Gate now
          sends X-Frame-Options: SAMEORIGIN + X-Content-Type-Options: nosniff globally
          (our front door may frame our pages; nobody else can).
- Why:    New-tab navigation stranded users with no way back to the hub (Holly's test).
- Proof:  Verified on staging in Chrome: Schedule embeds w/ rail intact, breadcrumb +
          Back + Full-screen present; ☰ collapse → full width; far-left hover → rail
          drawer slides back; clicked a hub from the drawer → navigated + un-embedded;
          external Sheet tile shows ↗; curl confirms X-Frame-Options SAMEORIGIN on both
          gated + public responses; zero console errors. (Also validated the registry
          model: the new Retention Playbook page added this AM appeared from one entry.)
- Build doc updated?  yes — frontdoor/BUILD_LOG.md "Navigation model" section.

## 2026-07-08 — Phase 2: frontdoor-gate built + P0 credential fixes (NOT yet deployed)
- Who:    Holly (via Claude, Fable 5 high; plan survived 3 Codex review rounds, board 5-0 Railway)
- What:   NEW `gate/` — the real PIN gate service (Express+pg sibling of state-api):
          CSRF login, Postgres sessions (workday, revoke-one/all), ENTRY+FINANCE PINs,
          per-IP limiter + global breaker w/ operator reset, hardened public allowlist
          (signature/rush/bandana-templates/ship-estimate), server-side protected route
          map (planetiq + clock admin/report), no-store+Vary:Cookie, healthz/readyz/
          health-public, alert events → 🚨, graceful DB-down. Plus P0 fixes IN the pages:
          STATE_API_KEY removed from index.html + schedule (same-origin /api/state via
          gate); ShipStation creds removed from client state/settings (gate env only,
          /api/shipstation/sync); ?k= admin keys removed from both clock pages.
          Shell UX: 🕐 topbar clock link, Agent OS → Systems, >8-tile type grouping,
          registry URL validation, client PIN screen removed (server owns auth).
          Docs: gate/RUNBOOK.md (non-technical ops) · gate/WEBHOOK_INVENTORY.md.
- Why:    Codex review confirmed live credential exposure on the public site (see
          PLAN-REVIEW-LOG.md); the gate is the structural fix + the "not findable" gate.
- Proof:  Local battery ALL PASS (no-DB degraded mode): health endpoints, gating
          redirects/401s, deny-list 404s, traversal/encoding/backslash/dotfile/case
          attacks all fail closed, CSRF enforced, correct-PIN-DB-down → graceful 503,
          per-IP limiter 429 at threshold, structured failed_pin events.
- ⚠ NOT LIVE YET: staging deploy blocked pending Holly's interactive approval of the
          Railway service creation; pages now call same-origin endpoints, so DO NOT
          push to the public repo until the gate is the host (cutover order in PLAN.md).
- Build doc updated?  yes — gate/RUNBOOK.md + WEBHOOK_INVENTORY.md new; PLAN.md is the
          approved design; frontdoor/BUILD_LOG.md still current for the shell.

## 2026-07-08 — Front Door shell built + planet-sales/ renamed to revenue-house/
- Who:    Holly (via Claude, Fable 5 high; designed in the 7/7 Opus session)
- What:   (1) NEW `frontdoor/` — the gated single front door over all ~55 operational
          surfaces: placeholder PIN gate (0000 — NOT security, Phase 2 hardens it),
          left rail (HUBS: PlanetOps · Revenue House · PlanetIQ · Systems / LIBRARY:
          Training · References), global type-ahead search, pinned favorites,
          recursive hub→tile rendering, hard-fail registry validation. 100% of
          content renders from `frontdoor/registry.json` (60 nodes: 10 hubs, 50
          surfaces incl. Drive control-sheets and stranded-file:// apps marked WIP).
          (2) RENAME `planet-sales/` → `revenue-house/` (hub renamed Revenue House,
          front-of-house metaphor; done pre-push so no live URLs broke).
          NOT committed/pushed/deployed — local preview only, by design, until the
          Phase 2 real gate exists ("not findable" promise).
- Why:    2026-07-07 research found 13+ orphan pages, ~10 apps stranded on file://,
          a drifting PA Docs bookmark registry, and the site publicly findable.
          The front door is the additive nav+status layer over what already works.
- Proof:  All 9 acceptance criteria of `_planning/fable-build-01-shell.md` §5
          verified in Chrome via localhost:8791 — PIN gate, rail, tiles+badges,
          new-tab opens, recursive Time & Labor sub-hub, search→navigate, pin
          survives reload, zero console errors, forced-mobile layout clean, and a
          deliberately-corrupted registry produced the named red error banner.
- Build doc updated?  yes — `frontdoor/BUILD_LOG.md` (new; schema + how-to-add-a-surface
          + gotchas + Phase-2 list). Spec/brief: `_planning/front-door-spec.md`,
          `_planning/fable-build-01-shell.md` (Appendix A = registry seed).
## 2026-07-08 — Bottom tab bar REMOVED — sidebar is the app's sole navigation
- Who:    Jean (via Claude, Fable 5; Jean's explicit call)
- What:   Deleted the 68px bottom tab bar (markup + CSS) — it duplicated the new
          sidebar section-for-section and ate vertical space on the floor iPad.
          Main content now reaches the viewport bottom; the Schedule and
          Availability iframes size to their panel (were hard-coded
          `calc(100vh - 120px)` around the bar). The Pre-Press / Running /
          Fulfillment count badges MOVED into the sidebar items keeping their
          element ids (`prepress-badge` etc.) so the existing KPI updaters work
          unchanged; the sidebar renders once at boot and only the highlight
          updates on switch, so badges stay stable. On phones the ☰ drawer is
          now the only nav — by design. This closes Holly's original "bottom bar
          getting girthy" complaint from the 7/7 walkthrough.
- Why:    With the sidebar always visible, the bar was pure redundancy; Jean
          ordered the strip-out.
- Proof:  Commit afd0cba, pushed to Pages. Headless: zero `.nav-tab`/`.bottom-nav`
          elements; all 3 badges inside the sidebar (Running badge populated from
          live state at boot); all 8 sections switch with highlight sync; main
          content + schedule iframe reach the viewport bottom (0px gap).
- Build doc updated?  no — this entry is the record.

## 2026-07-08 — Nav shell v2: dropdown → collapsible LEFT SIDEBAR (Jean's direction)
- Who:    Jean (via Claude, Fable 5)
- What:   Replaced the ☰ dropdown menu (same-day v1, below) with a persistent
          collapsible left sidebar rendered from the same `SECTIONS` registry:
          always visible beside the main content on wide screens; ☰ now toggles
          collapse to a 58px icons-only rail (remembered per device via
          localStorage `planetops_sidenav_collapsed`); current section carries a
          yellow marker; PIN-gated sections will show 🔒. On narrow screens
          (≤700px) the sidebar becomes an off-canvas drawer with a scrim, and
          navigating closes it. Home panel, `goSection()` routing, PIN-gate
          infra, and the bottom tab bar are unchanged. NOTE for Holly: this
          supersedes the icon-bar-vs-hamburger DECISION — Jean chose sidebar.
- Why:    Jean's call after seeing v1: a sidebar is the better long-term nav as
          sections multiply — always visible, scales vertically, collapses out
          of the way on the floor iPad.
- Proof:  Commit 70ad052, pushed to Pages. Headless test at 1280px and 620px:
          9 items render; collapse toggle + saved preference; current-highlight
          syncs on jump; drawer hidden at boot, opens with scrim, closes on
          navigate. All 7 script blocks syntax-clean.
- Build doc updated?  no — this entry is the record.

## 2026-07-08 — Nav shell: Home directory + ☰ quick-jump + PIN-gate infrastructure (overhaul #1)
- Who:    Jean (via Claude, Fable 5)
- What:   Main dashboard gains an app navigation shell so the bottom tab bar stops
          growing ("getting girthy"): a `SECTIONS` registry drives (a) a **Home**
          panel — one tile per section with a description, reached via the ☰ menu or
          tapping the logo — and (b) a **☰ hamburger menu** in the header that jumps
          between sections from anywhere (current section highlighted). New sections
          get ONE registry entry and appear in both places; the bottom bar stays as-is.
          Bottom-nav buttons now route through `goSection()` (adds `data-tab` attrs).
          **PIN gate built but inert:** `NAV_PIN = { code:null, gated:[] }` — when Holly
          picks a PIN + which sections are restricted, set both and gated sections get a
          🔒 in the menu/tiles, a PIN modal on entry, and a per-browser-session unlock.
          Hamburger chosen over a persistent icon bar per the plan doc's recommendation
          (scales better) — flag to Holly in case she prefers the icon bar.
- Why:    Holly's 7/7 Board-overhaul plan #1 (P0): navigation must scale as sections
          keep being added; PIN-restricted sections requested as infrastructure.
- Proof:  Commit 5dd8692, pushed to Pages. Headless-driven test: Home renders 8 tiles;
          menu opens with 9 entries + current highlight; jumping syncs panel + bottom
          tab; with a test PIN configured the gate blocks entry, rejects a wrong PIN,
          unlocks on the right one, and stays unlocked for the session.
- Build doc updated?  no — this entry is the record. Open DECISIONS for Holly: PIN code +
          gated section list (config at `NAV_PIN` in index.html), and the "Board" rename (#2).

## 2026-07-07 — P0 bugs from Holly's Board walkthrough: inventory loading + scheduler date range
- Who:    Jean (via Claude, Fable 5)
- What:   (1) **Blanks inventory loading** — `fetchBandanaInventory()` was only
          called at the very end of `syncFromPrintavo()`, so three paths left
          `state.inventory` null forever: the 7/6 cross-device fresh-sync skip
          (most devices return early and never reach the fetch), any mid-sync
          Printavo error, and off-hours page loads (sync doesn't run at all).
          Inventory now loads independently at init and whenever a Blanks sheet
          opens (the 5-min localStorage cache keeps this cheap), keeps a stale
          cache as fallback when the Railway proxy is down, and an already-open
          sheet updates its stock lines in place by element id — a full
          re-render would wipe quantities Rosa is mid-typing. A SKU that is
          loaded but unmatched now reads "no live stock record for this SKU"
          instead of the misleading "inventory not loaded yet".
          (2) **Scheduler date range** — two device-local failure modes, both
          reload-proof because `range` is intentionally LOCAL_ONLY (never
          healed by shared-state sync): an inverted custom range (start after
          end) rendered ZERO day rows, and scheduling a job outside the visible
          window silently flips the device into custom mode forever — weeks
          later the stored window is entirely in the past and the board shows
          no current dates. Fixes: inverted ranges swap, degenerate ranges fall
          back to Work Week, and boot resets a custom window that is entirely
          past with no scheduled jobs inside it. A deliberate current custom
          range is untouched.
- Why:    Holly's 7/7 Board walkthrough flagged both as live bugs (plan doc
          #12); the inventory one blocks the Blanks-stage overhaul (#4).
- Proof:  Commit b7a2ac4, pushed to Pages. Proxy verified healthy (HTTP 200,
          CORS *, ~12 s response — the latency is why late-arriving data must
          refresh an open sheet). Headless-Edge repro: seeded a stuck June
          custom range → board self-healed to the current work week; seeded a
          current custom range → preserved; board page renders 92 job cards
          post-change. NOTE for later: the inventory proxy returns no
          `organic` section, so ORG SKUs show "no live stock record" — n8n
          workflow / sheet side, not the app.
- Build doc updated?  no — behavior fix only; this entry is the record.

## 2026-07-07 — Top-level Estimator tab removed (UI/aesthetic pass)
- Who:    Jean (via Claude, Fable 5)
- What:   Removed the 🧮 Estimator tab from the main dashboard's bottom nav,
          its `panel-estimator` iframe panel, and the `switchTab` lazy-load
          line. The estimator itself is UNCHANGED: single source still lives
          at `/estimator/` and remains fully reachable via the Schedule
          module's ⏱ Estimator sub-tab (persistent iframe) plus the board's
          auto-charted time chips (`estimate.js`). Also refreshed the
          schedule tooltip note that referenced the deleted tab.
- Why:    Jean lives in the Schedule module; the standalone tab duplicated
          the sub-tab and cluttered the nav. Both iframed the same source,
          so nothing is lost.
- Proof:  grep for "estimator" in index.html returns zero matches; nav goes
          Board / Pre-Press / Running / Reports / Fulfillment / Schedule /
          Availability / Clock; no hash routing or saved-tab state pointed
          at the removed tab.
- Build doc updated?  no — nav-only change; this entry is the record.

## 2026-07-06 — Printavo-proxy polling throttled ~96% (429-storm root cause)
- Who:    Jean (via Claude, Fable 5; Jean approved the design)
- What:   `syncFromPrintavo()` was making ~105 proxy calls per sync per device
          (4 list pages + an UNCONDITIONAL per-job detail re-fetch), every 20 min,
          on every open device — the measured 353-executions-in-45-min storm that
          starved the shared quota pool (killed the 7/6 morning calculator
          writebacks) and previously tripped Printavo's Imperva WAF.
          Two changes:
          (1) **Detail TTL** — blanks list / URLs / placements (near-static) re-fetch
              only when the job's Printavo status moved or `detailFetchedAt` is
              older than 6h. Status, due date, customer ID, delivery method still
              refresh every sync — they ride the cheap list query, now hoisted out
              of the detail block so they apply unconditionally.
          (2) **Cross-device skip** — auto-sync returns early if `state.lastSyncAt`
              (shared via the State API) is fresher than 15 min: one device pulls,
              the rest inherit through shared state. The header 🔄 button passes
              `force=true` and bypasses the skip (but not the detail TTL — 6h is
              the staleness bound on near-static fields by design).
          Steady state drops from ~1,000 proxy executions/hr (3 devices) to ~15–30/hr.
- Why:    n8n CHANGELOG 7/6 flagged this as the storm's root cause after the
          writeback retry-hardening; extra-credit item #2.
- Proof:  node --check clean on all 7 inline script blocks; headless render OK;
          new-job path stamps `detailFetchedAt`; manual button verified passing force.
- Build doc updated?  no — sync behavior; this entry is the record.

## 2026-07-06 — Phase 3: Customer ID on cards + board search (Tray deferred)
- Who:    Jean (via Claude) — built by a Fable 5 agent, reviewed + deployed on Opus 4.8
- What:   Shipped 2 of the 3 Phase-3 blueprint features into `index.html`:
          (1) **Customer ID** — Printavo `customer.id` added to the list query, threaded
              through `makeJob`/`mapInvoiceToJob`, backfilled onto existing jobs on sync,
              and rendered as a tap-to-copy 🔑 on job cards, imprint cards, and the job sheet.
              It's the cross-system join key (Streak field 1068).
          (2) **Board search** — live filter by job #, customer, client tag, or customer ID;
              per-device (NOT shared state), 150ms debounce; applied to every column incl.
              archived; composes with the existing filter pills.
          Feature 1 (Outsourced Holding Tray) deliberately NOT built — see Why.
- Why:    Blueprint Phase 3 (`PlanetOps/Blueprint_PlanetOps_Phase3_2026-07-01.md`) specced
          all three, but the Status Taxonomy Overhaul (07-03 specs) renames the exact
          Printavo statuses the Tray's OUT/BACK logic keys off (`Awaiting Goods` →
          `Vendor Producing`, etc.). Building the Tray now would mean building it twice.
          Customer ID + Search are taxonomy-proof, so they ship now; the Tray waits for
          the rename to land, then gets built once on final status names.
- Proof:  Diff reviewed hunk-by-hunk (42 ins / 9 del, one file). greps confirm
          copyCustomerId/customerId/setBoardSearch/matchesSearch/board-search present and
          renderOutsourcedTray/outsourced-tray absent. Live-verified at
          https://planetholly.github.io/planetops/ after Pages deploy.
- Build doc updated?  Blueprint still valid as-is for the deferred Tray (Feature 1). Its
          "ship all three / commit-per-feature" order is now superseded: Features 2+3 shipped
          together in one commit (this env has no interactive git to split intermixed hunks),
          Feature 1 held. No other build-doc edit needed.
