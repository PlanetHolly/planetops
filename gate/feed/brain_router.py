#!/usr/bin/env python3
"""Structure, route, and log extracted Feed facts.

The router receives extracted document data from the /feed runtime. It does not
extract documents, call LLMs, create Dropbox links, or write to external systems.
"""
import argparse
import csv
import hashlib
import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path


OUT_ENV = "BRAIN_OUT_DIR"
REGISTRY_DEFAULT = Path(__file__).with_name("routing_registry.json")


@dataclass
class RoutingDecision:
    """One routing decision for a Fact."""

    matched_rule: str
    destinations: list
    reason: str = ""


@dataclass
class Fact:
    """A structured Feed fact matching the Blueprint phase-one shape."""

    fact_id: str = None
    received_at: str = None
    source: str = None
    submitter: str = None
    doc_refs: list = field(default_factory=list)
    note: str = None
    doc_type: str = None
    entities: dict = field(default_factory=dict)
    amounts: dict = field(default_factory=dict)
    dates: dict = field(default_factory=dict)
    summary: str = None
    confidence: float = None
    routing: dict = field(default_factory=lambda: {"matched_rule": None, "destinations": []})
    status: str = "new"
    content_hash: str = None

    def to_row(self):
        """Return a flat dict suitable for JSONL and CSV sinks."""
        return {
            "fact_id": self.fact_id,
            "received_at": self.received_at,
            "source": self.source,
            "submitter": self.submitter,
            "doc_refs": json.dumps(self.doc_refs, sort_keys=True),
            "note": self.note,
            "doc_type": self.doc_type,
            "job": nested_get(self, "entities.job"),
            "customer": nested_get(self, "entities.customer"),
            "vendor": nested_get(self, "entities.vendor"),
            "project": nested_get(self, "entities.project"),
            "total": nested_get(self, "amounts.total"),
            "currency": nested_get(self, "amounts.currency"),
            "line_count": nested_get(self, "amounts.line_count"),
            "eta": nested_get(self, "dates.eta"),
            "period": nested_get(self, "dates.period"),
            "invoice_dates": json.dumps(nested_get(self, "dates.invoice_dates") or [], sort_keys=True),
            "summary": self.summary,
            "confidence": self.confidence,
            "matched_rule": nested_get(self, "routing.matched_rule"),
            "destinations": json.dumps(nested_get(self, "routing.destinations") or [], sort_keys=True),
            "status": self.status,
            "content_hash": self.content_hash,
        }

    @classmethod
    def from_dict(cls, data):
        """Build a Fact from a plain dict."""
        payload = dict(data or {})
        payload.setdefault("doc_refs", [])
        payload.setdefault("entities", {})
        payload.setdefault("amounts", {})
        payload.setdefault("dates", {})
        payload.setdefault("routing", {"matched_rule": None, "destinations": []})
        payload.setdefault("status", "new")
        return cls(**payload)


def utc_now():
    """Return the current UTC datetime."""
    return datetime.now(timezone.utc)


def iso_time(now=None):
    """Return an ISO timestamp."""
    current = now or utc_now()
    if isinstance(current, str):
        return current
    return current.astimezone(timezone.utc).isoformat()


def default_out_dir():
    """Derive the Brain's output dir from this script's location.

    Mirrors scan_feed.default_feed_root so the live skill copy
    (_Skills/feed/scripts/) writes to PlanetIQ/Brain/ rather than a
    cwd-relative folder. Overridable with BRAIN_OUT_DIR.
    """
    here = Path(os.path.realpath(__file__))
    try:
        return here.parents[3] / "PlanetIQ" / "Brain"
    except IndexError:
        return Path("brain_out")


def out_dir(path=None):
    """Resolve the local adapter output directory."""
    return Path(path or os.environ.get(OUT_ENV) or default_out_dir()).expanduser()


def ledger_path(output_dir=None):
    """Return the local ledger path."""
    return out_dir(output_dir) / "ledger.jsonl"


def ledger_length(path):
    """Count ledger rows."""
    target = Path(path)
    if not target.exists():
        return 0
    with target.open("r", encoding="utf-8") as handle:
        return sum(1 for line in handle if line.strip())


def next_fact_id(received_at, ledger_file):
    """Return the deterministic next fact id."""
    date_part = iso_time(received_at)[:10].replace("-", "")
    return f"F-{date_part}-{ledger_length(ledger_file) + 1:04d}"


def hash_file(path):
    """Return the sha256 of a file's content (the real idempotency key)."""
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hash_files(paths):
    """Return one sha256 over several files, for a multi-document Fact.

    Order-independent, so a 3-invoice order hashes the same however the files
    are listed. Single-file callers use hash_file directly.
    """
    combined = hashlib.sha256()
    for digest in sorted(hash_file(path) for path in paths):
        combined.update(digest.encode())
    return combined.hexdigest()


def content_hash_for(paths):
    """Return the idempotency key for one or many documents."""
    paths = list(paths)
    return hash_file(paths[0]) if len(paths) == 1 else hash_files(paths)


def nested_get(obj, dotted):
    """Get a dotted attribute or dict value."""
    current = obj
    for part in dotted.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            current = getattr(current, part, None)
        if current is None:
            return None
    return current


def non_empty(value):
    """Return True when a required value is present."""
    return value is not None and value != "" and value != [] and value != {}


def build_fact(doc_refs, note, extracted, *, source, submitter, now=None, content_hash=None, ledger_file=None):
    """Assemble one Fact from caller-supplied extracted document data."""
    extracted = extracted or {}
    received_at = iso_time(now)
    ledger_file = ledger_file or ledger_path()
    fact = Fact(
        fact_id=next_fact_id(received_at, ledger_file),
        received_at=received_at,
        source=source,
        submitter=submitter,
        doc_refs=list(doc_refs or []),
        note=note,
        doc_type=extracted.get("doc_type"),
        entities=with_defaults(extracted.get("entities"), ["job", "customer", "vendor", "project"]),
        amounts=with_defaults(extracted.get("amounts"), ["total", "currency", "line_count"]),
        dates=with_defaults(extracted.get("dates"), ["eta", "period", "invoice_dates"]),
        summary=extracted.get("summary"),
        confidence=extracted.get("confidence"),
        content_hash=content_hash,
    )
    if fact.dates.get("invoice_dates") is None:
        fact.dates["invoice_dates"] = []
    return fact


def with_defaults(values, keys):
    """Return a dict containing known keys and any supplied extras."""
    result = {key: None for key in keys}
    if isinstance(values, dict):
        result.update(values)
    return result


def load_registry(path=REGISTRY_DEFAULT):
    """Load routing rules from JSON."""
    with Path(path).open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload.get("rules", [])


def value_matches(values, actual):
    """Return True if a rule value list matches an actual value."""
    values = values or []
    return "*" in values or (actual in values if actual is not None else False)


def note_matches(keywords, note):
    """Return True if a rule keyword list matches a note."""
    keywords = keywords or []
    if "*" in keywords:
        return True
    text = (note or "").lower()
    return any(keyword.lower() in text for keyword in keywords)


def rule_matches(rule, fact):
    """Return True when a registry rule matches a Fact."""
    match = rule.get("match", {})
    return value_matches(match.get("doc_type"), fact.doc_type) or note_matches(match.get("note_keywords"), fact.note)


def route(fact, registry):
    """Apply the first non-fallback matching rule, otherwise fallback."""
    fallback = None
    selected = None
    for rule in registry:
        if rule.get("rule_id") == "R-fallback":
            fallback = rule
            continue
        if rule_matches(rule, fact):
            selected = rule
            break
    if selected is None:
        selected = fallback or {"rule_id": "R-fallback", "destinations": ["review"], "required_fields": []}

    missing = [field for field in selected.get("required_fields", []) if not non_empty(nested_get(fact, field))]
    if missing:
        reason = f"missing required fields: {', '.join(missing)}"
        decision = RoutingDecision(f"{selected.get('rule_id')} ({reason})", ["review", "ledger"], reason)
        fact.status = "review"
    else:
        destinations = list(selected.get("destinations", []))
        if "ledger" not in destinations:
            destinations.append("ledger")
        decision = RoutingDecision(selected.get("rule_id"), destinations, "")
        fact.status = "review" if "review" in destinations else "routed"
    fact.routing = {"matched_rule": decision.matched_rule, "destinations": decision.destinations}
    return decision


class FileAdapter:
    """Base class for simple local-file adapters."""

    name = None

    def __init__(self, output_dir=None):
        self.output_dir = out_dir(output_dir)

    def write(self, fact, reason=""):
        """Write one Fact and return an adapter report."""
        raise NotImplementedError

    def ok(self, ref):
        """Return a successful adapter report."""
        return {"ok": True, "ref": ref, "error": None}


class LedgerAdapter(FileAdapter):
    """Append the Brain memory ledger."""

    name = "ledger"

    def write(self, fact, reason=""):
        self.output_dir.mkdir(parents=True, exist_ok=True)
        target = self.output_dir / "ledger.jsonl"
        with target.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(fact.to_row(), sort_keys=True) + "\n")
        return self.ok(str(target))


class IncomingAdapter(FileAdapter):
    """Append the local incoming CSV stand-in."""

    name = "app_incoming"
    columns = ["fact_id", "received_at", "vendor", "job", "customer", "summary", "total", "line_count", "eta", "status", "source_link", "doc_refs"]

    def write(self, fact, reason=""):
        target = self.output_dir / "incoming.csv"
        append_csv(target, self.columns, {
            "fact_id": fact.fact_id,
            "received_at": fact.received_at,
            "vendor": nested_get(fact, "entities.vendor"),
            "job": nested_get(fact, "entities.job"),
            "customer": nested_get(fact, "entities.customer"),
            "summary": fact.summary,
            "total": nested_get(fact, "amounts.total"),
            "line_count": nested_get(fact, "amounts.line_count"),
            "eta": nested_get(fact, "dates.eta"),
            "status": fact.status,
            "source_link": "",
            "doc_refs": json.dumps(fact.doc_refs, sort_keys=True),
        })
        return self.ok(str(target))


class PlanetIQAdapter(FileAdapter):
    """Append the local PlanetIQ intent queue."""

    name = "planetiq"

    def write(self, fact, reason=""):
        target = self.output_dir / "planetiq_queue.jsonl"
        append_jsonl(target, {"fact_id": fact.fact_id, "summary": fact.summary, "note": fact.note})
        return self.ok(str(target))


class ExpenseHoldAdapter(FileAdapter):
    """Append the local expense-hold CSV."""

    name = "expense_hold"
    columns = ["fact_id", "vendor", "job", "total", "eta", "note"]

    def write(self, fact, reason=""):
        target = self.output_dir / "expenses_held.csv"
        append_csv(target, self.columns, {
            "fact_id": fact.fact_id,
            "vendor": nested_get(fact, "entities.vendor"),
            "job": nested_get(fact, "entities.job"),
            "total": nested_get(fact, "amounts.total"),
            "eta": nested_get(fact, "dates.eta"),
            "note": fact.note,
        })
        return self.ok(str(target))


class ReviewAdapter(FileAdapter):
    """Append the local review queue."""

    name = "review"

    def write(self, fact, reason=""):
        row = fact.to_row()
        row["reason"] = reason
        target = self.output_dir / "review_queue.jsonl"
        append_jsonl(target, row)
        return self.ok(str(target))


def append_jsonl(path, row):
    """Append one JSON object to a JSONL file."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, sort_keys=True) + "\n")


def append_csv(path, columns, row):
    """Append one CSV row, writing the header when needed."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    needs_header = not target.exists() or target.stat().st_size == 0
    with target.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        if needs_header:
            writer.writeheader()
        writer.writerow({column: row.get(column) for column in columns})


def default_adapters(output_dir=None):
    """Return the default adapter map."""
    return {
        "ledger": LedgerAdapter(output_dir),
        "app_incoming": IncomingAdapter(output_dir),
        "planetiq": PlanetIQAdapter(output_dir),
        "expense_hold": ExpenseHoldAdapter(output_dir),
        "review": ReviewAdapter(output_dir),
    }


def ledger_contains(content_hash, output_dir=None):
    """Return True when a content hash already exists in the ledger."""
    if not content_hash:
        return False
    target = ledger_path(output_dir)
    if not target.exists():
        return False
    with target.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("content_hash") == content_hash:
                return True
    return False


def dispatch(fact, decision, adapters=None):
    """Dispatch a Fact to all destinations, preserving partial success reports."""
    adapters = adapters or default_adapters()
    sample_adapter = next(iter(adapters.values()), None)
    output_dir = sample_adapter.output_dir if sample_adapter else None
    if ledger_contains(fact.content_hash, output_dir):
        return {"status": "already_routed", "ok": True, "results": {}}

    results = {}
    for destination in decision.destinations:
        adapter = adapters.get(destination)
        if adapter is None:
            results[destination] = {"ok": False, "ref": "", "error": "missing adapter"}
            continue
        try:
            results[destination] = adapter.write(fact, reason=decision.reason)
        except Exception as exc:
            results[destination] = {"ok": False, "ref": "", "error": str(exc)}
    return {"status": "dispatched", "ok": all(item["ok"] for item in results.values()), "results": results}


def main(argv=None):
    """CLI for manual local intake testing."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--intake", required=True, nargs="+", help="data file path(s); pass several for ONE multi-document thing (e.g. a 3-invoice order)")
    parser.add_argument("--note-file", help="note text file")
    parser.add_argument("--extracted", required=True, help="JSON extraction dict")
    parser.add_argument("--source", default="intake")
    parser.add_argument("--submitter", default="manual")
    parser.add_argument("--registry", default=str(REGISTRY_DEFAULT))
    args = parser.parse_args(argv)

    note = Path(args.note_file).read_text(encoding="utf-8").strip() if args.note_file else ""
    extracted = json.loads(args.extracted)
    fact = build_fact(
        args.intake,
        note,
        extracted,
        source=args.source,
        submitter=args.submitter,
        content_hash=content_hash_for(args.intake),
    )
    decision = route(fact, load_registry(args.registry))
    report = dispatch(fact, decision)
    print(json.dumps({"fact": asdict(fact), "decision": asdict(decision), "report": report}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
