# BUILD-LOG — Front Door IA Phase 1

Branch `frontdoor-ia` off `origin/frontdoor-gate`. Built 2026-07-18 by Codex (thread 019f77c5), reviewed by Claude.

## Act 3 — Codex build
Implemented Phase 1 only.

Modified/deleted:
- `frontdoor/registry.json`
- `frontdoor/app.js`
- `frontdoor/app.css`
- deleted `download.html`

Created/copied promoted files:
- `guides/production-flow-map-v3.html`
- `systems/order-flow-automation-map.html`
- `systems/bandana-quote-bot-system-map.html`
- `planetiq/pricing-dashboard.html`
- `resources/qc-gate-checklist.html`
- `resources/bandana-blanks-ordering.html`
- `resources/customer-followup-gameplan.html`
- `resources/invoice-tracker-column-guide.html`
- `resources/2025-data-summary-and-sot-map.html`
- `resources/status-taxonomy-mock.html`
- `resources/claude-system-organization.html`
- `resources/feed-guide.html`
- `growth/photo-namer.html`

Key checks passed:
- `frontdoor/registry.json` parses.
- `node --check frontdoor/app.js` passes.
- `validate()` duplicate-id negative test passes.
- Deleted IDs are absent: `watchtower-rev`, `pipeline-dashboard`, `financial-dashboard`, `bandana-revamp`, `rh-hub-page`, `qc-invoice`.
- `command-center` and `status-simulator` are direct children of `revenue-house`.
- `graphics` is under `revenue-house`.
- `time-labor` is under `planetiq`.
- Time Clock safety stayed intact: `clock`, `timesheets-report`, and `screen-readiness` are still `access:"open"` and still point to their original `../clock/` or Google Sheet URLs.
- All relative registry URLs resolve to files.
- All current hub IDs resolve a `GLYPHS` entry.
- Existing unknown pin/recents IDs now scrub cleanly.

Deviations:
- I did not run the full browser pass. The sandbox blocked starting a local server with `PermissionError`, and the Browser runtime failed during setup with a sandbox metadata error. Static and Node invariant checks were completed instead.
- I skipped `QC_Interactive_Invoice`, `Mockup vs Real Gallery`, and `graph.html` as requested.
## Act 4 — Round 1: Claude's findings
1. Hijacked node `photo-tagger` — renamed to 'Bandana Photo Namer' and repointed at photo-namer.html. Two different tools.
2. Skipped the 'New nodes' half of work item 2 — only status-taxonomy-mock added.
3. Rail read 'Resources' twice (group label + hub name).

## Act 4 — Round 1: Codex's fixes
Fixed the three issues only.

Changed files:
- `frontdoor/registry.json`
- `frontdoor/app.js`
- `revenue-house/desks/bandana-quoting-glance-card.html`
- `revenue-house/desks/bandana-matrix-cheat-card.html`
- `revenue-house/retention/rollout-part1/index.html`

What I changed:
- Restored `photo-tagger` to `Bandana Photo Tagger`, url-less, `status: "wip"`, with the original localStorage/export warning note.
- Added separate `photo-namer` under Growth pointing to `../growth/photo-namer.html`.
- Added the three requested new nodes under Desks/Retention and copied their source files.
- Changed the rail group label back to `Library`, keeping `Resources` inside the `library` group. This was the smaller diff.

Checks passed:
- `node --check frontdoor/app.js`
- `frontdoor/registry.json` parses
- targeted node/path assertions passed

I did not re-copy `resources/status-taxonomy-mock.html`.