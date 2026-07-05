#!/usr/bin/env python3
"""
PlanetIQ monthly refresh — run from Holly's terminal (needs gws + gh auth; single-editor rule).

What it does, idempotently:
  1. Reads Kelly's LIVE "2026 - Totals" KPI tab (read-only — never writes to her sheet).
  2. Appends any NEW monthly points (labor/income/profit/dept/overhead) to the
     PlanetIQ Data Layer sheet's "Chart Series" tab that aren't already there.
  3. Regenerates planetiq/data.js from the Chart Series tab (the canonical charting source).

Default run = REPORT ONLY (shows what would change, writes nothing).
  --apply  : write new points to Chart Series + rewrite data.js
  --push   : with --apply, also git commit + push (Panel goes live)

SCOPE NOTE (no silent caps): this only syncs the 10 KPI series sourced from Kelly's
2026-Totals tab. Other series (Google CPC/ads, QB-accrual monthly, bandana units) have
their own cadence and are NOT touched here.
"""
import subprocess, json, sys, os, datetime

DL_SHEET = "1lvJ28bcid3e8FYNrT44bSbtxi_5U53QxdISiW95JuF0"   # PlanetIQ Data Layer
KPI_SHEET = "1XQNS-93GLZxPYxK15xYIqKeF-Yv6P9jCuvC2rbnANjQ"  # Kelly's KPI Tracker
DATA_JS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.js")

APPLY = "--apply" in sys.argv
PUSH = "--push" in sys.argv

# Kelly-tab row label (substring) -> Chart Series series name. All KPI-cash / USD.
LABEL_TO_SERIES = [
    ("Income (KPI)",        "Income monthly 2026 (KPI)"),
    ("Profit (Income",      "Profit monthly 2026 (KPI)"),
    ("Labor LEADERSHIP",    "Labor LEADERSHIP monthly"),
    ("Labor SALES",         "Labor SALES monthly"),
    ("Labor PRODUCTION",    "Labor PRODUCTION monthly"),
    ("Bandana Dept",        "Bandana Dept revenue monthly 2026"),
    ("Apparel & Merch",     "A&M Dept revenue monthly 2026"),
    ("DWC Dept",            "DWC Dept revenue monthly 2026"),
    ("OVERHEAD TOTAL",      "Overhead Total monthly 2026 (KPI)"),
]

def gws(params, body=None):
    cmd = ["gws"] + params
    if body is not None:
        cmd += ["--json", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True)
    txt = "\n".join(l for l in out.stdout.splitlines() if not l.startswith("Using keyring backend"))
    if not txt.strip():
        raise RuntimeError(f"gws empty/err: {out.stderr[:400]}")
    return json.loads(txt)

def read_range(sheet, rng, unformatted=True):
    p = {"spreadsheetId": sheet, "range": rng}
    if unformatted:
        p["valueRenderOption"] = "UNFORMATTED_VALUE"
    return gws(["sheets", "spreadsheets", "values", "get", "--params", json.dumps(p)]).get("values", [])

# --- 1. Kelly's live 2026-Totals -> candidate monthly points ---------------------
kpi = read_range(KPI_SHEET, "'2026 - Totals'!A1:N30")
# header row: find the one containing month names
hdr_idx = next(i for i, r in enumerate(kpi) if r and any(str(c).upper().startswith("JAN") for c in r))
months = {}  # col index -> period "2026-MM"
for ci, c in enumerate(kpi[hdr_idx]):
    cu = str(c).strip().upper()
    for m, mm in enumerate(["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"], 1):
        if cu.startswith(mm):
            months[ci] = f"2026-{m:02d}"

candidates = []  # (series, period, value)
for row in kpi:
    if not row: continue
    label = str(row[0]).strip()
    series = next((s for sub, s in LABEL_TO_SERIES if label.startswith(sub) or sub in label), None)
    if not series: continue
    for ci, period in months.items():
        if ci < len(row) and isinstance(row[ci], (int, float)) and row[ci] != 0:
            candidates.append((series, period, float(row[ci])))

# --- 2. Existing Chart Series -> dedup key ---------------------------------------
cs = read_range(DL_SHEET, "'Chart Series'!A1:E400")
cs_header, cs_rows = cs[0], cs[1:]
have = {(str(r[0]).strip(), str(r[2]).strip()) for r in cs_rows if len(r) >= 3}
new_points = [(s, p, v) for (s, p, v) in candidates if (s, p) not in have]

print(f"Kelly tab: {len(candidates)} candidate points across {len(LABEL_TO_SERIES)} series")
print(f"Chart Series already holds {len(cs_rows)} points")
if not new_points:
    print("✅ Nothing new to add — Chart Series is already current with Kelly's tab.")
else:
    print(f"🟡 {len(new_points)} NEW point(s) to add:")
    for s, p, v in sorted(new_points):
        print(f"    + {s:38} {p}  {v:,.2f}")

# --- 3. Apply: append to Chart Series, then rebuild data.js ----------------------
def rebuild_data_js():
    rows = read_range(DL_SHEET, "'Chart Series'!A2:E400")
    series = {}
    for r in rows:
        if len(r) < 4 or not str(r[0]).strip(): continue
        name, basis, period, value = str(r[0]).strip(), str(r[1]).strip(), str(r[2]).strip(), r[3]
        unit = str(r[4]).strip() if len(r) > 4 else ""
        d = series.setdefault(name, {"basis": basis, "unit": unit, "points": []})
        d["points"].append({"p": period, "v": float(value)})
    ordered = {k: series[k] for k in sorted(series)}
    stamp = datetime.date.today().isoformat()
    meta = {"asOf": stamp,
            "sheet": f"https://docs.google.com/spreadsheets/d/{DL_SHEET}",
            "note": f"Snapshot of the PlanetIQ Chart Series tab, regenerated {stamp} by refresh_planetiq.py. "
                    "QB-accrual = headline basis; KPI-cash labeled where shown."}
    with open(DATA_JS, "w") as f:
        f.write(f"// PlanetIQ Panel data snapshot — generated {stamp} by refresh_planetiq.py. Regenerate, don't hand-edit.\n")
        f.write("const PIQ_META=" + json.dumps(meta) + ";\n")
        f.write("const PIQ_SERIES=" + json.dumps(ordered) + ";\n")
    return len(ordered)

if APPLY:
    if new_points:
        next_row = 1 + len(cs_rows) + 1  # header + existing + 1
        body = {"values": [[s, "KPI-cash", p, v, "USD"] for (s, p, v) in new_points]}
        gws(["sheets", "spreadsheets", "values", "update", "--params",
             json.dumps({"spreadsheetId": DL_SHEET, "range": f"'Chart Series'!A{next_row}",
                         "valueInputOption": "RAW"})], body)
        print(f"✍️  Wrote {len(new_points)} rows to Chart Series!A{next_row}")
    n = rebuild_data_js()
    print(f"✍️  Rebuilt data.js from Chart Series ({n} series)")
    if PUSH:
        d = os.path.dirname(DATA_JS)
        subprocess.run(["git", "-C", d, "add", "data.js"], check=True)
        subprocess.run(["git", "-C", d, "commit", "-m", "PlanetIQ: refresh Panel from KPI tracker"], check=True)
        subprocess.run(["git", "-C", d, "push"], check=True)
        print("🚀 Pushed — Panel updates in ~30s–2min")
else:
    print("\n(report only — re-run with --apply to write, --apply --push to also publish)")
