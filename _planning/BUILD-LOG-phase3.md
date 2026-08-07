# BUILD LOG — Phase 3a: overhead gauge, garment margin lever, volume ladder (embroidery)

**Dates:** 2026-08-05 → 2026-08-07 · **File:** `embroidery-quote/index.html` only
**Builder:** Codex `0.139.0`, thread `019fd4…` · **Reviewer:** Opus · **Hand-fixes by Claude:** 2

---

## What shipped

1. **Order overhead-share gauge** — `projectMargin − (projectRevenue × 0.33)`, rendered beside the
   decoration flag, never replacing it. **`warn` styling, never `bad`** — an order under its overhead
   share is structurally common on garment-heavy work; a red alarm there trains people to ignore it.
   Meta text states the 33% is a portfolio average used as a per-order signal.
2. **Garment-heavy flag** — fires when garment cost > 60% of project cost, quoting the derived share.
3. **Customer-supplied comparison line** — display only, never alters the quote.
4. **Garment margin lever** — see below.
5. **Volume ladder** — the same job repriced at every Bear qty row above the entered quantity,
   **recomputed through the real engine** at each row, not extrapolated.

## 🔴 The design reversal that defines this phase

The lever was originally built as a **blank-markup replacement** (`current / 10% / 20% / to-33%`),
which needed a floor to stop it paying *less* than today on cheap blanks. Holly challenged the $0.45
as arbitrary. Reading the source — `Pricing/Revenue_Architecture_2026-07/GARMENT_SP_RESOLUTION.md` —
proved it is not:

> `$0.45` = receiving labour (`$34/hr ÷ 60 × 0.75 min`). `4%` = cash float 0.99% + spoilage 3.00%.

**It is cost RECOVERY, not markup. The garment is designed to earn ~0% profit** — the decoration
matrix carries all overhead (screen-print SP $150,921.78 vs overhead share $94,583.45). So a lever
that *replaces* recovery confused reimbursement with profit. See
[[reference_garment_recovery_derivation]].

**Rebuilt as ADDITIVE.** Recovery untouched and always applied; margin stacks on top:

```
blank + roundUpNickel($0.45 + 4% × blank) + roundUpNickel(pct × blank)
```

This makes the cheap-blank regression structurally impossible, and recovery and margin render as
**two separate lines** because they are different things.

**Final control** (labels follow the promo desk pattern — percentage in the label):

| option | margin |
|---|---|
| `Standard - cost recovery only - 0%` **(default)** | 0% |
| `Above standard - 5%` | flat 5% |
| `Premium - 10-15% by volume` | **15% ≤47 · 12% 48–143 · 10% 144+** |

Premium is **banded by quantity, not chosen** — high rate on small orders, stepping down with volume,
same shape as the decoration curve. No PM judgement. All four values live in two constants
(`GARMENT_MARGIN_PLUS`, `GARMENT_PREMIUM_BANDS`) — retuning is a one-line edit.

---

## Review findings

**Round 1 — Claude's error, not Codex's.** The plan's assertion 5 gave expected recoveries
`3.02 / 6.04 / 14.87` — **raw values before rounding**. Codex flagged the contradiction between the
table and the rounding wording and, correctly, treated the explicit numbers as governing. Result:
the markup modes used `roundCent` (and `to33` no rounding at all), making the new control the only
thing on the page not rounding to the nickel — and `to33` could land under the 33% it was named for.
Corrected to `1.70 / 3.05 / 6.05 / 14.90`, all `roundUpNickel`.

**Round 2 — the additive rebuild** (above), which superseded the markup modes entirely.

### Claude's hand-fixes
1. Promo-style option labels + helper line (cosmetic; selftest re-run after).
2. *(Phase 1 carry-over)* `runSelftest()` try/catch so a throwing harness reports
   `SELFTEST: ERROR` instead of rendering blank.

---

## Verification — run by Claude, outside Codex's sandbox

```
FINAL                                        SELFTEST: PASS (104/104)   count derived

default head-to-head vs origin/frontdoor-gate, qty 24 / $13.40 / 9,494 st:
  live   $188 | $7.82 / unit | 54.1% decoration | $648 | $27.00
  new    $188 | $7.82 / unit | 54.1% decoration | $648 | $27.00      IDENTICAL

Codex sabotage:
  additive stacking      FAIL (8/104)  — expected 3.75 got 3.6   (the cheap-blank regression)
  premium band lookup    FAIL (5/104)  — qty48 expected 3.65 got 4.55
  ladder per-row band    FAIL (2/104)  — 192 row expected 3.05 got 4.55
Claude sabotage:
  margin replaces recovery  FAIL (8/104) — expected 3.75 got 3.6
  premium bands flattened   FAIL (3/104) — qty12 expected 4.55 got 3.05
RESTORED                                     PASS (104/104), byte-identical to backup
```

Rendered and eyeballed with Premium on the live whale quote. Untouched vs live throughout:
`dtf-quote`, `apparel-mix`, `apparel-quote`, `bandana-quote`, `promo-quote`, `ship-estimate`.

**Whale effect** (blank $30.19, 9,494 st, Standard tier, Premium on): qty 12 margin **$155 → $210**,
blended 25.2% → 31.3%, overhead gap **−$47.79 → −$11.21**. At 192 the ladder applies 10% and Premium
adds **$586** to the order.

---

## Still open

- **Not ported** — `dtf-quote`, `apparel-mix`, `apparel-quote` have none of Phase 3.
- **Percentages not final** — 5 / 15 / 12 / 10 are Holly's working values, trivially retunable.
- **Spoilage 3.00% is Grade D** and is ~75% of the 4% recovery. Measuring real spoilage is the
  highest-value check on the recovery formula.
- **The overhead gauge tests the BLENDED number** against a rate derived on total revenue that
  already includes zero-profit garment revenue. Arguably the wrong denominator for a garment-heavy
  order — revisit with the Premium decision, not ahead of it.
- `apparel-mix` PUFF still the `$2.55` placeholder.
