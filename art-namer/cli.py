#!/usr/bin/env python3
"""Art Namer CLI — batch entry point (the NOW lane; SPEC.md describes the future Feed lane).

Usage:
  python3 cli.py <folder-or-jpgs...> [--sku PL2216] [--vision vision.json] [--dry-run]

Scans mockup JPGs (internally-filed names), applies the naming engine, then:
  1. appends/updates rows in the catalog (idempotent on invoice+color)
  2. copies renamed files into the staging folder (Website/Bandana_Images/)
  3. rebuilds the review contact sheet (click-to-cut, lookbook pattern)

--sku applies one SKU to the whole batch (typical: one project = one SKU).
--vision merges per-file vision facts: {"<source filename>": {"color":..., "shape":..., "sku":...}}
Nothing is uploaded anywhere by this script; Shared-Drive upload happens after
Holly approves the contact sheet (see SPEC.md handoff step).
"""
import argparse, html, json, os, re, shutil, sys
from PIL import Image
from engine import parse_internal, build_name

STAGING = os.path.expanduser("~/Dropbox/PlanetApparel/Website/Bandana_Images")
WORKDIR = os.path.expanduser("~/Dropbox/PlanetApparel/Website/_Internal/Art_Namer")
CATALOG = os.path.join(WORKDIR, "art_catalog.md")
SHEET = os.path.join(WORKDIR, "art_contact_sheet.html")

FIELDS = ["slug", "filename", "title", "alt", "color", "fabric", "shape", "method",
          "made_in_usa", "eco", "sku", "invoice", "design", "client", "source", "crop"]


def autocrop(src, dst, pad=0.02, thresh=235, density=0.30):
    """Mockups in ART/ are often PROOF SHEETS (letterhead + Pantone box + white
    margins) — not clean product images. Crop to the bandana: the longest
    contiguous run of rows/cols that are dense with non-white pixels (the solid
    bandana block; letterhead text rows are sparse). Returns 'auto' on success,
    'none' (full copy + warning) when detection fails, e.g. white/cream bandanas."""
    im = Image.open(src)
    g = im.convert("L")
    w, h = g.size
    small = g.resize((max(1, w // 8), max(1, h // 8)))
    px = small.load()
    sw, sh = small.size

    def longest_run(count, total, n):
        best = cur = start = bs = 0
        for i in range(n):
            if count(i) / total > density:
                cur += 1
                if cur == 1:
                    start = i
                if cur > best:
                    best, bs = cur, start
            else:
                cur = 0
        return bs, bs + best

    r0, r1 = longest_run(lambda y: sum(px[x, y] < thresh for x in range(sw)), sw, sh)
    c0, c1 = longest_run(lambda x: sum(px[x, y] < thresh for y in range(r0, r1)), max(1, r1 - r0), sw)
    if (r1 - r0) < sh * 0.25 or (c1 - c0) < sw * 0.25:   # too small = detection failed
        shutil.copy2(src, dst)
        return "none"
    p = int(max(w, h) * pad)
    box = (max(0, c0 * 8 - p), max(0, r0 * 8 - p), min(w, c1 * 8 + p), min(h, r1 * 8 + p))
    im.crop(box).save(dst, quality=92)
    return "auto"


def load_catalog():
    """Parse art_catalog.md -> {key: record}. Format: '### key' then '- field: value' lines."""
    recs = {}
    if not os.path.exists(CATALOG):
        return recs
    key = None
    for line in open(CATALOG):
        line = line.rstrip("\n")
        if line.startswith("### "):
            key = line[4:].strip()
            recs[key] = {}
        elif key and line.startswith("- ") and ": " in line:
            f, v = line[2:].split(": ", 1)
            recs[key][f] = v.strip("`")
    return recs


def save_catalog(recs):
    os.makedirs(WORKDIR, exist_ok=True)
    with open(CATALOG, "w") as f:
        f.write("# Art Namer — Catalog (provenance ledger)\n\n"
                "One record per produced mockup. Key = invoice-color (idempotent). "
                "Public name <-> SKU <-> invoice <-> ART source. Regenerate the contact "
                "sheet with cli.py; edit records here if a name needs a manual fix.\n\n")
        for key in sorted(recs):
            f.write(f"### {key}\n")
            for fld in FIELDS:
                if fld in recs[key]:
                    f.write(f"- {fld}: `{recs[key][fld]}`\n")
            f.write("\n")


def build_sheet(recs):
    cards = []
    for key in sorted(recs):
        r = recs[key]
        img = html.escape(os.path.join("../../Bandana_Images", r["filename"]))
        cards.append(f"""<div class="card" data-key="{html.escape(key)}" onclick="this.classList.toggle('cut');upd()">
<img src="{img}" loading="lazy"><div class="pad">
<div class="fn">{html.escape(r['filename'])}</div>
<div class="meta">SKU <b>{html.escape(r['sku'])}</b> · inv {html.escape(r['invoice'])} · {html.escape(r['color'] or '—')} · {html.escape(r['fabric'])}</div>
<div class="alt">{html.escape(r['alt'])}</div></div></div>""")
    page = f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Art Namer — Review ({len(recs)})</title><style>
body{{font-family:-apple-system,sans-serif;margin:0;background:#111;color:#eee;padding:24px 24px 80px}}
h1{{font-size:20px}} .sub{{color:#888;font-size:13px;max-width:760px;line-height:1.5}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-top:18px}}
.card{{background:#1d1d1d;border-radius:10px;overflow:hidden;cursor:pointer;border:2px solid transparent}}
.card img{{width:100%;aspect-ratio:1;object-fit:cover;display:block}}
.card.cut{{border-color:#e5484d;opacity:.32}} .pad{{padding:10px}}
.fn{{font-weight:600;font-size:12.5px;color:#F7BE00;word-break:break-all}}
.meta{{font-size:11.5px;color:#aaa;margin:5px 0}} .alt{{font-size:11.5px;color:#888;line-height:1.4}}
#bar{{position:fixed;bottom:0;left:0;right:0;background:#000;padding:11px 24px;display:flex;gap:14px;align-items:center;border-top:1px solid #333;font-size:13px}}
button{{background:#F7BE00;border:0;padding:9px 15px;border-radius:6px;font-weight:700;cursor:pointer}}
#stat{{color:#F7BE00;font-weight:700}}</style></head><body>
<h1>Art Namer — Naming Review</h1>
<p class="sub">Every card shows the proposed PUBLIC filename + SKU + alt text. Click a card to CUT it
(excluded from upload). When done, hit Copy and paste the result to Claude. Approved files upload to
the Website Shared Drive for Phelan.</p>
<div class="grid">{''.join(cards)}</div>
<div id="bar"><span id="stat"></span><span style="flex:1"></span><button onclick="copy()">Copy result</button></div>
<script>
const cards=[...document.querySelectorAll('.card')];
function upd(){{const cut=cards.filter(c=>c.classList.contains('cut')).length;
document.getElementById('stat').textContent=(cards.length-cut)+' APPROVED / '+cut+' cut';}}
function copy(){{const keep=cards.filter(c=>!c.classList.contains('cut')).map(c=>c.dataset.key);
navigator.clipboard.writeText('APPROVED: '+keep.join(', ')).then(()=>alert('Copied. Paste to Claude.'));}}
upd();</script></body></html>"""
    open(SHEET, "w").write(page)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+", help="project folder(s) or mockup JPG path(s)")
    ap.add_argument("--sku", default=None, help="SKU for the whole batch (e.g. PL2216)")
    ap.add_argument("--vision", default=None, help="JSON of per-file vision facts")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    vision = json.load(open(args.vision)) if args.vision else {}
    files = []
    for inp in args.inputs:
        if os.path.isdir(inp):
            files += [os.path.join(inp, f) for f in sorted(os.listdir(inp))
                      if re.search(r"\.(jpe?g|png)$", f, re.I)]
        else:
            files.append(inp)

    recs = load_catalog()
    taken = {r["slug"] for r in recs.values() if "slug" in r}
    done, skipped = 0, []
    for path in files:
        fn = os.path.basename(path)
        parsed = parse_internal(fn)
        if not parsed:
            skipped.append(fn)
            continue
        v = vision.get(fn, {})
        rec = build_name(parsed, sku=v.get("sku") or args.sku, vision=v, taken=taken)
        rec["source"] = path
        if rec["key"] in recs:                    # idempotent update, keep original slug
            rec["slug"] = recs[rec["key"]]["slug"]
            rec["filename"] = recs[rec["key"]]["filename"]
        recs[rec["key"]] = rec
        if not args.dry_run:
            os.makedirs(STAGING, exist_ok=True)
            rec["crop"] = autocrop(path, os.path.join(STAGING, rec["filename"]))
        done += 1
        crop_note = "" if args.dry_run else f"  crop:{rec['crop']}" + (
            "  ⚠️ CHECK (kept full proof sheet)" if rec["crop"] == "none" else "")
        print(f"  {fn}\n    -> {rec['filename']}  [sku {rec['sku']}]{crop_note}")

    if not args.dry_run:
        save_catalog(recs)
        build_sheet(recs)
    print(f"\n{done} named, {len(skipped)} skipped (non-mockup or unparseable), catalog {len(recs)} records")
    for s in skipped:
        print(f"  skipped: {s}")
    if not args.dry_run:
        print(f"catalog: {CATALOG}\nreview:  {SHEET}\nstaged:  {STAGING}")


if __name__ == "__main__":
    sys.exit(main())
