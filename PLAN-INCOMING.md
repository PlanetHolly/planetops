# PLAN — Feed Fork C Phase 2a: the Incoming board (read-only)

**Architecture:** `~/Dropbox/PlanetApparel/PlanetIQ/Blueprint_Feed_ForkC_2026-07-15.md`. The routing engine is already built and LIVE (`~/Dropbox/PlanetApparel/_Skills/feed/scripts/brain_router.py`). This plan builds **only the floor-facing view of it**.

**What this is for, in one line:** when a vendor order is coming in for a job, the production floor currently has no way to know until boxes physically land and someone opens them. This board makes inbound visible and job-linked *before* it arrives.

**Branch:** `brain-incoming-board` (already created, clean). **Do not push. Do not merge. Do not touch `main`.** This repo has parallel sessions on other branches — never force-push, never rebase shared history.

---

## Scope — build exactly these two things

### 1. `incoming/incoming-data.json` — the snapshot contract

Follow the existing pattern **exactly** — copy the shape of `signals/scoreboard-data.json` (a committed JSON snapshot the page fetches). Create a **realistic sample file** with 3-4 entries so the page can be developed and reviewed before real data flows:

```json
{
  "generated_at": "2026-07-16 (sample data — not live)",
  "items": [
    {
      "fact_id": "F-20260716-0001",
      "vendor": "SNS Activewear",
      "job": "1234",
      "customer": "Blink",
      "summary": "SNS Activewear order for Blink #1234 - 3 invoices - $4,820 - 130 units - ETA 7/22",
      "total": 4820.00,
      "line_count": 3,
      "eta": "2026-07-22",
      "status": "routed",
      "received_at": "2026-07-16T15:45:17Z",
      "doc_refs": ["...", "...", "..."]
    }
  ]
}
```
Include a variety: one multi-invoice order, one PO, one with a **null/missing ETA**, one dated in the past (overdue). The page must handle all of them without breaking.

### 2. `incoming/index.html` — the read-only board

- **Copy the conventions of `signals/index.html`** (205 lines — read it first). Same fetch pattern: `fetch('./incoming-data.json?_='+Math.floor(Date.now()/60000))`. Self-contained page, no build step, no external CDN.
- Renders one **card per inbound item**, **grouped by job**, showing: **vendor · what (summary) · job · $ total · # invoices · ETA · status**.
- **ETA is the most important field on the page** — the floor's question is "when does this land?". Make it prominent. Show relative urgency: arriving today/tomorrow, this week, overdue (ETA in the past and not received). Missing ETA renders as "ETA unknown", never blank or "null" or "Invalid Date".
- A count of what's inbound, and an **empty state** ("Nothing inbound right now") that is not an error.
- **Read-only.** No buttons that write, no check-off, no fake interactivity. Anything not implemented must not appear as a dead control.
- Must be legible on a **floor terminal** — this is glanced at across a room, not studied. Big type, high contrast, works down to ~900px wide. Dark-friendly if that's what the sibling pages do.
- Match the visual language of the existing pages — read `signals/index.html` and follow it. Do not invent a new design system.

---

## Hard constraints

- **Do NOT** register the page in `frontdoor/registry.json`. That is Holly's call after she sees it. (`registry.json` is client-readable — no secrets ever go in it; auth is server-side at `gate/index.js`.)
- **Do NOT** wire this to `brain_router.py`, Google Sheets, n8n, or any live data source. The sample JSON is the only input.
- **Do NOT** build check-off / "mark received". Status is app-owned state; the facts are router-owned; the two need a merge strategy that does not exist yet. Building it now would guarantee the router clobbers the floor's check-offs on the next run. **Out of scope — leave no stub for it.**
- **No new dependencies**, no framework, no build step. Vanilla HTML/CSS/JS like its siblings.
- **Do not modify any file outside `incoming/`** except this plan file.
- Do not commit. Leave changes in the working tree for review.

## Definition of done

`incoming/index.html` opens directly in a browser (`file://` or a local server), fetches `incoming/incoming-data.json`, and renders a legible job-grouped inbound board that correctly handles a multi-invoice order, a missing ETA, and an overdue item — with an empty state, no console errors, and no dead controls.
