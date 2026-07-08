# PlanetOps — Change Log

Shared, append-only. Newest at top. Per the Planet Apparel Build Change Log Discipline (`~/Dropbox/PlanetApparel/CLAUDE.md`).

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
