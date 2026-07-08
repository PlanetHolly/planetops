# Fable Build Brief 01 — The Front Door Shell

**For:** Fable · **From:** the locked design in `_planning/front-door-spec.md` (read it for the full "why"; this brief is the "what to build")
**Scope discipline:** Build EXACTLY what's in §3. Do not build anything in §7 (Deferred) — those depend on decisions not yet locked (real auth, hosting). If something here is ambiguous, stop and leave a `TODO(holly):` comment rather than guessing.

---

## 1. What this is
The **front door** to Planet Apparel's operating system: one page with a persistent left rail organized by the business's hubs, a global search, and a main pane that opens each surface. **Everything renders from a single `registry.json`** — the shell has no hardcoded content. This build is the *shell + data contract only*: the skeleton that proves the whole architecture, safe to build with zero open decisions.

## 2. Where it lives
- New folder: `planetops/frontdoor/`  (working folder name — the app's public name is still TBD: "Planet Apparel" vs "PlanetOS")
- Files: `frontdoor/index.html` · `frontdoor/registry.json` · `frontdoor/app.js` · `frontdoor/app.css` (inline is also fine if cleaner)
- **Preview locally only** (`python3 -m http.server`). Do NOT wire it into the main board nav and do NOT deploy publicly yet — public deploy waits for the real gate (Phase 2). This keeps the "not findable" promise intact.
- Mirror the **aesthetic and the fetch pattern** of the existing `revenue-house/retention/` page (brand header, `fetch('./registry.json?_='+cachebuster)`, render-from-JSON). Reuse the authentic Ø SVG logo from that page.

## 3. IN scope — build these

### 3a. The data contract — `registry.json`
The tree of the whole system. A **node** is either a `hub` (has `children`) or a `surface` (has `url`). Recursive — hubs can contain hubs. Schema:

```json
{
  "app": { "name": "Planet Apparel", "enterPin": "0000", "updated": "2026-07-08" },
  "tree": [
    {
      "id": "planetops", "kind": "hub", "group": "hubs",
      "icon": "⚙️", "name": "PlanetOps", "blurb": "Production — back of house",
      "children": [
        { "id": "floor", "kind": "surface", "name": "Floor App", "type": "live-app",
          "url": "../index.html", "domain": "Production", "status": "live",
          "access": "open", "dataSource": "Printavo GraphQL" }
      ]
    },
    { "id": "revenue-house", "kind": "hub", "group": "hubs", "icon": "🔁", "name": "Revenue House",
      "blurb": "Sales + Retention — front of house", "children": [ /* signals, retention, ... */ ] },
    { "id": "planetiq", "kind": "hub", "group": "hubs", "icon": "📊", "name": "PlanetIQ",
      "blurb": "Data · analysis · intelligence · knowledge · reporting", "children": [ /* ... */ ] },
    { "id": "systems", "kind": "hub", "group": "hubs", "icon": "🔧", "name": "Systems",
      "blurb": "Automations · system maps · standards", "children": [ /* ... */ ] },
    { "id": "training", "kind": "hub", "group": "library", "icon": "🎓", "name": "Training", "children": [] },
    { "id": "references", "kind": "hub", "group": "library", "icon": "📚", "name": "References", "children": [] }
  ]
}
```
- **Field enums:** `kind`: hub|surface · `group` (top level only): hubs|library · `type`: live-app|dashboard|system-map|tool|report|reference|training · `status`: live|stale|wip|planned · `access`: open|pin.
- **Seed `registry.json` from Appendix A below** — it is the locked node list (no judgment calls needed). Structure already folds Daily Ops → PlanetOps and PlanetGrowth + The Brain + Reports → PlanetIQ. `file://`-stranded apps carry `"status":"wip"` and no `url` (tile renders unclickable with a "not yet deployed" hint).
- **Drive-sheet rule:** load-bearing Google Sheets appear as tiles of type `report`, `url` = their docs.google.com link, `dataSource` noting what reads/writes them. They are part of the system picture, not clutter.
- **PIN guardrail:** `enterPin` stays `"0000"` forever in this file. `registry.json` is client-readable — the REAL pin must NEVER be stored here, even after launch. Real enforcement arrives in Phase 2 with the hosting decision.
- **Registry validation (required):** on load, validate the registry — unique `id`s, legal enum values, hubs have `children` array, surfaces have `name`. On failure, render a loud error banner naming the offending node instead of a half-empty app.

### 3b. Layout (Printavo/QuickBooks-style)
- **Top bar:** brand (Ø + app name) · **global search box** (center) · a **📌 Pinned** area.
- **Left rail (persistent):** two labeled groups — **HUBS** then **LIBRARY** — each listing its top-level hubs with icon + name. Clicking a hub loads it in the main pane. Rail stays put on every view.
- **Main pane:** shows the selected hub as a page of **surface tiles** (reuse the retention-page tile look: name · type · status badge). Clicking a surface tile opens its `url` in a new tab. A hub containing sub-hubs shows those as tiles too (recursive).
- **Breadcrumb** at the top of the main pane (e.g., `PlanetOps › …`), clickable back up the tree.
- **Brand:** black header, gold Ø (reuse the SVG), accent `#F7BE00` (accent only, never body). Light theme. Responsive (rail collapses to a top menu under ~820px).

### 3c. Behaviors
- **Render entirely from `registry.json`.** No hardcoded hubs/surfaces in the HTML.
- **Global search:** type-ahead over every node's `name` (and `blurb`); results jump to that hub or open that surface. (v1 = the index only — NOT invoice/document search; that's deferred.)
- **Pinned favorites:** user can pin any hub/surface; persist in `localStorage`. (Preference only — safe to use localStorage here.)
- **Status badges** on surface tiles from `status` (live=green, stale=amber, wip=slate, planned=blue) — reuse the retention page's badge styles.
- **Enter-PIN screen (PLACEHOLDER ONLY):** on load, show a simple PIN entry; accept `app.enterPin` from the registry; then reveal the app. **Add a visible code comment: `// PLACEHOLDER GATE — not real security; real enforcement in Phase 2 once hosting is chosen.`** Do not represent this as secure.

## 4. Reference implementation
Copy patterns directly from `revenue-house/retention/index.html`: the `fetch` + cache-buster, the `el()`/`esc()` render helpers, the brand header + Ø SVG, the badge CSS, the tile CSS. Consistency with that page is a goal.

## 5. Acceptance criteria (all must pass)
1. Opening `frontdoor/index.html` (served) shows the PIN placeholder; correct PIN reveals the app.
2. Left rail shows HUBS (PlanetOps · Revenue House · PlanetIQ · Systems) and LIBRARY (Training · References), all from `registry.json`.
3. Clicking a hub renders its child surfaces as tiles in the main pane, with correct status badges; clicking a surface opens its `url` in a new tab.
4. Sub-hubs render recursively (a hub inside a hub works).
5. Search finds any hub/surface by name as you type and navigates to it.
6. Pinning a surface adds it to the Pinned area and survives reload.
7. Zero console errors. Renders cleanly light-theme, and is usable on a phone-width screen.
8. Nothing is hardcoded that should come from `registry.json`.
9. A deliberately corrupted registry (duplicate id / bad enum) produces a loud, named error banner — never a silently half-rendered app.

## 6. Verify before calling it done
Serve locally, drive it in a browser, screenshot the rail + a hub view, confirm the 9 criteria, check console is clean.

## 7. DEFERRED — do NOT build in this pass
- Real authentication / real PIN enforcement / individual logins (waits on the hosting decision + a Codex review).
- Hosting migration (GitHub Pages vs Railway) — undecided.
- Live status/alarms wired to n8n or Drive (this pass uses static `status` values in the registry).
- Invoice search (Printavo) / document search (Drive).
- Deploying the stranded `file://` apps onto the web.
- Wiring the front door into the main board's nav, or public deployment.

---

## Appendix A — Registry seed (locked; transcribe, don't judge)

URLs are relative from `frontdoor/`. `wip` = stranded on file://, no url. Compiled from the 2026-07-07 three-lane research.

### ⚙️ PlanetOps (hub, group:hubs) — "Production — back of house"
| name | url | type | status | dataSource |
|---|---|---|---|---|
| Floor App (Board · Pre-Press · Running · Reports · Fulfillment) | `../index.html` | live-app | live | Printavo GraphQL + Railway state-api |
| Schedule Board | `../schedule/` | live-app | live | Railway /webhook/estimate |
| Production Availability (capacity gauge) | `../capacity/` | dashboard | live | Power Scheduler CSV (/gauge skill) |
| Project Estimator | `../estimator/` | tool | live | — |
| Priority Production (internal quick ref) | `../priority-guide/` | reference | live | — |
| Rush Windows (customer-facing) | `../rush/` | reference | wip *(untracked, not pushed)* | — |
| Box Guide | `../boxes/` | reference | live | — |
| Production Flow Map v3 | — | system-map | wip | Dropbox `PlanetApparel/PlanetOps/Production_Flow_Map_v3.html` |
| Graphics Suite (Dashboard · NewRequest · OrderDetail · Templates · Mockup Studio) | — | tool | wip | Dropbox `PlanetApparel/Graphics/` |
| QC Interactive Invoice (Malia trainer) | — | tool | wip | Dropbox `PlanetApparel/QC/QC_Interactive_Invoice.html` |
| **Sub-hub: Time & Labor (Daily Ops)** — Time Clock `../clock/` (live-app, live) · Timesheets Report `../clock/report.html` (report, live) · Team Admin `../clock/admin.html` (tool, live, access:pin) · Screen Readiness Tracker (report, live, url = Drive sheet `1PTs5sCXSBlhQ6G6j4jgSXcmcJjMEyhGDc7mN6K2QNmo`, Jean) |

### 🔁 Revenue House (hub, group:hubs) — "Sales + Retention — front of house"
| name | url | type | status | dataSource |
|---|---|---|---|---|
| Revenue House hub page | `../revenue-house/` | dashboard | live | — |
| Planet Sales Signals | `../signals/` | dashboard | live | `signals/scoreboard-data.json` ← Drive SoT `1PkA3UbiA0fmpwaAj6nRbuEzq2nrK9NhueELhBA4OhQM` |
| Retention — Live System Map | `../revenue-house/retention/` | system-map | live | `status.json` (hand-maintained) |
| The Save Touch (team playbook) | `../save-touch/` | reference | live | — |
| Bandana Shipping Estimator | `../ship-estimate/` | tool | live | — |
| Retention — Master Script Registry | Drive sheet `1Psd0SAm9OhpRVT-YYVf3h8r_xVxWVwoEhHxyAio_1xc` | report | live | governs retention n8n fleet |
| Sales Pipeline Dashboard | — | dashboard | stale *(3/17; superseded by signals)* | Dropbox `Sales/Dashboard/` |

### 📊 PlanetIQ (hub, group:hubs) — "Data · analysis · intelligence · knowledge · reporting" *(Financials PIN zone: access:pin on the financial children)*
| name | url | type | status | access | dataSource |
|---|---|---|---|---|---|
| PlanetIQ Panel | `../planetiq/` | dashboard | live | pin | `datalayer.json` / `chartseries.json` |
| Bandana Pricing Dashboard | — | dashboard | wip | pin | Dropbox `Pricing/pricing-dashboard.html` (awaits DATA) |
| KPI Tracker | Drive `1XQNS-93GLZxPYxK15xYIqKeF-Yv6P9jCuvC2rbnANjQ` | report | live | pin | person-driven |
| PlanetIQ Data Layer | Drive `1lvJ28bcid3e8FYNrT44bSbtxi_5U53QxdISiW95JuF0` | report | live | pin | Sheet→snapshot→page |
| Planet Pulse Invoice Tracker (Kelly, AR) | Drive `1FT9vqCUD5MOyxjt30q8wQ5PumgdeXj7FtgP5ObdYX8U` | report | live | pin | month-end close automation |
| Employee Order-Payment Tracker (Kelly) | Drive `1ElBiBXlBkwl5V5rFpIZOMtJsHPey3sc_7eJRs4xqOZU` | report | live | pin | — |
| Financial Dashboard | — | dashboard | stale *(4/29; superseded by PlanetIQ)* | — | — |
| **Sub-hub: Growth (was PlanetGrowth)** — Bandana Design Templates `../bandana-templates/` (tool, live) · Bandana Revamp `../bandana-revamp/` (reference, stale) + Website Pricing `../bandana-revamp/website-pricing.html` (reference, live) · Photo Tagger (tool, wip, Dropbox) · Mockup-vs-Real Gallery (tool, wip, Dropbox) |
| **Sub-hub: The Brain (knowledge)** — Graphify Knowledge Graph (system-map, wip, Dropbox `Claude_Holly/Knowledge_Graph/`) · Agentic OS Dashboard/Projects/Architecture (dashboard, wip, Dropbox `_Claude/AgenticOS/`) · Decisions (owner-only; placeholder hub, planned) |

### 🔧 Systems (hub, group:hubs) — "Automations · system maps · standards"
| name | url | type | status | dataSource |
|---|---|---|---|---|
| Order Flow & Automations Map | — | system-map | wip | Dropbox `PlanetApparel/Printavo_Automations/Order_Flow_Automation_Map.html` |
| Bandana Quote Bot — System Map | — | system-map | wip | Dropbox `Sales/Bandana_Quote_Automation/System_Map/` |
| PlanetPulse (SoT explainer) | `../planetpulse/` | reference | live | — |
| PlanetPulse Audit Guide | `../planetpulse-audit/` | reference | live | — |
| Printavo Hashtag Standard | `../hashtags/` | reference | live | — |
| State API (floor-board persistence) | — | reference | live *(backend; no page — tile links nowhere, note-only)* | Railway Postgres |
| Invoice Tracker TEST (sandbox) | Drive `1-UEkjoamvt6p2tdf6vVETBwO3Nh7yNZTeM-3AE18muA` | report | wip *(sandbox — label clearly)* | n8n invoice automation |

### 🎓 Training (hub, group:library)
| name | url | type | status |
|---|---|---|---|
| QC Gate Checklist | — | training | wip *(Dropbox Training/Internal/QC_Gate/)* |
| Bandana Blanks — Ordering Workflow (Malia) | — | training | wip *(Dropbox Training/Internal/)* |
| Claude System Organization ("How We're Organized") | — | training | wip *(Dropbox Training/Internal/Claude_Setup_Status/)* |
| Customer Follow-Up Game Plan | — | training | wip *(Dropbox Sales/Customer_Retention/Team_Materials/)* |

### 📚 References (hub, group:library)
| name | url | type | status |
|---|---|---|---|
| File Naming & Folder Guide | `../file-naming/` | reference | live |
| Feed Guide (PlanetIQ feed folders) | — | reference | wip *(Dropbox PlanetIQ/Feed/)* |
| Invoice Tracker — Column Guide | — | reference | wip *(Dropbox PlanetIQ/Month_End_Close/)* |
| 2025 Annual Data Summary & SoT Map | — | reference | wip *(Dropbox PlanetIQ/Annual_Data_Summary/)* |

Drive-sheet URL format: `https://docs.google.com/spreadsheets/d/<ID>/edit`.
