# PLAN — Phase 2: carry the decoration-margin fix to DTF, Mixed, and Screen Printed Apparel

**Repo:** `~/github/planetops` · **Branch:** `planet-graphics-templates` (working tree matches
`origin/frontdoor-gate` for all desk files — verified). Edit in place. **Do not commit, merge, push,
or change branches.**

**Reference implementation:** `embroidery-quote/index.html`, shipped 2026-08-05 (`44abb42` live).
Read it first — Phase 2 mirrors its *shape*, not its code, and the three desks each differ.

**Files in scope (exactly three):** `dtf-quote/index.html`, `apparel-mix/index.html`,
`apparel-quote/index.html`.
**🔴 DO NOT TOUCH:** `bandana-quote/index.html`, `promo-quote/index.html`,
`embroidery-quote/index.html` (already done — do not regress it), `ship-estimate/index.html`
(another terminal's uncommitted work).

---

## Why

The survival floor was being tested against a **blended** margin that includes the garment blank as a
pass-through. That inverts the signal: holding decoration identical, a cheap blank reads healthy and
an expensive blank reads failing, while the expensive-blank order actually earns more. PA's margin
lives in the decoration (the matrices, the `sp_curve`), never in the blank. **The garment recovery
rule is deliberately unchanged on every desk.**

**The bug is NOT uniform. Verified per desk — do not assume, each has its own fix:**

| desk | what's actually wrong | ladder? |
|---|---|---|
| `dtf-quote` | **Real inverted alarm.** `belowFloor` ORs a blended test onto a correct per-line test | ✅ full |
| `apparel-quote` | **Same class, quieter.** Bands the blended per-unit rate red under 33% | ❌ none |
| `apparel-mix` | **No false alarm.** Just a blended hero % with no decoration gauge | ⚠️ partial |

**🔒 Holly's ruling (2026-08-05): no ladder on matrix-priced work.** Screen-print margin is baked
into the Printavo matrix; there is no target % to uplift, and inventing one would make a governed
price a starting point. That is the same concern that killed the custom-margin field.

---

## Desk 1 — `dtf-quote/index.html` (full treatment)

**Fix the alarm.** At `~line 556`:

```js
const belowFloor = lineCalcs.some(row => row.actualMargin < survival - .0001)
                   || marginPct < survival - .0001;   // <-- DELETE this clause
```

`marginPct` (`~line 539`) is `projectMargin / totalRevenue` — blended. **Delete only the second
clause.** The `lineCalcs.some(...)` half is already the correct per-line decoration test; keep it
exactly as is.

**Zones.** Goods = garment revenue/cost. Decoration = the transfer lines (`baseUnit` already includes
transfer + the $0.66 labor + shipping share — that is the correct decoration cost, do not strip it).
Services = none on this desk. Compute `decorationMarginPct` from the line totals.

**Hero** (`~line 216`, `#projectMargin` / `#marginPct` / `#projectCost`): keep margin **dollars** as
the headline. `#marginPct` shows decoration margin; add a **muted** span showing blended alongside.
Match the embroidery desk's `.muted` treatment.

**Ladder.** Standard + Stretch, `STRETCH_UPLIFT = 0.10`, `STRETCH_CAP = 0.65` applied to the
`sp_curve` target. Each row: unit price, order total, project margin $, **achieved post-tier
decoration margin** + derived `clears floor` / `below floor` pill. **No Floor row.** Checkbox +
"Add checked to comparison" into the existing basket, using a **`copyLabel`** so internal option
names never reach `basketCopyText()` (customer-facing). Hero always tracks Standard.

⚠️ The gang-pricing path (`gangedLineCalc`) must stay correct under the ladder — a Stretch quote with
ganging applied must still reflect the collapsed film cost.

---

## Desk 2 — `apparel-quote/index.html` (fix the chip, no ladder)

**The defect** is at `~line 381`:

```js
rows.push(row('Per-unit price', money(perUnit), '…', true, marginInfo(perUnit, perUnitCost)));
```

`marginInfo` runs `band()` (`~line 267`), which paints anything under 33% red `below`. `perUnit` /
`perUnitCost` are **blended** — they include `s.blank` on both sides plus the recovery. An expensive
blank therefore turns the chip red while the print is priced correctly off the matrix.

**Fix:** band the **decoration** rate (P1 + P2 + imprint fees + services, against their own costs —
excluding `blank` and `recovery`). Keep the per-unit **price** displayed as it is; only the banded
rate changes. Add a second, visually subordinate row or chip showing the blended rate labelled as
such, so the invoice truth is still visible and clearly distinguished.

**🔴 No ladder on this desk.** Screen-print margin is matrix-baked; there is nothing to flex. Do not
add a Standard/Stretch box here.

The existing per-line chips (`Blank`, `Garment recovery`, `P1 decoration`, …) are already correct —
**leave them alone.**

---

## Desk 3 — `apparel-mix/index.html` (gauge + partial ladder + puff fix)

**Gauge.** No false alarm to fix here — its only project-level flag is the informational green
"SLIDING MARGIN NOTE" (`~line 655`). Add the decoration/blended split: `#projectMarginPct`
(`~line 664`) becomes decoration margin, blended shown muted beside it, margin dollars unchanged as
headline. Decoration = every placement line regardless of method (screen print, embroidery, DTF, each
has a real cost). Services = `SERVICES` + `IMPRINT_FEES`. Goods = garment recovery.

**Partial ladder.** Standard + Stretch, but **Stretch moves ONLY the curve-driven placements
(embroidery + DTF)**. Screen-print placements keep their matrix price untouched in both rows. Each
Stretch row must **state which methods it moved**, e.g. `Stretch applied to embroidery and DTF
placements; screen print held at matrix price.` Derive that list — do not hardcode it. If a quote has
**only** screen-print placements, the Stretch row is identical to Standard: **hide the ladder
entirely rather than show a Stretch row that cannot stretch.**

Update the `SLIDING MARGIN NOTE` wording so it stays true alongside the ladder.

**Puff data fix (separate, verify carefully).** `apparel-mix`'s embedded `DTF_DATA` still carries
`"flat_cost_estimate":2.55` — the dead placeholder — while `dtf-quote` has the real 613 Originals
pricing. Confirmed: that string appears **1×** in `apparel-mix` and **0×** in `dtf-quote`.

Copy the real `PUFF` block from `dtf-quote/index.html`'s `DTF_DATA` verbatim.

**🔴 Do not bodge this.** Real `PUFF` carries **bespoke `qty_bands`** (`1-24 / 25-49 / 50-99 /
100-299 / 300+`) and its own sizes (`PF_L`, `PF_XL`, `PF_GANG_L`, `PF_GANG_XL`) that differ from the
standard band set. If `apparel-mix`'s `calcDtf` / cost-lookup cannot handle a transfer type with its
own `qty_bands`, **say so and leave the placeholder in place** — do not fake a mapping onto the
standard bands. A wrong puff cost is worse than a known-stale one. Report either way.

---

## Invariants (all three desks)

1. **🔴 Every displayed number is DERIVED.** Never echo a target back as if it were an outcome. This
   is what broke round 2 on embroidery: the ladder showed target SP where the governed number
   belonged, and Holly could not answer "does this clear the floor" from the screen.
2. **No free-form margin % input.** Anywhere. Governed rows only.
3. **No Floor row** in any ladder — a visible floor becomes the price.
4. Do not change `sp_curve` bands, tier bands, `floor_ratio`, cost grids, the garment recovery
   formula, or any tier/survival flooring logic inside the price functions.
5. Verify the reverse price check, comparison basket, and Clear form still work on each desk.
   **Verify — do not assume.**

---

## Acceptance — runnable, and each harness must be seen to fail

Add `?selftest=1` to each of the three desks, writing one line into `<pre id="selftestOut">`:
`SELFTEST: PASS (n/n)` or `SELFTEST: FAIL (f/n) — <name>: expected X got Y`. **Count derived, never
hardcoded** — that was a real defect in Phase 1. A normal page load must be completely unaffected.

```bash
for d in dtf-quote apparel-mix apparel-quote; do
  printf '%-14s ' "$d"
  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --headless --disable-gpu --no-sandbox --virtual-time-budget=4000 --dump-dom \
    "file:///Users/hollytrevino/github/planetops/$d/index.html?selftest=1" 2>/dev/null \
  | python3 -c "import sys,re;h=sys.stdin.read();m=re.search(r'<pre id=\"selftestOut\"[^>]*>(.*?)</pre>',h,re.S);print(m.group(1).strip() if m else 'NODE NOT FOUND')"
done
```

**Parse the DOM node, not a grep** — `--dump-dom` also emits the inline `<script>` source, so a bare
grep matches the string in the code and fakes a pass.

### Required assertions per desk

- **Regression:** capture each desk's current outputs for one representative quote *before* changing
  anything and assert they still hold where they should.
- **🔑 Blank independence:** same quote at two very different blank costs → **identical decoration
  margin** and **identical flag/band state**. This is the assertion the whole change exists for.
- **dtf:** an expensive-blank quote whose blended margin is under 33% raises **no** below-floor flag,
  while a genuinely under-floor *line* still does.
- **apparel-quote:** the banded rate is the decoration rate, not blended — assert they differ on an
  expensive blank, and that the chip is not `bad` when decoration is healthy.
- **apparel-mix:** Stretch changes embroidery/DTF placement prices and leaves screen-print prices
  **byte-identical**; a screen-print-only quote hides the ladder.
- **Ladder desks:** assert under **Partner tier**, where target SP and achieved margin genuinely
  differ. Under Standard they are equal and the assertion proves nothing. Load-bearing check:
  **achieved < target**.
- **No free-form field:** `document.querySelector('#customMarginPct, #customPct')` is `null`.

### 🔴 Sabotage each harness before reporting done

For **each** desk, deliberately break its core change, re-run, confirm `SELFTEST: FAIL` with a useful
message, revert, confirm `PASS`. **Report all three FAIL outputs verbatim.** A harness never seen to
fail is not evidence.

⚠️ If Chrome produces nothing, that is **your sandbox blocking it, not a Chrome bug** — it happened in
Phase 1 and was misdiagnosed. Say you could not run it; do not substitute another harness and report
its result as a pass.

---

## Out of scope

No deploy, no commit, no push. No changes to the three untouchable desks. No refactor into shared
modules — these stay self-contained files. Do not touch the garment recovery formula (the
`$0.45 + 4%` vs 10%-of-COGS question is a separate open ruling).
