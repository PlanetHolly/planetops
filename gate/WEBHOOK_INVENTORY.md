# Webhook Inventory & Classification — 2026-07-08 (Codex R1/R2 requirement)

Every external endpoint the repo's pages call, swept from source. Two hosts:
`primary-production-079f9.up.railway.app` (n8n) · `planetops-production.up.railway.app` (state-api).

## Now proxied through the gate (credentials server-side) ✅
| Endpoint | Was called from | Fix shipped |
|---|---|---|
| state-api `/api/state` + `/api/state/:key` | index.html, schedule/index.html (embedded key — P0-1) | Same-origin `/api/state*` via gate; key in gate env; ShipStation fields scrubbed both directions. **Rotate STATE_API_KEY at cutover** + restrict state-api CORS to the gate origin. |
| n8n `/webhook/shipstation-proxy` | index.html (creds in browser — P0-2) | Same-origin `/api/shipstation/sync` via gate; creds in gate env. Holly rotates the ShipStation key at build start. |

## Internal webhooks — pages gated after cutover; endpoint itself still publicly callable ⚠️
`/webhook/inventory-deduct` (board) · `/webhook/printavo-proxy` (board) · `/webhook/bandana-inventory` (board) · `/webhook/estimate` (estimator, schedule) · `/webhook/schedule-mockups`, `/webhook/schedule-csv` (schedule) · `/webhook/gauge` (capacity) · `/webhook/timesheets-punch` (clock kiosk) · `/webhook/timesheets-admin`, `/webhook/timesheets-report` (clock manager pages — protected by `admin_key` in body via the manager_login flow; **rotate existing admin keys** since they historically traveled in `?k=` URLs, P0-3).

**Recommended follow-on (NOT in this build — touches live n8n workflows, needs Holly/Jean sign-off):** add a shared-secret header check inside each of these n8n workflows and send the header from the gated pages (or proxy them through the gate like state/shipstation). Until then: the gate hides the pages, the webhooks rely on obscurity + whatever validation each workflow does. Honest status: better than today, not finished.

## Deliberately PUBLIC (stays public by design) 🌐
| Endpoint | Page | Required hardening (n8n-side, same follow-on batch) |
|---|---|---|
| `/webhook/bandana-ship-estimate` | ship-estimate (public tier) | strict input validation, per-IP + global rate limits, execution timeout, failure alerting — it is anonymous-callable forever. |
