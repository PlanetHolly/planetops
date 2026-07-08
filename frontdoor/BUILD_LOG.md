# Front Door — BUILD_LOG

**Built:** 2026-07-08 (Fable 5 high, from `_planning/fable-build-01-shell.md` + `_planning/front-door-spec.md`)
**What this is:** The front door to Planet Apparel's operating system — one gated page, left rail of hubs, global search, every operational surface a tile. **Everything renders from `registry.json`; no content lives in the code.**
**Status:** Shell complete, all 9 acceptance criteria verified in Chrome. NOT committed, NOT pushed, NOT deployed — local preview only (deliberate: public deploy waits for the real gate in Phase 2).

---

## File map

| File | What it is |
|---|---|
| `index.html` | Skeleton: PIN gate overlay, top bar (brand · search · pinned), rail, main pane, and the authentic Ø SVG in a `<template>` |
| `app.css` | All styling. Brand: black bar, gold `#F7BE00` accent-only, light theme. Mobile rules under `@media(max-width:820px)` |
| `app.js` | The engine: fetch+validate registry → gate → render rail/pane/pins/search. ~260 lines, zero dependencies |
| `registry.json` | **The single source of truth.** The whole hub/surface tree. Edit THIS to change the app |
| `BUILD_LOG.md` | This file |

## How registry.json works

A node is a **hub** (`kind:"hub"`, has `children:[]`) or a **surface** (`kind:"surface"`, ideally has `url`). Hubs nest inside hubs — the tree is recursive, one hub template renders every level.

Fields: `id` (unique, kebab), `kind` hub|surface, `group` (top-level only) hubs|library, `icon` emoji, `name`, `blurb`, and for surfaces: `type` live-app|dashboard|system-map|tool|report|reference|training · `status` live|stale|wip|planned · `access` open|pin (🔒 marker; NOT enforced yet) · `url` (relative like `../signals/` or absolute Drive link; omit for stranded file:// apps) · `dataSource` (what feeds it — shown on tile) · `note` (amber callout, e.g. "stranded on file://").

**To add a surface:** open `registry.json`, find the hub, add one object to its `children`. Reload. Done.
**To add a hub:** same, but `kind:"hub"` + `children:[]`. Top-level hubs also need `group`.
**If you break it:** the app validates on load (duplicate ids, bad enums, hub without children array) and shows a red banner naming the bad node instead of half-rendering. Fix the named node.

## How to preview

```bash
cd ~/github/planetops && python3 -m http.server 8791
# open http://localhost:8791/frontdoor/  → PIN is 0000
```
Must be served (github.io later, http.server now) — `file://` can't fetch the registry (the app tells you this if you try).

## The gate (READ THIS)

The PIN screen is a **PLACEHOLDER, not security** — the pin lives client-readable in `registry.json` and must stay `0000`. Never put the real team PIN in that file. Real enforcement (and the separate Financials PIN for `access:"pin"` tiles) arrives in **Phase 2** once the hosting decision (GitHub Pages+gate vs Railway) is made and Codex has reviewed the auth plan. Entry is remembered per calendar day (`localStorage: frontdoor.gate`).

## Decisions made during build

1. **`revenue-house/` rename done first** (was `planet-sales/`) so the registry was born with final URLs. Internal links were all relative — nothing else changed.
2. **Hash routing** (`#/planetops/time-labor`) so deep links + reload land on the same hub, no server config needed.
3. **Pins + gate in `localStorage`** (`frontdoor.pins`, `frontdoor.gate`) — preferences only, fine to lose; per Holly's rule never trust localStorage for real data.
4. **Registry validation is hard-fail** — a bad registry renders a red banner naming the node, never a half-empty app (acceptance criterion 9).
5. **State API is an info-only tile** (backend, no page) — renders unclickable with its note.
6. **Search is index-only** (names + blurbs, top 12, keyboard ↑↓/Enter/Esc). Invoice/document search = Phase 2.

## Gotchas (learned the hard way)

- **`[hidden]` vs `display:flex`:** any element styled `display:flex` ignores the `hidden` attribute. Fixed globally with `[hidden]{display:none !important}` in app.css — keep that line.
- The **1Password/password-manager icon** appears in the PIN field (it's a `type=password` input). Harmless.
- Cache-buster on the registry fetch is per-minute (`Date.now()/60000`) — edits can take up to 60s to appear unless you hard-reload.

## Branded circular icons (updated 2026-07-08)
Icons render inside a dark round "Ø" circle (`.iconBadge`, sizes ib-lg/sm/xs) everywhere — tiles, rail, pinned chips, surface header, search. The ~10 hubs + the Floor App carry hand-built flat SVG glyphs in `GLYPHS` (keyed by node id, in app.js); every other surface shows its emoji inside the same circle. `iconFor`/`badge(node,size)` do the rendering. To give a hub/floor a custom glyph, add an SVG string to `GLYPHS[id]`; otherwise the emoji is used.

## Emojis (updated 2026-07-08)
EVERY node (hub + surface) carries a unique `icon` emoji — no two repeat. Tiles lead with a big emoji + bold name (QuickBooks feel); the pinned quick-bar shows those emojis as tabs. **When you add a surface, give it a NEW emoji not already used** — there's a uniqueness assert in the registry (a Python check during build fails on any dupe). If you're unsure what's taken, dump icons: `python3 -c "import json;[print(n) for n in json.load(open('frontdoor/registry.json'))]"` (or just avoid the obvious ones already in the file).

## Navigation model (updated 2026-07-08)
Surfaces do NOT open in new tabs. Clicking an **internal** surface tile navigates the shell (`#/path/to/surface`) and loads it **embedded in the main pane** via an `<iframe>` — the left rail stays put (Printavo/QuickBooks feel). A slim header bar over the iframe gives ‹ Back and ⤢ Full screen (⤢ is the only new-tab path). Browser Back works inside the shell. **External** surfaces (docs.google.com — Google forbids framing) still open a new tab and show a ↗ marker on the tile. The rail is **collapsible**: the ☰ topbar button hides it (persisted in `localStorage: frontdoor.rail`); when collapsed a 10px far-left hover strip slides it back as a drawer. Same-origin framing is allowed and hardened by `X-Frame-Options: SAMEORIGIN` (set globally in gate/index.js) so only our own front door can frame these pages. Key funcs: `currentNode()` (hub or surface), `openNode()` (external→new tab, internal→navTo), `renderPane()` surface branch, `setupRail()`.

## Open items / What's next (Phase 2+, in rough order)

1. **Hosting decision** — GitHub Pages behind a gate vs Railway (board: isolated, reversible, later step). Blocks real auth.
2. **Real gate** — universal entry PIN + separate Financials PIN, enforced server-side; Codex adversarial review of that plan BEFORE build (Holly's requirement).
3. **Deploy the stranded `file://` apps** (every `status:"wip"` tile with a "stranded" note) — pricing-dashboard, Order-Flow map, Production Flow Map v3, Agentic OS, Graphics Suite, QC trainer, graphify, guides.
4. **Wire the front door into the main board nav** + retire the PA Docs bookmark file (this registry replaces it).
5. Live status/alarms per tile (n8n / Drive polling) · whole-app name final call ("Planet Apparel" seeded; "PlanetOS" the alternate) · landing view per person · registry governance ritual (who adds surfaces, when).

**Spec:** `_planning/front-door-spec.md` · **Brief:** `_planning/fable-build-01-shell.md` (Appendix A = the seed this registry was transcribed from)
