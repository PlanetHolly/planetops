# PlanetOps — Change Log

Shared, append-only. Newest at top. Per the Planet Apparel Build Change Log Discipline (`~/Dropbox/PlanetApparel/CLAUDE.md`).

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
