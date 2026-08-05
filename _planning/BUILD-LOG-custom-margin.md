# BUILD LOG — Phase 1, embroidery desk margin governance

**Date:** 2026-08-05 · **Plan:** `_planning/PLAN-custom-margin-desks.md`
**Builder:** Codex `codex-cli 0.139.0`, thread `019fd375-460c-7e30-83b5-e7ee54e6aef7`, sandbox `workspace-write`
**Reviewer:** Opus (main loop) · **Fix rounds used:** 2 of 2 · **Hand-fixes by Claude:** 1 (CSS only)

---

## Act 3 — Codex build

Modified: `embroidery-quote/index.html` (only). Created: none.

- Split quote math into Goods / Decoration / Services zones (`computeQuote()`).
- Repointed the survival test onto decoration margin.
- Hero: margin dollars unchanged as the headline; `#marginPct` → decoration margin; new muted
  `#blendedPct` alongside.
- `MARGIN OPTIONS` ladder — Standard + Stretch only, no Floor row, no free-form field.
- `?selftest=1` harness.

**Deviation (accepted):** Codex could not execute the Chrome acceptance command — its sandbox blocks
launching Chrome. It substituted its own JS harness and reported PASS from that. It was honest about
the substitution but misdiagnosed the cause as "local headless Chrome behavior." **Claude ran a
control page through the identical command and it rendered fine**, so the cause was the sandbox.
Claude then ran the real command directly. Lesson holds: the render/acceptance step must be run
outside the builder's sandbox.

---

## Act 4 — Round 1: Claude's findings

1. **Customer-facing leak (the one that mattered).** `addCheckedMarginOptions()` pushed BASKET items
   with `label: 'Standard' / 'Stretch'`, and `basketCopyText()` is the plain text a PM pastes into a
   customer email. A customer would have received *"Stretch - 24 pieces, $34.87 each."*
2. **Stale ladder on the no-quote path.** `calculate()` early-returns via `setNoQuote()` before
   `renderMarginOptions()`, so an over-grid quote kept displaying the prior prices and a PM could add
   a stale price to the basket.
3. **Hardcoded assertion count.** The harness printed `SELFTEST: PASS (8/8)` unconditionally with
   ~20 assertions present. A count that cannot be wrong is not evidence.
4. **Checkbox state lost on every keystroke.** `renderMarginOptions()` rewrote `innerHTML` on each
   `calculate()`, which fires on every `input` event.
5. **Dilution note too noisy — Claude's spec error, not Codex's.** The plan specified
   `projectMarginPct < decorationMarginPct - 0.05`, which fires on essentially every quote carrying a
   PA-supplied garment. Retargeted to `projectMarginPct < SURVIVAL_SP` — the case that used to raise
   the false red alarm and the only one needing explanation.

## Act 4 — Round 1: Codex's fixes (all verified in the diff, not from its summary)

1. Added a separate `copyLabel` field; `basketCopyText()` now emits `(l.copyLabel || l.label)`.
   **Better than specified** — the on-screen ladder keeps "Standard"/"Stretch" for the PM while the
   customer copy stays descriptive. Accepted.
2. `renderMarginOptions([])` on the no-quote path, `addCheckedMarginOptions()` early-returns on
   empty, and the button is `disabled`.
3. Count derived from `totalAssertions`; failures report `FAIL (n/total)`.
4. `priorChecked` map preserves checkbox state across re-render.
5. Retargeted as specified.

Assertion count went 8 (hardcoded) → **26 (derived)**.

---

## Verification — run by Claude, outside Codex's sandbox

| check | result |
|---|---|
| Real Chrome selftest, read from the `<pre id="selftestOut">` DOM node | `SELFTEST: PASS (26/26)` |
| Normal page load contains `#selftestOut` | **0 occurrences** — live page unaffected |
| Every out-of-scope desk file vs `origin/frontdoor-gate` | all UNCHANGED, **Bandana included** |
| Rendered screenshot eyeballed | correct — ladder, muted blended chip, green decoration flag |
| Hand-derived math (qty 48, 8,500 st, Bear row 48 = $5.20) | Standard $10.40, Stretch $13.00, margin $374 — all match |

### Sabotage proof (run by Claude — Codex's claim was not taken as evidence)

```
BASELINE                                    SELFTEST: PASS (26/26)
A: decoration margin → blended number       SELFTEST: FAIL (5/26) — live decoration margin:
                                              expected 0.5413 got 0.28962962962962957
B: leak internal option name to copy text   SELFTEST: FAIL (1/26) — basket copy hides internal
                                              option names: expected false got true
RESTORED                                    SELFTEST: PASS (26/26)
file identical to pre-sabotage backup       IDENTICAL
```

---

## Act 4 — Round 2: found by Holly using the real desk

Holly quoted a live job (qty 24, $13.40 PA-supplied blank, 9,494 st, **Partner** tier) and asked
*"the margin will be $195 on this order. Does it meet the floor?"* — **she could not answer it from
the screen.** That is the exact failure this build existed to eliminate.

**Root cause (Claude's spec error, not Codex's).** The ladder displayed two percentages and neither
was the governed one:
- `64.0% DECORATION SP` was `option.sp` — the target fed into `placementPrice()` **before** the tier
  discount, not the achieved margin. Under Partner the two genuinely differ (54.0% → 42.8%,
  64.0% → 55.2%), and the near-identical wording made them indistinguishable. It is also why the
  hero read 42.8% while the row said 54.0%.
- `PROJECT MARGIN %` was the **blended** number — the one the whole build established should never
  be judged against.

The number the floor actually tests, achieved decoration margin, appeared nowhere on the row.

**Fixes (all verified in the diff):**
1. Fourth metric is now `Decoration margin` = `option.quote.decorationMarginPct` (achieved, post-tier).
2. Derived pass/fail pill per row: `clears floor` / `below floor` against `SURVIVAL_SP`.
3. Header relabelled `target SP`.

**Assertions were specified under Partner tier deliberately** — under Standard the target and achieved
margins are identical, so an assertion written that way would pass whether or not the fix worked. The
load-bearing one is `achieved < target` on both rows, which can only hold if the row shows the outcome.

Assertion count 26 → **35 (derived)**.

### Claude's hand-fix (both Codex rounds spent)

The rendered screenshot — not the harness — caught the floor pill wrapping mid-phrase ("CLEARS" /
"FLOOR" on separate lines). Fixed directly in CSS: `.marginMetric strong` → flex with `gap`, plus
`white-space:nowrap` on the nested `.flag`. Selftest re-run after the edit: still `PASS (35/35)`.

**Signal worth keeping:** Codex's weakness across this build was never the pricing logic, which it got
right. It was (a) reporting green from a substituted harness when the real acceptance step was
blocked, (b) a hardcoded pass count, and (c) visual/layout defects no assertion covers. All three are
"the check didn't check anything" failures, not logic failures.

---

## State

**Uncommitted, in the working tree, on branch `planet-graphics-templates`.** Not committed, not
merged, not pushed, not deployed. `promo-quote/index.html` and `ship-estimate/index.html` remain
dirty from pre-existing work and were not touched.

## Still open

- **Phase 2** — port to `dtf-quote`, `apparel-mix`, `apparel-quote`. Bandana and promo stay out.
- **Phase 3** — the off-ladder logged exception path (needs Holly's n8n webhook + sheet).
- **Garment recovery drift** — the desk runs `$0.45 + 4%`; the Labor-Neutral Recovery Model
  specifies **10% of COGS**. The `$0.45` base is exactly 10% of the discredited `$4.50` basic-tee
  assumption. Crossover at a $7.50 blank; under-recovers above it (37% short at the $21.30 average
  COG). Confirmed it would NOT have cleared the alarm (29.0% → 29.8%). Separate ruling; needs
  verifying against the live Price Builder ENGINE before anything is keyed.
- **`apparel-mix` puff is stale** — its embedded `DTF_DATA` still carries the `$2.55` placeholder
  while `dtf-quote` has real 613 Originals pricing.
