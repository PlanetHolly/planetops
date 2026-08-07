# PLAN — Garment margin lever (additive), replacing the blank-markup selector

**File:** `embroidery-quote/index.html` **only.** Not committed, not deployed.
**Supersedes** the blank-markup selector in `PLAN-phase3-garment-heavy.md` (the `current / pct10 /
pct20 / to33` replacement modes). **Everything else in that plan — overhead gauge, garment-heavy
flag, customer-supplied comparison, volume ladder — stays exactly as built.**

**🔴 DO NOT TOUCH** `dtf-quote`, `apparel-mix`, `apparel-quote`, `bandana-quote`, `promo-quote`,
`ship-estimate`. Ports come later.

---

## Why the change

Holly's ruling 2026-08-07, after we read `GARMENT_SP_RESOLUTION.md` together:

**`$0.45 + 4%` is COST RECOVERY, not markup.** `$0.45` = receiving labour (`$34/hr ÷ 60 × 0.75 min`).
`4%` = cash float (0.99%) + spoilage (3.00%). The garment is designed to earn PA **~0% profit**; all
profit lives in the decoration matrix/curve. See [[reference_garment_recovery_derivation]].

So a lever that *replaces* the recovery was conceptually wrong — it confused reimbursement with
profit, and needed a floor to stop it going backwards. **The new lever is ADDITIVE**: recovery stays
untouched, and a separate, explicit garment margin sits on top. It can never reduce anything, and the
two are shown as separate lines because they are different things.

**The stack:**

```
  blank cost                                    ← what PA pays
+ roundUpNickel($0.45 + 4% × blank)             ← cost recovery, UNCHANGED, always applied
+ roundUpNickel(marginPct × blank)              ← NEW, actual profit
  ────────────────────────────────
  garment line
+ decoration (Standard / Stretch curve)         ← untouched
```

---

## The control

Replace the existing markup `<select>` with **Garment margin**, three governed levels:

| value | label | margin % of blank |
|---|---|---|
| `none` **(default)** | `None (cost recovery only)` | **0%** |
| `plus` | `Plus 5%` | 5% |
| `premium` | `Premium (scales with quantity)` | **banded, below** |

```js
const GARMENT_MARGIN_PLUS = 0.05;
const GARMENT_PREMIUM_BANDS = [           // aligned to the desk's qty rows + sp_curve shape
  {max: 47,   pct: 0.15},
  {max: 143,  pct: 0.12},
  {max: null, pct: 0.10}
];
```

- **`none` is the default and MUST reproduce today's quote to the cent.** Cortney is quoting live on
  this desk; anyone who never opens the dropdown sees no change whatsoever.
- Margin is `roundUpNickel(pct × blank)` — **blank cost only**, not blank+recovery. Same nickel
  rounding as everything else on the page.
- **Premium is banded by ORDER QUANTITY, not chosen.** High rate on small orders, stepping down with
  volume — the same shape as the decoration curve. The PM makes no judgement call.
- **Customer-supplied garments get zero garment margin** at every level (blank cost to PA is 0, and
  recovery stays the flat `$0.45` handling). Assert this.
- Show the resolved figures next to the control, derived: recovery `$X`, garment margin `$Y`, and for
  Premium the band that applied (e.g. `15% at qty 12`).

## Display

The garment breakdown must show **recovery and margin as two separate lines**, never merged:

```
  Garment cost recovery    $1.70 / unit    handling $0.45 + 4% float & spoilage
  Garment margin           $4.55 / unit    Premium, 15% at qty 12
```

That separation is the point — it keeps "money paid back" visually distinct from "money earned".

## Interactions

- **Both ladder rows** (Standard and Stretch) reflect the selected garment margin. Decoration sell
  price and decoration margin % are **identical across levels** — assert this.
- **Volume ladder rows must apply the Premium band for THAT row's quantity**, not the current
  quote's. With Premium selected on a 12-pc quote, the 192 row uses 10%, not 15%. This is the
  headline behaviour of the whole feature — assert it explicitly.
- Overhead gauge, garment-heavy flag and customer-supplied line all recompute with the margin applied.

---

## Acceptance

Extend `?selftest=1`; count derived. Run outside any sandbox, parsing the `<pre id="selftestOut">` node
(a grep also matches the inline script source). Keep every existing assertion passing.

New assertions:

1. **Default unchanged** — `none`, qty 24, blank $13.40, Standard: revenue `648.00`, cost `460.32`,
   margin `187.68`, decoration `0.5413`. Identical to today.
2. **Recovery never moves** — recovery is `1.70` on a `$30.19` blank at **all three** levels.
3. **Margin values** — blank `$30.19`: `none` → `0.00`, `plus` → `1.55`,
   `premium` → `4.55` @qty 12, `3.65` @qty 48, `3.05` @qty 192.
4. **Premium banding is live** — same blank, Premium selected: the per-unit garment margin at qty 48
   is strictly less than at qty 12, and at 192 strictly less than at 48.
5. **Decoration untouched** — decoration sell/unit and decoration margin % are identical across all
   three levels on the same quote.
6. **Additive, never subtractive** — for blanks `$3.00 / $4.50 / $8.63 / $30.19`, the garment line at
   `plus` and `premium` is `>=` the line at `none`. (This is what the old replacement design got
   wrong.)
7. **Volume ladder bands per row** — with Premium on a qty-12 quote, the ladder's 192 row uses a
   `3.05` garment margin, not `4.55`. Derive the expected value independently.
8. **Customer-supplied** — garment margin is `0.00` at all three levels; recovery stays `0.45`.
9. **No free-form field** — `document.querySelector('#customMarginPct, #customPct, #customMarkupPct')`
   is `null`.

### 🔴 Sabotage before reporting done

Break each of: (a) the additive stacking (make margin replace recovery), (b) the Premium band lookup
(make it flat), (c) the volume ladder's per-row band. Confirm a **distinct, useful** failure each
time. Revert, confirm PASS. Report all three verbatim.

⚠️ If Chrome emits nothing that is **your sandbox**, not a Chrome bug — say so plainly and do not
substitute a harness.

## Out of scope

No deploy/commit/push. No change to the recovery formula, `sp_curve`, tier bands, `bear_cost`, the
survival floor, or the decoration ladder. The overhead gauge, garment-heavy flag, customer-supplied
line and volume ladder are already built and correct — extend them, don't rebuild them.
