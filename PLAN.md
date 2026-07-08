# Plan: The Real Gate — put the PlanetOps app behind a team PIN (Railway-assumed)
_Round 2 — revised after Codex rounds 1 (26 findings) and 2 (7 findings); arbiter substitutions noted in §Decisions_

## Goal
Make the PlanetOps web app genuinely private — not publicly findable — behind a single team PIN, while keeping a small public tier working (email-signature images embedded in live emails; customer-facing pages), and shipping self-watching (health, alerting, one-click repair) from day one. Hosting assumption under review: a small Railway service. The business owner (Holly, non-technical) decides hosting AFTER this review.

## URGENT pre-work surfaced by review (independent of hosting choice)
Round 1 confirmed the CURRENT public site already leaks credentials. These are **Phase-2 prerequisites, sequenced before or with the gate**, and treated as already-compromised:
- **P0-1** `index.html` + `schedule/index.html` embed the live `STATE_API_KEY` in public page source; `state-api` has CORS `*`. → Rotate the key; move state-api calls behind the gate's server-side proxy; restrict CORS to the gate origin; remove client-side `x-api-key` use.
- **P0-2** ShipStation API key+secret ride the shared state payload back to any browser holding P0-1's key. → Move ShipStation creds server-side (gate env vars / proxy); scrub them from stored state in Postgres; rotate the ShipStation credentials.
- **P0-3** `clock/report.html` AND `clock/admin.html` (same pattern, admin.html:67-69) accept the admin key as `?k=` (leaks via history/screenshots/referrers). → Replace with httpOnly scoped-cookie or POST-only token exchange at the gate; rotate any existing timesheets admin keys; remove query-string admin auth everywhere.
- **P0-4** Every n8n/Railway webhook the public pages call directly is publicly invokable. → Inventory all webhooks; classify: (a) sensitive/internal → server-side auth/rate limits or proxying through the gate; (b) **deliberately public** (e.g. ship-estimate's n8n quote webhook) → anonymous-abuse controls: strict input validation, per-IP + global rate limits, timeouts, logging, alerts.
- **P0-5** Assume everything ever published to github.io (HTML/JS/keys) is compromised: at cutover, rotate ALL secrets that ever appeared in the public tree (state key, webhook tokens), per the rotation runbook — inventory every consumer BEFORE revoking.

## Approach
1. **New Railway service `frontdoor-gate`** (Express, sibling of state-api):
   - `POST /gate` — CSRF-tokened login form; checks `ENTRY_PIN` → creates a server-side session (see §Sessions) and sets the cookie `httpOnly; Secure; SameSite=Lax; Path=/` with Max-Age to end of current Pacific workday. Session id regenerated on every successful PIN entry (fixation guard). Expiry validated server-side per request.
   - **Sessions = one Postgres table** (`gate_sessions`: sid, scope, expires_at, created_ip) in the DB we already run — gives revoke-one and revoke-all. (Arbiter substitution: Codex suggested a session table or Redis; Postgres chosen — already owned, one fewer service.)
   - **Auth middleware runs before ALL static routes** — direct navigation to any non-public path 302s to the gate. Tested by walking every registry URL unauthenticated.
   - **Static serving** of the repo tree behind that middleware; Railway auto-deploys from the private GitHub repo. **Pre-verified on a staging service that Railway's GitHub app deploys the repo AFTER it flips private** (hard prerequisite).
   - **PUBLIC allowlist** (no cookie): `/signature/*`, `/rush/*`, `/bandana-templates/*`, `/ship-estimate/*`, `/healthz`, `/health-public`. Implementation hardened per review: decode + normalize `new URL(req.originalUrl).pathname`, reject encoded slashes/backslashes/dot-segments/dotfiles, resolve the filesystem path and require it to remain under the exact allowlisted directory; case-sensitive exact prefixes; no redirects across the boundary. **Each public page's full network-request set audited and included** (root-relative asset deps), with tests for traversal/encoding/casing tricks. **Public directories are publish-only**: a CI/deploy test denylists unexpected content landing in them (dotfiles, source files, CSV/JSON dumps, oversized/high-res internal assets) so a future save into `/bandana-templates/` can't silently publish something private.
   - **Protected route map is server-side and independent of registry UI labels** — includes `/planetiq/*`, `/clock/admin.html`, `/clock/report.html`, and any future **same-origin** `access:"pin"` path. The registry's `access` field is display-only; the server map is authoritative. External `access:"pin"` tiles (the Google-Sheets links) CANNOT be route-protected — the **Drive-sharing audit is a prerequisite for those tiles remaining visible**, and until it passes they carry a "protected by Drive permissions, not the PIN" label.
   - **FINANCE zone**: separate short-lived scoped session (own cookie, narrow Path, ~60-min idle re-entry), unlocked by `FINANCE_PIN` via the same CSRF-tokened POST. Honesty note: the finance PIN protects PAGES; Google-Drive-linked sheets are protected by Drive sharing, which gets its own audit — the plan does not claim the PIN secures Drive docs.
   - **Brute force**: `app.set('trust proxy', 1)`; per-IP limiter (10/15min) AND a global failure circuit breaker (e.g. 50 failures/hour → lock the gate for 15 min + alert both thresholds to 🚨 System Alerts). Because the global lockout is itself a DoS lever, it comes with an **operator repair path**: a warning alert BEFORE hard lockout, a documented lockout reset (Railway env `LOCKOUT_RESET` bump or restart), and emergency PIN rotation steps in the runbook — existing team sessions stay valid through a lockout. `ENTRY_PIN` minimum 6–8 digits or a word-style team code; forced rotation after a lockout alert.
   - **Caching**: `Cache-Control: no-store, private` + `Vary: Cookie` on every gated response — applied by middleware BEFORE static serving, and verified by a **response-header test across gated HTML/JS/CSS/JSON/images including 304 responses**; long-cache only public immutable assets.
2. **Frontdoor UI**: replace placeholder gate with the real CSRF-tokened POST; remove `enterPin` from registry.json; **registry URL validation** — tiles only open same-origin paths or an approved external-domain list (docs.google.com), so a bad registry edit can't send the team to a lookalike.
3. **Self-watching** (day one):
   - `/healthz` = pure service liveness (no dependencies). `/readyz` (gated `/frontdoor/status.html` backing) = per-dependency checks: DB, static tree freshness (deployed commit vs repo HEAD), state-api, key webhooks.
   - **`/health-public`** = unauthenticated, minimal, plain-language ("Planet Apparel app: OK / having trouble — the team has been alerted") so a broken gate never hides the status itself.
   - n8n heartbeat (5-min, Eastern-cron caveat) posts what+why to 🚨 System Alerts; **structured auth events** (failed PINs, lockouts, denied-path attempts, allowlist hits, webhook failures, last state save) feed plain-language status cards: *what broke / who's affected / what to click.*
   - **Timed rollback runbook** written for a non-technical operator: exact steps, expected propagation times, covering all three layers (Railway rollback; repo re-public → Pages resurrects old URLs in minutes; signature/URL restores).
4. **Cutover — inventory is a HARD pre-deploy gate, not a step**:
   0. (Prerequisite) Full external-consumer inventory of `planetholly.github.io/planetops/*` — email signatures, Automations.io, n8n, bookmarks, Drive docs, Dropbox CLAUDE.mds — reviewed and signed off by Holly BEFORE anything flips. Signatures get a dedicated stable public origin and are updated before Pages dies (email clients request old URLs indefinitely).
   1. Deploy gate on staging → verify private-repo autodeploy → production deploy. Old github.io untouched.
   2. Walk every registry surface through the gate, authenticated and unauthenticated.
   3. Execute P0 rotations (state key, ShipStation, webhook tokens) with consumers updated in the same window.
   4. Update public-tier references → flip repo private → Pages dies → announce one URL + PIN → migrate bookmarks.
   5. Rollback = the timed runbook above — with one correction from review: after the P0 rotations, simply re-publicizing the repo would resurrect pages whose embedded keys/webhooks are now dead. **Rollback therefore means: push a maintenance/redirect page to the old Pages tree (pointing at the gate URL), never a naive re-public** — old secrets are not restored.

## Key decisions & tradeoffs
- **Server-side sessions in Postgres** (not stateless cookie — Codex R1; not Redis — arbiter: one fewer service).
- **PIN + limiter + circuit breaker** instead of logins — owner's locked simplicity requirement; the seam for per-person logins later is the session table itself.
- **One origin behind the gate + explicit public allowlist** vs keeping Pages for the public tier — chosen for one-place-to-watch; the signature assets get their stability from the allowlist and the pre-cutover reference update.
- **Managed-alternative comparison (mandated by review, decided by Holly):** Cloudflare Access (one-time PIN per email or shared policy) in front of Railway would replace most custom auth code and its brute-force surface, at the cost of a second vendor, per-user email friction (conflicts with the locked "one team PIN, no logins"), and DNS/domain setup. This comparison ships in the findings report as a decision input — not silently decided either way.

## Risks / open questions
- Full webhook inventory size unknown until P0-4 runs.
- Railway private-repo autodeploy assumed but unverified until the staging test (hard prerequisite).
- Drive-sharing audit may surface publicly-shared sheets (separate remediation).

## Out of scope
Individual logins (seam preserved via session table) · live tile status · invoice/document search · deploying stranded file:// apps · Printavo/n8n integration changes beyond the webhook-auth pass.
