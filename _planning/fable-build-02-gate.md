# Fable Build Brief 02 — The Real Gate (Railway-assumed, pending Holly's hosting call)

**Status:** DRAFT for Codex adversarial review → Holly's hosting decision → then buildable.
**From:** `front-door-spec.md` §2 (locked access model) · `frontdoor/BUILD_LOG.md` (open items) · boardroom staging ruling 2026-07-07.
**Assumption under review:** hosting = Railway. Codex's job is to attack this plan; Holly decides hosting AFTER reading the findings. **Nothing in this brief is buildable until she signs off.**

---

## 1. What this delivers

The **real lock** on the Front Door: the whole PlanetOps app served behind a team PIN so it is genuinely private and not findable — while the small public tier (email-signature images, customer-facing pages) keeps working. Plus the self-watching required by the locked spec: the system tells us when it's failing, why, and repair is one click.

Explicitly NOT in scope: individual logins (the PIN gate is the seam for them later) · live status wiring · invoice/document search · deploying stranded file:// apps (separate follow-on brief).

## 2. Architecture (Railway-assumed)

One new Railway service, `frontdoor-gate` — a sibling of the existing `state-api` (same pattern: tiny Express, env-var config, `/health`):

```
GitHub repo planetops (flipped PRIVATE at cutover) = source of truth
        │ Railway auto-deploy on push
frontdoor-gate (Express, ~200 lines)
  ├─ POST /gate        → checks ENTRY_PIN → sets signed httpOnly session cookie
  ├─ static serving    → the whole planetops tree, gated by the cookie
  ├─ PUBLIC allowlist  → /signature/* · /rush/* · /bandana-templates/* ·
  │                      /ship-estimate/* · /health   (no cookie required)
  ├─ FINANCE zone      → /planetiq/* re-prompts for FINANCE_PIN (server-checked)
  └─ GET /health       → { ok, db, ts } — no auth, for the heartbeat
```

- **Sessions:** signed httpOnly SameSite=Lax cookie (secret = `SESSION_SECRET` env var), expiry = end of the current Pacific workday (matches the locked "type once, in for the day"). No session store needed v1 — the cookie is self-contained (signed timestamp+scope); revocation = rotate `SESSION_SECRET`.
- **PINs:** `ENTRY_PIN`, `FINANCE_PIN` as Railway env vars. Rotation = edit var, redeploy (60s, no code change). Never in the repo, never in registry.json.
- **Brute-force guard:** per-IP rate limit on /gate (e.g. 10 tries / 15 min, then 429 + alert). PINs are short — the limiter is what makes them survivable.
- **Frontdoor UI change (small):** `frontdoor/app.js` placeholder gate is replaced by a real POST to /gate; the `enterPin` field is REMOVED from registry.json. The rest of the shell is untouched.
- **The floor app's embeds** (estimator/schedule/capacity iframes) stay same-origin behind the gate — one cookie covers them.

## 3. Self-watching (required day one, per locked spec)

1. `/health` checks the service + a `SELECT 1` against Postgres (shared instance with state-api) + reports version/deploy id.
2. **n8n heartbeat workflow** (clone the existing Fix-Agent/alert pattern): ping `/health` every 5 min; on failure or non-200, post WHAT failed + the response body to 🚨 System Alerts. Cron TZ note: n8n is Eastern.
3. **Admin status page** at `/frontdoor/status.html` (gated): green/red for gate service, DB, and each data feed the shell references.
4. **Repair path:** Railway deploy history → one-click rollback to last-good. Documented in BUILD_LOG so anyone can do it.

## 4. Cutover order (the dangerous part — do it in THIS order)

1. Deploy `frontdoor-gate` at its Railway URL. Old github.io stays untouched and working.
2. Verify EVERY surface through the gate (walk the registry; the 9-criteria pattern from Brief 01).
3. **Audit every external reference to `planetholly.github.io/planetops/*`:** team email signatures (signature/*.png — breaking these is silent damage), Automations.io steps, n8n workflows, PA Docs bookmark file, Drive docs, anything in Dropbox CLAUDE.md files. Produce the list BEFORE flipping anything. (Per the rotation-runbook rule: inventory EVERY consumer before revoking.)
4. Update public-tier references to the new URL (or confirm a redirect strategy).
5. Flip the GitHub repo private → Pages dies → internal pages stop being publicly reachable (the goal).
6. Announce to the team: one URL + the PIN. Update the PA Docs bookmarks to point at the front door only.
7. Rollback plan if anything breaks: repo public again → Pages resurrects the old URLs within minutes.

## 5. Cost

Railway: one more tiny service on the existing account (~$0–5/mo at this traffic). GitHub free tier suffices once Pages is off (private repos are free; it was only *Pages-from-private* that needed a paid plan).

## 6. Codex — attack here

1. **Session design:** is a self-contained signed cookie (no store) sound for this threat model? SameSite/secure flags, workday expiry math, logout/rotation story.
2. **PIN brute force:** is per-IP rate limiting enough for a 4–8 digit PIN? Should there be a global circuit breaker + alert?
3. **Allowlist leaks:** path traversal (`/signature/../frontdoor/`), casing, trailing-slash and encoding tricks, redirect edge cases that expose gated files.
4. **Caching/CDN:** can gated content leak via shared caches, Railway edge, or browser cache after PIN rotation?
5. **Cutover blast radius:** what github.io consumers could we have missed? What breaks silently?
6. **Iframe/same-origin assumptions** of the floor app behind the gate.
7. **Failure honesty:** does the self-watching actually satisfy "easy to identify when it's failing, why, and easy repairs" — or is there a failure mode it can't see (e.g., gate up but static tree stale)?
8. **Simpler-alternative check:** is there a materially simpler design (e.g., Cloudflare Access, basic-auth at the edge, Pages+private+Enterprise) that beats this on maintenance for the same privacy?

---
*After Codex review: findings → Holly → hosting decision locked in `front-door-spec.md` §3 → then and only then a buildable version of this brief.*
