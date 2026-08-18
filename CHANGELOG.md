# PlanetOps — Change Log

Shared, append-only. Newest at top. Per the Planet Apparel Build Change Log Discipline (`~/Dropbox/PlanetApparel/CLAUDE.md`).

## 2026-08-18 — OT day cap lowered 600 → 525 min on the capacity gauge (the availability view PMs read) — branch `jean/ot-cap-525`, NOT yet merged
- Who:    Jean (via Claude, Opus). Jean's call: 525 is the realistic ceiling, 600 was not achievable.
- What:   `capacity/index.html`, three lines only — the legend text ("Overtime day (600 min)" → 525), the OT segment button label ("OT · 600" → "OT · 525"), and the live constant `const CAP={Standard:420,OT:600}` → `{Standard:420,OT:525}` (:155). Nothing else touched.
- Why:    600 minutes of press in a single day is not physically reachable. Production leaves at 2:30pm; from a 6:00 start that is 510 minutes of clock time TOTAL, before lunch, breaks, setup, press checks and cleanup. A gauge advertising 600 tells a PM there is availability that does not exist, so promised dates get built on it. 525 is Jean's stated realistic ceiling and still represents ~1h45m of genuine overtime beyond the 420 standard day.
- NOT changed: the `SAMPLE` fallback block's `minutes:600` entries (:162-164) are demo data used only when the n8n feed is dead, not the cap — a 600-minute sample day now correctly renders as over-cap.
- ✅ RESOLVED same session: `schedule/index.html:1018` carried a SECOND OT cap, `otCap:600` on the Auto Press lane (used by `capFor()` :1229). Jean's call — changed to 525 as well, so the gauge and the scheduler board now agree. `tests/test_ot_daycap.js` fixture + assertion E updated 600 → 525 so the test reflects production rather than enshrining a stale number. **No `otCap:600` or `OT:600` remains anywhere in the repo.**
- 🔑 WHAT 525 MEANS (Jean, 8/18): **8 hours 45 minutes of press printing**, inclusive of a third 15-minute break at the end of the day should the crew need it. 600 was never reachable and was quietly adding to the production overload by implying capacity that does not exist.
- Proof:  `node tests/test_ot_daycap.js` → 10/10 pass (unaffected: it exercises the scheduler lane, not the gauge). `grep` confirms exactly one `const CAP=` in the repo and it now reads 525; no other `Standard:420` definition exists.
- Build doc updated?  yes — this entry.

## 2026-07-29 — FLIP 2 of 2 + truncation guard: records are now the team-default board base, and a truncated export can no longer corrupt it — **PR #37 MERGED** (`55c476d`) + **PR #36 MERGED** (`56736a6`) → `frontdoor-gate` → Railway auto-deploy — https://github.com/PlanetHolly/planetops/pull/37 · https://github.com/PlanetHolly/planetops/pull/36
- Who:    Jean (via Claude, Opus). Merged in ORDER — #37 (guard) first, then #36 (render flip) — so records never became authoritative without the guard. Low-risk rollout: Jean is currently the SOLE scheduler user (never handed to the floor; only he + Holly know of it), so the multi-user soak/quiet-window discipline that gated the #35 flip does not apply here — no concurrent editor exists to exercise. Both flips are reversible (flag defaults) and backed by the nightly snapshot + still-live Printavo.
- What (#36, `RENDER_FROM_RECORDS` default `false→true`): `buildModel()`'s render base is now the persisted job records, not the re-parsed feeds. Records survive feed truncation + the slow leak (46 active records were held vs a live feed on 7/27) and — unlike a URL param — reach the front-door-embedded page. Tri-state: no stored pref = ON (records); `?render=feed` opts a device back to the feed base and PERSISTS it; `?render=records` opts back in; storage-throw leaves the initial ON. `useRecords` guard unchanged, so history-snapshot + manual-import still take the feed path.
- What (#37, CSV truncation guard): `loadLiveCsv()` now rejects a live feed whose data-row count collapsed below 50% of the last ACCEPTED feed (`csvTruncationVerdict()`), so a truncated export (the recurring ~7KB/23-row Railway export vs a healthy ~32KB/82-row one) never reaches `feedBase()`/`ingestRecords()` to blank record dates. Relative threshold adapts to any shop size; growth always passes; cold-start accepts the first feed and self-corrects the baseline upward; baseline persists in `localStorage.sb_csv_lastgood_rows`, ratcheted on accept only. `window.csvGuardDiag()` exposes the last decision. Live-feed only — history/manual-import untouched.
- Why together: #36 makes records authoritative; #37 is what makes a truncated export a genuine non-event on that authoritative path (the flip protects records from a job VANISHING; the guard protects them from a bad row BLANKING a date). Merging #36 without #37 would have inherited the exact 5→29 corruption seen live on 7/28.
- Proof:  Merged locally in order, full suite (13 files) re-run ON EACH merged result — all green: test_csv_guard 12/12, test_render_default 9/9, test_mergesync_default 9/9, test_merge 23/23, test_records_parity 4/4, test_render_ordering 6/6, test_inqueue 33, test_typeofwork 14, test_2b_render 14, test_pool_lanes 8, test_stage_gate 11, test_live_duedates 10, test_retirement 15. Zero conflict markers; `MERGE_SYNC=true` (:637), `csvTruncationVerdict` (:1065), `RENDER_FROM_RECORDS=true` (:1407) all confirmed present. Both PRs confirmed MERGED via gh.
- ⚠ Rollout: sole-user, so Jean just hard-refreshes his own tab to pick up records-render (verify: board shows the full schedule incl. the previously-leaked jobs, not the truncated feed). Deploy-verify on his machine same as before (`RENDER_FROM_RECORDS=true` in the served doc). When the tool IS handed to the floor, the multi-user rollout discipline returns.
- Cutover status: the SCHEDULE side is now fully on PlanetOps records (authoritative, truncation-immune, merge-synced). Remaining before Power Scheduler can be turned OFF: **A2** (floor-timers→calculator production-cost bridge) — still the sole cutover trigger, gated on Holly green-light + Kelly awareness (money-path) + a Rosa/Marisol floor pilot (Monday earliest). Pre-A2: the **Running section** needs a fix (Jean flagged 7/29 — looks/functions wrong, appears to be on outdated data) before the floor can use it.
- Build doc updated?  yes — this entry + `Power_Scheduler/CHANGELOG.md` + the cutover checklist resume block.

## 2026-07-29 — FLIP 1 of 2: MERGE_SYNC is now the team default (per-item merge sync ON) — **PR #35 MERGED** (`ffb5917`) → `frontdoor-gate` → Railway auto-deploy — https://github.com/PlanetHolly/planetops/pull/35
- Who:    Jean (via Claude, Opus). Merged in a quiescent end-of-day window with every scheduler/board device closed (no open tab could blind-overwrite during rollout).
- What:   `schedule/index.html`, the `MERGE_SYNC` resolution block only. Default `false → true`. Tri-state: no stored pref = ON; `?sync=blob` opts a device out and now PERSISTS the opt-out as `'0'` (old code did `removeItem`, which read as unset and wouldn't stick under an ON default); `?sync=merge` opts back in `'1'`; a storage exception at load leaves the initial ON. No other line changed — `SYNC_KEYED`/`SYNC_WHOLE`, the merge/pull/push functions and the `if(MERGE_SYNC)` call sites are untouched; this only switches which path is the default.
- Why:    First of the two staged cutover flips. A records-authoritative board (RENDER flip #36, next) cannot safely run on whole-blob last-write-wins once Printavo stops being the backup — a stale tab would blob-overwrite the now-authoritative store. Merge-sync had to be the default before RENDER flips. Merge ORDER is the guardrail, not a preference.
- Proof:  `tests/test_mergesync_default.js` (7 cases, real-source extraction; reverting the default to false fails it). Full suite re-run ON THE MERGED FILE — all 11 green: test_mergesync_default 9/9, test_merge 23/23 (the per-item merge core this switches on), test_inqueue 33, test_typeofwork 14, test_2b_render 14, test_live_duedates 10, test_pool_lanes 8, test_records_parity 4, test_render_ordering 6, test_retirement 15, test_stage_gate 11. Zero conflict markers; `let MERGE_SYNC=true` confirmed present at `schedule/index.html:637`.
- ⚠ Rollout: all devices were closed at merge, so each picks up the flipped code on next open (closed = safe). Deploy-verify on Jean's own machine: hard-refresh → DevTools Network → schedule doc → Response contains `let MERGE_SYNC=true` (owed by Jean; do not trust until seen). An un-refreshed old-code tab still blind-overwrites until it reloads — the one-line morning safeguard ("reload the scheduler before you use it") closes the residual.
- Next: let merge-sync run one real production day under concurrent use, THEN merge PR #36 (RENDER_FROM_RECORDS default ON) in the same quiet-window discipline. ⚠ #36 alone does NOT make truncation a non-event — the board's CSV ingest still has no truncation guard (a 7 KB / 23-row export was serving the board on 7/28); the ingest-guard durability PR should land with #36.
- Build doc updated?  yes — this entry + `Power_Scheduler/CHANGELOG.md` + the cutover checklist resume block.

## 2026-07-27 — Board: the unscheduled pool is grouped by STATION instead of one flat list — **PR #34 MERGED** (`4a649ce`) → `frontdoor-gate` → Railway auto-deploy — https://github.com/PlanetHolly/planetops/pull/34
- Post-merge verification on the MERGED file: zero conflict markers; `poolLanes()` at `schedule/index.html:1976`, its call site at `:2001`, the `.lane-static` CSS rule at `:308`; the main `<script>` block parses clean standalone; all 10 suites green (test_pool_lanes 8/8, test_stage_gate 11/11, test_inqueue 33/33, test_typeofwork 14/14, test_2b_render 14/14, test_live_duedates 10/10, test_merge 23/23, test_records_parity 4/4, test_render_ordering 6/6, test_retirement 15/15); and the merged file rendered against the live feed reproduces the `Auto Press — 3 jobs · 902 min waiting for a date` block. Browser smoke test on the live board still owed by Jean.
- Who:    Jean (via Claude, Opus), branch `jean/pool-by-station` off `frontdoor-gate`, worktree `~/github/planetops-pool-lanes`. Follow-on to PR #33, requested after Jean confirmed that fix live ("it looks correct… now I can switch between Printavo's Power Scheduler and our scheduler and have the same projects being reflected to each other" — 9 unscheduled, 5 through the Queue awaiting a date).
- Ask:    every job in the pool has already been given a station — that's what released it from the Queue — so Jean asked to see the pool split by Auto Press / Manual Press / Heat Press / Post Production rather than as one long list: "easier to tell where things can start landing."
- What:   new `poolLanes(un)` next to `renderBoard()` in `schedule/index.html`. Renders one `.lane` card per station that has jobs, in **LANES order** (auto → heat → manual → post → ship → receiving — deliberately the same order the day rows below use, so the pool and the days scan identically; not Jean's spoken order, which listed manual before heat). Header per block = station label + `N jobs · M min waiting for a date`. `renderBoard()`'s pool body changes from `<div class="cardgrid">${un.map(jobCard)}</div>` to `${poolLanes(un)}`; the existing sort (parked last, then soonest prod-due) is untouched and now orders jobs *within* each station. Section subtitle now opens with "grouped by station".
- No capacity bar on these blocks on purpose — an undated job has no day to fill, so a used/cap meter would be meaningless here. The day rows keep theirs.
- Deliberately NOT collapsible: day-row station blocks collapse via `expandedLanes` and start CLOSED, which would hide the whole pool behind clicks. The Unscheduled section already collapses as a unit. New CSS rule `.lane-static .lane-head{cursor:default}` so these heads don't look clickable like the day rows' do.
- ⚠ Guard against silently dropping work: a pool job always has a station, but nothing guarantees it MATCHES a lane (a retired or renamed Printavo station). Unmatched rows get their own **"Other station"** block rather than disappearing from the board — grouping must never lose a row.
- Proof:  new `tests/test_pool_lanes.js`, 8 assertions, extracting the real `poolLanes`/`LANES`/`laneOf` from the shipped file with `jobCard` stubbed: the four stations Jean named each get a block; per-station minute sums are right (798 for a two-job Auto Press); blocks follow LANES order regardless of input order; an unmatched station lands in "Other station"; **card count in === card count out** on both the normal and unmatched cases; empty pool renders an empty string. Full regression on the same tree, all exit 0: test_pool_lanes 8/8 · test_stage_gate 11/11 · test_inqueue 33/33 · test_typeofwork 14/14 · test_2b_render 14/14 · test_live_duedates 10/10 · test_merge 23/23 · test_records_parity 4/4 · test_render_ordering 6/6 · test_retirement 15/15. Main `<script>` block parsed standalone, clean. Rendered against the live feed's current pool: one `Auto Press — 3 jobs · 902 min waiting for a date` block holding `27524-1`, `27542-1`, `27561-1`.
- Build doc updated?  no — this entry is the record. Browser smoke test on the live board still owed by Jean.

## 2026-07-27 — Stage 1 / Stage 2 are now actually separate: the Board's unscheduled pool is the exact COMPLEMENT of the Queue — **PR #33 MERGED** (`50f126a`) → `frontdoor-gate` → Railway auto-deploy — https://github.com/PlanetHolly/planetops/pull/33
- Post-merge verification on the MERGED file: zero conflict markers; `inBoardPool` at `schedule/index.html:1262` and the pool filter at `:1968`; the main `<script>` block parses clean standalone; all 9 suites green (test_stage_gate 11/11, test_inqueue 33/33, test_typeofwork 14/14, test_2b_render 14/14, test_live_duedates 10/10, test_merge 23/23, test_records_parity 4/4, test_render_ordering 6/6, test_retirement 15/15); and the merged file re-evaluated against the live feeds reproduces queue 14 / pool 3 / **0 in both**. Merged into `frontdoor-gate` on top of `0eebbbb` (Holly's Media Center sink-column change, unrelated files) with no conflict. Browser smoke test on the live board still owed by Jean.
- Who:    Jean (via Claude, Opus), branch `jean/board-stage-gate` off `frontdoor-gate`, worktree `~/github/planetops-stage-gate`.
- Symptom (Jean, two reports in one): (a) `27553 - 1` was ✕ removed from the Queue as not-production-work; it left the Queue but **stayed in the Board's unscheduled pool**, where there is no remove button (and shouldn't be — "if it gets deleted in the queue because that's stage 1 then it shouldn't live in the board as stage 2"). (b) `27401 - 1` had no ⏱ time and no station yet — still stage 1 — but showed in the Queue **and** in the Board's unscheduled pool at the same time. Jean's framing: Queue = stage 1 (fill in details, time, station), Board unscheduled = stage 2 (enriched, waiting on a date only); a job should be in exactly one.
- Root cause: `inQueue`, `invReleasable`, `isPrintavoPost`, `exitsOnDate` and `isRemoved` were all declared **inside `renderList()`**, so only the Queue could see them. `renderBoard()` had no access and defined its pool independently as `unscheduled.filter(j=>!isOut(j))` over `unscheduled=jobs.filter(j=>!j.date)` — i.e. "any undated non-outsourced job", which knows nothing about enrichment and nothing about removal. Two surfaces, two unrelated rules, guaranteed to disagree.
- What (1/2): the whole predicate block is **hoisted to module scope**, immediately after `pptOf`/`realPP`, under a `THE STAGE GATE` header comment. Every one of them is byte-identical to what shipped in PR #32 — they only changed address, and `isRemoved` gained a `(store.removed||{})` guard now that it is called from a second place. `renderList()` is unchanged apart from losing the declarations.
- What (2/2): one new predicate at the same scope — `const inBoardPool=j=>!j.date&&!isOut(j)&&!inQueue(j)&&!isRemoved(j);` — and `renderBoard()`'s pool filter becomes `unscheduled.filter(j=>inBoardPool(j)&&matchesQ(j))`. Deliberately the **exact complement** of `inQueue` rather than a fresh set of conditions: a job graduates on station assignment (unchanged, and the existing 0-minute confirm on that select is still where "give it a time" is enforced), so re-testing minutes here would open a gap where a job Jean knowingly graduated at 0 minutes is in NEITHER stage and vanishes from the board entirely. Complement = every job is always visible in exactly one place. Section subtitle updated to match ("these are through the Queue — details, ⏱ time and station are set, all that's left is the DATE").
- Scope note (deliberate, flagged not fixed): `isRemoved` is applied to the unscheduled POOL only. A removed job that later receives a production date still renders on its day row and still counts against day capacity — that's on purpose, since a date means somebody scheduled it as real work, and silently hiding it would hide committed press capacity. Removed jobs remain restorable from the Queue's Removed section, which is unchanged.
- Live effect, measured on the real feeds (`intake-feed` + `schedule-csv`, pulled 2026-07-27, empty local store) by evaluating the shipped predicates on both branches: **before — queue 14, board pool 17, 14 jobs in BOTH (every single queue job was duplicated into the pool). After — queue 14, board pool 3, 0 in both.** The 3 that remain are `27524-1`, `27542-1`, `27561-1`, all carrying `Auto Press (In Season)` and real minutes with no date — textbook stage 2.
- Proof:  new `tests/test_stage_gate.js`, 11 assertions, extracting the real predicates from the shipped file: Jean's `27401-1` before and after station assignment (queue only → pool only); `27553-1` removed → in neither; a dated job → in neither (it's on its day row); `25414-1`/`-2` vendor vs in-house legs; and **the invariant** — a 240-shape matrix over station × status × Type of Work × stationAssigned × removed × dated asserting that no shape is ever in both stages and no undated, un-removed, in-house job falls through both. Full regression on the same tree, all exit 0: test_stage_gate 11/11 · test_inqueue 33/33 · test_typeofwork 14/14 · test_2b_render 14/14 · test_live_duedates 10/10 · test_merge 23/23 · test_records_parity 4/4 · test_render_ordering 6/6 · test_retirement 15/15. The main `<script>` block was also parsed standalone (187k chars, clean) since the change moves a large block across the file.
- Build doc updated?  no — this entry is the record. Browser smoke test on the live board still owed by Jean.

## 2026-07-24 — Full-outsource imprints leave the QUEUE: Printavo's per-imprint **Type of Work** now names the in-house leg — **PR #32 MERGED** (`53467dc`) → `frontdoor-gate` → Railway auto-deploy — https://github.com/PlanetHolly/planetops/pull/32
- Post-merge verification on the MERGED file: zero conflict markers; `vendorTow`/`inHouseLeg` present at `schedule/index.html:1954-1955`; all 8 suites green (test_inqueue 33/33, test_typeofwork 14/14, test_2b_render 14/14, test_live_duedates 10/10, test_merge 23/23, test_records_parity 4/4, test_render_ordering 6/6, test_retirement 15/15); and the merged file re-evaluated against the live feeds produces a byte-identical 69-row queue to the verified branch. Merged on Jean's explicit go-ahead after he confirmed the ship-direct invoices in Printavo. Browser smoke test on the live board still owed by Jean.
- Who:    Jean (via Claude, Opus), branch `jean/queue-vendor-only` off `frontdoor-gate`, worktree `~/github/planetops-vendor-only`.
- Symptom (Jean's report): invoice `25414` has two imprints — `-1` is a complete outsource (nothing for Planet production), `-2` is the in-house packaging leg. **Both** were showing in the Queue; only `-2` should. Same shape on `26504` (1,2,3 vendor + 4 in-house), `26510`, `27365`. And invoices that are outsource ALL the way through with no in-house leg at all (`27260`, `27417`) had no way to leave the Queue.
- Root cause: `invReleasable` (from PR #28) picked the in-house leg by **Post-Pro label** alone — `sibs.some(x=>realPP(pptOf(x)))?realPP(pptOf(j)):true`. Until some sibling carries a label, the `:true` legacy branch releases the WHOLE invoice, vendor legs included. Printavo does not pre-fill Post Production Type on these, so the legacy branch was the normal case, not the exception.
- The signal that was already there: the official Printavo API returns a per-imprint **Type of Work** (`typeOfWork`) reading `"Outsource"` or `"In-House Production"`, and the intake feed (`PDYJe6wCsZOlRKuO`) has been carrying it into the board since 7/09. It was only ever used by `isOut()` for Arrivals routing — never consulted for the queue split.
- What (1/3), `schedule/index.html` → `renderList()`: two new helpers above `invReleasable` — `const vendorTow=j=>/outsourc/i.test(j.typeOfWork||'');` and `const inHouseLeg=j=>/in[\s_-]*house/i.test(j.typeOfWork||'')||realPP(pptOf(j));` — and the gate becomes: `invsvc==='none'` → never; **any sibling is an in-house leg → only in-house legs release**; **every outsourced sibling is Type of Work = Outsource → NOTHING on the invoice releases** (no in-house work exists; it waits in Arrivals and closes to history on arrival, the same end state as "no 2nd service" but detected instead of toggled); otherwise → all release (the legacy fallback, unchanged and still reachable whenever Printavo tells us nothing). A Post-Pro label still counts as an in-house leg, so a label Jean sets by hand overrides Printavo — verified by test 23.
- What (2/3), `feedBase()`: the Power Scheduler CSV has no Type of Work column and **CSV wins at invoice level**, so on a healthy CSV every outsourced invoice would have reached the new gate with the field blank and fallen straight back to the old label-guessing. `feedBase()` now copies `typeOfWork` from the intake feed onto CSV rows, keyed on `parentKey` (so split rows `- 1a`/`- 1b` inherit correctly). The copy is **all-or-nothing per invoice**: PS imprint ordinals are a lifetime counter and can drift from the API's, so unless the two sources agree on the invoice's ENTIRE set of imprint keys the whole invoice is left blank rather than risk stamping "vendor leg" on the wrong imprint. Records ingest (`ingestRecords`) picks the value up from the same place, so the records path inherits the fix for free.
- What (3/3), Arrivals `invGroup()` — display only, no logic: a third chip state, `📦 vendor-only · no in-house leg` (grey, no button), for invoices where every outsourced imprint is Type of Work = Outsource. Previously they showed `🔧 in-house leg TBD` + a "no 2nd service?" button, which after this change is wrong on both counts — nothing is TBD and the toggle is moot. Computed from ALL the invoice's outsourced imprints (`jobs.filter(...)`), not just the rows in the current date bucket, so a split arrival can't make a mixed invoice look vendor-only. The `📪 no 2nd service` and `🔧 in-house after arrival` states are untouched.
- Live effect, measured against the real feeds (`intake-feed` 100 rows / 60 invoices + `schedule-csv`, both pulled 2026-07-24) by evaluating the shipped predicates on both branches: **queue 92 → 69 rows, 23 removed, every one of them Type of Work = Outsource, zero in-house rows lost.** Mixed invoices: `25414` keeps 2 drops 1 · `26504` keeps 4 drops 1,2,3 · `26510` keeps 3 drops 1,2 · `27232`/`27249`/`27325`/`27495`/`27551` keep 2 drop 1 · `27365` keeps 3,4 drops 1,2. Vendor-only invoices that leave the Queue entirely: `27260` (4 imprints), `27417` (3), `27285`, `27314`, `27335`. The intake feed paginates at INVOICE level (`invoices(first:10)`, max 20 pages), so an invoice is never split across a page — a vendor-only verdict is never an artifact of truncation.
- ✅ Vendor-only is a REAL category, confirmed by Jean in Printavo 2026-07-24: `27285` (Kabouter Creative), `27314` and `27335` (Anythink Nature Library A/B) are single-imprint Digital Bandana orders that ship **direct from the vendor to the client** — they have no `-2` in-house leg because there is no in-house work, and they were never meant to touch the Queue. (They are NOT missing an imprint; an earlier read of this changelog entry guessed they might be, and that guess was wrong.) Their siblings `27232`/`27249`/`27325`/`27495`/`27551` do carry a `-2` In-House Production imprint because those come back here for packaging. So the same Printavo field distinguishes "outsourced then packaged here" from "outsourced and shipped direct" with no hand-toggling, which is exactly what `invsvc==='none'` was invented to do by hand — this detects it automatically. Those three stay visible in Arrivals under the new vendor-only chip and close to history on arrival.
- Proof:  `tests/test_inqueue.js` extended to 33 assertions (all 23 prior ones still green, extraction harness now also pulls `vendorTow`/`inHouseLeg` out of the live file): 20a/b = Jean's `25414` both ways; 21 = `27260` all-vendor, none in queue; 22a/b = `26504` one in-house leg among three vendor legs; 23a/b = a hand-set Post-Pro label still wins on an all-Outsource invoice; 24 = no Type of Work anywhere → legacy release intact; 25a/b = an in-house sibling that isn't outsourced-classified reaches the queue by the normal path while its vendor sibling stays out. `tests/test_typeofwork.js` extended to 14 (G/H/I/J) covering the `feedBase()` copy, including the ordinal-drift bailout and manual-import purity. Full regression on the same tree, all exit 0: test_inqueue 33/33, test_typeofwork 14/14, test_2b_render 14/14, test_live_duedates 10/10, test_merge 23/23, test_records_parity 4/4, test_render_ordering 6/6, test_retirement 15/15.
- Build doc updated?  no — this entry is the record. Browser smoke test on the live board still owed by Jean.

## 2026-07-22 — In-house post-production legs now show in the QUEUE too (same root cause as PR #28, scoped to the Post Production lane) + round 2: the Sched column now shows in Queue mode for the rows whose only exit is a date — **PR #30 MERGED** (`eab1ecb`) → `frontdoor-gate` → Railway auto-deploy; all 5 suites re-run green ON THE MERGED FILE
- Who:    Jean (via Claude, Opus), plan in `PLAN-inhouse-postpro.md` (repo-local, not committed), branch `jean/queue-inhouse-postpro` off `frontdoor-gate`. Round 1 committed as `b10164f`; round 2 (below) built on top of it in the same working tree, NOT committed/pushed — left in the working tree per Jean's instruction, both land together in PR #30.
- Symptom: Printavo also pre-stamps `Station = "Post Production"` on **in-house** post-production legs (packaging, fold+bag, barcode) that are not outsourced at all. PR #28 only fixed this for outsourced work (it branches on `isOut(j)`); non-outsourced jobs still fell to the `!j.station` branch of `inQueue` and never reached the Queue, so their Post-Pro type and ⏱ time could never be set. Confirmed live in `power_scheduler_2026-07-22_2039.csv`: `27524 - 2` (`Fold + Bag + Barcode`, status `👕 Blanks to Pull from Inventory 👕`) and `27365 - 3` (`Packaging (Apparel)`, status `👕 Blanks Received 👕`), both undated with a Printavo-stamped Post Production station.
- The `stationAssigned` distinction (this is the whole design): a station on a job has two possible origins. `j.stationAssigned===true` means Jean assigned it himself in the Queue — the existing queue→board graduation, and it must keep working exactly as today (the row leaves the Queue immediately). `j.stationAssigned` falsy but `j.station` set means Printavo stamped it — Jean never made a queue decision, so hiding it was the bug.
- What (round 1):   `schedule/index.html`, `renderList()`. New helper immediately above `inQueue`: `const isPrintavoPost=j=>!j.stationAssigned&&!!laneOf(j.station)&&laneOf(j.station).key==='post';`. Updated predicate: `const inQueue=j=>!j.placeholder&&!j.date&&(isOut(j)?invReleasable(j):(!j.station||isPrintavoPost(j)));`. Scoped deliberately to the **Post Production lane only** — NOT `!j.stationAssigned` alone and NOT dropping `!j.station` outright, either of which would also have pulled in ~17 undated `Auto Press`/`Heat Press`/`Manual Press` imprints that carry a Printavo station and are simply waiting for a board date (noise in the Queue, explicitly out of scope). `isOut`, `OUTSOURCED`, `invReleasable`, the `unscheduled` filter, `queueN`/`parkedN` (derive from `inQueue`, pick this up automatically), and the Arrivals section are all untouched.
- Consequence (documented, not prevented — matches the outsourced behaviour Jean already approved): a Printavo-stationed in-house post-pro leg now leaves the Queue when it gets a **production date**, not when a station is assigned, because Printavo already set the station — there's no station assignment left for Jean to make. Same tradeoff as the outsourced fix, now extended to this lane.
- What (round 2, Jean-approved follow-up — the fix above gave two families of rows a queue exit condition Jean had no way to reach): the round-1 fix meant outsourced legs and Printavo-stamped post-pro legs now exit the Queue on a production **date**, but the `Sched` date column at `renderList()` only rendered under `listShowAll` — normal Queue mode had no date field at all, so Jean could see these rows sitting in the Queue with no way to set the date that releases them. New helper next to `isPrintavoPost`: `const exitsOnDate=j=>isOut(j)||isPrintavoPost(j);` (outsourced rows ignore station entirely in `inQueue`, so `isOut(j)` alone correctly covers them regardless of whether a station happens to be set). The `Sched` `<td>` now renders **unconditionally** in every row/mode — a per-row conditional `<td>` would desync the table's column count, so instead the cell is always present and only its *contents* vary: `exitsOnDate(j)` rows get the real `<input type="date" class="schedinput" data-schedule="${j.imprint}">` (reusing the existing `data-schedule` change handler verbatim — no new handler added), everything else gets a muted `<span class="pending">—</span>` explaining the row leaves the Queue on station assignment instead and its date is set on the Board. The header's `${listShowAll?H('date','Sched'):''}` became the unconditional `${H('date','Sched')}` (sorting via `SORTVAL.date` is untouched and keeps working). The expand-row colspan at the same spot, previously `colspan="${listShowAll?19:18}"`, is now the unconditional `colspan="19"` to match the column count in both modes. Nothing else touched — Board, Arrivals, `inQueue`, `isOut`, `invReleasable`, `isPrintavoPost` are all unchanged.
- Proof:  `tests/test_inqueue.js` extended twice. Round 1 (kept all 10 prior assertions passing) added 6 cases: `27524-2`/`27365-3` undated → in queue (the bug); the same job dated → not in queue; the same job with `stationAssigned:true` → not in queue (graduation regression guard); an undated `Auto Press`/`Heat Press` job → not in queue (scope guards). Extraction harness extended to pull `laneOf`, `LANES`, and `isPrintavoPost` out of the live file the same way as the rest (real source, not reimplemented); `extractConst`'s string-scanner was made comment-aware (skips `//` and `/* … */`) because `LANES`' own inline comment contains an apostrophe ("Jean's number") that would otherwise desync the brace/string balance for the rest of the file. Round 2 added `exitsOnDate` extraction plus 4 cases (outsourced leg → true, Printavo-stamped post-pro leg → true, normal unstationed job → false, `stationAssigned:true` job → false) and a source-consistency guard asserting directly against the raw file text that the `Sched` header and `data-schedule` `<td>` are no longer `listShowAll`-conditional and the expand-row colspan is the unconditional `19` — guarding the exact column-desync bug this change exists to prevent. `node tests/test_inqueue.js` → 23/23 PASS, exit 0. Full regression green on the same working tree: `test_2b_render` 14/14 (its `node --check` over the extracted script body confirms no template-literal break), `test_live_duedates` 10/10, `test_retirement` 15/15, `test_typeofwork` 9/9 — all exit 0.
- Build doc updated?  no — this entry + the matching `Power_Scheduler/CHANGELOG.md` entry in Dropbox are the record. Round 1 committed as `b10164f`; round 2 NOT committed or pushed (per instruction) — changes sit in the working tree on `jean/queue-inhouse-postpro`, both intended for PR #30. Browser smoke test still owed.

## 2026-07-22 — Outsourced packaging imprints now show in the QUEUE (✓ arrived no longer gates entry; the G1 vendor/in-house leg split still does) — **PR #28 MERGED** (`fd8387c`) → `frontdoor-gate` → Railway auto-deploy — https://github.com/PlanetHolly/planetops/pull/28 (commit `7b8c6f5`, authored PlanetHolly per repo convention)
- Who:    Jean (via Claude, Opus)
- What:   `schedule/index.html` — `renderList()`'s `inQueue` predicate excluded any job that already had a `station` set, and Printavo pre-stamps `Station = "Post Production"` on outsourced packaging imprints (e.g. sublimated bandana `-2` legs) before the outsourced/arrived check ever ran, so the row was invisible to the Queue no matter what. Final rule: `const inQueue=j=>!j.placeholder&&!j.date&&(isOut(j)?invReleasable(j):!j.station);`. Normal (non-outsourced) jobs are unaffected — still gated on having no station. Outsourced jobs are no longer gated on station at all (that pre-stamped value is never consulted for them, fixing the bug) and no longer gated on ✓ arrived (`store.arrived[...]` dropped out of the expression entirely — arrived stays only an arrival stamp, the "📦 landed" badge is untouched); instead they're gated by the **pre-existing `invReleasable` (G1) helper**, preserved verbatim: an invoice marked "no 2nd service" (`store.invsvc[inv]==='none'`) never releases; once any sibling imprint on the invoice carries a real Post-Pro label, only the labeled sibling(s) release — the unlabeled pure-vendor leg stays Arrivals-only; if no sibling is labeled yet, all release (legacy flow, unchanged). Outsourced jobs now enter the Queue and Arrivals at the same time (once `invReleasable`), from the moment they appear, and leave the Queue when given a **production date** (placed on the board).
- Why:    Verified against the live feed (`power_scheduler_2026-07-22_2039.csv`): `27155 - 2` and 11 other outsourced packaging imprints were sitting in Arrivals but never reachable from the Queue, so their packaging time could never be set before the goods arrived — and the Arrivals hint text promising "the job then joins the QUEUE" on ✓ arrived was false for every one of them. First pass at this fix wrongly deleted `invReleasable` as dead code; round-1 review (Jean's own worked example, `27155-1` vendor print vs `27155-2` labeled packaging) caught that it does load-bearing work unrelated to the ✓ arrived gate, and it's restored.
- Arrivals copy corrected too (Jean green-lit editing it, 7/22 — TEXT ONLY, no Arrivals logic/markup/handlers touched): the Arrivals section hint and two `invGroup` chip tooltips all described queue-joining as something that happens ON ✓ arrived, which is no longer true. Rewritten to say the in-house leg is already in the QUEUE before the goods land — set its Post-Pro type, ⏱ time and station now — and that ✓ arrived only stamps the 📦 landed date and moves the row into arrived history. The "📪 no 2nd service" tooltip keeps its (still-true) never-joins-the-queue meaning, minus the on-arrival framing.
- Proof:  `tests/test_inqueue.js` extracts the live `OUTSOURCED`/`isOut`/`invReleasable`/`pptOf`/`realPP`/`inQueue` source out of `schedule/index.html` by regex/brace-balancing and evaluates it as real functions against 10 cases: the original bug case, dated-outsourced regression, normal stationed/unstationed regression guards, placeholder, `27155-1` (unlabeled vendor leg) staying OUT while `27155-2` (labeled packaging) is IN on the same invoice, an `invsvc==='none'` invoice staying OUT, and an unlabeled invoice's siblings releasing together (legacy path). `node tests/test_inqueue.js` → 10/10 PASS, exit 0.
- Build doc updated?  no — this entry + the matching `Power_Scheduler/CHANGELOG.md` entry in Dropbox are the record. Merged 2026-07-23 as `fd8387c`. Post-merge verification on `frontdoor-gate`: zero conflict markers, the shipped predicate is present at `schedule/index.html:1927`, and all five suites pass on the MERGED file (test_inqueue 10/10, test_2b_render 14/14, test_live_duedates 10/10, test_retirement 15/15, test_typeofwork 9/9) — which mattered here because PR #29 (records gate) also touched `schedule/index.html` between the branch point and the merge. Browser smoke test on the live board still owed by Jean.

## 2026-07-14 — QC section on the front door + the QC Gate goes live (sublimation/outsourced form)
- Who:    Holly (via Claude)
- What:   **(1) New `qc/` surface.** `PlanetApparel/QC/QC_Gate_Form.html` (Malia's production QC instrument, stranded on `file://` since it was built) moved into the repo as `qc/index.html` and is now served behind the gate. **(2) New QC hub in the registry** under PlanetOps, holding the live `qc-gate-form` plus the old `qc-invoice` trainer (re-nested, now labelled as superseded). Two new hand-drawn glyphs (`qc`, `qc-gate-form`) in `frontdoor/app.js`. **(3) The form itself gained a sublimation/outsourced mode.** The project picker went from three types (Bandana / Apparel·In-House / Apparel·Outsourced) to **two products x an Outsourced toggle** — the two apparel forms rendered *identical* checks, so "outsourced" was a type that keyed off nothing. It is now a toggle that does real work. **Bandana + Outsourced = the sublimation form** (24 checks / 28 with reorder): date triangle -> date SQUARE (4th date = goods back from the vendor), a new Purchase Order zone (PO attached / actually sent / read / carries the vendor's "Date to arrive to PA"), the PMS check replaced by mock-up vs. the customer-PROVIDED file (sublimation has no colour requirement), a required second imprint line for packaging, and a reorder branch that compares mock-up-to-mock-up hunting for a swap instead of pulling a physical sample.
- Why:    Ride-along #3 with Malia on invoice 27437 (sublimated bandana, outsourced). Holly: "we need a separate form for sublimation because it's outsourced." Hosting was the ONE thing blocking Malia from running the gate solo — the form persists state in `localStorage`, which needs a real origin; `file://` cannot hold it (and Chrome will not even open `file://` for automation). Behind the front door it finally persists.
- Access: **Team-level.** `/qc/` is not in `PUBLIC_PREFIXES`, not in `DENY_PREFIXES`, and not in `FINANCE_PREFIXES` — so it sits behind the entry PIN only, with no second PIN. Confirmed against `gate/index.js:45-54`.
- Proof:  Registry validated against the app's own rules (75 nodes, 0 bad enums, 0 duplicate ids); both new emojis confirmed unused. Driven in Chrome on a local server: all four forms render with no duplicate checks (Bandana 21/26 UNCHANGED — the only trialed form, verified against regression), flags route to Jean correctly, N/A stays out of the copied findings, "never marked" still warns, and a run **survives a reload inside the shell's iframe** on a real origin. A run saved under the pre-toggle schema still restores onto the right checks (IDs were not renumbered). Zero console errors in the shell. `node --check` clean.
- Caught:  My own first cut showed Apparel-Outsourced BOTH the date triangle and the date square — the square supersedes it. Fixed before push.
- Left open: The sublimation form is **built but NOT trialed with Malia** — 5 judgment calls I made unilaterally are listed at the bottom of `QC_Gate_Rebuild_Spec_2026-07-14.md` (dropped the base-colour and blanks-ordered checks from sublimation; added #16; kept "seps file" naming though sublimation has no separations; gave Apparel-Outsourced the PO zone too). Also: the registry's "every emoji is unique" assert the BUILD_LOG promises **is not actually running** — 9 emoji are already duplicated across the 75 nodes. Mine are not among them, but the invariant has drifted.
- Build doc updated?  yes — this entry + `QC/CANONICAL_SOURCE.md` in Dropbox (the Dropbox HTML is now a stale copy; repo is SoT).

## 2026-07-09 — Security: fix pre-auth reflected XSS on the gate login page + stored XSS in the clock pages
- Who:    Holly (via Claude)
- What:   **(1) HIGH — reflected XSS, pre-auth, live in prod (`gate/index.js:181`).** `safeRedirect(req.query.r)` was interpolated raw into `<input name="r" value="${redirect}">`. Its guard `safePathname()` is a *filesystem* containment check, not an output encoder, and it actively defeated itself: the WHATWG URL parser percent-encodes `"` `<` `>`, the blocklist only tested `%2f|%5c|%2e%2e|%00`, then `decodeURIComponent` decoded the metacharacters straight back. With no CSP, `/gate?r=/x"><script>…` executed on the gate origin — the same origin as the PIN form. Fixed three ways: added `escHtml()` (escapes `& < > " '`) and applied it to `redirect`, `csrf` and `msg` at the sink; added a fail-closed `if (/["'<>\`]/.test(p)) return null` to `safePathname` so `safeRedirect` falls back to `/frontdoor/`; and added a login-page-scoped CSP via a new `sendLogin()` helper wrapping all five call sites. **(2) MEDIUM — stored XSS in `clock/admin.html`, `clock/report.html`, `clock/index.html`.** Roster/time-card fields from the `timesheets-*` webhooks (Google Sheet backed) went into `innerHTML` unescaped; `emp_id` also landed in a `data-e="…"` attribute. Added a one-line `esc()` to each page and wrapped every remote field.
- Why:    `/security-review` on this branch found both; each was independently re-verified against the real code before any edit. `frontdoor-gate` auto-deploys to Railway, so (1) was exploitable in production: a crafted link to any teammate could keylog the ENTRY_PIN or FINANCE_PIN as they typed it. (2) let anyone with Sheet edit access — not just a Manager-PIN holder — plant `<img src=x onerror=…>` in an employee name and steal `ts_admin_key` out of the manager's `sessionStorage`, escalating sheet-editor → full timesheet admin.
- Note:   The existing `esc()` in `frontdoor/app.js` escapes only `& < >`, **not `"`**. Both sinks here are double-quoted attribute contexts, so reusing it verbatim would have left the breakout open (`?r=/x" autofocus onfocus=alert(1) x="` needs no angle brackets). The helpers added here escape quotes. `frontdoor/app.js` is unchanged — it uses `esc()` in text context and was reviewed clean.
- Proof:  Gate booted locally: both payloads (`/x"><script>alert(1)</script>` and the no-angle-bracket `/x" autofocus onfocus=alert(1) x="`) now render `value="/frontdoor/"` with zero `<script>`/`onfocus` in the body; benign `?r=/frontdoor/schedule/` still round-trips; CSP present on `/gate`, absent on `/healthz`; login page renders intact (logo, PIN field, Enter button) on 200/401/503 paths; bad-PIN error escapes to `That&#39;s not it`. Clock: headless-Chrome DOM test rendering the real admin row template with a malicious roster → `PWNED=false`, 0 injected `<img>`, 0 injected `<script>`, no `onmouseover` attribute, and `data-e` round-trips exactly so the Edit button still resolves its employee. `node --check` clean on `gate/index.js` and all three extracted inline scripts.
- Left open: `clock/report.html:104` still passes the manager `admin_key` in a query string (`?k=…`), contradicting the P0-3 comment above it. Fixing it requires the live n8n `timesheets-report` workflow to read a POST body — deliberately out of scope here.
- Build doc updated?  yes — this entry.

## 2026-07-09 — Front door: Floor section view (click-through) + sub-flyout hover fix + registry type fix — GO-LIVE
- Who:    Holly (via Claude)
- What:   **(1) Section view:** clicking a sub-hub (The Floor, Time & Labor) in the flyout now NAVIGATES into it instead of just re-fanning the flyout — the section's keys (Scheduler, Board, Pre-Press, Running, Reports, Fulfillment, Calculator, Availability) render as a left side-nav beside the embedded app (`.sectionNav` in `renderPane`), active key highlighted, breadcrumb follows; a bare section hash (`#/planetops/floor`) forwards to its first embeddable key. **(2) Hover fix:** the sub-flyout was unreachable — plain sibling rows' `mouseenter` scheduled `hideSubFlyout()` and the 220ms hide raced the diagonal mouse path from "The Floor" to the sub-menu. Plain rows no longer touch the sub-flyout; the sub-flyout now overlaps its parent by 4px (no dead gap) and hide delays went 220→350ms. **(3) Registry fix:** `command-center` carried `type:"app"` (not in the validator enum) — the hard-fail validation banner would have blanked the whole front door on next deploy; corrected to `live-app`. Also commits last night's until-now-uncommitted front-door work (home summary + finance lock + recents + PlanetOps/RH/IQ glyph set + gate `/api/home/summary`).
- Why:    Holly's design feedback while working with Jean: "click on the floor to display only the floor with its keys on the left" and "I can't hover over Scheduler from the flyout — the only way into the Scheduler is search."
- Proof:  Driven end-to-end in Chrome against a local serve: flyout → hover The Floor → sub-flyout stays open while the pointer sits on a sibling row for 1s (old code hid it at 220ms) → click Scheduler → `#/planetops/floor/schedule` renders keys-left + Scheduler embedded; clicking "The Floor" row lands on the same view; clicking Board in the side-nav swaps the frame + active key + breadcrumb. `node --check` clean on app.js + gate/index.js; registry passes its own validator (renders, no red banner).
- Build doc updated?  yes — this entry.

## 2026-07-09 — Command Center Data API: Gate-2 hardening (honest staleness · partial-read guard · real sanitizer · sanitized-parity)
- Who:    Holly (via Claude)
- What:   Applied the Codex Gate-2 critique to the deployed n8n workflow **"Command Center — Data API"** (`uVO85DuKcSzbEU4g`, ACTIVE), findings 1–4 + the sample-data half of 6. **Finding 1 (honest staleness):** rebuild outcome is now persisted in static data as `sd.lastRebuild = {ok, at, error}`. `Serve Cached` computes `stale` from it — `stale=true` if the LAST rebuild FAILED **or** cache age > 15 min (was hard-coded `false`). Cached responses always carry `meta.generatedAt`, `servedAt`, `servedFrom`, `lastRebuildOk` (plus `lastRebuildError/At` when the last rebuild failed). **Finding 2 (partial-read guard):** `Transform` now verifies ALL EIGHT tabs read successfully AND meet minimum shape (SCRIPTS≥10, TOUCHPOINTS≥20, JOURNEYS≥20, stages≥6, SCRIPT_FIELDS/TOUCHPOINT_SCRIPTS/BEHAVIOR_TRIGGERS/META≥1) BEFORE overwriting `sd.lastGood`. Any tab error / short read → mirror is NOT clobbered, `lastRebuild` records the failure, and stored last-good is served stale. **Finding 3 (real sanitizer):** replaced the regex pass with a strict tokenizer/allowlist parser (Node, no DOM) — parses tags, keeps only an allowlist, per-tag attribute allowlist (`a`: href [https:// or mailto: after entity-decode + control/whitespace strip + lowercase] with `rel="noopener noreferrer" target="_blank"` FORCED, plus the style allowlist so the button stays styled; structural tags: style-only), style values pass a property allowlist (background, color, padding*, margin*, border*, border-radius, font-*, text-*, display, width, max-width, line-height, letter-spacing) with charset `[-#%a-zA-Z0-9 .,:;!]` and hard reject of `url(` / `expression` / `javascript` / `data:`. `img`/`src`/`srcset` dropped entirely (no external fetches); `script`/`style`/`iframe`/… dropped with contents. **Finding 4 (sanitized-parity):** merge-field parity now compares fields extracted from the SANITIZED html vs bodyText; a merge field present in raw but removed by sanitization is gated as `sanitizer-removed-field:[X]`. **Sample regen (finding 6 half):** `revenue-house/command/sample-data.json` regenerated verbatim from the fresh post-deploy transformer payload (+ snapshot `meta.note`) so the static fallback is transformer-identical and carries `schemaVersion` + full staleness meta. Deployed via GET→PUT (static-data reset to force a clean cold/fresh build).
- Why:    Codex Gate-2 flagged four "runs green, serves wrong / serves unsafe" classes: cache reported fresh before knowing the rebuild's fate; a partial Sheet read could overwrite last-good with a thin-but-"healthy" payload; the regex sanitizer still allowed `<img src>`, `style:url()`, `data:`/encoded `javascript:` and other external-fetch/XSS surface; and parity was checked on raw (pre-sanitize) HTML, so a field could pass validation yet vanish from what actually renders/sends.
- Proof:  15/15 sanitizer unit tests pass (real ^review button + adversarial: entity/control-char `javascript:`, `<img onerror>`, `style:url()`/`expression`/`data:`, `<script>`/`<style>` content drop, `onclick`, http-not-https href dropped, mailto kept, non-allowed tag stripped keeping text, table/tr/td survive). 4/4 transform-logic tests pass (healthy stores mirror stale=false; SCRIPTS=4 short-read serves stale, does NOT clobber, records `lastRebuild.ok=false`; no-prior-mirror partial read returns empty stale; `sanitizer-removed-field` detected + gated). LIVE curls post-deploy: cold `200` 5.06s `servedFrom:fresh stale:false lastRebuildOk:true validationErrors:0`; warm `200` 0.23s `servedFrom:cache stale:false`; `^review` yellow `<a>` survives with `background:#F7BE00`, forced `rel="noopener noreferrer" target="_blank"`, https href intact, all three merge fields preserved, parity passes (validationErrors 0). Counts shifted as expected from tonight's 3 react-qc rows (touchpoints 30→31, journeys 27→28, touchpoint_scripts 21→22). Python structural deep-compare live-vs-new-sample = identical across all 8 collections + meta.
- Build doc updated?  yes — this entry; canonical contract `revenue-house/command/sample-data.json` regenerated (now carries schemaVersion + staleness meta). Findings 5, 7, 8, 9, 10 (index.html badge/routing/detail-view/lifecycle/search) are OUT of this scope (page-side, separate owner).

## 2026-07-09 — Command Center Data API: schema alignment + respond-first (kiosk fast path)
- Who:    Holly (via Claude)
- What:   Fixed the deployed n8n workflow **"Command Center — Data API"** (`uVO85DuKcSzbEU4g`) on two integration bugs the kiosk-page builder found, against the canonical contract `revenue-house/command/sample-data.json`. **Fix 1 (schema):** `Transform + Validate` now emits `scripts[].aliases` as an ARRAY (was a comma-string), adds `scripts[].sheetRow` (int, from the Sheets `row_number`), adds `meta.gids` (tab-id map) + `meta.sheetId`, and reshapes `gaps[]` to the canonical `{code,name,channel,publishStatus,reason,notes,sheetRow,kind}` — planned scripts now emit `kind:"script"` (the page filters gaps on exactly this, so it previously rendered ZERO gaps) with a derived `reason`, while validation failures emit `kind:"invalid"` carrying BOTH `reason` (joined errors) and `errors[]` (kept for the alert). Coerced `script_fields.required` and `behavior_triggers.neverAutoReply` to real booleans (a string `"false"` was truthy — latent "never auto-reply" chip bug). **Stale bug:** a healthy rebuild now always sets `meta.stale=false`; `stale:true` is emitted ONLY when serving stored last-good after a failed/empty rebuild. **Fix 2 (respond-first):** restructured to Webhook → `Serve Cached` (reads last-good from static data) → **Respond Cached immediately** → THEN the 8 Sheets reads → `Transform` re-stores the mirror; first-ever call (or an old-schema mirror, gated by `schemaVersion`) falls through to cold build-then-respond. `meta.servedFrom` = `cache|fresh`, plus the build timestamp. Added `errors:[]` to the 7 `sample-data.json` gaps so the canonical fallback and live payload are byte-for-schema identical.
- Why:    Kiosk page treats `sample-data.json` as the contract; the live payload diverged (aliases string, no sheetRow, no gids, gaps invisible) AND the 8 chained Sheets reads took ~6s cold, past the page's 3s hard timeout — so the kiosk was silently falling back to sample data on every load.
- Proof:  curl ×N on the live webhook: cold first build 200 in ~6.0s (full valid payload, `servedFrom:fresh`, `stale:false`, `validationErrors:0`); every subsequent call ~0.2–0.3s (`servedFrom:cache`, `stale:false`); background refresh verified advancing `generatedAt` (07:08:28 → 07:08:51 → 07:09:00) while serves stayed <0.3s. Python deep-compare of key sets: ALL 8 collections (scripts, script_fields, touchpoints, touchpoint_scripts, journeys, stages, behavior_triggers, gaps) now schema-identical between live and sample-data; 18/18 scripts, 7/7 gaps; aliases arrays, sheetRow ints, meta.gids + meta.sheetId present, gaps[].reason + errors[] present.
- Build doc updated?  yes — this entry; canonical contract `revenue-house/command/sample-data.json` (gaps gained `errors:[]`)

## 2026-07-08 — Art Namer: conversion gate corrected + full automation + docs
- Who:    Holly (via Claude)
- What:   `cli.py` now runs the whole pipeline in one command (`--upload`): conversion gate → auto SKU from Printavo → auto-crop → name → catalog → idempotent Drive upload. **Corrected a latent silent-wrong bug found during verification:** the gate originally used `paidInFull`, which is NOT conversion — inv 20200 is "Delivered / Picked up" with `paidInFull:false` (net terms), so real delivered work would have been silently dropped. Conversion truth = Printavo `status.type` (`INVOICE` vs `QUOTE`) AND which connection the record lives in; `invoices(query:"5")` is a fuzzy search that does NOT return quote 5, so the code queries `invoices` + `quotes` and matches visualId exactly. Gate now FAILS CLOSED (tri-state: True process / False quote / None unverified → both skip with a printed reason). Notably `🔵 Art (Seps.io)` is a QUOTE-type status — seps.io mockups exist for jobs that never convert, exactly what the filter excludes. Added `README.md` (build doc) + `FEED_INTEGRATION.md` (app briefing). Retired the throwaway plan file.
- Why:    Holly: only capture projects that CONVERTED; name them for Google + LLM search; have the infrastructure ready to drop into the PlanetOps Feed surface later.
- Proof:  Gate verified on 4 real records — 27062 (Order Shipped, paid) → PROCESS w/ SKU PL2219; 20200 (Delivered, paidInFull:false) → PROCESS w/ SKU ORG2417 (would have been wrongly dropped by the old logic); quote 5 (Archived Quote) → BLOCK; 99999 (nonexistent) → BLOCK unverified. Canal Trust end-to-end with `--upload`: both colorways named, cropped 2550×3300→1940×1940 (visually verified), uploaded to Website_Ready/Bandanas/, re-run produced 0 duplicate Drive files. Collision/idempotency/sublimation/USA-fabric assertions pass.
- Build doc updated?  yes — art-namer/README.md (new) + SPEC.md (conversion gate section rewritten)

## 2026-07-08 — Art Namer engine (new component: `art-namer/`)
- Who:    Holly (via Claude)
- What:   New naming engine that turns produced-job bandana mockups into Google/LLM-optimized web assets: `art-namer/engine.py` (pure logic: internal-filename parse, SKU decode per SKU_Dictionary §2, slug/title/alt schema, collision + idempotency rules), `cli.py` (batch lane: catalog + auto-crop proof-sheets to product image + staging + review contact sheet), `SPEC.md` (contract for the future Feed lane — Part C calls the SAME engine). Slug pattern `custom-{fabric}-bandana-{color}[-screen-printed]-{entity}.jpg`; SKU rides as metadata, never in slug. Catalog: `Website/_Internal/Art_Namer/art_catalog.md`. Final store: Website Shared Drive → `Website_Ready/Bandanas/` (folder created; Phelan-visible). Registry: `art-namer` node added under PlanetOps hub (uncommitted, rides with frontdoor WIP).
- Why:    Holly: produced-art photos must be named for Google + AI search (Phelan's filename-driven WordPress import; his scheme lacked the internal SKU). Pilot for the bigger harvest→feed→scheduler vision.
- Proof:  Canal Trust invoice 27062 end-to-end (see corrected entry above for the final verified state).
- Build doc updated?  yes — art-namer/SPEC.md is the build doc (new component)

## 2026-07-08 — The Floor cascade (branch `frontdoor-gate`, staging only)
- Who:    Holly (via Claude)
- What:   "The Floor" is now a HUB in registry.json — hovering it in the PlanetOps flyout fans out a second-level cascade flyout (`#subflyout`, `cascadeRow`/`showSubFlyout` in frontdoor/app.js): Scheduler · Board · Pre-Press · Running · Reports · Fulfillment · Calculator · Availability, each with a bespoke flat glyph. Scheduler/Calculator/Availability open their real pages; the floor-native rows open ../index.html (section deep-links like `#prepress` in the registry are inert until the floor app learns to read them — see handoff below). Time & Labor sub-hub gets the same cascade. Node ids: schedule/estimator/capacity MOVED under floor; new ids floor-board/-prepress/-running/-reports/-fulfillment.
- Why:    Holly: hovering The Floor should show its sub-dashboards, Scheduler first. Floor-app-side pieces (rail emoji→glyphs, deep-link reader in index.html) are deliberately PAUSED for Jean's board+scheduler rebuild (branch `jean/intake-feed-merge`) — do not build them on this branch.
- Proof:  Staging browser-verified: PlanetOps flyout shows "The Floor ›", hover fans the cascade, Scheduler-first order, click embeds w/ 3-level breadcrumb (PlanetOps › The Floor › Scheduler), zero console errors.
- Build doc updated?  yes — this entry; registry schema unchanged (hubs nest recursively by design)

## 2026-07-08 — Front door v3: QuickBooks nav + full glyph set + HOME canvas (branch `frontdoor-gate`, staging only)
- Who:    Holly (via Claude)
- What:   (1) Slim tucked left rail (icon + short label) with QuickBooks-style hover FLYOUTS replacing the tile grid; (2) unique hand-drawn flat SVG glyph for ALL 61 registry nodes — emoji fully retired from the front door; "Floor App" renamed "The Floor"; (3) NEW home canvas: welcome band · "Needs attention" alarm board · Quick Access (pins + recents) · Feed card · Browse (hubs accordion) · Ø logo → home from anywhere; (4) NEW gate endpoint `GET /api/home/summary` (session-gated; gate health + state-api probe + registry STALE/WIP notices + `financeUnlocked`/`financeSurfaceIds` for server-enforced finance redaction; `no-store, private` + `Vary: Cookie` always). `loadSession()` now distinguishes DB-down (503 `session_store_unavailable`) from logged-out on API routes.
- Why:    Holly's design direction (7/8): flat QuickBooks-style marks over emoji, hover-flyout nav, tucked rail, home = control tower ("sections that show the alarm"). Plan Codex-reviewed adversarially — 4 rounds, 37 findings, APPROVED.
- Proof:  Staging (`frontdoor-gate-staging`) browser-verified: home renders, flyouts work, accordion works, embed + Ø-logo→home round trip, recents chip appears, ZERO console errors. curl battery: entry-only summary → `financeUnlocked:false`, 9 finance ids, 0 finance-named flags; finance PIN unlock → `true` + finance flags visible; no-cookie → 401; headers correct incl. errors. NOT live-tested: Postgres-down 503 path (staging Postgres is shared with prod state-api — not safe to pause) and state-api-down probe (env change blocked); both code-reviewed only. The static "run /feed" nudge from the plan was deliberately NOT built (permanent fake-urgency).
- Build doc updated?  yes — frontdoor/BUILD_LOG.md still accurate for registry schema; home + summary endpoint documented here + in `~/.claude/plans/i-want-you-to-snuggly-cloud.md` (Codex-approved spec)

## 2026-07-08 — Branded circular icons + Floor App nav (bottom tabs → left rail)
- Who:    Holly (via Claude, Fable 5) — staging feedback
- What:   (1) FRONT DOOR: every icon now sits in a dark round Ø circle (.iconBadge);
          ~10 hubs + the Floor App got hand-built flat SVG glyphs (GLYPHS map),
          surfaces keep emoji-in-circle. QuickBooks-branded look.
          (2) FLOOR APP (index.html, live SPA): the bottom tab bar became a collapsible
          LEFT icon-rail (.bottom-nav → .side-nav; .app-shell content wrapped in
          .content-row row layout) — thin icons by default, hover expands labels.
          switchTab() + the 3 count badges (#prepress/#active/#fulfillment) + the
          :nth-child(2) Pre-Press ref all preserved. Clock tab REMOVED (redundant with
          the front-door top clock). Tabs kept: Board·Pre-Press·Running·Reports·
          Fulfillment·Estimator·Schedule·Availability.
- Why:    Bland identical tiles; Floor App bottom bar should collapse "like the key."
- Proof:  Verified on staging in Chrome: rail + tiles show custom hub glyphs (PlanetOps,
          Revenue House, PlanetIQ, Systems, Training, References, Growth, Brain) + Floor App
          glyph in dark circles, surfaces emoji-in-circle. Floor App embeds with the new left
          icon-rail; hover expands labels; clicking Board→Pre-Press switches panels; count
          badges (8/1) intact; Clock gone. Only console errors = benign extension noise +
          expected ShipStation 500 (no creds on staging).
- ⚠ Floor-app nav is a UX change for the production floor; they get it at cutover
  (heads-up/retrain then; verify tablet ergonomics — was thumb-friendly bottom bar).
- Build doc updated?  yes — frontdoor/BUILD_LOG.md "Branded circular icons".
- Who:    Holly (via Claude, Fable 5) — her staging aesthetic feedback ("tiles look bland")
- What:   Every one of the 61 registry nodes now carries a UNIQUE, function-matched emoji
          (Floor 🎛️ · Schedule 🗓️ · Signals 📡 · Retention 🧲 · Save Touch 🆘 · Pipeline 🚰
          · Agent OS 🤖 · KPI 🎯 …). Tiles reshaped so the emoji + bold name lead at the top
          (QuickBooks feel); the pinned quick-bar now shows those emojis as tabs for free.
          A build-time Python assert guarantees no emoji repeats (incl. hub emojis).
- Why:    Surfaces all fell back to the same 📄 — indistinguishable and dull.
- Proof:  Verified on staging in Chrome: PlanetOps + Revenue House hubs show every tile with
          a distinct emoji, name prominent; pinned chip shows its emoji. Only console output
          = benign browser-extension "message channel" noise (:0:0, no app stack) — not the app.
- Build doc updated?  yes — frontdoor/BUILD_LOG.md "Emojis" section (keep new surfaces unique).
- Who:    Holly (via Claude, Fable 5 high) — her staging feedback
- What:   Clicking an internal surface tile now loads it EMBEDDED in the main pane
          (iframe) with the left rail persistent + breadcrumb + ‹Back + ⤢Full-screen,
          instead of window.open new-tab. Browser Back works in-shell. Rail is
          collapsible (☰ topbar toggle, persisted) with a far-left hover-reveal drawer.
          External surfaces (docs.google.com) still new-tab, marked with ↗. Gate now
          sends X-Frame-Options: SAMEORIGIN + X-Content-Type-Options: nosniff globally
          (our front door may frame our pages; nobody else can).
- Why:    New-tab navigation stranded users with no way back to the hub (Holly's test).
- Proof:  Verified on staging in Chrome: Schedule embeds w/ rail intact, breadcrumb +
          Back + Full-screen present; ☰ collapse → full width; far-left hover → rail
          drawer slides back; clicked a hub from the drawer → navigated + un-embedded;
          external Sheet tile shows ↗; curl confirms X-Frame-Options SAMEORIGIN on both
          gated + public responses; zero console errors. (Also validated the registry
          model: the new Retention Playbook page added this AM appeared from one entry.)
- Build doc updated?  yes — frontdoor/BUILD_LOG.md "Navigation model" section.

## 2026-07-08 — Phase 2: frontdoor-gate built + P0 credential fixes (NOT yet deployed)
- Who:    Holly (via Claude, Fable 5 high; plan survived 3 Codex review rounds, board 5-0 Railway)
- What:   NEW `gate/` — the real PIN gate service (Express+pg sibling of state-api):
          CSRF login, Postgres sessions (workday, revoke-one/all), ENTRY+FINANCE PINs,
          per-IP limiter + global breaker w/ operator reset, hardened public allowlist
          (signature/rush/bandana-templates/ship-estimate), server-side protected route
          map (planetiq + clock admin/report), no-store+Vary:Cookie, healthz/readyz/
          health-public, alert events → 🚨, graceful DB-down. Plus P0 fixes IN the pages:
          STATE_API_KEY removed from index.html + schedule (same-origin /api/state via
          gate); ShipStation creds removed from client state/settings (gate env only,
          /api/shipstation/sync); ?k= admin keys removed from both clock pages.
          Shell UX: 🕐 topbar clock link, Agent OS → Systems, >8-tile type grouping,
          registry URL validation, client PIN screen removed (server owns auth).
          Docs: gate/RUNBOOK.md (non-technical ops) · gate/WEBHOOK_INVENTORY.md.
- Why:    Codex review confirmed live credential exposure on the public site (see
          PLAN-REVIEW-LOG.md); the gate is the structural fix + the "not findable" gate.
- Proof:  Local battery ALL PASS (no-DB degraded mode): health endpoints, gating
          redirects/401s, deny-list 404s, traversal/encoding/backslash/dotfile/case
          attacks all fail closed, CSRF enforced, correct-PIN-DB-down → graceful 503,
          per-IP limiter 429 at threshold, structured failed_pin events.
- ⚠ NOT LIVE YET: staging deploy blocked pending Holly's interactive approval of the
          Railway service creation; pages now call same-origin endpoints, so DO NOT
          push to the public repo until the gate is the host (cutover order in PLAN.md).
- Build doc updated?  yes — gate/RUNBOOK.md + WEBHOOK_INVENTORY.md new; PLAN.md is the
          approved design; frontdoor/BUILD_LOG.md still current for the shell.

## 2026-07-08 — Front Door shell built + planet-sales/ renamed to revenue-house/
- Who:    Holly (via Claude, Fable 5 high; designed in the 7/7 Opus session)
- What:   (1) NEW `frontdoor/` — the gated single front door over all ~55 operational
          surfaces: placeholder PIN gate (0000 — NOT security, Phase 2 hardens it),
          left rail (HUBS: PlanetOps · Revenue House · PlanetIQ · Systems / LIBRARY:
          Training · References), global type-ahead search, pinned favorites,
          recursive hub→tile rendering, hard-fail registry validation. 100% of
          content renders from `frontdoor/registry.json` (60 nodes: 10 hubs, 50
          surfaces incl. Drive control-sheets and stranded-file:// apps marked WIP).
          (2) RENAME `planet-sales/` → `revenue-house/` (hub renamed Revenue House,
          front-of-house metaphor; done pre-push so no live URLs broke).
          NOT committed/pushed/deployed — local preview only, by design, until the
          Phase 2 real gate exists ("not findable" promise).
- Why:    2026-07-07 research found 13+ orphan pages, ~10 apps stranded on file://,
          a drifting PA Docs bookmark registry, and the site publicly findable.
          The front door is the additive nav+status layer over what already works.
- Proof:  All 9 acceptance criteria of `_planning/fable-build-01-shell.md` §5
          verified in Chrome via localhost:8791 — PIN gate, rail, tiles+badges,
          new-tab opens, recursive Time & Labor sub-hub, search→navigate, pin
          survives reload, zero console errors, forced-mobile layout clean, and a
          deliberately-corrupted registry produced the named red error banner.
- Build doc updated?  yes — `frontdoor/BUILD_LOG.md` (new; schema + how-to-add-a-surface
          + gotchas + Phase-2 list). Spec/brief: `_planning/front-door-spec.md`,
          `_planning/fable-build-01-shell.md` (Appendix A = registry seed).
## 2026-07-08 — Bottom tab bar REMOVED — sidebar is the app's sole navigation
- Who:    Jean (via Claude, Fable 5; Jean's explicit call)
- What:   Deleted the 68px bottom tab bar (markup + CSS) — it duplicated the new
          sidebar section-for-section and ate vertical space on the floor iPad.
          Main content now reaches the viewport bottom; the Schedule and
          Availability iframes size to their panel (were hard-coded
          `calc(100vh - 120px)` around the bar). The Pre-Press / Running /
          Fulfillment count badges MOVED into the sidebar items keeping their
          element ids (`prepress-badge` etc.) so the existing KPI updaters work
          unchanged; the sidebar renders once at boot and only the highlight
          updates on switch, so badges stay stable. On phones the ☰ drawer is
          now the only nav — by design. This closes Holly's original "bottom bar
          getting girthy" complaint from the 7/7 walkthrough.
- Why:    With the sidebar always visible, the bar was pure redundancy; Jean
          ordered the strip-out.
- Proof:  Commit afd0cba, pushed to Pages. Headless: zero `.nav-tab`/`.bottom-nav`
          elements; all 3 badges inside the sidebar (Running badge populated from
          live state at boot); all 8 sections switch with highlight sync; main
          content + schedule iframe reach the viewport bottom (0px gap).
- Build doc updated?  no — this entry is the record.

## 2026-07-08 — Nav shell v2: dropdown → collapsible LEFT SIDEBAR (Jean's direction)
- Who:    Jean (via Claude, Fable 5)
- What:   Replaced the ☰ dropdown menu (same-day v1, below) with a persistent
          collapsible left sidebar rendered from the same `SECTIONS` registry:
          always visible beside the main content on wide screens; ☰ now toggles
          collapse to a 58px icons-only rail (remembered per device via
          localStorage `planetops_sidenav_collapsed`); current section carries a
          yellow marker; PIN-gated sections will show 🔒. On narrow screens
          (≤700px) the sidebar becomes an off-canvas drawer with a scrim, and
          navigating closes it. Home panel, `goSection()` routing, PIN-gate
          infra, and the bottom tab bar are unchanged. NOTE for Holly: this
          supersedes the icon-bar-vs-hamburger DECISION — Jean chose sidebar.
- Why:    Jean's call after seeing v1: a sidebar is the better long-term nav as
          sections multiply — always visible, scales vertically, collapses out
          of the way on the floor iPad.
- Proof:  Commit 70ad052, pushed to Pages. Headless test at 1280px and 620px:
          9 items render; collapse toggle + saved preference; current-highlight
          syncs on jump; drawer hidden at boot, opens with scrim, closes on
          navigate. All 7 script blocks syntax-clean.
- Build doc updated?  no — this entry is the record.

## 2026-07-08 — Nav shell: Home directory + ☰ quick-jump + PIN-gate infrastructure (overhaul #1)
- Who:    Jean (via Claude, Fable 5)
- What:   Main dashboard gains an app navigation shell so the bottom tab bar stops
          growing ("getting girthy"): a `SECTIONS` registry drives (a) a **Home**
          panel — one tile per section with a description, reached via the ☰ menu or
          tapping the logo — and (b) a **☰ hamburger menu** in the header that jumps
          between sections from anywhere (current section highlighted). New sections
          get ONE registry entry and appear in both places; the bottom bar stays as-is.
          Bottom-nav buttons now route through `goSection()` (adds `data-tab` attrs).
          **PIN gate built but inert:** `NAV_PIN = { code:null, gated:[] }` — when Holly
          picks a PIN + which sections are restricted, set both and gated sections get a
          🔒 in the menu/tiles, a PIN modal on entry, and a per-browser-session unlock.
          Hamburger chosen over a persistent icon bar per the plan doc's recommendation
          (scales better) — flag to Holly in case she prefers the icon bar.
- Why:    Holly's 7/7 Board-overhaul plan #1 (P0): navigation must scale as sections
          keep being added; PIN-restricted sections requested as infrastructure.
- Proof:  Commit 5dd8692, pushed to Pages. Headless-driven test: Home renders 8 tiles;
          menu opens with 9 entries + current highlight; jumping syncs panel + bottom
          tab; with a test PIN configured the gate blocks entry, rejects a wrong PIN,
          unlocks on the right one, and stays unlocked for the session.
- Build doc updated?  no — this entry is the record. Open DECISIONS for Holly: PIN code +
          gated section list (config at `NAV_PIN` in index.html), and the "Board" rename (#2).

## 2026-07-07 — P0 bugs from Holly's Board walkthrough: inventory loading + scheduler date range
- Who:    Jean (via Claude, Fable 5)
- What:   (1) **Blanks inventory loading** — `fetchBandanaInventory()` was only
          called at the very end of `syncFromPrintavo()`, so three paths left
          `state.inventory` null forever: the 7/6 cross-device fresh-sync skip
          (most devices return early and never reach the fetch), any mid-sync
          Printavo error, and off-hours page loads (sync doesn't run at all).
          Inventory now loads independently at init and whenever a Blanks sheet
          opens (the 5-min localStorage cache keeps this cheap), keeps a stale
          cache as fallback when the Railway proxy is down, and an already-open
          sheet updates its stock lines in place by element id — a full
          re-render would wipe quantities Rosa is mid-typing. A SKU that is
          loaded but unmatched now reads "no live stock record for this SKU"
          instead of the misleading "inventory not loaded yet".
          (2) **Scheduler date range** — two device-local failure modes, both
          reload-proof because `range` is intentionally LOCAL_ONLY (never
          healed by shared-state sync): an inverted custom range (start after
          end) rendered ZERO day rows, and scheduling a job outside the visible
          window silently flips the device into custom mode forever — weeks
          later the stored window is entirely in the past and the board shows
          no current dates. Fixes: inverted ranges swap, degenerate ranges fall
          back to Work Week, and boot resets a custom window that is entirely
          past with no scheduled jobs inside it. A deliberate current custom
          range is untouched.
- Why:    Holly's 7/7 Board walkthrough flagged both as live bugs (plan doc
          #12); the inventory one blocks the Blanks-stage overhaul (#4).
- Proof:  Commit b7a2ac4, pushed to Pages. Proxy verified healthy (HTTP 200,
          CORS *, ~12 s response — the latency is why late-arriving data must
          refresh an open sheet). Headless-Edge repro: seeded a stuck June
          custom range → board self-healed to the current work week; seeded a
          current custom range → preserved; board page renders 92 job cards
          post-change. NOTE for later: the inventory proxy returns no
          `organic` section, so ORG SKUs show "no live stock record" — n8n
          workflow / sheet side, not the app.
- Build doc updated?  no — behavior fix only; this entry is the record.

## 2026-07-07 — Top-level Estimator tab removed (UI/aesthetic pass)
- Who:    Jean (via Claude, Fable 5)
- What:   Removed the 🧮 Estimator tab from the main dashboard's bottom nav,
          its `panel-estimator` iframe panel, and the `switchTab` lazy-load
          line. The estimator itself is UNCHANGED: single source still lives
          at `/estimator/` and remains fully reachable via the Schedule
          module's ⏱ Estimator sub-tab (persistent iframe) plus the board's
          auto-charted time chips (`estimate.js`). Also refreshed the
          schedule tooltip note that referenced the deleted tab.
- Why:    Jean lives in the Schedule module; the standalone tab duplicated
          the sub-tab and cluttered the nav. Both iframed the same source,
          so nothing is lost.
- Proof:  grep for "estimator" in index.html returns zero matches; nav goes
          Board / Pre-Press / Running / Reports / Fulfillment / Schedule /
          Availability / Clock; no hash routing or saved-tab state pointed
          at the removed tab.
- Build doc updated?  no — nav-only change; this entry is the record.

## 2026-07-06 — Printavo-proxy polling throttled ~96% (429-storm root cause)
- Who:    Jean (via Claude, Fable 5; Jean approved the design)
- What:   `syncFromPrintavo()` was making ~105 proxy calls per sync per device
          (4 list pages + an UNCONDITIONAL per-job detail re-fetch), every 20 min,
          on every open device — the measured 353-executions-in-45-min storm that
          starved the shared quota pool (killed the 7/6 morning calculator
          writebacks) and previously tripped Printavo's Imperva WAF.
          Two changes:
          (1) **Detail TTL** — blanks list / URLs / placements (near-static) re-fetch
              only when the job's Printavo status moved or `detailFetchedAt` is
              older than 6h. Status, due date, customer ID, delivery method still
              refresh every sync — they ride the cheap list query, now hoisted out
              of the detail block so they apply unconditionally.
          (2) **Cross-device skip** — auto-sync returns early if `state.lastSyncAt`
              (shared via the State API) is fresher than 15 min: one device pulls,
              the rest inherit through shared state. The header 🔄 button passes
              `force=true` and bypasses the skip (but not the detail TTL — 6h is
              the staleness bound on near-static fields by design).
          Steady state drops from ~1,000 proxy executions/hr (3 devices) to ~15–30/hr.
- Why:    n8n CHANGELOG 7/6 flagged this as the storm's root cause after the
          writeback retry-hardening; extra-credit item #2.
- Proof:  node --check clean on all 7 inline script blocks; headless render OK;
          new-job path stamps `detailFetchedAt`; manual button verified passing force.
- Build doc updated?  no — sync behavior; this entry is the record.

## 2026-07-06 — Phase 3: Customer ID on cards + board search (Tray deferred)
- Who:    Jean (via Claude) — built by a Fable 5 agent, reviewed + deployed on Opus 4.8
- What:   Shipped 2 of the 3 Phase-3 blueprint features into `index.html`:
          (1) **Customer ID** — Printavo `customer.id` added to the list query, threaded
              through `makeJob`/`mapInvoiceToJob`, backfilled onto existing jobs on sync,
              and rendered as a tap-to-copy 🔑 on job cards, imprint cards, and the job sheet.
              It's the cross-system join key (Streak field 1068).
          (2) **Board search** — live filter by job #, customer, client tag, or customer ID;
              per-device (NOT shared state), 150ms debounce; applied to every column incl.
              archived; composes with the existing filter pills.
          Feature 1 (Outsourced Holding Tray) deliberately NOT built — see Why.
- Why:    Blueprint Phase 3 (`PlanetOps/Blueprint_PlanetOps_Phase3_2026-07-01.md`) specced
          all three, but the Status Taxonomy Overhaul (07-03 specs) renames the exact
          Printavo statuses the Tray's OUT/BACK logic keys off (`Awaiting Goods` →
          `Vendor Producing`, etc.). Building the Tray now would mean building it twice.
          Customer ID + Search are taxonomy-proof, so they ship now; the Tray waits for
          the rename to land, then gets built once on final status names.
- Proof:  Diff reviewed hunk-by-hunk (42 ins / 9 del, one file). greps confirm
          copyCustomerId/customerId/setBoardSearch/matchesSearch/board-search present and
          renderOutsourcedTray/outsourced-tray absent. Live-verified at
          https://planetholly.github.io/planetops/ after Pages deploy.
- Build doc updated?  Blueprint still valid as-is for the deferred Tray (Feature 1). Its
          "ship all three / commit-per-feature" order is now superseded: Features 2+3 shipped
          together in one commit (this env has no interactive git to split intermixed hunks),
          Feature 1 held. No other build-doc edit needed.
