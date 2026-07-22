import csv
import io
import json
import os
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

import brain_router
import scan_feed


NOW = datetime(2026, 7, 16, 12, 0, tzinfo=timezone.utc)


class FeedBrainTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.feed_root = self.base / "Feed"
        self.auto_root = self.base / "Auto"
        self.state_dir = self.base / "state"
        self.out_dir = self.base / "out"
        self.feed_root.mkdir()
        self.auto_root.mkdir()
        for folder in scan_feed.FOLDERS:
            (self.feed_root / folder).mkdir()
            (self.auto_root / folder).mkdir()
        (self.feed_root / "Intake").mkdir()
        self.env = {
            "FEED_ROOT": str(self.feed_root),
            "FEED_AUTO_ROOT": str(self.auto_root),
            "FEED_STATE_DIR": str(self.state_dir),
            "BRAIN_OUT_DIR": str(self.out_dir),
        }

    def tearDown(self):
        self.temp.cleanup()

    def write_file(self, relpath, text, mtime=1784212800.0):
        target = self.feed_root / relpath
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
        os.utime(target, (mtime, mtime))
        return target

    def scan(self):
        return scan_feed.scan(now=NOW, run_id="feed-test", env=self.env)

    def test_a1_new_file_listed_once_then_marked_processed(self):
        self.write_file("General/one.pdf", "one")
        first = self.scan()
        self.assertEqual([item.path for item in first.new_files], ["General/one.pdf"])

        scan_feed.mark_processed(first.new_files[0], now=NOW, run_id="feed-test", env=self.env)
        second = self.scan()
        self.assertEqual(second.new_files, [])

    def test_a2_missing_journal_restores_from_snapshot(self):
        target = self.write_file("General/one.pdf", "one")
        first = self.scan()
        scan_feed.mark_processed(first.new_files[0], now=NOW, run_id="feed-test", env=self.env)
        (self.state_dir / "processed.jsonl").unlink()

        restored = self.scan()
        self.assertEqual(restored.new_files, [])
        self.assertTrue(any("Restored processed state from snapshot" in message for message in restored.messages))
        self.assertTrue(target.exists())

    def test_a3_missing_journal_and_snapshot_baselines_and_lists_recent_review_only(self):
        self.state_dir.mkdir()
        old = self.write_file("General/old.pdf", "old", mtime=1770000000.0)
        recent = self.write_file("General/recent.pdf", "recent", mtime=1784212799.0)
        snapshot = self.feed_root / "_state" / "processed_snapshot.json"
        if snapshot.exists():
            snapshot.unlink()

        result = self.scan()
        self.assertEqual(result.new_files, [])
        self.assertTrue(any(message.startswith("ALERT:") for message in result.messages))
        self.assertEqual([item.abs_path for item in result.review_files], [recent])
        self.assertTrue(old.exists())

    def test_a4_identical_bytes_redropped_under_new_name_not_flagged(self):
        self.write_file("General/original.pdf", "same bytes")
        first = self.scan()
        scan_feed.mark_processed(first.new_files[0], now=NOW, run_id="feed-test", env=self.env)
        self.write_file("General/copy.pdf", "same bytes", mtime=1784212805.0)

        second = self.scan()
        self.assertEqual(second.new_files, [])

    def test_a5_intake_data_file_surfaces_with_note_sidecar_ignored_as_data(self):
        data = self.write_file("Intake/order.pdf", "order bytes")
        note = self.write_file("Intake/order.note.txt", "note text")

        result = self.scan()
        self.assertEqual([item.path for item in result.new_files], ["Intake/order.pdf"])
        self.assertEqual(result.new_files[0].tag, "[intake]")
        self.assertEqual(scan_feed.read_note(data), "note text")
        self.assertNotIn(note, [item.abs_path for item in result.new_files])

    def test_a9_intake_is_scanned_in_the_app_folder_too(self):
        """The app's upload surface can only land in the Dropbox APP folder.

        n8n's credential is app-folder scoped (same constraint as Fork A's payroll
        lane), so an upload cannot reach the canonical Feed/Intake. If the scanner
        only watched canonical, every uploaded doc would be invisible.
        """
        app_intake = self.auto_root / "Intake"
        app_intake.mkdir()
        data = app_intake / "uploaded_po.pdf"
        data.write_text("uploaded from the app", encoding="utf-8")
        note = app_intake / "uploaded_po.note.txt"
        note.write_text("PO for job #7788, from Acme", encoding="utf-8")
        os.utime(data, (1784212800.0, 1784212800.0))
        os.utime(note, (1784212800.0, 1784212800.0))

        result = self.scan()
        paths = [(i.root, i.path) for i in result.new_files]
        self.assertIn(("intake_app", "Intake/uploaded_po.pdf"), paths)
        self.assertEqual(scan_feed.read_note(data), "PO for job #7788, from Acme")
        # the sidecar is metadata, never data
        self.assertNotIn(("intake_app", "Intake/uploaded_po.note.txt"), paths)

    def test_a10_same_filename_in_both_intakes_does_not_collide(self):
        """A human drop and an app upload can share a name; they are distinct files."""
        (self.auto_root / "Intake").mkdir()
        a = self.write_file("Intake/order.pdf", "human drop")
        b = self.auto_root / "Intake" / "order.pdf"
        b.write_text("app upload", encoding="utf-8")
        os.utime(b, (1784212800.0, 1784212800.0))

        result = self.scan()
        roots = sorted(i.root for i in result.new_files if i.path == "Intake/order.pdf")
        self.assertEqual(roots, ["intake", "intake_app"])
        self.assertTrue(a.exists())

    def test_a6_legacy_log_migration_baselines_without_reflagging(self):
        target = self.write_file("General/legacy.pdf", "legacy", mtime=1784212800.0)
        legacy = self.base / "processed_log.sample.json"
        legacy.write_text(json.dumps({"General/legacy.pdf": 1784212800.0}), encoding="utf-8")
        self.env["FEED_LEGACY_LOG"] = str(legacy)

        result = self.scan()
        self.assertEqual(result.new_files, [])
        self.assertTrue(any("Migrated legacy processed log" in message for message in result.messages))
        self.assertTrue(target.exists())

    def test_a7_default_legacy_log_auto_migrates_without_env_var(self):
        target = self.write_file("General/default-legacy.pdf", "legacy", mtime=1784212800.0)
        legacy = self.base / "processed_log.json"
        legacy.write_text(json.dumps({"General/default-legacy.pdf": 1784212800.0}), encoding="utf-8")

        with mock.patch.object(scan_feed, "default_legacy_log", return_value=legacy):
            result = self.scan()

        self.assertEqual(result.new_files, [])
        self.assertTrue(any("Migrated legacy processed log" in message for message in result.messages))
        self.assertTrue(target.exists())

    def sns_fact(self):
        extracted = {
            "doc_type": "inbound_order",
            "entities": {"job": "1234", "vendor": "SNS Activewear", "customer": "Blink"},
            "amounts": {"total": 4820, "line_count": 3},
            "dates": {"eta": "2026-07-22"},
            "summary": "SNS Activewear order for Blink",
            "confidence": 0.9,
        }
        return brain_router.build_fact(
            ["fixtures/sns_invoice_1.pdf", "fixtures/sns_invoice_2.pdf", "fixtures/sns_invoice_3.pdf"],
            "SNS Activewear order for Blink, job #1234, 3 invoices",
            extracted,
            source="intake",
            submitter="Holly",
            now=NOW,
            content_hash="hash-sns",
            ledger_file=self.out_dir / "ledger.jsonl",
        )

    def test_b1_build_fact_on_sns_blink_fixture(self):
        fact = self.sns_fact()
        self.assertEqual(fact.doc_type, "inbound_order")
        self.assertEqual(fact.entities["job"], "1234")
        self.assertEqual(fact.amounts["line_count"], 3)
        self.assertEqual(len(fact.doc_refs), 3)

    def test_b2_route_and_dispatch_inbound_order_to_incoming_and_ledger(self):
        fact = self.sns_fact()
        decision = brain_router.route(fact, brain_router.load_registry())
        report = brain_router.dispatch(fact, decision, brain_router.default_adapters(self.out_dir))

        self.assertEqual(decision.destinations, ["app_incoming", "ledger"])
        self.assertTrue(report["ok"])
        self.assertEqual(len(read_csv_rows(self.out_dir / "incoming.csv")), 1)
        ledger_rows = read_jsonl(self.out_dir / "ledger.jsonl")
        self.assertEqual(len(ledger_rows), 1)
        self.assertEqual(ledger_rows[0]["content_hash"], "hash-sns")

    def test_b3_garbage_routes_to_review_and_ledger_only(self):
        fact = brain_router.build_fact(
            ["fixtures/garbage.txt"],
            "random thing",
            {},
            source="intake",
            submitter="Holly",
            now=NOW,
            content_hash="hash-garbage",
            ledger_file=self.out_dir / "ledger.jsonl",
        )
        decision = brain_router.route(fact, brain_router.load_registry())
        report = brain_router.dispatch(fact, decision, brain_router.default_adapters(self.out_dir))

        self.assertEqual(decision.destinations, ["review", "ledger"])
        self.assertTrue(report["ok"])
        review_rows = read_jsonl(self.out_dir / "review_queue.jsonl")
        self.assertEqual(len(review_rows), 1)
        self.assertIn("reason", review_rows[0])
        self.assertFalse((self.out_dir / "incoming.csv").exists())

    def test_b4_same_content_hash_already_routed_without_duplicates(self):
        fact = self.sns_fact()
        decision = brain_router.route(fact, brain_router.load_registry())
        adapters = brain_router.default_adapters(self.out_dir)
        first = brain_router.dispatch(fact, decision, adapters)
        second = brain_router.dispatch(fact, decision, adapters)

        self.assertEqual(first["status"], "dispatched")
        self.assertEqual(second["status"], "already_routed")
        self.assertEqual(len(read_csv_rows(self.out_dir / "incoming.csv")), 1)
        self.assertEqual(len(read_jsonl(self.out_dir / "ledger.jsonl")), 1)

    def test_b5_expense_fixture_writes_only_expense_hold_and_ledger(self):
        fact = brain_router.build_fact(
            ["fixtures/expense.pdf"],
            "shipping invoice $312.40, job #1234",
            {"doc_type": "expense", "amounts": {"total": 312.40}, "entities": {"job": "1234"}},
            source="intake",
            submitter="Holly",
            now=NOW,
            content_hash="hash-expense",
            ledger_file=self.out_dir / "ledger.jsonl",
        )
        decision = brain_router.route(fact, brain_router.load_registry())
        report = brain_router.dispatch(fact, decision, brain_router.default_adapters(self.out_dir))

        self.assertEqual(decision.destinations, ["expense_hold", "ledger"])
        self.assertTrue(report["ok"])
        self.assertEqual(len(read_csv_rows(self.out_dir / "expenses_held.csv")), 1)
        self.assertFalse((self.out_dir / "incoming.csv").exists())
        self.assertFalse((self.out_dir / "planetiq_queue.jsonl").exists())

    def test_b6_consolidated_period_bill_routes_without_a_job(self):
        """Real UPS weekly invoice shape: no single job by design, belongs to a period.

        Regression for the 2026-07-16 finding — proven on a real UPS invoice.
        """
        fact = brain_router.build_fact(
            ["fixtures/ups_weekly.pdf"],
            "shipping invoice $579.46, UPS weekly bill",
            {
                "doc_type": "period_expense",
                "entities": {"vendor": "UPS", "customer": "Planet Apparel"},
                "amounts": {"total": 579.46, "currency": "USD"},
                "dates": {"period": "2026-07-04"},
            },
            source="intake",
            submitter="Holly",
            now=NOW,
            content_hash="hash-ups",
            ledger_file=self.out_dir / "ledger.jsonl",
        )
        decision = brain_router.route(fact, brain_router.load_registry())
        report = brain_router.dispatch(fact, decision, brain_router.default_adapters(self.out_dir))

        # Must win over R-expense (whose 'shipping invoice' keyword also matches this note).
        self.assertEqual(decision.matched_rule, "R-period-expense")
        self.assertEqual(decision.destinations, ["expense_hold", "ledger"])
        self.assertTrue(report["ok"])
        # A missing job is CORRECT here, not a review trigger.
        self.assertEqual(fact.status, "routed")
        self.assertIsNone(fact.entities["job"])
        self.assertEqual(len(read_csv_rows(self.out_dir / "expenses_held.csv")), 1)
        self.assertFalse((self.out_dir / "incoming.csv").exists())

    def test_b7_period_bill_without_a_period_goes_to_review(self):
        """dates.period is what a consolidated bill is keyed on, so its absence must not pass silently."""
        fact = brain_router.build_fact(
            ["fixtures/ups_weekly.pdf"],
            "UPS weekly bill",
            {"doc_type": "period_expense", "amounts": {"total": 579.46}},
            source="intake",
            submitter="Holly",
            now=NOW,
            content_hash="hash-ups-noperiod",
            ledger_file=self.out_dir / "ledger.jsonl",
        )
        decision = brain_router.route(fact, brain_router.load_registry())
        brain_router.dispatch(fact, decision, brain_router.default_adapters(self.out_dir))

        self.assertEqual(decision.destinations, ["review", "ledger"])
        self.assertEqual(fact.status, "review")
        self.assertFalse((self.out_dir / "expenses_held.csv").exists())

    def test_b8_hash_file_is_content_based_not_path_based(self):
        """The CLI keyed idempotency on the file PATH, so a renamed re-drop routed twice."""
        one = self.base / "a.pdf"
        two = self.base / "b.pdf"
        one.write_bytes(b"identical bytes")
        two.write_bytes(b"identical bytes")
        different = self.base / "c.pdf"
        different.write_bytes(b"other bytes")

        self.assertEqual(brain_router.hash_file(one), brain_router.hash_file(two))
        self.assertNotEqual(brain_router.hash_file(one), brain_router.hash_file(different))
        self.assertEqual(len(brain_router.hash_file(one)), 64)

    def test_b9_multi_doc_hash_is_order_independent_and_single_doc_unchanged(self):
        """The flagship case is 3 SNS invoices = ONE order, so the key must cover the set."""
        a = self.base / "inv1.pdf"
        b = self.base / "inv2.pdf"
        c = self.base / "inv3.pdf"
        a.write_bytes(b"invoice one")
        b.write_bytes(b"invoice two")
        c.write_bytes(b"invoice three")

        # Same three files in any order = the same order.
        self.assertEqual(
            brain_router.content_hash_for([a, b, c]),
            brain_router.content_hash_for([c, a, b]),
        )
        # A different set is a different order.
        self.assertNotEqual(
            brain_router.content_hash_for([a, b, c]),
            brain_router.content_hash_for([a, b]),
        )
        # One doc keeps plain single-file semantics (no silent hash change).
        self.assertEqual(brain_router.content_hash_for([a]), brain_router.hash_file(a))


def read_jsonl(path):
    with Path(path).open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def read_csv_rows(path):
    with Path(path).open("r", newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


if __name__ == "__main__":
    unittest.main()
