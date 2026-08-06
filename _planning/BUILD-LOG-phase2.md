# BUILD LOG — Phase 2, decoration-margin fix on DTF + Mixed Decorations

**Date:** 2026-08-05 · **Plan:** `_planning/PLAN-phase2-decoration-floor.md`
**Builder:** Codex `0.139.0`, thread `019fd448-17f7-7223-8c0d-74fbb368bea9`, sandbox `workspace-write`
**Reviewer:** Opus · **Fix rounds used:** 2 of 2 · **Hand-fixes by Claude:** 2

---

## Outcome: two desks, not three

| desk | outcome |
|---|---|
| `dtf-quote` | ✅ fixed — blended clause removed from `belowFloor`, zones, hero, ladder. **21/21** |
| `apparel-mix` | ✅ fixed — decoration gauge, partial ladder (curve methods only). **15/15** |
| `apparel-quote` | ❌ **reverted, byte-identical to live — it had nothing to fix** |

### 🔴 `apparel-quote` — the plan was wrong, twice

The plan pointed at the `Per-unit price` row chip. **`row()` computes `band()` and discards it**,
returning an empty `marginCell` — that chip is never rendered. Codex faithfully implemented the
specified fix (producing no output) and then un-blanked **every** row chip to make it visible, which
put internal cost/margin data onto the desk.

Second attempt pointed at `projectCard()`. **`spPanel` does not exist in this desk**, and the render
line is guarded `if(_sp)`, so `projectCard()` renders nowhere either.

**Verified against the LIVE file:** empty `<div class="badge"></div>` (every sibling carries
`INTERNAL - MARGIN VISIBLE`), `0` rendered chips, `0` `spPanel`, `0` `class="internal"`. **Four
separate margin surfaces removed — deliberate.** This desk shows no margin, so it cannot show an
inverted margin signal. Reverted with `git checkout`; confirmed identical to `origin/frontdoor-gate`.

**🟠 Open question for Holly:** is `apparel-quote` *meant* to be margin-free? A PM on it currently
gets no margin visibility at all. If that's intentional (customer-facing), leave it. If it's an
unfinished strip, that's its own piece of work — not this one.

---

## What shipped

**`dtf-quote`** — deleted only the blended clause; the correct per-line test is untouched:
```js
const belowFloor = lineCalcs.some(row => row.actualMargin < 0.33)      // kept
                   || marginPct < 0.33;                                 // DELETED
```
Plus Goods/Decoration zones, hero showing decoration with blended muted, and the Standard/Stretch
ladder with derived floor pills. Gang-pricing path preserved.

**`apparel-mix`** — decoration gauge; ladder moves **only** curve-priced placements (embroidery,
DTF), screen print held at matrix price, each row deriving which methods it moved; ladder **hidden
entirely** on a screen-print-only quote. Sliding-margin note reworded to stay true.

**Puff placeholder deliberately NOT fixed.** Codex was authorised to refuse and did: the mix desk's
DTF lookup can't safely handle a transfer type with its own `qty_bands` (PUFF uses
1-24/25-49/50-99/100-299/300+). `$2.55` stays with the reason recorded. **A wrong puff cost is worse
than a known-stale one.** Still open.

---

## Review findings

**Round 1** — apparel-quote failed its own assertion (`FAIL (1/10)`) when Claude ran the loop; Codex
had never run it. Root cause was the plan, not the build. See above.

**Round 2** — 🔴 **the `screen print stretch byte-identical price` assertion was vacuous by
construction.** It called `placementCalcFor` fresh twice and compared those results — testing the
helper in isolation, never the pipeline. Claude scaled the real screen-print price by 1.1 inside
`calculate()` and the harness stayed **PASS (12/12)**. The single load-bearing property of that desk
was untested. Now reads `LAST_CALCS`, assigned from the real `calculate()` path, plus inverse
assertions (embroidery and DTF prices must *rise*) so freezing every method can't pass either.

### Claude's hand-fixes (both rounds spent)

1. **Reverted `apparel-quote` entirely** — `git checkout`, verified identical to live.
2. **Wrapped both `runSelftest()` call sites in try/catch.** A throwing harness rendered an *empty*
   `selftestOut`, indistinguishable from "harness not wired". Now prints
   `SELFTEST: ERROR - harness threw: <message>`. Verified: sabotage G went from blank →
   `ERROR - Cannot read properties of undefined (reading 'quote')`.

---

## Verification — all run by Claude, outside Codex's sandbox

```
BASELINE                     dtf 21/21     mix 15/15
SABOTAGE E  (blended clause back, WRONG VAR)   dtf PASS  <- MY sabotage was a no-op, see below
SABOTAGE E2 (blended clause back, real var)    dtf FAIL (1/21) — expensive blank has no
                                                 below-floor flag: expected OK got Check
SABOTAGE F  (double uplift)                    mix FAIL (1/12) — Partner Stretch achieved below target
SABOTAGE F2 (scale screen print in pipeline)   mix PASS  <- REAL DEFECT, assertion was vacuous
SABOTAGE F3 (same, after fix)                  mix FAIL (1/15) — screen print stretch byte-identical
                                                 price: expected {"price":8.569,...} got {"price":7.79,...}
SABOTAGE G  (freeze every method)              mix ERROR - harness threw (was: blank)
RESTORED                     dtf 21/21     mix 15/15    both byte-identical to backup
```

### 🔑 The near-miss worth remembering

Sabotage E **passed**, and Claude nearly reported the DTF harness as broken. It wasn't.
**`marginPct` is an element `id`, and browsers auto-create a global for it** — so the sabotage
resolved to an `HTMLSpanElement`, `span < 0.33` is `false`, and the edit was a silent no-op.
**Check the instrument before condemning the code.** Rerun with the real variable
(`projectMarginPct`) produced the correct failure.

Also confirmed: rendered both desks and eyeballed them. Untouched vs live throughout:
`bandana-quote`, `promo-quote`, `embroidery-quote`, `apparel-quote`, `ship-estimate`.

---

## Still open

- **`apparel-mix` PUFF = `$2.55` placeholder** (needs the mix DTF lookup to support bespoke `qty_bands`).
- **`apparel-quote` margin-free by design?** — needs Holly's ruling.
- **`embroidery-quote` selftest has the same blank-on-throw gap** — deployed and passing, not touched
  here to avoid a second deploy. Fold into the next change to that file.
- Garment recovery `$0.45 + 4%` vs the model's 10% of COGS; post-raise overhead recompute
  ([[reference_survival_floor_derivation]]).
