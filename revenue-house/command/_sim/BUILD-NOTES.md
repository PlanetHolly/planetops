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
