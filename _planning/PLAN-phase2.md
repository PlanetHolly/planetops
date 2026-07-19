# PLAN — Front Door Phase 2: hub landings · home signal row · flyout collapse · fullscreen · icon rings

**Status:** SPEC LOCKED — design calls made 2026-07-19 (Holly unavailable; each call justified inline).
**Scope:** `frontdoor/app.js` · `frontdoor/app.css` · `frontdoor/registry.json` (4 one-line property adds). Nothing else.
**Base:** branch `frontdoor-ia` at `483b232` (Phase 1 built). All line numbers below are against THAT file state.
**Backend:** ZERO backend work. Both new fetches hit things that already exist and already serve the command center.

Decisions log + "Holly might reject" flags are at the bottom (§8).

---

## 0 · Ground rules (carried from Phase 1 — violating these breaks the app)

1. Hub IDs frozen. Nothing here renames an id.
2. Icon house color = **2px OUTER RING**, never a circle tint. The `#232323` circle stays; most glyphs use `#232323` interior cutouts against it (see `estimator`, `apparel-quote-calc`, `boxes` in `GLYPHS`).
3. Nothing may push a new entry into `validate()`'s `errs` array — new checks go to `warnings` only (`errs` bricks the whole app via `showRegError`, app.js:682).
4. Server strings never hit `innerHTML` — keep the `textContent` discipline from `renderFlagBoard` (app.js:575) for anything fetched.
5. Finance masking: `safeName()`/`financeVisible()` (app.js:237-238) are the ONLY way a locked node's name renders. The landing template goes through them.

---

## 1 · HUB LANDING PAGES — `renderHubLanding(node, pane)`

### 1.1 Entry gesture (DECIDED)

**Rail click → navigate to the hub's landing. Rail hover → flyout (unchanged).**
One line: touch devices have no hover, so click must go somewhere real — the landing page IS the touch path, and it lists everything the flyout listed.

- **app.js:321** — in `renderRail()`, change
  `item.onclick = () => showFlyout(node, item);   // click works for touch too`
  to
  `item.onclick = () => { hideAllFly(); navTo(node); };   // click = landing; hover = flyout; landing is the touch path`
- `item.onmouseenter` (L320) and `onmouseleave` stay exactly as they are.
- `cascadeRow` click (app.js:343) already does `navTo(hub)` — leave it; sub-hubs route per §1.2.

### 1.2 Route handling — `renderPane()` (app.js:415-468)

Replace the last two branches (L459-467) with:

```js
  /* a SECTION hash (sub-hub like The Floor) → open its first embeddable key,
     which renders with the section side-nav on the left */
  if (PARENT.get(node.id)) {
    const first = (node.children || []).find(c => c.kind === 'surface' && c.url && !isExternal(c.url));
    if (first) { navTo(first); return; }
  }

  /* any other hub (top-level, or a sub-hub with nothing embeddable) → its landing page */
  renderHubLanding(node, pane);
```

One line: sub-hubs with a live first child keep the Floor-style auto-open Holly already likes; every other hub click now lands on a real page instead of bouncing home. `#/planetops` etc. become working deep links automatically — `currentNode()` already resolves hubs.

### 1.3 `renderHubLanding(node, pane)` — new function, place it directly after `renderPane()`

Shell-rendered DOM in `#pane`. **NOT an iframe** (hubs have no url; an iframe would have to re-implement finance masking). The command center (`revenue-house/command/index.html` L43-70) is the **visual** reference only: dark hero band + tile grid with a count in the top-right corner of each tile.

```js
function countSurfaces(hub) {              // registry metadata, stated honestly — NOT business signal
  let total = 0, live = 0;
  (function w(n){ (n.children || []).forEach(c => {
    if (c.kind === 'surface') { total++; if (c.status === 'live' && c.url) live++; }
    else w(c);
  }); })(hub);
  return { total, live };
}
function ringClass(node) { const t = railHubFor(node); return t ? ' ring-' + t.id : ''; }

function renderHubLanding(node, pane) {
  document.body.classList.remove('embedding');
  renderCrumbs(node);
  pane.innerHTML = '';

  /* hero band — command-center pattern: dark card, gold kicker, big name, blurb, count top-right */
  const parent = PARENT.get(node.id);
  const { total, live } = countSurfaces(node);
  const hero = el('div', 'hubHero');
  hero.innerHTML =
    `<div class="hhKicker">${esc(parent ? parent.name : 'Planet Apparel')}</div>` +
    `<h1>${badge(node, 'lg')}<span>${esc(node.name)}</span></h1>` +
    (node.blurb ? `<p class="hhSub">${esc(node.blurb)}</p>` : '') +
    `<div class="hhCount">${total}<small>inside · ${live} live</small></div>`;
  pane.appendChild(hero);

  const kids = node.children || [];
  const hubKids = kids.filter(c => c.kind === 'hub');
  const surfKids = kids.filter(c => c.kind === 'surface');

  /* 1 · the rooms — child hubs as big cards */
  if (hubKids.length) {
    pane.appendChild(el('div', 'groupHead', 'Inside'));
    const hg = el('div', 'hubCards');
    hubKids.forEach(h => hg.appendChild(hubCard(h)));
    pane.appendChild(hg);
  }

  /* 2 · direct tools — reuse tileFor(); finance-locked ones aggregate to ONE tile */
  const { ready, works } = splitWorks(surfKids);
  const locked = ready.filter(n => isFinanceNode(n) && !financeVisible(n));
  const visible = ready.filter(n => !locked.includes(n));
  if (visible.length || locked.length) {
    pane.appendChild(el('div', 'groupHead', 'Tools'));
    const grid = el('div', 'tiles');
    visible.forEach(n => grid.appendChild(tileFor(n)));
    if (locked.length) grid.appendChild(lockedAggTile(locked.length));
    pane.appendChild(grid);
  }

  /* 3 · in the works — dimmed, last (same hygiene as flyouts/Browse) */
  if (works.length) {
    pane.appendChild(el('div', 'groupHead', 'In the works'));
    const wg = el('div', 'tiles');
    works.forEach(n => wg.appendChild(tileFor(n)));
    pane.appendChild(wg);
  }
  if (!kids.length) pane.appendChild(el('div', 'emptyHub', 'Nothing here yet.'));
}

function hubCard(h) {
  const { total, live } = countSurfaces(h);
  const c = el('div', 'hubCard clickable');
  c.innerHTML =
    `<div class="hcCnt">${total}<small>inside · ${live} live</small></div>` +
    `${badge(h, 'lg')}<div class="hcLab">${esc(h.name)}</div>` +
    (h.blurb ? `<div class="hcOne">${esc(h.blurb)}</div>` : '');
  c.onclick = () => openNode(h);
  return c;
}

function lockedAggTile(n) {                 // PlanetIQ answer: 6 identical masked tiles → ONE honest tile
  const t = el('div', 'tile clickable lockedAgg');
  t.innerHTML =
    `<h3><span class="iconBadge ib-lg"><svg viewBox="0 0 24 24"><rect x="6" y="10.5" width="12" height="9" rx="2" fill="#94a3b8"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="#94a3b8" stroke-width="2.2"/></svg></span>` +
    `<span class="tName">🔒 Financials (${n})</span></h3>` +
    `<p>${n} locked tool${n === 1 ? '' : 's'} — enter the finance PIN to see them.</p>`;
  t.onclick = () => { location.href = '/gate/finance?r=%2Ffrontdoor%2F'; };
  return t;
}
```

Notes for the implementer:
- **Locked aggregation rule (DECIDED):** whenever ≥1 direct surface child is finance-locked, they collapse to one aggregate tile — no per-node masked tiles on landings, ever. One line: N identical "🔒 Financials" tiles carry zero information; one tile with a count carries exactly the honest amount. Names stay hidden (shared-device hygiene); the count leaks nothing. Sub-hub cards (`pricing`, `time-labor`) are hubs, never masked — their names/blurbs render normally, matching current flyout behavior.
- The unlock click matches the existing home `lockchip` exactly (app.js:591) — after unlock the user lands on `/frontdoor/` home, not back on the hub. Known small loss: the gate's `safeRedirect` strips hash fragments, and fixing that is backend. Accepted.
- **Counts are registry metadata** — the label is literally "N inside · M live", same vocabulary as the existing hub tile meta (app.js:406). Never "N alerts", "N jobs", or anything that smells like business signal. Real signal arrives later via `/api/home/summary` enrichment with zero front-door changes.
- `renderHubLanding` never runs for a masked node (hubs can't be `access:"pin"` in the current registry; if one ever is, `safeName` in the hero would mask it — use `safeName(node)` instead of `node.name` in the hero `h1` for future-proofing. Do that.).
- Watchtower does NOT get a special tile on hub landings — it's featured on HOME (§2), and it's a normal child of Systems here.

### 1.4 Landing CSS — append to app.css

```css
/* ── hub landing (command-center visual pattern) ── */
.hubHero{position:relative;background:#232323;color:#fff;border-radius:16px;padding:22px 26px;margin:4px 0 18px}
.hubHero .hhKicker{font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:var(--gold);font-weight:800}
.hubHero h1{margin:6px 0 0;font-size:26px;letter-spacing:.3px;text-transform:uppercase;font-weight:800;display:flex;align-items:center;gap:12px}
.hubHero .hhSub{margin:9px 0 0;color:#cfcfcf;font-size:13px;line-height:1.6;max-width:640px}
.hubHero .hhCount{position:absolute;top:18px;right:22px;font-size:26px;font-weight:800;color:var(--gold)}
.hubHero .hhCount small{font-size:11px;color:#9aa4b2;font-weight:700;display:block;text-align:right}
.hubCards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:6px}
.hubCard{position:relative;background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;cursor:pointer;
  transition:transform .1s,box-shadow .1s,border-color .1s}
.hubCard:hover{transform:translateY(-2px);box-shadow:0 5px 16px rgba(0,0,0,.08);border-color:#c7c7cc}
.hubCard .hcCnt{position:absolute;top:16px;right:18px;font-size:24px;font-weight:800;color:var(--ink)}
.hubCard .hcCnt small{font-size:11px;color:#9ca3af;font-weight:700;display:block;text-align:right}
.hubCard .hcLab{margin-top:10px;font-size:17px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}
.hubCard .hcOne{margin-top:4px;font-size:12.5px;color:#666;line-height:1.45;padding-right:56px}
.tile.lockedAgg{background:#fafafa}
@media(max-width:820px){ .hubHero h1{font-size:21px} .hubCards{grid-template-columns:1fr} }
```

The hero uses `#232323` (the icon-circle dark), matching the command center's `--ink` band. Icons already "pop" against it.

---

## 2 · HOME SIGNAL ROW — Watchtower headline + this-week sales

Placement in `renderHome()` (app.js:471): insert **between the welcome band and "⚠️ Needs attention"** — i.e. right after `pane.appendChild(wb);` (L483) add:

```js
  /* 1.5 · live signal row — Watchtower headline + sales pulse */
  const sig = el('div', 'sigRow'); sig.id = 'sigRow';
  pane.appendChild(sig);
  renderSignalRow();
```

### 2.1 Module state + fetches (mirror the `SUMMARY`/`renderFlagBoard` pattern exactly)

```js
/* ── home signal row: Watchtower open incidents + this week's sales ──
   Both read things that ALREADY exist. Fetched once per page load, in boot();
   renderSignalRow() re-renders from module state on every home render.
   FAIL SILENT: a dead feed renders NOTHING (console.warn only) — a permanently
   lit "unavailable" chip trains people to ignore the row (the 3-amber-flags lesson). */

// Same webhook the command center's Watchtower view reads (its FLIGHTLOG_ENDPOINT).
// NOT the retention-activity feed — that one cold-assembles for 15-40s; never call it here.
const WATCHTOWER_FLIGHTLOG = 'https://primary-production-079f9.up.railway.app/webhook/watchtower-flightlog';
let WATCH = undefined;   // undefined = not yet fetched/failed · number = open-incident count
let SALES = undefined;   // undefined = none · {week, quoted, converted}

async function fetchSignals() {
  try {   // payload contract (command center L2131): { agents:[{ incidents:[...open only...] , ...}] }
    const r = await fetch(WATCHTOWER_FLIGHTLOG, { signal: AbortSignal.timeout(3500) });
    const d = await r.json();
    if (d && Array.isArray(d.agents))
      WATCH = d.agents.reduce((n, a) => n + (Array.isArray(a.incidents) ? a.incidents.length : 0), 0);
  } catch (e) { console.warn('watchtower signal unavailable:', e.message); }
  try {   // signals/scoreboard-data.json: { weeks:[{iso_week, rows:[{rep:'Company', quotes_dollar, converted_dollar}]}] }
    const r = await fetch('../signals/scoreboard-data.json', { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    const wk = Array.isArray(d.weeks) && d.weeks[d.weeks.length - 1];
    const co = wk && (wk.rows || []).find(x => x.rep === 'Company');
    if (co) SALES = { week: wk.iso_week, quoted: co.quotes_dollar || 0, converted: co.converted_dollar || 0 };
  } catch (e) { console.warn('sales signal unavailable:', e.message); }
  renderSignalRow();
}

function renderSignalRow() {
  const row = document.getElementById('sigRow');
  if (!row) return;                                    // not on home right now
  row.innerHTML = '';
  const wt = BYID.get('watchtower');
  if (WATCH === undefined) { /* failed or pending → render nothing for Watchtower */ }
  else if (WATCH === 0) {                              // QUIET at zero: one slim, low-contrast line
    const c = el('div', 'sigQuiet', '🟢 Watchtower — all clear');
    if (wt) { c.classList.add('clickable'); c.onclick = () => openNode(wt); }
    row.appendChild(c);
  } else {                                             // LOUD when not: full-width red strip
    const c = el('div', 'sigAlert');
    const label = el('span');                          // fetched-adjacent → textContent, never innerHTML
    label.textContent = `🚨 Watchtower — ${WATCH} open incident${WATCH === 1 ? '' : 's'}`;
    c.appendChild(label);
    const go = el('span', 'flagGo', 'Go →');
    c.appendChild(go);
    if (wt) c.onclick = () => openNode(wt);
    row.appendChild(c);
  }
  if (SALES) {
    const sn = BYID.get('signals');
    const c = el('div', 'sigChip');
    c.textContent = `📡 W${SALES.week}: $${Math.round(SALES.quoted).toLocaleString()} quoted · $${Math.round(SALES.converted).toLocaleString()} won`;
    if (sn) { c.classList.add('clickable'); c.onclick = () => openNode(sn); }
    row.appendChild(c);
  }
}
```

Wire-up in `boot()` (app.js:657-666): add `fetchSignals();` on its own line next to the existing `fetchSummary().then(...)` call. Do NOT chain them — either feed being slow must not delay the other or the flag board.

Rules, stated so nobody re-derives them:
- **Zero state:** one quiet green micro-line. It exists (proof the watch is running) but whispers.
- **N>0:** full-width red strip, impossible to miss. Click → `openNode(watchtower)` (which per §4 opens the command app full-screen in a new tab).
- **Fetch failure/timeout:** render NOTHING for that tile. `console.warn` only. The flag board's state-api health check already owns "the system is having trouble" messaging; duplicating it here would double-ring.
- **Timeout 3500ms** even though the webhook's cold path can be slower — home must render fast; a cold-start miss just means no chip this load. Accepted trade, per the Phase-1 plan note ("short timeout, fail silent").
- The sales chip shows the ISO week number so stale data self-describes (the JSON's `generated_at` is a manual pull; if it's three weeks old, "W27" says so). Do not add a staleness warning — honesty via label, not alarm.
- The watchtower webhook is cross-origin but already CORS-callable (the command center calls it from this same origin today). If CORS ever breaks, behavior degrades to "no chip", which is the designed failure mode.

### 2.2 Signal row CSS — append to app.css

```css
/* ── home signal row ── */
.sigRow{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 18px}
.sigQuiet{font-size:12px;font-weight:600;color:#4b5563;padding:5px 11px;border-radius:999px;background:#f0fdf4;border:1px solid #d1fae5}
.sigQuiet.clickable,.sigChip.clickable{cursor:pointer}
.sigQuiet.clickable:hover,.sigChip.clickable:hover{border-color:var(--gold)}
.sigAlert{flex-basis:100%;display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;cursor:pointer;
  background:#fef2f2;border:2px solid #dc2626;color:#991b1b;font-size:15px;font-weight:800}
.sigAlert .flagGo{margin-left:auto}
.sigChip{font-size:12px;font-weight:600;color:#4b5563;padding:5px 11px;border-radius:999px;background:#fff;border:1px solid var(--line)}
```

---

## 3 · FLYOUT COLLAPSE — parent collapses to a slim icon strip when the sub fans out

Holly: *"When anything is chosen to the right of any of these flyouts, the hub should just disappear… it should collapse."* Clicking already hides everything (`hideAllFly` on every row click). This section handles the **cascade hover state**: when a sub-flyout opens, the parent gives up its space — but it must NOT be hidden outright, because the flyouts are `position:fixed` siblings and the sub is placed off the parent's live `getBoundingClientRect().right`; hiding the parent strands the pointer over the pane and the `mouseleave` chain kills both menus.

**Design: collapse, don't hide.** The parent shrinks to a 46px icon-only strip that stays hoverable, and the sub-flyout is positioned off the strip's **post-collapse** rect.

### 3.1 JS changes

**`showSubFlyout` (app.js:373-379)** — order is load-bearing: fill sub → collapse parent → **then** measure:

```js
function showSubFlyout(hub, rowEl) {
  keepFlyout(); clearTimeout(subHideTimer);
  const fly = document.getElementById('flyout');
  const sf = document.getElementById('subflyout');
  fillFlyout(sf, hub);
  /* collapse the parent to a slim icon strip BEFORE measuring — the sub anchors
     to the collapsed width, so there is never a dead gap for the pointer */
  fly.classList.add('collapsed');
  [...fly.querySelectorAll('.flyRow')].forEach(r => r.classList.toggle('srcRow', r === rowEl));
  placeFly(sf, fly.getBoundingClientRect().right - 4, rowEl.getBoundingClientRect().top - 6);
}
```

(`getBoundingClientRect()` after `classList.add` forces a synchronous layout — the measured right edge is the collapsed one. The `-4` overlap survives from Phase 1: no pointer gap.)

**Un-collapse on every path that retires the sub:**
- `hideAllFly` (app.js:328): also `f.classList.remove('collapsed')` (guard `if (f)`).
- `hideSubFlyout` (app.js:331): when the sub actually hides (both the `now` branch and inside the timeout), also `document.getElementById('flyout')?.classList.remove('collapsed')`.
- `showFlyout` (app.js:367): first line of body after `keepFlyout(); hideSubFlyout(true);` add `document.getElementById('flyout').classList.remove('collapsed');` (re-hovering the rail resets to full width — this is also the user's "expand it back" gesture).

**Tooltips** — collapsed rows are icon-only, so in `flyRow` (app.js:336) and `cascadeRow` (app.js:341) add `row.title = safeName(n);` / `row.title = hub.name;`. (Harmless everywhere, essential in the strip.)

**Keep the Phase-1 rule untouched:** plain rows must NOT hide the sub on hover (the diagonal-path comment at app.js:348-350). That rule applies identically to the collapsed strip — hovering a plain icon does nothing; hovering a different `cascadeRow` icon re-fans its sub (existing `onmouseenter` still bound); clicking any icon opens it (existing `onclick`). The ONLY way back to the expanded parent is re-hovering the rail item or letting the 350ms timers retire everything — accepted, because any expand-on-hover affordance re-creates the exact hover-chain kill this section exists to avoid.

### 3.2 Collapse CSS — append to app.css

```css
/* ── cascade collapse: parent flyout → slim hoverable icon strip ── */
.flyout.collapsed{min-width:0;width:46px;padding:7px 4px;overflow-x:hidden}
.flyout.collapsed .flyName,.flyout.collapsed .flyCaret,.flyout.collapsed .badge,
.flyout.collapsed .lock,.flyout.collapsed .ext,
.flyout.collapsed .flyGroupHead,.flyout.collapsed .flyEmpty{display:none}
.flyout.collapsed .flyRow{justify-content:center;padding:7px 4px;gap:0}
.flyout.collapsed .flyRow.srcRow{background:#fffbeb}
```

Row vertical rhythm is preserved (the 26px `ib-sm` badge dominates row height, and padding is unchanged), so the sub's `top` — measured off `rowEl` pre-collapse — stays visually aligned with its source icon.

### 3.3 Touch

Touch has no hover path at all: no flyout ever opens by touch after §1.1 (rail tap → landing; landing cards → sections/tools). The collapse behavior is hover-only by construction. Nothing to build; note it in the code comment so nobody "fixes" touch into the cascade.

---

## 4 · FULLSCREEN FLAG — `"display": "fullscreen"`

### 4.1 The list (DECIDED — partially overrules the prior review)

**Final list (4): `clock` · `command-center` · `status-simulator` · `watchtower`.**

- `clock` — kiosk; must never wear shell chrome. (Also matches the topbar 🕐 which is already `target="_blank"`.)
- `command-center`, `status-simulator`, `watchtower` — all three are URLs into the command app, which runs **its own hash router**; embedding it inside the shell's hash router is the double-router mess the flag exists for.
- **Board + Scheduler: CUT — confirmed.** They are The Floor's first two section-nav keys; a fullscreen flag turns the side-nav into a new-tab farm and makes the sub-hub auto-open pop a tab.
- **Ship Board (`shipment`) + Capacity (`capacity`): CUT — overruling the review's "keep" ⚠️.** One line: they are Floor section-nav keys too (registry children of `floor`), so the exact objection that cut Board/Scheduler applies — clicking them mid-section must not pop tabs. Anyone who wants them full-bleed has the `⤢ Full screen` button on the surfBar (app.js:432), which is the right ad-hoc gesture. **Flagged for Holly** (§8) — trivially reversible: it's one registry property per node.

### 4.2 Implementation

**`openNode` (app.js:299-305)** — insert after `noteRecent(node);`:

```js
  if (node.display === 'fullscreen' && node.url) { openUrl(node.url); return; }   // kiosk/own-router apps: new tab, no shell chrome
```

**Hash deep links still embed — confirmed.** `renderPane` is untouched by the flag: `#/systems/watchtower` in the address bar renders the iframe view. Deliberate: a pasted/memorized link must never spawn a surprise tab, and the surfBar gives an escape hatch.

**registry.json** — add `"display": "fullscreen"` to exactly these four nodes: `command-center` (~L222), `status-simulator` (~L232), `clock` (~L726), `watchtower` (~L785).

**`validate()` (app.js:145-181)** — add a WARNING (never an err), next to the other per-surface checks:

```js
      if (node.display && node.display !== 'fullscreen') warnings.push(`"${node.id}": unknown display "${node.display}" (ignored)`);
```

Consequences to know: the home signal-row alert, pins, recents chips, search results — every `openNode` path — now opens these four in a new tab. That is the intent (they're standalone apps). `noteRecent` still records them, so they appear in Recents; fine.

---

## 5 · ICONS — house-color outer rings + the 7 missing glyphs

### 5.1 Rings

House color as a **2px outer ring** around the existing dark circle. `box-shadow` (not `border`) so layout metrics don't shift and chips/rows don't reflow.

**`badge()` (app.js:135)** — change to:

```js
function badge(node, size) { return `<span class="iconBadge ib-${size}${ringClass(node)}">${iconInner(node)}</span>`; }
```

(`ringClass` is defined in §1.3 — `railHubFor` resolves any node to its top-level hub. Nodes with no resolvable top hub — shouldn't exist — get no ring class, which renders ring-less. Fine.)

**CSS** — append. Ring color keyed to the FIVE top-level hubs (Growth/Brain/Time-Labor ride their parent's color — the ring means "which house am I in", and there are only five houses):

```css
/* ── house-color outer rings (NEVER a circle tint — the #232323 circle is the glyph's canvas) ── */
.iconBadge{--ring:transparent;box-shadow:0 0 0 2px var(--ring)}
.ib-xs{box-shadow:0 0 0 1.5px var(--ring)}   /* 20px badge: 2px reads heavy; 1.5px verified at size */
.ring-planetops{--ring:#F7BE00}
.ring-revenue-house{--ring:#10b981}
.ring-planetiq{--ring:#38bdf8}
.ring-systems{--ring:#a78bfa}
.ring-references{--ring:#fbbf24}
```

Container-clipping check for the implementer: `.pinnedChips` (overflow-x:auto) and `.flyout` (overflow-y:auto) — the ring is drawn outside the element box; chip padding (4-5px) and flyRow padding (7px) absorb it. Verify visually in the topbar chips, flyout rows, search results, section nav, tiles, and the browse accordion. If any container clips, fix with `padding` on the container, never by shrinking the ring.

Yellow-on-yellow check (`planetops` ring `#F7BE00` around glyphs whose fill is also `#F7BE00` — `schedule` is `#38bdf8` but `floor-board`, `apparel-quote-team`, `estimator`-style yellows): the `#232323` circle sits between glyph and ring, so they never touch. Confirm at `ib-xs` on a real retina and non-retina render.

### 5.2 The missing glyphs — 7, not 6 (measured against the Phase-1 registry: `shipment`, `retention-rollout-part-1`, `bandana-quoting-glance-card`, `bandana-matrix-cheat-card`, `graphics-templates`, `art-namer`, `photo-namer`)

Add to `GLYPHS` (app.js:33-130), flat style, distinct hue per surface, `#232323` cutouts, min stroke 1.6. Use these exactly:

```js
  shipment:          '<svg viewBox="0 0 24 24"><path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="#0ea5e9"/><path d="M5.5 9 7 5.5h10L18.5 9" fill="none" stroke="#0ea5e9" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 17v-4.5M9.8 14.2 12 12l2.2 2.2" fill="none" stroke="#232323" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'retention-rollout-part-1': '<svg viewBox="0 0 24 24"><path d="M4.5 10v4l3 .6 6.5 4V5.4l-6.5 4z" fill="#f472b6"/><path d="M16.5 9.2a4.4 4.4 0 0 1 0 5.6" fill="none" stroke="#f472b6" stroke-width="2" stroke-linecap="round"/><path d="M19 7.2a7.4 7.4 0 0 1 0 9.6" fill="none" stroke="#f472b6" stroke-width="1.6" stroke-linecap="round" opacity=".7"/></svg>',
  'bandana-quoting-glance-card': '<svg viewBox="0 0 24 24"><rect x="4.5" y="4.5" width="15" height="15" rx="2.2" fill="#fb7185"/><path d="M8 9h8l-4 5.5z" fill="#232323"/></svg>',
  'bandana-matrix-cheat-card': '<svg viewBox="0 0 24 24"><rect x="4.5" y="4.5" width="15" height="15" rx="2.2" fill="#fbbf24"/><path d="M4.5 10h15M4.5 14.5h15M10 4.5v15M15 4.5v15" stroke="#232323" stroke-width="1.6"/></svg>',
  'graphics-templates': '<svg viewBox="0 0 24 24"><rect x="7.5" y="7.5" width="12" height="12" rx="2" fill="#c084fc" opacity=".55"/><rect x="4.5" y="4.5" width="12" height="12" rx="2" fill="#c084fc"/><circle cx="8.5" cy="8.5" r="1.6" fill="#232323"/></svg>',
  'art-namer':        '<svg viewBox="0 0 24 24"><path d="M4 8a2 2 0 0 1 2-2h6.5l7.5 6-5.5 7.5L4 14z" fill="#f472b6"/><circle cx="8.6" cy="9.6" r="1.5" fill="#232323"/><path d="M11 14.5h5" stroke="#232323" stroke-width="1.7" stroke-linecap="round"/></svg>',
  'photo-namer':      '<svg viewBox="0 0 24 24"><rect x="4" y="4.5" width="16" height="10" rx="2" fill="#34d399"/><circle cx="8.5" cy="8" r="1.6" fill="#232323"/><path d="M11 12.5 14 9.5l4 5" fill="none" stroke="#232323" stroke-width="1.7" stroke-linejoin="round"/><path d="M5.5 17.8h9M5.5 20.3h6" stroke="#34d399" stroke-width="1.7" stroke-linecap="round"/></svg>',
```

Also **delete the orphan `training` glyph key** (app.js:38) — the `training` hub no longer exists in the registry (merged into Resources in Phase 1); dead weight.

### 5.3 Smallest-size verification (acceptance-gated, not optional)

Build a throwaway preview in the scratchpad (NOT committed, NOT in the repo): one HTML page that loads `registry.json` + the `GLYPHS` map and renders every id at `ib-xs`, `ib-sm`, `ib-lg` with its ring on both `#fff` and `#1f2937` (topbar chip) backgrounds. Eyeball every glyph at `ib-xs` (20px): no stroke may vanish, no two glyphs in the same flyout may be confusable. This is the "verify at the smallest badge size" gate.

---

## 6 · Order of implementation

1. §5 glyphs + rings (pure additive, verifiable in isolation)
2. §4 fullscreen (registry + 3-line openNode change + validate warning)
3. §3 flyout collapse
4. §1 hub landings (biggest surface; needs §5's `ringClass`— note `ringClass` lands with §1.3, so if you build §5 first, define `ringClass` then)
5. §2 signal row

Each step leaves the app fully working — commit per step.

---

## 7 · Acceptance checks

1. `node --check frontdoor/app.js` clean · `registry.json` parses · `validate()` on the shipped registry yields **zero errs, zero warnings**.
2. **Rail click on each of the 5 top hubs** renders a landing in `#pane` (dark hero, correct name/blurb, count) — no iframe in the DOM, breadcrumb shows `Home? › Hub` correctly, and browser Back returns to home.
3. **Rail hover still opens the flyout** on all 5 hubs; flyout row clicks still navigate; nothing about hover changed on non-cascade rows.
4. `#/planetops` pasted cold into the address bar → Production landing. `#/planetops/floor/schedule` → still lands on the embedded Scheduler with the Floor side-nav (unchanged).
5. Sub-hub click (e.g. The Floor from the flyout) still auto-opens its first embeddable child. A hub with no embeddable child (e.g. Graphics via `#/revenue-house/graphics` if its first child is external — verify which) renders its landing, not home.
6. **PlanetIQ landing, finance LOCKED:** exactly ONE "🔒 Financials (N)" tile, N = the locked direct-surface count (6 at time of writing); no masked per-node tiles; no finance names or blurbs anywhere in the DOM (inspect, don't eyeball). Growth/Brain/Time & Labor hub cards render with real names. Finance UNLOCKED: the aggregate tile is gone and the real tiles render.
7. **Signal row:** stub `WATCH = 0` → one quiet green line. `WATCH = 3` → full-width red strip reading "🚨 Watchtower — 3 open incidents", click opens the command app in a new tab. Fetch blocked (devtools offline) → row shows no Watchtower element at all and home renders normally within ~0ms of data (no spinner, no jank). `SALES` present → chip shows `W##` + two dollar figures matching the JSON's last `Company` row.
8. **Collapse:** hover Production → hover a cascade row (Guides) → parent snaps to a 46px icon strip, sub-flyout appears adjacent (≤0px visual gap, 4px overlap), pointer can travel row→sub without either vanishing. Hovering a different cascade icon in the strip re-fans. Hovering plain icons does nothing. Clicking a leaf closes everything AND the next rail hover shows a full-width (un-collapsed) flyout. Repeat on a sub-sub cascade if any exist.
9. **Fullscreen:** clicking Time Clock / Command Center / Status Simulator / Watchtower from flyout, pins, search, and landing tiles opens a NEW TAB with no shell chrome. `#/systems/watchtower` pasted directly still embeds with the surfBar. Board, Scheduler, Ship Board, Capacity all still embed from everywhere.
10. **Icons:** zero emoji fallbacks across the whole registry (`iconInner` resolves SVG for all 90 ids); every badge wears its house ring; xs-size review done per §5.3; rings not clipped in topbar chips, flyouts, search results, section-nav, tiles, browse rows.
11. Registry ids and urls: unchanged except the 4 `display` adds (diff the file to prove it).
12. Driven in a **real browser, not headless** — every hub landing, the collapse gesture, and both signal states, with the console clean.

---

## 8 · Decisions log (made without Holly — one line each) + rejection risks

| # | Decision | Why (one line) | Reversal cost |
|---|----------|----------------|---------------|
| D1 | Rail **click = landing**, hover = flyout | Touch has no hover; the landing is the touch path and the "another home page" Holly asked for | Trivial (one line) — but it retrains a team habit; expect two days of "where did the menu go" |
| D2 | Sub-hubs keep auto-open-first-child; only hubs without an embeddable child get landings | Holly likes the Floor section-nav; landings replace only the dead bounce-to-home | Trivial |
| D3 | Locked finance children aggregate to **one "🔒 Financials (N)" tile** on landings | Six identical masked tiles are noise; one counted tile is honest and unlockable | Trivial |
| D4 | Counts phrased "**N inside · M live**" | Registry metadata stated as registry metadata — no fake business signal | Trivial |
| D5 | Watchtower home tile: quiet green line at 0, red strip at N, **nothing on fetch failure** | A permanently lit "unavailable" chip is how the 3 amber flags got tuned out | Trivial |
| D6 | Sales chip = latest `Company` row, week number shown, no staleness alarm | Label-honesty over alarm; the JSON is a manual pull and W## self-describes age | Trivial |
| D7 | Collapse = 46px icon strip, measure-after-collapse, no expand-on-hover affordance | Any expand-on-hover re-creates the stranded-pointer kill this fixes | Cheap |
| D8 | **Fullscreen list = clock, command-center, status-simulator, watchtower — Ship Board and Capacity CUT** ⚠️ overrules the prior review's "keep" | They're Floor section-nav keys like Board/Scheduler; same tab-farm objection; surfBar ⤢ covers ad-hoc | Trivial (registry property) — **most likely Holly override**; if she wants Ship Board full-screen on the floor kiosk, add the property back to `shipment` |
| D9 | Rings keyed to the **5 top-level hubs only** (children inherit the house color) | The ring answers "which house am I in"; per-sub-hub colors would dilute it to confetti | Cheap |
| D10 | 7 glyphs to build, not 6 (`art-namer` was also emoji), and the orphan `training` key deleted | Measured against the Phase-1 registry, not the plan's stale count | — |

**Hard to reverse: nothing here.** Everything is client-side rendering + one registry property. The only *sticky* item is D1 (muscle memory) and the fact that `#/hubid` hashes become real destinations people will bookmark — keep those hashes stable from now on.

**Flag for Holly (expected pushback):** D8 (Ship Board/Capacity not fullscreen) and D5's "nothing on failure" (she asked for Watchtower *featured*; at zero it is deliberately a whisper, and on a dead feed it's absent — if she wants a permanent presence, swap the failure branch to render the quiet chip without a count).
