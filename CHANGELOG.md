# PlanetOps — Change Log

Shared, append-only. Newest at top. Per the Planet Apparel Build Change Log Discipline (`~/Dropbox/PlanetApparel/CLAUDE.md`).

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
