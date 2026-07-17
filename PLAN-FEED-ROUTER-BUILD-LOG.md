# Feed Router — Build Log
Plan: PLAN-FEED-ROUTER.md (Codex-approved, 3 rounds). Builder: Codex (workspace-write). Reviewer/arbiter: Claude.
Staged build — one reviewable increment per round.

## Pre-build (Claude, full access)
- Located canonical brain at Dropbox/PlanetApparel/PlanetIQ/Feed_Brain/ (byte-identical to _Skills copy; no drift).
- Imported into gate/feed/: brain_router.py, routing_registry.json, scan_feed.py, test_feed_brain.py.
- Reference suite is unittest-based (runs on plain python3; pytest NOT installed — parity guard must not depend on it).

## Build #1 — Step 0 (brain import + Node port + parity guard)

### Act 3 — Codex build (thread 019f721d-104a-7cb0-8bb1-a4bb61614193, sandbox workspace-write)
Codex wrote (foreground run hit the 2-min wall AFTER writing all files; no resume needed):
- gate/feed/route.js — CommonJS port of route() + helpers (value/note/rule matches, nested_get, non_empty), loads the same routing_registry.json
- gate/feed/parity_fixtures.json — 13 shared fixtures
- gate/feed/parity_check.py — python3/stdlib runner over brain_router.route()
- gate/feed/parity_check.js — node runner over route.js
- gate/feed/parity_test.sh — runs both, diff -u, exit 1 on any divergence (deploy-blocking guard)
- gate/package.json — added scripts.test = "sh feed/parity_test.sh"

### Act 4 — Claude review
- Read route.js line-by-line vs brain_router.py: faithful. doc_type OR note match; R-fallback skipped-then-used-last; ledger always appended; missing required_fields → exactly ["review","ledger"] + status review + matched_rule "<id> (missing required fields: ...)"; status review-if-review-else-routed. nested_get early-return parity holds. non_empty sidesteps the bool/int subclass trap.
- Verified parity_test.sh is a REAL guard (not rigged to pass).
- Ran INDEPENDENT adversarial fixtures (not Codex's): both-null doc_type/note → fallback; amounts.total=0 → routes (present); amounts.total="" → review (missing); uppercase doc_type → fallback (case-sensitive doc_type replicated); case-insensitive note. Normalized diff: EXACT MATCH 6/6.
- Official `npm test` parity guard: PASS.
- Fix rounds needed: 0.

### Faithful-replication notes to carry forward
- doc_type match is CASE-SENSITIVE; note match is case-insensitive. Build #4 extractor MUST emit lowercase doc_type or docs silently fall to fallback/review.
- amounts.total=0 passes the required-field check (correct); a $0 "sanity" flag, if wanted, belongs in Build #4 deterministic validators, not here.

### Deferred (Step 0 sub-item, NOT done — touches live /feed)
- Re-point the Dropbox Python CLI (~/Dropbox/.../Feed_Brain + _Skills/feed) at the repo copy so the repo is the single source of truth. Deliberately not done silently; flagged for Holly since it alters the live local /feed skill.

VERDICT: Build #1 APPROVED by Claude. Parity guard green.
