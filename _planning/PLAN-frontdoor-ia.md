# PLAN — Front Door: organize the files, fix the home page, finish the icons

**Status:** LOCKED pending final go. Updated 2026-07-18 with Holly's decisions.
**Scope:** `frontdoor/registry.json` · `frontdoor/app.js` · `frontdoor/app.css` — plus copying stranded
tool files into the repo. **The Board dashboard (`index.html`, ~7700 lines) is the NEXT session.**

**Build location:** a fresh worktree off **`origin/frontdoor-gate`**. Not the local `frontdoor-gate`
pointer (14 commits stale, held by an abandoned session scratchpad), and no branch switching in any
existing clone — another session is live in `~/github/planetops`.

---

## What the audit measured

75 surfaces / 17 hubs · 50 live · 22 wip · 3 stale.

- **The 19 url-less surfaces are a PROMOTE BACKLOG, not dead tiles.** 13 already carry the note
  `"stranded on file:// — Dropbox …"`. They are finished tools that exist only on Holly's Mac.
- **Command Center was buried, not missing** — 3 levels down inside a 24-row flyout.
- **Icons were already 94% done** — 87 hand-built SVG glyphs, 6 emoji stragglers.
- **The home "⚠️ Needs attention" board shows registry metadata, not business signal.** Its flags are
  derived from `status` fields, so the 3 permanent amber chips are just 3 files marked `stale`.
- **The home Feed card is dead** — targets `feed-upload` (doesn't exist) → falls back to url-less
  `feed-guide` → clicking reloads home.
- Bugs: glyph key `signals` defined twice · `Watchtower` = 2 nodes on 1 URL · 2 nodes both labeled
  "Bandana Quote (desk)" · `download.html` is 0 bytes.

---

## From Holly's screen-share walkthrough (2026-07-18) — APP-WIDE, not one section

> *"Implement everywhere if you can, not only the section I covered."* These are **rules**, applied to
> every hub and every flyout, not one-off fixes.

### P1. Every hub gets a LANDING PAGE — the biggest new item
Today a top-level hub click routes home; hubs have no pages. Holly wants a hub click to open a
**dashboard in the Command Center pattern** (`revenue-house/command/`): dark hero band naming the hub,
then a tile grid where each tile carries an **icon + a live count + a one-line "what's in here."**
Her words: *"a production command center… a little bit more indication of what is in each thing."*

- Build **one reusable hub-landing template**, driven by the registry — not six hand-built pages.
- Counts come from the registry itself (how many live surfaces in each child group) so no new backend.
- Applies to **all** top-level hubs: Production, Revenue House, PlanetIQ, Systems, Resources.
- This supersedes plan constraint "hubs have no pages" — it is now a deliberate build, and it means
  `renderPane`'s hub branch stops calling `navHome()`.

### P2. A flyout must never echo its own parent
Hovering **PlanetOps** shows "PlanetOps" as the first flyout row; hovering **The Floor** re-shows
"The Floor." *"I know I'm in the floor… the first thing should be the Scheduler."* Drop the
redundant self-row in every flyout and cascade.

### P3. Drilling right collapses what's behind it
*"When anything is chosen to the right of any of these flyouts, the hub should just disappear…
it should collapse."* Once a cascade column opens to the right, the parent column gives up its space.

### P4. Display renames (ids stay frozen)
- **PlanetOps → "Production."** *"That's where everything production goes."* Display name only; id
  stays `planetops`, so glyphs, the rail map, and `#/planetops/floor/schedule` all keep working.
- **Library hubs → "Resources."** Holly: *"Resources is good. It's universal."* Training + References
  merge into one universal, cross-functional **Resources** hub.
- **Guides stays inside Production**, scoped to production SOPs only — the two are different things.
  *(Interpretation — confirm: Training folds into Resources rather than staying separate.)*

### P5. Two hubs are in the wrong house
- **Graphics is NOT production** — *"graphics is a tool for our sales team… under the sales umbrella."*
  Moves to **Revenue House**.
- **Time & Labor is NOT production** — Holly confirmed it belongs under **Financials** (PlanetIQ).
  🔴 **DANGER — its children are NOT finance-gated, and must NOT become so.** Only `team-admin` is
  `access:"pin"`; `clock`, `timesheets-report`, `screen-readiness` are `open`. The registry *move* is
  access-safe (ids, access flags and `../clock/*` urls all travel unchanged). Two ways to break it:
  (a) "correcting" the children to `access:"pin"` — **that locks the floor time-clock kiosk behind the
  finance PIN**; (b) physically moving clock files under `/planetiq/`, which finance-gates them by URL
  prefix (`FINANCE_PREFIXES`, gate/index.js:53). **Move the registry node only. Never move the files.**

### P6. Merge the duplicate QC entries
QC Gate and the QC Interactive Invoice trainer are now the same thing — keep the latest, drop the
other. QC itself stays where it is: Holly calls it *"the bridge between sales and production."*

### P7. Duplicate display names are a defect class
⚠️ **CORRECTION:** the two **"🔒 Financials"** rows are **NOT a bug** — that is `safeName()` masking
applied to multiple `access:"pin"` siblings on a shared device. Working as designed; leave it alone.

The real duplicates are **"Bandana Quote (desk)" ×2** and **"Watchtower" ×2**, both already fixed by
work item 1. Add a duplicate-display-name check as a **non-blocking warning** — a separate `warnings`
array → `console.warn` / soft banner, **never** the `errs` array, because any entry in `errs` makes
`showRegError` refuse to render the whole app (app.js:637-648). A sequencing mistake must not brick
the front door.

---

## Holly's decisions (locked)

| # | Decision |
|---|---|
| 1 | **Keep the existing 6 hubs.** The 9-domain re-spine was approved, then reversed — *"I like the hubs we have. We can add more but I like them. The other files need organization."* |
| 2 | **Add an `Inventory` hub** under PlanetOps — Jean's bandana board has no home. |
| 3 | **Widen `APPROVED_EXTERNAL`** to the n8n Railway host so that board can be registered. |
| 4 | **Pickup & Delivery = build NEXT pass**, not this one. It exists nowhere today. |
| 5 | Discoverability via **seeded default pins**, not a new home row. |
| 6 | `brain-incoming-board` pushed to origin ✅ done · bandana-quote edit committed ✅ (by another session) |

---

## Hard constraints (from the code — violating these breaks the app)

1. 🔴 **Hub IDs are FROZEN. Only display `name` changes.** `GLYPHS` (87 entries) and `RAIL_LABEL` are
   keyed to registry ids; renaming an id silently drops icons to emoji and kills hub deep links.
   `#/planetops/floor/schedule` — the team's memorized link — resolves through those ids.
   **This is what makes P4 and P5 safe:** renaming PlanetOps→Production and moving Graphics/Time &
   Labor are *presentation* changes; every id and url travels unchanged.
2. **Home has no "house tiles."** `renderHome` is flag board → pins → recents → Feed → Browse.
3. ~~**Hubs have no pages.**~~ **SUPERSEDED by P1** — hubs now get landing pages. The old behavior
   (top-level hub click → `navHome()`) is the thing being replaced. Sub-hub → first embeddable child
   still stands.
4. **Pins, recents, search and finance-masking all key on `node.id`.** No second node may represent
   the same surface — it splits pins and can bypass finance masking on a shared device.
5. **Icon house color goes on an OUTER RING, never a circle tint.** The `#232323` circle is what makes
   the glyphs pop, and most glyphs use `#232323` interior detail as cutouts against it.

---

## The work

### 1. Fix the four measured defects
Delete the duplicate `signals` glyph key · collapse the two `Watchtower` nodes to one (keep it under
Systems) · delete the 3 `stale` nodes · delete the 0-byte `download.html` · rename one of the two
"Bandana Quote (desk)" nodes to **"Bandana Price Lookup."**

### 2. Organize the files — the main event
Copy each stranded tool into the repo and give its existing registry node a real `url`.

**Clean copies (13):** Production Flow Map v3 → Guides · QC Interactive Invoice → QC · Order Flow map
+ Quote Bot system map → Systems · pricing-dashboard.html (402KB) → PlanetIQ · QC Gate Checklist,
Bandana Blanks Ordering, Customer Follow-Up Game Plan → Training · Invoice Tracker Column Guide, 2025
Data Summary → References · **`taxonomy_mock.html` → References** · photo-namer → Growth.

**New nodes (5):** Shara's two bandana cheat cards → Desks · Retention rollout deck → Retention
(fill its `[GO-LIVE DATE]` placeholder first) · Shara bot overview → Desks, **held until MARK is live**.

**Needs repair before promoting (2):** `Mockup_vs_Real_Gallery` — images are hardcoded absolute
`file:///…` paths, so images must be moved into the repo and srcs rewritten. `graph.html` (Graphify) —
loads its library from unpkg CDN, must be vendored.

**Deliberately held:** **Jean's `Bandana_Board_Preview.html`** is wired to **SANDBOX** v2 webhooks.
It gets the new `Inventory` hub and a registry node, but **promotes at v2 cutover with prod URLs
swapped** — not before.

**Stop maintaining:** Dropbox `QC_Gate_Form.html` is byte-identical to repo `qc/index.html`;
`icon_preview.html` already shipped as the Status Simulator.

### 3. Revenue House — regroup so each group means one thing
✅ **RESOLVED 2026-07-18 (Holly):** Watchtower belongs to **Systems**, not here — the Command Center
is the *retention* command center; Watchtower watches every engine in the business. The Revenue House
copy (`watchtower-rev`) is **deleted**; the Systems node (`watchtower`) is the single survivor.
With Watchtower gone, Command Center is **not** a sub-hub — it becomes a **direct child** of Revenue
House (Holly's original one-click complaint), with Status Simulator beside it.

⚠️ Known and accepted: the nav will say Systems while the URL still reads
`../revenue-house/command/#/activity`, because Watchtower physically lives inside the Command Center
app. Splitting it into its own app is a **build**, deliberately deferred.

```
revenue-house
├─ command-center          → ../revenue-house/command/            "one click, was 3 levels deep"
├─ status-simulator        → ../revenue-house/command/#/simulator
├─ signals                            "the score"
├─ desks (+ ship-estimate, bandana price lookup, Shara's cards)   "quote it here"
├─ retention (save-touch, playbook, map, registry)                "keep the customer"
└─ pricing (finance-locked, + revenue-discovery)                  "the money math"
```
**Removed:** `rh-hub-page` (a hub inside a hub whose own tiles say "Superseded") and
`pipeline-dashboard` (stale, superseded by Signals).

Making Command Center a sub-hub reuses the existing side-nav pattern (what The Floor uses), so it
opens with Watchtower and Simulator in a left rail. **Zero new UI code.**

### 4. Home page — show things, not just links
New section order: welcome band with the health dot inline → **live signal row** → real attention
flags (red/amber only; the wip drawer moves out) → Quick access (pins + recents) → Browse → Feed card.

Signal row, honest about cost:
- **Free** (already fetched): state-API health.
- **One client fetch each, no backend work:** Watchtower open-incident count (`watchtower-flightlog`,
  short timeout, fail silent — its sibling activity feed has a 15–40s cold assemble, so do **not**
  call that one) and this week's sales from `signals/scoreboard-data.json`.
- **Not in this pass:** open A/R, unshipped-past-due, today's arrivals. The gate already declares
  server-side enrichment of `/api/home/summary`, and the client renders any flag the server emits with
  a "Go →" attached — so these arrive later with **zero front-door changes**.

**Fix the dead Feed card** — point it at a real target or remove it until `feed-upload` ships.

### 5. Seeded default pins
Seed `PINS_KEY` when localStorage is empty; the 📌 toggle still governs. Per-device is correct —
Kelly's daily ≠ Holly's daily ≠ the floor kiosk.
**Board · Scheduler · Command Center · QC Gate · Signals · Availability · Bandana Quote desk ·
Apparel Quote desk.**
Excluded on purpose: Time Clock (already a topbar button), Watchtower (exception-driven — the flag
board rings when it matters), Invoice Tracker (finance-locked).
Unknown/deleted ids in existing pins and recents must drop cleanly, not crash — `financial-dashboard`
is pin-access *and* stale, so it is in real pin lists today.

### 6. Full-screen flag
New registry property `"display": "fullscreen"`, honored in `openNode()` → routes through `openUrl()`
instead of `navTo()`. Applied to: **Board · Scheduler · Ship Board · Time Clock · Command Center ·
Capacity.** Time Clock is a kiosk and should never wear shell chrome; Command Center currently runs
its own hash router inside an iframe inside the shell's hash router.

### 7. Icons — finish and tune
Build the 6 missing glyphs in the existing flat-SVG style · house color as a 2px **outer ring**
(Production `#F7BE00` · Revenue House `#10b981` · PlanetIQ `#38bdf8` · Growth `#34d399` ·
Systems `#a78bfa` · library `#fbbf24`) · every yellow-glyph icon checked against the yellow ring at
the smallest badge size · min stroke 1.6.

### 8. Dead-end hygiene
Any surface still without a url after the promotes sorts into a dimmed **"In the works"** group at the
bottom of its flyout and Browse body, ranks last in search, and is hidden from section side-navs.

---

## Acceptance check
1. `registry.json` parses · `node --check` clean · `validate()` shows the loud banner when fed a
   fixture with a duplicate id (**negative test**, not just "it passes").
2. Every live url reachable before is reachable after. Deletion whitelist: `watchtower` (dup),
   `pipeline-dashboard`, `financial-dashboard`, `bandana-revamp`, `rh-hub-page`.
3. Every registry id that had a `GLYPHS` key before still has one after.
4. **Zero emoji fallbacks** — `iconInner` resolves an SVG for every node present.
5. Command Center is **one click** from the Revenue House flyout and appears in seeded pins on a
   fresh profile.
6. Every promoted file opens and renders inside the shell — **each one clicked, not assumed.**
7. Training and References contain zero url-less entries.
8. `#/planetops/floor/schedule` still lands on Scheduler.
9. Finance surfaces still render masked before unlock; recents still scrub finance.
10. A localStorage pin list containing a deleted id loads without crashing.
11. Full-screen nodes open standalone; all others still embed.
12. Driven in a **real browser, not headless** — every hub, flyout and promoted page opened, no
    console errors.

## BUILD SEQUENCE — two phases (added after adversarial review)

Every Phase 1 item is mechanical once the corrections above land. Every Phase 2 item needs a design
decision. Shipping them together makes the file organization — Holly's stated "main event" — wait on
hub-landing CSS debates.

### Phase 1 — registry, files, cheap UI (ships first)
Item 1 defects · item 2 promotes (13 clean copies; the 2 repair cases may slip) · item 3 Revenue House
regroup + Command Center sub-hub · **P2** flyHead removal (one line, both cascades) · **P4** renames +
Training/References → Resources · **P5** moves (registry node only) · **P6** QC merge · **P7** warnings
channel · item 5 seeded pins · item 8 dead-end hygiene.

### Phase 2 — new UI surface area
**P1** hub landing pages · item 4 home signal row · **P3** flyout collapse · item 6 fullscreen flag ·
item 7 icon outer-rings + all new glyphs.

### Open decisions blocking Phase 2
1. ✅ **RESOLVED — Watchtower lives in Systems** (see item 3). `watchtower-rev` is deleted, not
   `watchtower`. Holly also wants **Watchtower featured on the home page** — its open-incident count
   is the Phase 2 signal-row headline. Design note: it must be **quiet at zero and loud when it isn't**;
   a permanently-lit chip trains people to ignore it, which is what happened to the 3 stale amber flags.
2. **P1 render target** — shell-rendered DOM in `#pane` via a new `renderHubLanding(node)`, NOT an
   iframe (hubs have no url, and an iframe'd page would have to re-implement finance masking). The
   Command Center is a **visual** reference only.
3. **P1 entry point** — today *nothing* navigates to a top-level hub: rail click opens the flyout
   (app.js:291) and the flyout's self-row has no onclick. Landing pages need **rail click → navTo(hub),
   hover → flyout**, or they are unreachable except via breadcrumb.
4. **PlanetIQ's landing is unusable while finance is locked** — 6 of its 7 children mask to identical
   "🔒 Financials" tiles with blurbs stripped. The template must aggregate them into one
   "🔒 Financials (6) — unlock" tile.
5. **The counts are registry metadata, not business signal** — the same criticism this plan levels at
   the home flag board. State it honestly as "N tools · M live"; real signal arrives later via
   `/api/home/summary` enrichment.
6. **Fullscreen: cut Board and Scheduler.** They are The Floor's first two section-nav keys — a
   fullscreen flag turns the section side-nav into a new-tab farm and makes the sub-hub auto-open pop
   a tab. Keep Time Clock, Ship Board, Capacity. Hash deep links still embed.

## Out of scope (next sessions)
Board dashboard · Pickup & Delivery page · clearing the abandoned worktree · consolidating the three
clones · merging Jean's two unmerged branches (`jean/capacity-jean-mode`, `jean/queue-visibility`).
