# Simulator Overlay Build Notes

Generated: 2026-07-30

Sources:
- /Users/hollytrevino/Dropbox/PlanetApparel/Printavo_Automations/Status_Cleanup_2026-07/live_statuses_FINAL_2026-07-27.json
- /Users/hollytrevino/Dropbox/PlanetApparel/Printavo_Automations/Status_Cleanup_2026-07/build_status_reference.py
- /Users/hollytrevino/Dropbox/PlanetApparel/Printavo_Automations/OneThread_Build/composer_workflow.json
- /Users/hollytrevino/Dropbox/PlanetApparel/Printavo_Automations/OneThread_Build/nudge/resolver.js
- /Users/hollytrevino/Dropbox/PlanetApparel/Printavo_Automations/Status_Cleanup_2026-07/taxonomy_mock.html

Coverage:
- Board statuses: 71
- Overlay entries: 71
- Nudge statuses: 15
- Customer-email/native customer statuses: 16
- Fallback statuses with taxonomy color: 71

R-a unmatched statuses using name normalization:
- 548887 📤 Need to Send PO (Outsourced)

Notes:
- Baked nudge examples use resolver.js with sample order Summit Trading Co, bandana, total 2500, tier T1.
- Ball-in-Our-Court (548871) is intentionally not a nudge in this build.
- Customer statuses whose current Command Center data feed does not expose a live script code still carry a scriptCode placeholder or source-derived code so the training panel can explain the customer-facing connection without blank-screening.

Config-backed nudge rule:
- Statuses labeled as PM nudge in REF but absent from Config.NUDGE_TRIGGERS are rendered as customer/internal training states without a nudge card: 548870, 548871, 548877, 548883.

## 2026-07-30 Simulator Review Update

Applied approved Simulator-only feedback from Sessions 1 and 2:
- Added display-only `streakFactor`, `endGame`, and `timed` fields where applicable.
- Added Streak factor and End game sections to the Simulator renderer.
- Rebuilt the nudge example card around customer, current status, short why, and box age / days in status.
- Removed suggestion copy and Snooze from nudge cards; actions now show Open in Streak and Done.
- Standardized Simulator terminology on nudge and added the clock indicator for timed-release statuses.
- Updated Quote, In Conversation, Waiting on Customer, Follow-Up Pre-Quote, Sample Pack - Prep & Ship, and Sample Pack Purchased -> Samples Sent display data per Holly/Kelly rulings.
- Added display-only copy revision notes for sample-pack confirmation and sample-arrival check-in copy.

Follow-ups intentionally not built in this Simulator pass:
- Dark nudge engine sync under `OneThread_Build/`: Waiting on Customer recurring 7-day rule, Follow-Up Pre-Quote 7-to-14-day change, Streak last-email-in/out trigger, Sample Pack Prep & Ship 2-day PM nudge, and Samples Sent PM nudge after the ladder.
- Live CC Sheet `^ot_*` script rewrites for sample-pack confirmation and sample-arrival two-path check-in copy.
- Archive automation for 30-day no-email-in/out routing and PM/archive-notice emails.
- T1 missed-opportunity cross-sell system 2 weeks after archive.
- Streak-only sample-pack conversion tracking.
