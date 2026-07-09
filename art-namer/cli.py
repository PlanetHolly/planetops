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
import argparse, html, json, os, re, shutil, subprocess, sys, time
from PIL import Image
from engine import parse_internal, build_name, decode_sku

STAGING = os.path.expanduser("~/Dropbox/PlanetApparel/Website/Bandana_Images")
WORKDIR = os.path.expanduser("~/Dropbox/PlanetApparel/Website/_Internal/Art_Namer")
CATALOG = os.path.join(WORKDIR, "art_catalog.md")
SHEET = os.path.join(WORKDIR, "art_contact_sheet.html")

# Printavo read-only GraphQL proxy (office IP is WAF-blocked; proxy is the working path)
PRINTAVO_PROXY = "https://primary-production-079f9.up.railway.app/webhook/printavo-proxy"
# Google Shared Drive "Planet Apparel Website" -> Website_Ready/Bandanas/ (Phelan-visible)
DRIVE_ID = "0AKztajy-cjm8Uk9PVA"
BANDANAS_FOLDER = "1KuCQT6K-EDIJ_4Ke-_lbNFiIg1RNGlb7"

FIELDS = ["slug", "filename", "title", "alt", "color", "fabric", "shape", "method",
          "made_in_usa", "eco", "sku", "invoice", "design", "client", "source", "crop",
          "converted", "paid_in_full", "printavo_status", "drive_id"]


def _gws(args):
    """Run gws, return parsed JSON from stdout (gws logs its keyring line to stderr)."""
    out = subprocess.run(["gws"] + args, capture_output=True, text=True).stdout
    i = out.find("{")
    return json.loads(out[i:]) if i >= 0 else {}


_pv_cache = {}


def printavo_lookup(invoice):
    """visualId -> {converted, status, status_type, paid_in_full, sku}.
    converted is TRI-STATE: True (went forward) / False (still a quote) / None (can't tell).

    CONVERSION TRUTH = status.type, and WHICH connection the record lives in.
      * Printavo tags every status QUOTE or INVOICE. A job that went forward carries
        an INVOICE-type status and lives in the `invoices` connection.
      * A job that never converted lives in `quotes` — and `invoices(query:...)` will
        NOT find it (that query is a fuzzy search; asking it for quote "5" returns
        unrelated invoices). So we MUST query both connections and match visualId exactly.
      * Do NOT use paidInFull: inv 20200 is 'Delivered / Picked up' with paidInFull=false
        (terms/net accounts). And '🔵 Art (Seps.io)' is a QUOTE-type status — seps.io
        makes mockups for jobs that never convert, which is what this filter must exclude.

    sku = first line item whose itemNumber decodes as a known bandana SKU prefix.
    Cached; rate-limit friendly (10 req / 5s ceiling)."""
    if invoice in _pv_cache:
        return _pv_cache[invoice]
    q = ('query { invoices(query: "%s", first: 8) { nodes { visualId paidInFull '
         'status { name type } lineItemGroups { nodes { lineItems { nodes { itemNumber } } } } } } '
         'quotes(query: "%s", first: 8) { nodes { visualId status { name type } } } }' % (invoice, invoice))
    try:
        r = subprocess.run(["curl", "-s", "--max-time", "30", "-X", "POST", PRINTAVO_PROXY,
                            "-H", "Content-Type: application/json",
                            "-d", json.dumps({"query": q})], capture_output=True, text=True).stdout
        data = json.loads(r)["data"]
    except Exception:
        return _pv_cache.setdefault(invoice, dict(converted=None, reason="lookup failed"))
    time.sleep(0.6)

    def exact(conn):
        return next((n for n in (data.get(conn) or {}).get("nodes", [])
                     if str(n.get("visualId")) == str(invoice)), None)

    node = exact("invoices")
    if node:
        st = node.get("status") or {}
        skus = [li["itemNumber"] for g in node["lineItemGroups"]["nodes"]
                for li in g["lineItems"]["nodes"] if li.get("itemNumber")]
        info = dict(converted=(st.get("type") == "INVOICE"), status=st.get("name", "").strip(),
                    status_type=st.get("type", ""), paid_in_full=node.get("paidInFull"),
                    sku=next((s for s in skus if decode_sku(s)), None))  # reuse engine prefix table
        return _pv_cache.setdefault(invoice, info)

    node = exact("quotes")
    if node:                                   # lives in quotes = never converted
        st = node.get("status") or {}
        return _pv_cache.setdefault(invoice, dict(
            converted=False, status=st.get("name", "").strip(), status_type=st.get("type", ""),
            paid_in_full=None, sku=None))

    return _pv_cache.setdefault(invoice, dict(converted=None, reason="not found in Printavo"))


def drive_upload(path, name):
    """Upload to Website_Ready/Bandanas/. Idempotent: existing name -> reuse id."""
    esc = name.replace("'", r"\'")
    found = _gws(["drive", "files", "list", "--params", json.dumps({
        "q": f"name = '{esc}' and '{BANDANAS_FOLDER}' in parents and trashed = false",
        "supportsAllDrives": True, "includeItemsFromAllDrives": True,
        "corpora": "drive", "driveId": DRIVE_ID, "fields": "files(id,name)"})])
    if found.get("files"):
        return found["files"][0]["id"]
    created = _gws(["drive", "files", "create", "--upload", path,
                    "--json", json.dumps({"name": name, "parents": [BANDANAS_FOLDER]}),
                    "--params", json.dumps({"supportsAllDrives": True})])
    return created.get("id", "")


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
    ap.add_argument("--sku", default=None, help="override SKU for the batch (default: auto from Printavo)")
    ap.add_argument("--vision", default=None, help="JSON of per-file vision facts")
    ap.add_argument("--no-printavo", action="store_true", help="skip Printavo lookup (offline)")
    ap.add_argument("--allow-unconverted", action="store_true",
                    help="process jobs that are NOT paidInFull (default: skip them)")
    ap.add_argument("--upload", action="store_true", help="upload to Website_Ready/Bandanas/ on the Shared Drive")
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
    done, skipped, unconverted, uploaded = 0, [], [], 0
    for path in files:
        fn = os.path.basename(path)
        parsed = parse_internal(fn)
        if not parsed:
            skipped.append(fn)
            continue

        pv = {} if args.no_printavo else printavo_lookup(parsed["invoice"])
        # Conversion gate: FAIL CLOSED. Only capture jobs positively confirmed as gone
        # forward (converted is True). False = still a quote. None = couldn't verify.
        # Neither is silently processed — Holly only wants converted work on the website.
        if not args.no_printavo and not args.allow_unconverted and pv.get("converted") is not True:
            why = pv.get("reason") or pv.get("status") or "unknown"
            unconverted.append(f"{fn}  (inv {parsed['invoice']}: {why})")
            continue

        v = vision.get(fn, {})
        sku = v.get("sku") or args.sku or pv.get("sku")   # explicit > batch > Printavo
        rec = build_name(parsed, sku=sku, vision=v, taken=taken)
        rec["source"] = path
        rec["converted"] = pv.get("converted", "unknown")
        rec["paid_in_full"] = pv.get("paid_in_full", "unknown")
        rec["printavo_status"] = pv.get("status", "")
        if rec["key"] in recs:                    # idempotent update, keep original slug + drive id
            rec["slug"] = recs[rec["key"]]["slug"]
            rec["filename"] = recs[rec["key"]]["filename"]
            rec["drive_id"] = recs[rec["key"]].get("drive_id", "")
        recs[rec["key"]] = rec

        if not args.dry_run:
            os.makedirs(STAGING, exist_ok=True)
            staged = os.path.join(STAGING, rec["filename"])
            rec["crop"] = autocrop(path, staged)
            if args.upload:
                rec["drive_id"] = drive_upload(staged, rec["filename"])
                uploaded += 1
        done += 1
        notes = "" if args.dry_run else f"  crop:{rec['crop']}" + (
            "  ⚠️ CHECK (kept full proof sheet)" if rec["crop"] == "none" else "")
        if not args.dry_run and args.upload:
            notes += "  ⬆ drive" if rec.get("drive_id") else "  ❌ upload failed"
        if rec["sku"] == "TBD":
            notes += "  ⚠️ NO SKU"
        if rec["converted"] == "unknown" and not args.no_printavo:
            notes += "  ⚠️ CONVERSION UNVERIFIED"   # lookup failed; never silently assume converted
        print(f"  {fn}\n    -> {rec['filename']}  [sku {rec['sku']}]{notes}")

    if not args.dry_run:
        save_catalog(recs)
        build_sheet(recs)
    print(f"\n{done} named · {len(unconverted)} skipped (not converted) · "
          f"{len(skipped)} skipped (unparseable) · catalog {len(recs)} records"
          + (f" · {uploaded} uploaded" if args.upload else ""))
    for u in unconverted:
        print(f"  not converted: {u}")
    for s in skipped:
        print(f"  unparseable:   {s}")
    if not args.dry_run:
        print(f"catalog: {CATALOG}\nreview:  {SHEET}\nstaged:  {STAGING}")


if __name__ == "__main__":
    sys.exit(main())
