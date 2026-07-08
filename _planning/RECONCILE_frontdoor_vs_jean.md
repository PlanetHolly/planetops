# Reconciling two parallel builds — Holly's front door vs. Jean's nav shell
_2026-07-08 · for Holly + Jean to align before more code_

## TL;DR — you both built the same thing, apart, and neither of you is wrong
Over the last day, **Jean rebuilt the app's navigation on `main`** (pushed to GitHub) and **Holly's Claude session built a parallel front door + real security layer** (uncommitted, now saved on branch `frontdoor-gate`). You independently converged on the *same design* — collapsible left sidebar, no bottom tab bar, a tile "home directory" with lock icons, and a PIN gate. That convergence means the design is right. Now it has to become **one** line, not two. Nothing is lost — both versions are committed (Jean on `main`, Holly on `frontdoor-gate`).

## Side-by-side

| Piece | Jean's build (on `main`, committed) | Holly's build (branch `frontdoor-gate`) | Recommendation |
|---|---|---|---|
| **Floor-app nav** | Removed bottom bar → collapsible left **sidebar** + ☰ hamburger + section registry. Committed, integrated, his domain. | Removed bottom bar → left **icon-rail** in the same file, but built on a base 13 commits behind Jean's. | **Keep Jean's** — it's on main, more complete, his lane. Drop Holly's parallel floor-app nav edits. |
| **Home / directory** | `home-tiles` inside the floor app — "every section of the app," icons + labels + 🔒 lock markers. | Standalone `frontdoor/` app: a registry-driven directory of **all ~55 tools** (not just the floor app) + search + pinned favorites + branded circular icons. | **DECISION (see below).** Ours is the wider layer; his is the in-app one. |
| **PIN gate** | Client-side scaffold (`NAV_PIN`), **inert**, note: *"which sections are gated is Holly's DECISION."* Bypassable (it's front-end only). | **Real server-side gate** on Railway: session cookies, brute-force limits, financial 2nd PIN, health/alerts — **survived 3 rounds of Codex review + a boardroom vote.** | **Ours wins** — it's the actual answer to Jean's open "Holly's decision." His scaffold retires. |
| **Credential security** | ⚠️ `main` **still leaks live keys**: `STATE_API_KEY` (line 4404), ShipStation key+secret in state, `?k=` admin keys in the clock pages. | **Fixed:** keys moved server-side behind the gate's proxy; ShipStation creds server-only; `?k=` removed. | **MUST graft ours onto main** — this is a live exposure, not cosmetic. |
| **Icons** | Emoji. | Branded dark-circle "Ø" badges + custom hub/Floor-App glyphs. | Graft ours (cheap, additive). |
| **revenue-house/ (retention map + playbook)** | Present. | Present. **Essentially identical** (playbook differs by 2 lines). | Common ground — no conflict. |
| **P0 production bug fixes** (blanks-inventory load, scheduler date self-heal) | On `main`. | Not present. | **Keep Jean's.** |
| **Printavo write-back** (the big push) | Jean's active next build (bidirectional stage mirroring). | n/a | His lane — own branch, careful testing (it writes to live Printavo). |

## The one real decision for you two: how many "homes"?
Both of you built a tile directory. You have to pick **one shape** so users don't hit two:
- **Option A — Nested:** Holly's `frontdoor/` is the top directory over *all* tools → opening the Floor App shows Jean's sidebar for its sections. (More ambitious; creates the two-rail nesting Holly's already planning to calm down.)
- **Option B — One home:** pick a single directory — extend Jean's in-app home to list all tools, *or* adopt Holly's front door as the one home — and don't keep both. (Simpler; one nav.)
- Either way, **wrap the whole thing in Holly's real Railway gate** and apply the credential fixes.

## The clean git path (no lost work)
1. ✅ **Done:** Holly's work is preserved on branch `frontdoor-gate` (commit 399a714). `main` untouched.
2. **Jean keeps `main`** as the canonical line (his nav + bug fixes + Printavo work).
3. **Graft the non-negotiables from `frontdoor-gate` onto `main` via a PR:** the `gate/` service + the P0 credential fixes (re-applied on top of Jean's index.html) + branded icons. These are mostly **additive** (`gate/`, `frontdoor/` are new dirs — no conflict); only the index.html credential lines need re-applying to Jean's version.
4. **Going forward: one repo, branches, PRs.** Jean → `printavo-writeback` branch; front-door/gate → its branch; `main` stays stable. No more two people editing `main` uncommitted. **Do NOT split to a separate personal GitHub** — that turns today's one-time reconcile into a permanent fork.

## Bottom line for the conversation with Jean
1. Great news — your 8pm work is all on GitHub, safe.
2. We accidentally built the same nav twice; yours stays for the floor app.
3. But `main` is **leaking live credentials right now** — the gate + fixes from the parallel build need to come over, and they're already Codex-reviewed. That's the urgent graft.
4. Decide together: one home directory or nested. Then branches + PRs from here on.
