# Art Namer → PlanetOps Feed: Implementation Briefing

**Read this when you start building the Feed surface in the app.** It tells you exactly how Art Namer plugs in, what already exists, what you must not re-derive, and the order to build in.

---

## 1. What you're connecting

Art Namer already works today as a CLI. It is **not a prototype to be rewritten** — `engine.py` is the canonical schema and the Feed lane must call it, not reimplement it. The whole point of the split is that there is exactly one naming system.

```
                         ┌──────────────────────────┐
  TODAY  (CLI)           │       engine.py          │
  batch of ART/ folders ─▶ parse · SKU decode ·     │──▶ catalog + Drive
                         │  slug/title/alt schema   │
  LATER  (Feed)          │  collision · idempotency │
  in-app drop ──────────▶└──────────────────────────┘──▶ catalog + Drive
```

Same schema in, same asset out. If the two lanes ever disagree, the website gets inconsistent filenames and the SEO work is wasted.

---

## 2. What already exists (do not rebuild)

| Piece | Where | State |
|---|---|---|
| Naming schema (slug/title/alt/SKU/collision/idempotency) | `art-namer/engine.py` | ✅ live, tested |
| Conversion gate + SKU lookup + crop + Drive upload | `art-namer/cli.py` | ✅ live, tested |
| Final asset store | Shared Drive `Website_Ready/Bandanas/` (`1KuCQT6K-EDIJ_4Ke-_lbNFiIg1RNGlb7`) | ✅ created |
| Provenance ledger | `Website/_Internal/Art_Namer/art_catalog.md` | ✅ live |
| Gate session auth | `gate/index.js` → `requireSession(req,res)` | ✅ live |
| Gate body limit | `express.json({ limit: '10mb' })` | ✅ already big enough for a mockup JPG |
| Proxy route pattern to clone | `gate/index.js` → `POST /api/shipstation/sync` | ✅ copy this shape |
| Printavo read proxy | `https://primary-production-079f9.up.railway.app/webhook/printavo-proxy` | ✅ live (office IP is WAF-blocked; proxy is the only path) |
| Registry node | `frontdoor/registry.json` → `art-namer` | ✅ added |

---

## 3. The three rules you must not re-derive

These cost real debugging to establish. They are load-bearing.

**① Conversion truth is `status.type`, not `paidInFull`.**
Printavo tags every status `QUOTE` or `INVOICE`. A converted job carries an `INVOICE`-type status.
- Invoice **20200** is "🤝 Delivered / Picked up" with `paidInFull: false` (net-terms account). Gating on payment **silently drops delivered work**.
- "🔵 Art (Seps.io)" is a **QUOTE**-type status. seps.io makes mockups for jobs that never convert — that's exactly what the gate must exclude.

**② `invoices(query:"5")` does not return quote 5.**
That argument is a fuzzy search; it returns unrelated invoices. You must query **both** the `invoices` and `quotes` connections and match `visualId` **exactly**.

**③ The gate fails closed.**
Process only when conversion is positively `True`. `False` (still a quote) and `None` (couldn't verify) both skip, with a reason. Never silently assume converted — Holly's rule: an automation that runs green while writing wrong is worse than one that stops.

---

## 4. The Feed lane — build spec

### Payload (app → gate)
```jsonc
POST /api/art-namer          // session-gated, same as /api/shipstation/sync
{
  "filename": "Mockup_Canal Trust Bandana_C&O Canal Trust (27062)_Navy_R1.jpg",
  "image":    "<base64 jpeg>",   // 10mb express limit already covers a mockup
  "note":     "optional free text from the Feed 'what do you want to do' field"
}
```
The **internal filename carries everything** — design, client, invoice #, color. Do not ask the user to re-type it. If a dropped file doesn't match the `Mockup_*` pattern, reject it in the UI with the expected shape, rather than guessing.

### Route (gate/index.js — clone the ShipStation shape)
```js
app.post('/api/art-namer', async (req, res) => {
  if (!await requireSession(req, res)) return;            // ← existing middleware
  try {
    const r = await fetch(process.env.ART_NAMER_WEBHOOK, {  // n8n webhook, env var
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.set('Cache-Control', 'no-store, private').status(r.status).json(await r.json());
  } catch (e) { res.status(502).json({ error: 'art-namer webhook unreachable: ' + e.message }); }
});
```
Never put the Printavo token or Drive creds in the browser. The gate proxies; n8n holds credentials.

### n8n workflow `/webhook/art-namer`
1. **Parse** the filename → design / client / invoice / color. (Port of `engine.parse_internal`.)
2. **Conversion gate** → query Printavo proxy for `invoices` + `quotes`, exact `visualId`. Not `INVOICE`-type → return `{skipped: true, reason}` and stop. **Fail closed.**
3. **SKU** → first line item whose `itemNumber` matches a known prefix (`engine.SKU_DECODE`).
4. **Vision** (Claude API) → confirm color, and drive the crop for light-colored bandanas where the current heuristic gives up.
5. **Name** → apply the schema. Must produce byte-identical output to `engine.build_name()`.
6. **Store** → write the cropped/renamed JPG into `Website_Ready/Bandanas/` using the **tech@ Google cred** (Shared Drive access). Idempotent: look up by filename first, reuse the file id.
7. **Ledger** → append/update the catalog row keyed `{invoice}-{color}`.
8. **Notify** → Chat ping with the proposed name + a link, for Holly's approve/reject.

### Schema parity — the one real risk
n8n will hold a *second copy* of the naming logic. That is how systems drift.

**Mitigation, in order of preference:**
1. **Have n8n shell out to `engine.py`** (a tiny Railway service exposing `POST /name` around `build_name()`), so there is literally one implementation. ← recommended
2. If you must port it: pin a `SCHEMA_VERSION` string in `engine.py`, echo it in every catalog row, and add a CI check that the n8n port produces identical output for the Canal Trust fixture.

Never let the app hand-roll a filename.

---

## 5. Where it goes after Feed

Once assets carry the invoice #, the scheduler can show the artwork on a job card — that was your original "then it goes in the scheduler" idea, and it falls out for free because the catalog already joins `invoice ↔ asset ↔ SKU`.

Suggested build order:
1. **Feed drop-zone + `/api/art-namer` route** (thin; reuses `requireSession`).
2. **n8n lane** with the conversion gate first — prove it blocks a quote before you let it write anything.
3. **Vision crop** — this unblocks white/cream bandanas, currently the biggest quality gap.
4. **Scheduler artwork chip** — read `art_catalog.md` (or its Drive equivalent) by invoice #.
5. **Apparel/promo** — the schema keeps a `sku` field; apparel has no encoded SKU system, so it needs garment style numbers instead. Do this last; the bandana schema must be proven first.

---

## 6. Open items carried in

- **Vision pass is a hook, not an implementation.** `--vision` reads a JSON you supply; nothing generates it. Color currently comes from the filename.
- **Auto-crop is tuned for dark art on white proof sheets.** Light bandanas flag `crop:none` and keep the full sheet. It never crops wrong silently.
- **Phelan handoff is still manual** — he runs the WordPress import from the Drive folder. His protocol: a ~10-image test batch and his thumbs-up before any full run.
- **Registry node + CHANGELOG entry are uncommitted**, riding with the frontdoor WIP branch.
- Only bandanas. Only `Mockup_*` files. `Provided_*` and production `.ai`/`.pdf` are ignored by design.
