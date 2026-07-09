"""Art Namer engine — pure naming logic, no I/O.

Turns an internally-filed bandana mockup into a Google/LLM-optimized public
name + metadata record. Used by cli.py today; the future PlanetOps Feed lane
(see SPEC.md) calls the same functions so there is exactly ONE naming system.

Input convention (internal filing, per the 2026 File Naming Guide + seps.io):
    Mockup_{Design}_{Client} ({Invoice})_{Color}_R{n}.jpg
e.g. Mockup_Canal Trust Bandana_C&O Canal Trust (27062)_Navy_R1.jpg

Keyword rules (SEMrush/GSC-grounded, project_bandana_gallery_import):
    headline terms = custom · cotton|made-in-usa|organic-cotton · color ·
    bandana · screen-printed. Spec-only (NEVER in slug): polyester,
    sublimated, digital. Entity (design/client) included for LLM/AEO.
"""
import re

# SKU prefix -> fabric/method decode. Source of truth: Pricing/Products/SKU_Dictionary.md §2.
# fabric_slug: the headline fabric term customers actually search (None = omit).
# method_slug: 'screen-printed' is the only searched method; sub/digital are spec-only.
SKU_DECODE = {
    "PL":        dict(fabric="Cotton (import)", fabric_slug="cotton", method="Screen Print", method_slug="screen-printed", usa=False),
    "TRIBAN":    dict(fabric="Cotton (import)", fabric_slug="cotton", method="Screen Print", method_slug="screen-printed", usa=False, shape="Triangle"),
    "US":        dict(fabric="USA-Made Cotton", fabric_slug="made-in-usa-cotton", method="Screen Print", method_slug="screen-printed", usa=True),
    "USTRIBAN":  dict(fabric="USA-Made Cotton", fabric_slug="made-in-usa-cotton", method="Screen Print", method_slug="screen-printed", usa=True, shape="Triangle"),
    "ORG":       dict(fabric="Organic Cotton", fabric_slug="organic-cotton", method="Screen Print", method_slug="screen-printed", usa=False),
    "OV":        dict(fabric="Organic Cotton (oversized)", fabric_slug="organic-cotton", method="Screen Print", method_slug="screen-printed", usa=False),
    "SUB":       dict(fabric="Polyester (sublimation)", fabric_slug=None, method="Sublimation", method_slug=None, usa=False),
    "DIGTRISC":  dict(fabric="USA Cotton (digital)", fabric_slug="made-in-usa-cotton", method="Digital", method_slug=None, usa=True, shape="Triangle"),
    "DIG":       dict(fabric="Fine Sateen Cotton (digital)", fabric_slug="cotton", method="Digital Full-Color", method_slug=None, usa=False),
    "CUSTOMDIG": dict(fabric="Custom Digital", fabric_slug=None, method="Digital", method_slug=None, usa=False),
}
_PREFIXES = sorted(SKU_DECODE, key=len, reverse=True)  # longest match first (USTRIBAN before US)

MOCKUP_RE = re.compile(
    r"^(?:Vendor )?Mockup_(?P<design>.+?)_(?P<client>[^_]+?)\s*\((?P<invoice>\d+)\)"
    r"(?:_(?P<color>[^_]+?))?(?:_R(?P<rev>\d+))?(?:\s*\(\d+\))?\.(?P<ext>jpe?g|png)$", re.I)

# tokens dropped from the design name when building the entity slug
_NOISE = {"bandana", "bandanas", "print", "prints", "the", "a"}


def decode_sku(sku):
    """PL2219ECO -> fabric/method dict + eco flag. Unknown prefix -> {}."""
    if not sku:
        return {}
    s = sku.strip().upper()
    for p in _PREFIXES:
        if s.startswith(p):
            d = dict(SKU_DECODE[p])
            d["eco"] = s.endswith("ECO")
            if d["eco"]:
                d["method"] = "Screen Print (waterbase/discharge)"
            return d
    return {}


def parse_internal(filename):
    """Parse an internally-filed mockup filename. Returns dict or None."""
    m = MOCKUP_RE.match(filename)
    if not m:
        return None
    d = m.groupdict()
    d["design"] = d["design"].strip()
    d["client"] = d["client"].strip()
    if d.get("color"):
        d["color"] = d["color"].strip()
    return d


def _slug(text):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def entity_slug(design, client):
    """Design name minus noise words; falls back to client."""
    words = [w for w in re.split(r"[^A-Za-z0-9&]+", design) if w and w.lower() not in _NOISE]
    return _slug(" ".join(words)) or _slug(client)


def build_name(parsed, sku=None, vision=None, taken=None):
    """The schema. parsed=parse_internal() dict; vision=optional dict that can
    override/confirm color/shape/design_desc; taken=set of slugs already used
    (collision rule: append distinguishing attribute, never -1/-2).
    Returns the full metadata record."""
    v = vision or {}
    dec = decode_sku(sku)
    color = v.get("color") or parsed.get("color") or ""
    shape = v.get("shape") or dec.get("shape") or "Square"
    fabric_slug = dec.get("fabric_slug", "cotton")   # unknown SKU -> assume cotton (most common)
    method_slug = dec.get("method_slug", "screen-printed")
    entity = entity_slug(parsed["design"], parsed["client"])

    parts = ["custom", fabric_slug, "bandana", _slug(color) or None, method_slug, entity]
    slug = "-".join(p for p in parts if p)
    if taken is not None and slug in taken:            # collision: add attribute, then client
        for extra in (["triangle"] if shape == "Triangle" else []) + [_slug(parsed["client"])]:
            if f"{slug}-{extra}" not in taken:
                slug = f"{slug}-{extra}"
                break
    if taken is not None:
        taken.add(slug)

    fabric = dec.get("fabric", "Cotton")
    method = dec.get("method", "Screen Print")
    color_t = color.title() if color else ""
    title = f"Custom {fabric.split(' (')[0]} Bandana{' – ' + color_t if color_t else ''} | {parsed['design'].replace(' Bandana','')}"
    alt = (f"{color_t + ' c' if color_t else 'C'}ustom {fabric.split(' (')[0].lower()} bandana, "
           f"{method.split(' (')[0].lower().replace('screen print','screen printed')} "
           f"for {parsed['client']} by Planet Apparel.")

    return dict(
        key=f"{parsed['invoice']}-{_slug(color) or 'na'}",   # idempotency key: invoice+color
        slug=slug, filename=f"{slug}.jpg", title=title, alt=alt,
        color=color_t, fabric=fabric, shape=shape, method=method,
        made_in_usa=dec.get("usa", False), eco=dec.get("eco", False),
        sku=(sku or "TBD"), invoice=parsed["invoice"],
        design=parsed["design"], client=parsed["client"],
    )
