#!/usr/bin/env python3
"""Scan the PlanetIQ Feed folders with crash-safe local state.

Usage:
  python3 scan_feed.py                 list files new since the last /feed run
  python3 scan_feed.py --commit        mark every currently new file processed
  python3 scan_feed.py --mark RELPATH  mark one file processed

The script self-locates from the checked-out skill copy, while allowing every
runtime path to be overridden by environment variables for tests and team use.
"""
import argparse
import hashlib
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


FOLDERS = ["Payroll", "Monthly_Financials", "Production_Times", "General"]
STATE_ENV = "FEED_STATE_DIR"
ROOT_ENV = "FEED_ROOT"
AUTO_ENV = "FEED_AUTO_ROOT"
LEGACY_ENV = "FEED_LEGACY_LOG"
JOURNAL_NAME = "processed.jsonl"
STATE_NAME = "state.json"
SNAPSHOT_REL = Path("_state") / "processed_snapshot.json"


@dataclass
class FeedFile:
    """One candidate data file found in a Feed root."""

    path: str
    root: str
    abs_path: Path
    size: int
    mtime: float
    sha256: str = ""

    @property
    def key(self):
        """Return the collision-safe state key for this file."""
        return state_key(self.root, self.path)

    @property
    def tag(self):
        """Return the human-readable source tag for listings."""
        if self.root == "appfolder":
            return "[auto-ingested]"
        if self.root == "intake":
            return "[intake]"
        if self.root == "intake_app":
            return "[intake · uploaded from the app]"
        return ""


@dataclass
class ScanResult:
    """The scanner result returned to tests and the CLI."""

    new_files: list
    review_files: list
    messages: list
    state: dict


def utc_now():
    """Return the current UTC datetime."""
    return datetime.now(timezone.utc)


def iso_now(now=None):
    """Return an ISO timestamp for journal rows."""
    current = now or utc_now()
    if isinstance(current, str):
        return current
    return current.astimezone(timezone.utc).isoformat()


def default_run_id(now=None):
    """Return the default run id for this scanner invocation."""
    current = now or utc_now()
    if isinstance(current, str):
        stamp = current.replace(":", "").replace("-", "")
    else:
        stamp = current.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"feed-{stamp}"


def default_feed_root():
    """Derive the canonical Feed folder from this script location."""
    here = Path(os.path.realpath(__file__))
    try:
        pa_root = here.parents[3]
    except IndexError:
        pa_root = Path.cwd()
    return pa_root / "PlanetIQ" / "Feed"


def default_auto_root(feed_root=None):
    """Derive the app-folder Feed location from the canonical Feed folder."""
    root = Path(feed_root) if feed_root else default_feed_root()
    planet_apparel = root.parents[1] if len(root.parents) > 1 else root.parent
    return planet_apparel.parent / "Apps" / "PlanetIQ-Feed"


def default_legacy_log():
    """Return the live skill's legacy processed log path."""
    try:
        return Path(os.path.realpath(__file__)).parents[1] / "processed_log.json"
    except IndexError:
        return None


def get_paths(env=None):
    """Resolve scanner paths from environment variables and defaults."""
    environ = env or os.environ
    feed_root = Path(environ.get(ROOT_ENV, str(default_feed_root()))).expanduser()
    auto_root = Path(environ.get(AUTO_ENV, str(default_auto_root(feed_root)))).expanduser()
    state_dir = Path(environ.get(STATE_ENV, "~/.claude/planetiq-feed-state/")).expanduser()
    legacy = environ.get(LEGACY_ENV)
    legacy_log = Path(legacy).expanduser() if legacy else default_legacy_log()
    return feed_root, auto_root, state_dir, legacy_log


def state_key(root, relpath):
    """Return the internal state key for a root-relative path."""
    return f"{root}:{relpath}"


def sha256_file(path):
    """Hash a file's content."""
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def should_ignore(path):
    """Return True when a path should not be treated as a Feed data file."""
    name = path.name
    return (
        name == "_READ_ME_FIRST.txt"
        or name.startswith(".")
        or name.endswith(".note.txt")
        or path.is_dir()
    )


def iter_current_files(feed_root=None, auto_root=None, env=None):
    """Yield all current data files from canonical, app-folder, and Intake roots."""
    if feed_root is None or auto_root is None:
        feed_root, auto_root, _state_dir, _legacy = get_paths(env)

    for root_path, root_name in ((Path(feed_root), "canonical"), (Path(auto_root), "appfolder")):
        for folder in FOLDERS:
            folder_path = root_path / folder
            if not folder_path.is_dir():
                continue
            for item in sorted(folder_path.iterdir()):
                if should_ignore(item):
                    continue
                stat = item.stat()
                yield FeedFile(
                    path=f"{folder}/{item.name}",
                    root=root_name,
                    abs_path=item,
                    size=stat.st_size,
                    mtime=round(stat.st_mtime, 2),
                )

    # Intake lives under BOTH roots: humans drop into the canonical Feed/Intake/,
    # while the app's upload surface lands in the Dropbox app folder (n8n can only
    # reach the app-folder sandbox — same constraint Fork A's payroll lane has).
    for intake_root, root_name in (
        (Path(feed_root) / "Intake", "intake"),
        (Path(auto_root) / "Intake", "intake_app"),
    ):
        if not intake_root.is_dir():
            continue
        for item in sorted(intake_root.iterdir()):
            if should_ignore(item):
                continue
            stat = item.stat()
            yield FeedFile(
                path=f"Intake/{item.name}",
                root=root_name,
                abs_path=item,
                size=stat.st_size,
                mtime=round(stat.st_mtime, 2),
            )


def normalize_state(payload):
    """Normalize state snapshots from current or older JSON shapes."""
    if not payload:
        return {"files": {}, "hashes": []}
    if "files" in payload:
        return {"files": dict(payload.get("files") or {}), "hashes": list(payload.get("hashes") or [])}
    files = {}
    for key, value in payload.items():
        if isinstance(value, dict):
            files[key] = value
    return {"files": files, "hashes": []}


def load_journal(journal_path):
    """Load append-only journal rows into the current state shape."""
    files = {}
    hashes = set()
    if not journal_path.exists():
        return None
    with journal_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            root = row.get("root", "canonical")
            relpath = row.get("path", "")
            key = state_key(root, relpath)
            files[key] = {
                "path": relpath,
                "root": root,
                "size": row.get("size"),
                "mtime": row.get("mtime"),
                "sha256": row.get("sha256", ""),
                "processed_at": row.get("processed_at"),
                "run_id": row.get("run_id"),
            }
            if row.get("sha256"):
                hashes.add(row["sha256"])
    return {"files": files, "hashes": sorted(hashes)}


def write_json_atomic(path, payload):
    """Write JSON by temporary file and atomic rename."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_name(f".{target.name}.tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.rename(tmp, target)


def append_journal(journal_path, feed_file, processed_at, run_id):
    """Append one processed file row immediately."""
    journal_path.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "path": feed_file.path,
        "root": feed_file.root,
        "size": feed_file.size,
        "mtime": feed_file.mtime,
        "sha256": feed_file.sha256,
        "processed_at": processed_at,
        "run_id": run_id,
    }
    with journal_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, sort_keys=True) + "\n")


def copy_snapshot(state, feed_root):
    """Copy the current state snapshot into the Feed root for visibility."""
    snapshot = Path(feed_root) / SNAPSHOT_REL
    write_json_atomic(snapshot, state)


def rebuild_state_snapshot(state_dir, feed_root, state):
    """Persist the state snapshot locally and to the Feed backup location."""
    write_json_atomic(Path(state_dir) / STATE_NAME, state)
    copy_snapshot(state, feed_root)


def load_snapshot(feed_root):
    """Load the Dropbox visibility snapshot when present."""
    snapshot = Path(feed_root) / SNAPSHOT_REL
    if not snapshot.exists():
        return None
    return normalize_state(json.loads(snapshot.read_text(encoding="utf-8")))


def legacy_root_and_path(relpath):
    """Translate one legacy log key into root plus path."""
    if relpath.startswith("AUTO "):
        return "appfolder", relpath[5:]
    if relpath.startswith("Intake/"):
        return "intake", relpath
    return "canonical", relpath


def migrate_legacy_log(legacy_log, state_dir, now=None, run_id=None):
    """Import legacy path->mtime log entries as baseline journal lines."""
    if not legacy_log or not Path(legacy_log).exists():
        return None
    data = json.loads(Path(legacy_log).read_text(encoding="utf-8"))
    journal = Path(state_dir) / JOURNAL_NAME
    processed_at = iso_now(now)
    rid = run_id or default_run_id(now)
    journal.parent.mkdir(parents=True, exist_ok=True)
    files = {}
    with journal.open("a", encoding="utf-8") as handle:
        for relpath, mtime in sorted(data.items()):
            root, path = legacy_root_and_path(relpath)
            row = {
                "path": path,
                "root": root,
                "size": None,
                "mtime": round(float(mtime), 2),
                "sha256": "",
                "processed_at": processed_at,
                "run_id": rid,
            }
            handle.write(json.dumps(row, sort_keys=True) + "\n")
            files[state_key(root, path)] = dict(row)
    return {"files": files, "hashes": []}


def load_or_initialize_state(feed_root, state_dir, legacy_log=None, current_files=None, now=None, run_id=None):
    """Load journal state, restore snapshot, migrate legacy, or baseline safely."""
    state_dir = Path(state_dir)
    state_dir_preexisting = state_dir.exists()
    journal = state_dir / JOURNAL_NAME
    state_dir.mkdir(parents=True, exist_ok=True)
    messages = []
    state = load_journal(journal)
    if state is not None:
        return state, messages, []

    migrated = migrate_legacy_log(legacy_log, state_dir, now=now, run_id=run_id)
    if migrated is not None:
        messages.append(f"Migrated legacy processed log: {legacy_log}")
        return migrated, messages, []

    snapshot = load_snapshot(feed_root)
    if snapshot is not None:
        processed_at = iso_now(now)
        rid = run_id or default_run_id(now)
        for record in snapshot.get("files", {}).values():
            feed_file = FeedFile(
                path=record.get("path", ""),
                root=record.get("root", "canonical"),
                abs_path=Path(record.get("path", "")),
                size=record.get("size") or 0,
                mtime=record.get("mtime") or 0,
                sha256=record.get("sha256", ""),
            )
            append_journal(journal, feed_file, record.get("processed_at") or processed_at, record.get("run_id") or rid)
        messages.append(f"Restored processed state from snapshot: {Path(feed_root) / SNAPSHOT_REL}")
        return snapshot, messages, []

    if not state_dir_preexisting:
        return {"files": {}, "hashes": []}, messages, []

    current = list(current_files or [])
    processed_at = iso_now(now)
    rid = run_id or default_run_id(now)
    files = {}
    hashes = set()
    for feed_file in current:
        feed_file.sha256 = sha256_file(feed_file.abs_path)
        append_journal(journal, feed_file, processed_at, rid)
        files[feed_file.key] = {
            "path": feed_file.path,
            "root": feed_file.root,
            "size": feed_file.size,
            "mtime": feed_file.mtime,
            "sha256": feed_file.sha256,
            "processed_at": processed_at,
            "run_id": rid,
        }
        hashes.add(feed_file.sha256)
    messages.append("ALERT: processed journal and snapshot are missing; current files were baselined as assumed processed.")
    return {"files": files, "hashes": sorted(hashes)}, messages, current


def is_recent(feed_file, now=None, days=14):
    """Return True if a file was modified within the review window."""
    current = now or utc_now()
    if isinstance(current, str):
        current_ts = datetime.fromisoformat(current.replace("Z", "+00:00")).timestamp()
    else:
        current_ts = current.timestamp()
    return feed_file.mtime >= current_ts - (days * 24 * 60 * 60)


def find_new_files(current_files, state):
    """Return current files that are not already represented by path state or hash."""
    files_state = state.get("files", {})
    known_hashes = set(state.get("hashes", []))
    new_files = []
    for feed_file in current_files:
        previous = files_state.get(feed_file.key)
        if previous and previous.get("size") == feed_file.size and previous.get("mtime") == feed_file.mtime:
            if previous.get("sha256"):
                feed_file.sha256 = previous["sha256"]
            continue
        if previous and not previous.get("sha256") and previous.get("mtime") == feed_file.mtime:
            continue
        feed_file.sha256 = sha256_file(feed_file.abs_path)
        if feed_file.sha256 in known_hashes:
            continue
        new_files.append(feed_file)
    return new_files


def scan(now=None, run_id=None, env=None):
    """Scan Feed folders and return files needing processing."""
    feed_root, auto_root, state_dir, legacy_log = get_paths(env)
    if not feed_root.is_dir():
        raise FileNotFoundError(f"Feed folder not found: {feed_root}")

    current = list(iter_current_files(feed_root, auto_root, env=env))
    state, messages, baselined = load_or_initialize_state(
        feed_root,
        state_dir,
        legacy_log=legacy_log,
        current_files=current,
        now=now,
        run_id=run_id,
    )
    review = [item for item in baselined if is_recent(item, now=now)]
    new_files = [] if baselined else find_new_files(current, state)
    rebuild_state_snapshot(state_dir, feed_root, state)
    return ScanResult(new_files=new_files, review_files=review, messages=messages, state=state)


def find_feed_file(relpath, env=None):
    """Find a current Feed file by CLI relative path."""
    normalized = relpath[5:] if relpath.startswith("AUTO ") else relpath
    for item in iter_current_files(env=env):
        if item.path == relpath or item.path == normalized or str(item.abs_path) == relpath:
            return item
    return None


def mark_processed(path, *, now=None, run_id=None, env=None):
    """Append one processed-file journal row and refresh snapshots."""
    feed_root, _auto_root, state_dir, _legacy_log = get_paths(env)
    feed_file = path if isinstance(path, FeedFile) else find_feed_file(str(path), env=env)
    if feed_file is None:
        raise FileNotFoundError(f"Feed file not found: {path}")
    if not feed_file.sha256:
        feed_file.sha256 = sha256_file(feed_file.abs_path)
    append_journal(Path(state_dir) / JOURNAL_NAME, feed_file, iso_now(now), run_id or default_run_id(now))
    state = load_journal(Path(state_dir) / JOURNAL_NAME) or {"files": {}, "hashes": []}
    rebuild_state_snapshot(state_dir, feed_root, state)
    return feed_file


def read_note(datafile_path):
    """Return Intake sidecar note text for a data file, when one exists."""
    datafile = Path(datafile_path)
    exact = datafile.with_name(f"{datafile.stem}.note.txt")
    if exact.exists():
        return exact.read_text(encoding="utf-8").strip()
    notes = sorted(datafile.parent.glob("*.note.txt"))
    if len(notes) == 1:
        return notes[0].read_text(encoding="utf-8").strip()
    return None


def print_result(result):
    """Print the human-readable scanner listing."""
    for message in result.messages:
        print(message)
    if result.review_files:
        print("Recent files for manual yes/no review:")
        for item in sorted(result.review_files, key=lambda f: f.path):
            print(f"  {item.abs_path}   {item.tag}".rstrip())
        return
    if not result.new_files:
        print("NOTHING NEW - the PlanetIQ Feed folders are already current.")
        return
    print(f"{len(result.new_files)} new file(s) since the last /feed run:")
    for item in sorted(result.new_files, key=lambda f: (f.root, f.path)):
        print(f"  {item.abs_path}   {item.tag}".rstrip())
        if item.root in ("intake", "intake_app"):
            note = read_note(item.abs_path)
            if note:
                print(f"    note: {note}")


def main(argv=None):
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", action="store_true", help="mark every currently new file processed")
    parser.add_argument("--mark", help="mark one relative path processed")
    args = parser.parse_args(argv)

    try:
        if args.mark:
            marked = mark_processed(args.mark)
            print(f"Marked processed: {marked.path}")
            return 0
        result = scan()
        if args.commit:
            for item in result.new_files:
                mark_processed(item)
            print(f"Committed: {len(result.new_files)} file(s) recorded as processed.")
            return 0
        print_result(result)
        return 0
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
