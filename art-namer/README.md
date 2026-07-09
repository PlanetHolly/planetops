# Art Namer

Turns produced-job bandana mockups into **Google- and LLM-optimized web assets** with the internal SKU attached, and puts them where Phelan can import them into the website.

```
Mockup_Canal Trust Bandana_C&O Canal Trust (27062)_Navy_R1.jpg     ← internal filing
   ↓
custom-cotton-bandana-navy-screen-printed-canal-trust.jpg          ← public asset
   + title / alt (LLM-readable) + SKU PL2219 + full provenance
```

**Why:** planetapparel.com's WordPress import is filename-driven (the filename generates title, slug, and taxonomy). Internal names — invoice numbers, "Mockup", "R1" — are worthless to Google. This makes the filename do the SEO work while the SKU rides along as metadata.

## Run it

```bash
cd ~/github/planetops/art-namer
python3 cli.py "/Users/hollytrevino/Dropbox/ART/<Client>/<Bandana_Project_Month Year>" --upload
```

That single command: verifies the job converted → fetches its SKU → crops the proof sheet to a clean product image → names it → writes the catalog → rebuilds the review sheet → uploads to the Shared Drive.

Point it at a folder or at individual JPGs. Multiple folders are fine.

### Flags
| Flag | Effect |
|---|---|
| `--upload` | Push named files to `Website_Ready/Bandanas/` on the Shared Drive. Idempotent — an existing name reuses its Drive file, never duplicates. |
| `--dry-run` | Show the names it *would* produce. Touches nothing. |
| `--sku PL2216` | Override the SKU for the batch. Default is auto-fetched from Printavo per invoice. |
| `--no-printavo` | Offline. Skips conversion check + SKU lookup (SKU becomes `TBD`). |
| `--allow-unconverted` | Process jobs that did NOT convert. Off by default, on purpose. |
| `--vision file.json` | Merge per-file facts: `{"<source filename>": {"color": "...", "shape": "...", "sku": "..."}}` |

## The conversion gate (read this before trusting output)

Only work that **went forward** belongs on the website. seps.io produces mockups for jobs that never convert, so the art archive is not a safe source on its own.

**Conversion truth = Printavo `status.type`, plus which connection the record lives in.**
- Lives in `invoices` with an `INVOICE`-type status → **converted** → processed.
- Lives in `quotes` → **never converted** → skipped and listed.
- Found in neither, or Printavo unreachable → **can't verify** → skipped and listed.

The gate **fails closed**: nothing is processed unless conversion is positively confirmed. Every skip is printed with its reason — no silent drops.

Two traps this avoids, both real:
- **`paidInFull` is NOT conversion.** Invoice 20200 is "Delivered / Picked up" with `paidInFull: false` (net-terms accounts). Gating on payment would silently drop delivered work.
- **`invoices(query:"5")` does not find quote 5.** That query is a fuzzy search and returns unrelated invoices, so the code matches `visualId` exactly and queries both connections.

## What it produces

| Output | Location |
|---|---|
| Renamed + cropped images (staging) | `~/Dropbox/PlanetApparel/Website/Bandana_Images/` |
| Catalog (provenance ledger) | `~/Dropbox/PlanetApparel/Website/_Internal/Art_Namer/art_catalog.md` |
| Review contact sheet | `…/Art_Namer/art_contact_sheet.html` |
| Final, Phelan-visible | Shared Drive **Planet Apparel Website** → `Website_Ready/Bandanas/` |

The catalog is the ledger: public name ↔ SKU ↔ invoice ↔ Drive id ↔ original ART path. It is **idempotent** — keyed on `invoice-color`, so re-running never duplicates a record, a file, or a Drive upload.

**Why Google Drive and not Dropbox for the final folder:** that Shared Drive exists so Phelan (external) can reach website assets without seeing company docs, and n8n's Google creds can write to Shared Drives while its Dropbox app-folder creds cannot reach shared `PlanetApparel/` paths. Dropbox stays the local staging + archive.

## The naming schema

`custom-{fabric}-bandana-{color}[-screen-printed]-{entity}.jpg`

- **fabric** — `cotton` · `made-in-usa-cotton` · `organic-cotton`. Decoded from the SKU prefix (`PL`/`US`/`ORG`/…) per `Pricing/Products/SKU_Dictionary.md` §2.
- **Sublimation and digital carry no fabric or method token** — "polyester" and "sublimated" have effectively zero search volume; they are spec-only.
- **entity** — the design name minus noise words, so an LLM can tie the asset to a real brand.
- **SKU is metadata, never in the slug.** Phelan keeps a SKU column; a SKU in the URL hurts SEO.
- **Collisions** resolve by appending a distinguishing attribute (shape, then client) — never `-1`/`-2`.

## Known limits

- **Auto-crop is tuned for dark bandanas on white proof sheets.** A white or cream bandana fails detection, gets flagged `crop:none`, and keeps the full proof sheet. It never crops wrong silently — but those need a human look. Vision-assisted crop is the fix.
- **The vision pass is a hook, not an implementation.** `--vision` consumes a JSON you supply; nothing generates it yet. Color currently comes from the internal filename.
- **Only `Mockup_*` files are parsed.** `Provided_*` (customer-supplied art) and production `.ai`/`.pdf` are ignored by design.
- **Bandanas only.** Apparel has no encoded SKU system (garment style numbers instead).

## Files

- `engine.py` — pure logic: filename parse, SKU decode, slug/title/alt schema, collision + idempotency. No I/O. **This is the canonical schema.**
- `cli.py` — the batch lane: Printavo lookup, conversion gate, auto-crop, catalog, contact sheet, Drive upload.
- `SPEC.md` — the contract for the future PlanetOps **Feed** lane.
- `FEED_INTEGRATION.md` — how to wire this into the app once Feed exists.

Change log lives in `planetops/CHANGELOG.md`.
