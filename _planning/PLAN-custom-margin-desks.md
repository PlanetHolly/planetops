# PLAN — Fix what the quote desks police, and replace the margin field with a governed ladder

**Repo:** `~/github/planetops` · **Working branch:** `planet-graphics-templates`
(138 commits behind `origin/frontdoor-gate`, but every desk file in the working tree is
byte-identical to `origin/frontdoor-gate` — verified. Edit in place. Do NOT rebase, merge, commit,
or push.)

**PHASE 1 IS ONE FILE: `embroidery-quote/index.html`.** Nothing else. See Phases at the bottom.

**Supersedes** the earlier version of this plan, which added a free-form "custom margin %" field.
That approach was rejected by Holly on 2026-08-05 and the reasoning is below — do not resurrect it.

---

## Why this build exists

The desk applies a 33% survival floor to a **blended** project margin that includes the garment
blank. The blank is a deliberate pass-through: PA's margin lives in the decoration (the Printavo
matrices for screen print, the sliding `sp_curve` for embroidery and DTF), and the garment carries
only a handling top-up of `$0.45 + 4% of blank`. **That architecture is correct and is NOT being
changed by this build.** What's broken is what the desk measures against it.

**Proven on a live quote** (24 pcs, 9,494 stitches, `bear_cost["24"][1] = $5.78`, decoration priced
at the qty-24 curve target of 54%). Changing *only* the blank:

| blank | garment margin | decoration margin | project $ | blended % | desk verdict |
|---|---|---|---|---|---|
| $3.00 | $14.40 | $163.68 (54.1%) | **$178.08** | 45.8% | ✅ CLEARS SURVIVAL |
| $13.40 | $24.00 | $163.68 (54.1%) | **$187.68** | 29.0% | 🔴 BELOW SURVIVAL |

Identical work, identical decoration margin, and **the more profitable order is the one flagged as
failing.**

**And the alarm cannot ever fire for the reason it claims.** `placementPrice()` floors every
placement at `roundUpNickel(cost / (1 - 0.33))`. A sweep of all 7 qty rows × 5 stitch bands × both
tiers puts the **lowest achievable decoration margin at 37.65%** — the floor is structural.
Therefore **100% of the BELOW SURVIVAL alarms this desk has ever produced were garment dilution.**

A free-form margin % field would let a PM "fix" that false alarm by raising the price of the
*embroidery* because the customer chose an expensive jacket. That is the inconsistency Holly is
protecting against, so the fix is to remove the lever, not to govern it.

---

## Scope of Phase 1 — `embroidery-quote/index.html` only

### 1. Split the quote into three named zones

Compute and expose these alongside the existing `projectRevenue` / `projectCost`:

| zone | contents | governed by |
|---|---|---|
| **A · Goods** | `garment.revenue` / `garment.cost` | the recovery rule (`0.45 + 0.04 × blank`) — **untouched** |
| **B · Decoration** | placement lines only (`placementRevenue` / `placementCost`) | the sliding `sp_curve`, floored at 33% |
| **C · Services** | specialty item revenue (cost is 0 by model) | the fee card |

`decorationMarginPct = (placementRevenue - placementCost) / placementRevenue`.

**Zone B is what the survival floor tests.** Zone C is excluded from the floor test on purpose —
it is zero-cost revenue and including it would only inflate the ratio and weaken the guardrail.

### 2. Repoint the survival flag

- **Red `bad` flag** — reserve for genuine failure only: `decorationMarginPct < SURVIVAL_SP`,
  a missing/zero `bear_cost` lookup, or the existing over-grid / missing-stitch cases. Given the
  structural floor, the margin branch should be unreachable in practice — **keep it anyway** as the
  assertion that the guardrail held, and word it about *decoration*, not the project.
- **Green `good` flag** — `DECORATION CLEARS SURVIVAL — 54.1% on Bear cost, floor 33%.`
- **Blended dilution note (new, `warn` styling, NOT `bad`)** — fires when
  `projectMarginPct < decorationMarginPct - 0.05`. It explains rather than alarms, with the real
  dollars, e.g.:

  > `Blended project margin 29.0% — the PA-supplied blank dilutes the ratio. $321.60 of garment
  > cost is recovered at $1.00/unit by design; PA's margin is in the decoration, at 54.1%.
  > Project profit is $187.68.`

  Derive every figure. Do not hardcode the example.

### 3. Hero row

`#marginTotal` already leads with project margin **dollars** — keep it exactly as the hero.
Change only the meta line beneath it:

- `#marginUnit` — unchanged (`$7.82 / unit`).
- `#marginPct` — now shows the **governed** number: `54.1% decoration`.
- **New muted span** next to it: `29.0% blended` in `var(--muted)`, visually subordinate.

The blended number stays visible because it is invoice truth. It just stops being the headline and
stops raising alarms.

### 4. Margin options ladder

New `<section>` immediately **above** the existing "Customer comparison" section, titled
**MARGIN OPTIONS**. Exactly two governed rows — no free-form input anywhere:

| row | decoration SP | note |
|---|---|---|
| **Standard** | `targetSpForQty(qty).sp` | the default; the desk's live quote; pre-checked |
| **Stretch** | `min(target + 0.10, 0.65)` | pre-approved higher point for low-competition work |

Each row shows, all derived: decoration SP %, per-unit customer price, order total, project margin
$, project margin %. Each row has a checkbox. One button: **Add checked to comparison** → pushes
each checked row into the **existing** basket (`addToBasket` / `BASKET` / `CURRENT_QUOTE`) as a
separate labeled option (`"Standard"` / `"Stretch"`), so `copyBasket` produces the good/better
plain-text comparison for a customer email.

**🔴 There is deliberately no Floor row.** A visible floor becomes the price. The 33% floor stays
an invisible guardrail inside `placementPrice()`.

**The hero always tracks Standard.** Checking Stretch adds it to the comparison; it never repoints
the hero, the breakdown, or the reverse price check.

Define `const STRETCH_UPLIFT = 0.10; const STRETCH_CAP = 0.65;` near `SURVIVAL_SP` so the shape is
tunable in one place.

### 5. What must NOT be added

- **No free-form margin % input.** Not for PMs, not gated, not hidden. It is not in this build.
- **No change** to `sp_curve` bands, tier discount bands, `floor_ratio`, `bear_cost`, the garment
  recovery formula, or any embedded pricing data.
- **No change** to `placementPrice()`'s floor logic.

### 6. Don't break what's already there

Verify (don't assume) that the ladder and the new zone math leave these working:
`renderPriceCheck` / `PC_LAST` (reverse price check), the basket copy text, **Clear form**, the
`?` no-quote paths (`setNoQuote`), and the vendor-routing Empowered warning.

---

## Acceptance check — runnable, and it must be seen to fail

Add a `?selftest=1` mode: on load with that param, run the assertions and write one line into a
`<pre id="selftestOut">` appended to body — `SELFTEST: PASS (n/n)` or
`SELFTEST: FAIL — <name>: expected X got Y`. Normal page load completely unaffected.

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu --no-sandbox --virtual-time-budget=4000 --dump-dom \
  "file:///Users/hollytrevino/github/planetops/embroidery-quote/index.html?selftest=1" \
  2>/dev/null | grep -o 'SELFTEST:[^<]*'
```

**Done means it prints `SELFTEST: PASS`.**

### Assertions

1. **Live-quote regression.** qty 24, blank $13.40 PA-supplied, garment qty 24, 1 placement 9,494
   st, Standard, Bear: `projectRevenue === 648.00`, `projectCost === 460.32`,
   `projectMargin === 187.68`, blended `≈ 28.96%`, `decorationMarginPct ≈ 54.13%`,
   per-decorated-unit `=== 27.00`, margin/unit `≈ 7.82`. (These are the live desk's real outputs —
   they must not move.)
2. **🔑 Blank independence.** Same inputs, blank `$3.00` instead of `$13.40`:
   `decorationMarginPct` is **identical** to assertion 1, and the flag state is **identical**
   (both green). This is the assertion the whole build exists for.
3. **No false alarm.** In assertion 1 no `bad` flag is present, and the dilution `warn` note IS
   present and contains the derived `$187.68` and `54.1%`.
4. **Structural floor sweep.** Across all 7 `bear_cost` qty rows × 5 stitch bands × both tiers,
   `decorationMarginPct >= 0.33` in every case. (Reference: the lowest is 37.65%.)
5. **Ladder correctness.** Stretch row's decoration SP `=== min(target + 0.10, 0.65)`; its per-unit
   price is strictly greater than Standard's; its project margin $ is strictly greater.
6. **Hero tracks Standard.** Checking the Stretch box does not change `#marginTotal`, `#marginPct`,
   `#orderTotal`, or `#perUnit`.
7. **Basket.** Checking both rows and clicking Add puts exactly 2 items in `BASKET`, labeled
   `Standard` and `Stretch`, with the two different prices.
8. **No free-form field.** `document.querySelector('#customMarginPct, #customPct')` is `null`.

### 🔴 Sabotage the harness before reporting done

Deliberately break the change — e.g. point `decorationMarginPct` back at the blended number — re-run
the command, confirm it prints `SELFTEST: FAIL` with a useful message. Revert, confirm `PASS`.
**Report both outputs.** A selftest never seen to fail is not evidence.

---

## Phases

- **Phase 1 (this build):** `embroidery-quote/index.html` only. Holly eyeballs the real thing and
  rules on the row set and wording.
- **Phase 2 (after her look):** port the settled design to `dtf-quote/index.html`,
  `apparel-mix/index.html`, `apparel-quote/index.html`. **`bandana-quote/index.html` is out of
  scope — do not touch it.** `promo-quote/index.html` is also out: it marks up the whole landed
  cost uniformly, so it has no pass-through zone and no dilution to fix.
- **Phase 3 (deferred, needs Holly):** the off-ladder exception path — PM's name + required reason,
  logged. It needs an n8n webhook and a sheet, which Holly builds herself. Not started here, and
  **not half-built.**

## Report, don't fix

`apparel-mix/index.html` carries its own embedded `DTF_DATA` in which `PUFF` is still the `$2.55`
placeholder, while `dtf-quote/index.html` has the real 613 Originals pricing. The mix desk quotes
puff off a stale number. **Phase 2 territory — flag it, don't fix it now.**
