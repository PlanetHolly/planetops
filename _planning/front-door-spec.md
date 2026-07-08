# Planet Apparel — The Front Door (working name: TBD)

**Status:** Planning / design-lock in progress · Started 2026-07-07
**Builder:** Fable (executes from this locked spec) · **Reviewer:** Codex (adversarial stress-test before build) · **Owner sign-off:** Holly
**Rule:** Nothing gets built until this spec can't wobble. Planning stage is deliberately over-invested — this is foundational and must be built to last.

---

## 1. What this is (the definition)

The **single front door to Planet Apparel's whole operating system** — one internal web app that indexes every operational "surface" (live apps, dashboards, system maps, tools, reference guides) the business runs on, organized by the **9 business domains**, behind a gate so it is private (not public/findable).

It is **NOT** a rewrite of anything. It is an **additive navigation + status layer** over surfaces that already exist. The Printavo API integrations, n8n automations, and the PlanetOps floor app keep working exactly as they do today — the front door links to and reports on them; it does not replace them.

The problem it solves (found in the 2026-07-07 research sweep):
- ~55 operational surfaces scattered across public GitHub Pages, local `file://` Dropbox HTML, and Google Sheets.
- ~13 orphan pages reachable only by a known URL; ~10 real apps stranded on `file://`.
- A drifting PA Docs bookmark registry (hybrid github.io + file:// links, points at a dead build).
- The app being publicly findable (privacy concern).

### The model — 3 tiers on a data layer
1. **Home / Control Tower** — one page, left-rail by 9 domains, every surface a tile showing *what it is · live or stale · any alarm.* Alarms bubble to the top. Replaces the bookmark registry. ← the new build
2. **Domain hubs** — a wing per domain that earns one. Planet Sales is the first (built 7/7); the Floor App already is one.
3. **System maps** — the deep, alarm-driven view of one system. **Retention (`revenue-house/retention/`) is the built template.** Order-Flow map, Production-Flow map, Bandana-Bot map become its peers.
4. **Data layer underneath** — Google Sheets + sibling JSONs feed the web apps; the hub links each app to what feeds it.

### Interface reference
Printavo's left rail: a **grouped "key"** (GENERAL / EXTRAS / FINANCIALS, each with items), persistent on every screen, main content on the right. Ours = the 9 domains as the grouped key.

---

## 2. LOCKED decisions (as of 2026-07-07)

- **[LOCKED] Organizing principle** = the 9 domains: Daily Ops · Sales Ops · Systems · PlanetGrowth · Deliverables · PlanetIQ · Production · The Brain · Decisions. (Matches bookmarks, Agentic OS, how Holly thinks.)
- **[LOCKED] Navigation** = Printavo-style persistent **left rail**, grouped by domain, sub-sections under each; main pane loads the selected surface.
- **[LOCKED] Access model = two PINs, no logins (v1):**
  - **PIN #1 — universal, to enter the app.** Type once, session lasts the workday. Solves "private / not findable." Rotate the one PIN if someone leaves.
  - **PIN #2 — separate, tighter, on Financials & Reporting only.** The one zone with a second lock.
  - Deliberately NO per-person role matrix (Holly: "don't overcomplicate"). The gate is a **seam** — individual logins can be swapped in later without a rebuild if audit/per-person revoke is ever needed.
- **[LOCKED] Resilience / self-watching (build in from day one):**
  - `/health` endpoint (app up? DB reachable? data sources responding?).
  - Heartbeat that pings it and, on failure, posts *what + why* to the existing **🚨 System Alerts** space (reuses the Fix-Agent/alert pattern).
  - **Admin status page** inside the app: green/red for app, DB, and each feed (Drive sheets, n8n).
  - One-click **rollback** to last-good deploy = easy repair.
  - Boring/standard tech underneath (static pages + thin server) so little *can* break.
- **[LOCKED] Source of truth** = GitHub **private** repo (hides code, keeps push workflow). Repo stays canonical per `feedback_planetops_canonical_source`.
- **[LOCKED] Everything is a hub or a surface — a recursive tree of hubs.** Hubs lead to hubs or surfaces, all the way down (PlanetOps → floor tools; Planet Sales → Signals/Retention; Systems → automation maps). **ONE hub template, reused at every level** — Fable builds it once; `registry.json` defines the tree; adding a hub/surface = one entry. This is the built-to-last core.
- **[LOCKED] Global search bar (first-class, top of every screen)** — QuickBooks-style. Type-ahead find across the whole system. Scope, staged: v1 = search the hub/surface index (jump to any page instantly); later = invoice search (Printavo) + document search (Drive). Holly: "100% a search bar is needed."
- **[LOCKED] Top-level rail** (each item is itself a hub):
  - **HUBS:** ⚙️ PlanetOps (Production — *back of house*) · 🔁 **Revenue House** (Sales + Retention — *front of house*) · 📊 **PlanetIQ** (the data + analysis + intelligence + knowledge + **reporting** center — absorbs BI + PlanetGrowth + The Brain + Reports; 🔒 Financials PIN lives here) · 🔧 Systems (automations/infra)
  - **LIBRARY (shared across all):** 🎓 Training · 📚 References
  - Consider a **Pinned/Favorites** shelf (QuickBooks-style) so each person pins their most-used hubs.
- **[LOCKED] Build sequencing = staged, NOT big-bang (per boardroom 2026-07-07).** Do not migrate hosting + add auth + build the hub all at once during ship week. See §5.

---

## 3. OPEN locks (still to resolve before build)

- **[OPEN] Name — the whole app** — candidates: Command Center · elevate "PlanetOps" as umbrella · Mission Control / The Bridge. Holly's call.
- **[RESOLVED] Data/analysis hub name = PlanetIQ** (2026-07-07). It owns BI + PlanetGrowth + The Brain + Reports. Financials PIN lives here.
- **[RESOLVED] Reports** = folded into PlanetIQ (not a standalone Library item).
- **[RESOLVED] Sales/Retention hub name = Revenue House** (2026-07-07). Holly's restaurant metaphor organizes the whole system: **Revenue House = front of house** (customer/sales side), **PlanetOps = back of house** (production). Folder renamed to `revenue-house/` 2026-07-08 (pre-push, so no live URLs broke).
- **[RESOLVED] Stragglers (2026-07-07):** Daily Ops → folds into PlanetOps · Decisions → folds into PlanetIQ (owner-only) · Deliverables → out of scope for v1.
- **[OPEN] Sub-section "shelf" taxonomy** — the repeatable set of sub-sections every domain gets (e.g., Dashboards · Tools · Reports · System Maps · References · Training). A consistent, repeatable pattern = built to last (prevents each domain becoming a junk drawer).
- **[OPEN] Landing view** — where a person lands when they open the door (a global home vs. per-audience default).
- **[OPEN] Governance / anti-rot** — how a new surface registers and how the hub stays fresh. Proposed: ONE `registry.json` is the single source of truth (domain · type · status · access-level · data-source per surface); the hub renders from it; adding a surface = one entry. This is what retires the drifting bookmark file. Confirm + define the "who updates it, when" ritual.
- **[OPEN] Data-layer linking** — each app tile links to the Sheet/JSON that feeds it (so you see the plumbing, not just the faucet).
- **[OPEN] Which surfaces deploy first / which stranded `file://` apps get pulled onto the web** — prioritization pass.
- **[RESOLVED] Hosting = Railway** (2026-07-08, boardroom 5–0 after the Codex-approved gate plan; Cloudflare Access documented as a possible LATER layer if the team grows past ~15, not rejected). Gate design = `PLAN.md` (root), survived 3 Codex rounds (26→7→0); argument transcript `PLAN-REVIEW-LOG.md`. The review also surfaced P0 live credential exposure (state key, ShipStation, ?k= admin keys) — the gate build is the structural fix.
- **[ROADMAP · Phase 3] Shipping Center (PlanetOps)** — connect EasyPost so the team ships directly from the app: create label → print → (eventually) auto-email the client from a future notification center. Captured 2026-07-08 from Holly; NOT part of Phase 2.

---

## 4. Surface inventory (the parts list — from 2026-07-07 research)

~55 surfaces. Legend: ● live web (github.io) · ◆ stranded on file:// · ▲ data-sheet (Drive) · ○ orphan/stale

| Domain | Surfaces |
|---|---|
| **Production** | ● Floor App (root cockpit) · ● Schedule · ● Availability/capacity · ● Estimator · ○ Box Guide · ○ Priority-Guide / Rush · ◆ Production Flow Map v3 · ◆ Graphics mini-app (Dashboard/NewRequest/OrderDetail/Templates/Mockup Studio) · ◆ QC Interactive Invoice · ▲ Screen Readiness (Jean) · ▲ AutoPress IPH (stale) |
| **Daily Ops** | ● Time Clock (kiosk) · ● Timesheets Report (Kelly) · ● Team Admin · ▲ Planet Pulse Invoice Tracker (Kelly) · ▲ Employee Order-Payment Tracker (Kelly) |
| **Sales Ops** | ●N Planet Sales hub · ● Signals + ▲ Signals Data Layer SoT · ●N Retention Map + status.json + ▲ Retention Master Script Registry · ○ Save Touch · ● Ship Estimator · ○ Sales Pipeline Dashboard (stale) |
| **Systems** | ◆ Order-Flow Automation Map · ○ Hashtag Standard · ○ File-Naming Guide · ○ PlanetPulse + PlanetPulse Audit · ● State API (backend) · ◆ Agentic OS dashboard/projects/architecture · ◆ Bandana Quote Bot System Map · ▲ Invoice Tracker TEST (sandbox) |
| **PlanetIQ** | ○ PlanetIQ Panel · ◆ pricing-dashboard · ▲ PlanetIQ Data Layer · ▲ KPI tracker · ○ Financial Dashboard (stale) · datalayer.json / chartseries.json · guides (Feed, Invoice Tracker Column, 2025 Data Summary) · PlanetIQ Overview deck |
| **PlanetGrowth** | ○ Bandana Design Templates · ○ Bandana Revamp cluster (+ website-pricing) · ◆ Bandana Photo Tagger · ◆ Mockup-vs-Real Gallery |
| **The Brain** | ◆ Graphify Knowledge Graph · PA Docs bookmark registry (the thing this replaces) · Command_Center.md / Home.md (Obsidian MOCs) |
| **Decisions** | ○ Strategic Financial Review (stale deck) |
| **Deliverables** | (client-facing outputs — out of scope for v1) |

Duplicates to reconcile (exist in 2 places): Estimator, Schedule, File-Naming, Retention map (Dropbox vs new page), PlanetIQ/Financial dashboards.

---

## 5. Staged build plan (boardroom-blessed 2026-07-07)

- **Phase 0 — this week, cheap + reversible:** put the *current* site behind a gate so it's no longer public/findable (the universal PIN wall) + stand up the front-door **skeleton** (9-domain left-rail shell + `registry.json`). Kills the two real fears (findable, scattered) now. Does NOT force the Railway migration.
- **Phase 1 — deliberately, with runway:** build out the hub from this locked spec — tiles, status, alarms, the financial PIN zone, data-layer links.
- **Phase 2 — only if/when needed, isolated:** Railway hosting migration (one variable, reversible). Or upgrade the PIN gate to individual logins.

Board's core finding: the front door is directionally right and low-risk to what works (Printavo/n8n untouched); the only caution is **timing + bundling** — stage it, don't big-bang it mid-sprint.

---

## Decision log
- 2026-07-07 — Access = two PINs, no logins (universal entry + financial). Hosting migration deferred/staged. Resilience/self-watching required from day one. Organizing = 9 domains. Nav = left-rail. Build staged, not big-bang (boardroom). Source = private GitHub repo.
