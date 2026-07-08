# Gate RUNBOOK — when something's wrong (written for a non-technical operator)

**First, always:** open **`/health-public`** on the app URL (no login needed).
🟢 = the app is up (a login problem is probably the PIN — see #2). 🟠 = real trouble; the 🚨 System Alerts space has the details.

## 1. The app is down / everyone sees errors  → ROLL BACK (~2 minutes)
1. railway.app → **frontdoor-gate** service → **Deployments**.
2. Find the last deployment marked before the trouble started → ⋮ menu → **Redeploy**.
3. Wait for green → check `/health-public` → tell the team. Done. (This undoes bad code, not data.)

## 2. Someone can't log in but /health-public is 🟢
- PIN typo (8 tries locks a device for 15 min) — wait, retry.
- PIN was rotated — the current PIN is in Railway → frontdoor-gate → **Variables** → `ENTRY_PIN`.

## 3. "Gate locked" alert fired (too many failed PINs — possible attack, or the team mistyping)
- It self-clears in 15 minutes; **logged-in people are unaffected.**
- To clear immediately: Railway → frontdoor-gate → ⋮ → **Restart** (this resets the counter).
- If it was an attack (alerts show many IPs): change `ENTRY_PIN` in Variables (service restarts itself), then tell the team the new PIN.

## 4. Rotate a PIN (someone left, or after an attack)
Railway → frontdoor-gate → Variables → edit `ENTRY_PIN` (or `FINANCE_PIN`) → save (auto-redeploys, ~60s) → tell the team. Everyone logs in again next page-load.

## 5. Log EVERYONE out right now (lost/stolen device)
Railway → Variables → change `SESSION_SECRET` to any new random string → save. All sessions die instantly; the team re-enters the PIN.

## 6. ShipStation sync failing
The creds live in Railway Variables (`SHIPSTATION_KEY` / `SHIPSTATION_SECRET`) — NOT in the app. If ShipStation rotated keys, update them there. Never type them into the app.

## 7. NEVER do this
- Never make the GitHub repo public again to "fix" something — the old published pages contain retired keys and will NOT work; it only re-exposes history. The old-URL fallback is the maintenance/redirect page, which is already deployed on the Pages branch.
- Never put a PIN, key, or secret into any file in the repo (including registry.json).

---

# Heartbeat spec (n8n workflow — clone of the Fix-Agent alert pattern)

- **Schedule:** every 5 min (n8n cron is EASTERN — 5-min interval is TZ-safe).
- **Step 1:** HTTP GET `https://<gate-url>/healthz`, 10s timeout.
- **Step 2 (on non-200 / timeout):** POST to 🚨 System Alerts: *"frontdoor-gate is DOWN — `<status/error text>`. The whole app is unreachable for the team. Fix: RUNBOOK #1 (Railway → Deployments → Redeploy last good). `/health-public` shows the public status."*
- **Step 3 (recovery):** when it flips back to 200 after a failure, post *"frontdoor-gate recovered."*
- **De-dup:** alert on state CHANGE only (down→up, up→down), not every 5 minutes.
- The gate also pushes its own structured events (lockouts, attack warnings, misconfiguration) to the same channel via `ALERT_WEBHOOK_URL` — those arrive without polling.
