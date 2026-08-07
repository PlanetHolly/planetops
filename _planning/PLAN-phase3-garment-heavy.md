# PLAN — Phase 3a: overhead gauge, governed blank markup, volume ladder (embroidery desk)

**Repo:** `~/github/planetops` · **Branch:** `planet-graphics-templates` · **Do not commit, push, or deploy.**

**Phase 3a touches ONE file: `embroidery-quote/index.html`.** It is live and **Cortney is quoting
customers on it right now**, so default behaviour must not shift by a cent.

**🔴 DO NOT TOUCH:** `dtf-quote`, `apparel-mix` (Phase 3b), `apparel-quote`, `bandana-quote`,
`promo-quote`, `ship-estimate`.

---

## Why

A real whale quote exposed a structural hole. Blank $30.19, 9,494 stitches, PA-supplied, Standard:

| qty | unit | order | margin $ | decoration | blended | vs 33% overhead |
|---|---|---|---|---|---|---|
| 12 | $51.19 | $614 | $155 | 58.1% | 25.2% | short $48 |
| 48 | $42.29 | $2,030 | $331 | 50.0% | 16.3% | short $339 |
| 192 | $38.69 | $7,428 | $910 | 44.7% | **12.3%** | **short $1,541** |

**The rate gets worse as the customer orders more**, because the sliding curve walks decoration down
while the blank passes through at a flat ~5.6%. At 192 units PA fronts **$5,796 of blank to earn
~$326 on it**. The desk currently shows two green `CLEARS FLOOR` pills on this order and says nothing.

Holly's ruling 2026-08-07: build the visibility **and** a governed blank-markup control, plus a
volume ladder.

---

## 1. Order overhead-share gauge

New derived figure: `overheadShare = projectMargin − (projectRevenue × 0.33)`.

- Render **next to** the existing decoration flag, never replacing it. They answer different
  questions: decoration = *is the work priced right*; overhead = *did the order pay its share*.
- **Wording must be neutral, not alarmist.** `ORDER CARRIES ITS OVERHEAD SHARE — $X clear` /
  `ORDER IS UNDER ITS OVERHEAD SHARE BY $X`. Use `warn` styling for the under case, **never `bad`** —
  a red alarm on a structurally-common case is how alert fatigue starts.
- Add one line of provenance: the 33% is the 2026 Jan–Jun break-even rate (overhead ÷ revenue), a
  **portfolio average used here as a per-order signal**. Say that in the meta text so nobody reads
  it as a hard gate.

## 2. Garment-heavy flag

When `garment.cost / projectCost > 0.60`, raise a `warn` block stating the derived share and the
dollars, e.g. *"Garment is 79% of project cost and delivers 13% of project margin."* Derive both.

## 3. Customer-supplied comparison line

One line, near the gauge: what this exact job looks like if the customer supplied the garment —
unit price, project margin $, blended %. Reuse the existing `garmentMath()` customer-supplied path
(`recovery = 0.45`, no blank cost/revenue). **Display only — it must not change the quote.**

## 4. 🔒 Governed blank-markup control

New select, next to Garment source. **Fixed options only — NO free-form % input**
(see `feedback_quote_desk_margin_governance`):

| value | label | recovery per unit |
|---|---|---|
| `current` **(default)** | `Current recovery ($0.45 + 4%)` | `roundUpNickel(0.45 + 0.04 × blank)` |
| `pct10` | `10% of blank (model spec)` | `roundUpNickel(blank × 0.10)` |
| `pct20` | `20% of blank` | `roundUpNickel(blank × 0.20)` |
| `to33` | `Price blank to 33% margin` | `roundUpNickel(blank / 0.67 − blank)` |

**🔴 `current` is the default and must reproduce today's output to the cent.** Show the resulting
$/unit next to the selector, derived. The existing customer-supplied path is unaffected (flat $0.45).

**Do not change `garmentRecovery`'s formula itself** — add the mode around it. The
`$0.45 + 4%` vs 10% question stays an open pricing ruling; this control lets a PM apply a
pre-approved alternative on a garment-heavy job, it does not redefine the default.

## 5. Volume ladder

New panel: the same job repriced at every Bear qty row **above** the entered quantity
(from `EMBROIDERY_DATA._meta.qty_rows`). Per row: qty, unit price, order total, project margin $,
blended %, and overhead-share status.

**🔴 Recompute through the real engine at each qty** — `qtyRow()`, `targetSpForQty()`,
`placementPrice()`, `garmentMath()`. Do **not** extrapolate or scale. The whole point is showing the
Bear cost step and the curve step interacting.

Hide the panel when the entered qty is already the top row. Header states plainly that the rate
falls as volume rises when the blank is passed through flat.

---

## Invariants

1. **Default state is byte-for-byte today's quote.** Regression assertions on the live figures.
2. All new numbers **derived**, never echoed.
3. No free-form margin or markup input anywhere.
4. The decoration floor test and the Standard/Stretch ladder are **unchanged**.
5. Reverse price check, comparison basket, Clear form still work — verify, don't assume.

---

## Acceptance

Extend `?selftest=1`, count derived. Run it **outside any sandbox**, parsing the `<pre id="selftestOut">`
node (a grep also matches the inline script source):

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu --no-sandbox --virtual-time-budget=5000 --dump-dom \
  "file:///Users/hollytrevino/github/planetops/embroidery-quote/index.html?selftest=1" \
| python3 -c "import sys,re;h=sys.stdin.read();m=re.search(r'<pre id=\"selftestOut\"[^>]*>(.*?)</pre>',h,re.S);print(m.group(1).strip() if m else 'NODE NOT FOUND')"
```

Assertions to add (keep every existing one passing):

1. **Default regression** — qty 24, blank $13.40, 9,494 st, Standard: revenue `648.00`, cost `460.32`,
   margin `187.68`, decoration `0.5413`. Unchanged from today.
2. **Whale regression** — qty 12, blank $30.19: recovery `1.70`, revenue `614.28`, margin `154.92`,
   decoration `0.5808`, blended `0.2522`.
3. **Overhead gauge** — that same quote reports **under** by `47.79` (± 0.01), and the flag is `warn`,
   **not** `bad`.
4. **Gauge is not vacuous** — a quote that clears (e.g. blank `0`, qty 48) reports **carries**.
5. **Markup modes** — on the whale quote (blank `$30.19`), recovery is **`1.70 / 3.05 / 6.05 / 14.90`**
   for `current / pct10 / pct20 / to33`, and `to33` yields a garment margin rate of ≥ 0.33.

   **🔴 CORRECTED 2026-08-07.** This line previously read `1.70 / 3.02 / 6.04 / 14.87` — those are the
   **raw values before rounding**, and they were wrong. **Every markup mode must use `roundUpNickel`,
   the same as `current` and every other price on this desk.** Rounding *up* also matters for `to33`:
   rounding down would drop the garment under the 33% it is named for.
6. **Default unchanged by the new control** — with mode `current`, every output equals assertion 1.
7. **Volume ladder** — for the whale quote the 192 row shows blended **below** the 12 row's blended
   (the rate-collapse property), and each row's unit price is **lower** than the row above it.
8. **Ladder rows come from the engine** — the 192 row's decoration margin equals
   `placementPrice(bear_cost[192][1], targetSpForQty(192).sp, 'Standard', 192)`, computed independently.
9. **Customer-supplied line** — shows a higher blended % and a lower order total than the PA-supplied
   quote, and does not alter `#marginTotal`.
10. **No free-form field** — `document.querySelector('#customMarginPct, #customPct, #customMarkupPct')` is `null`.

### 🔴 Sabotage before reporting done

Break each of: the overhead gauge sign, the markup mode lookup, and the volume ladder's per-qty
recompute. Confirm a **distinct, useful** failure each time. Revert, confirm PASS. Report all three
verbatim. ⚠️ If Chrome emits nothing that is **your sandbox**, not a Chrome bug — say so, do not
substitute a harness.

---

## Out of scope

No deploy/commit/push. No change to `sp_curve`, tier bands, `bear_cost`, the survival floor, or the
default recovery formula. Phase 3b ports to `dtf-quote` + `apparel-mix` after Holly sees this.
