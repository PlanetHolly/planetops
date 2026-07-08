# Plan Review Log: The Real Gate (Phase 2 — PIN gate + hosting)
Started 2026-07-08 ~00:15 PT. MAX_ROUNDS=3. Reviewer: Codex (read-only). Builder/arbiter: Claude (Fable 5).
Source brief: `_planning/fable-build-02-gate.md` · Plan under review: `PLAN.md`.

## Round 1 — Codex

Material flaws found:

- `PLAN.md:17` does not require `Secure` on auth cookies; Railway is HTTPS, so cookies must be `httpOnly; Secure; SameSite=Lax; Path=/` with short `Max-Age` and signed payload expiry verified server-side. Fix: explicitly require `Secure`, `Path=/`, max-age, HMAC validation, and reject expired cookies on every request.

- `PLAN.md:17` uses a stateless cookie with only global revocation; a leaked shared-device cookie survives until workday end or secret rotation. Fix: add a tiny server-side session table or in-memory+Redis store with `sid`, expiry, scope, and revoke-all/revoke-one support.

- `PLAN.md:21` per-IP rate limiting is not enough for a short team PIN because attackers can rotate IPs and Railway may expose proxy IP behavior if `trust proxy` is wrong. Fix: add global PIN failure counters, exponential lockout, `app.set('trust proxy', 1)`, and alerts on both per-IP and global thresholds.

- `PLAN.md:21` does not specify PIN length or entropy; a 4-digit PIN is 10,000 possibilities and viable against any distributed attack. Fix: require at least 6 to 8 digits or passphrase-style team code, with forced rotation after failed-attempt alerts.

- `PLAN.md:19` path-prefix allowlisting is underspecified and easy to get wrong with `%2e%2e`, `%2f`, backslashes, doubled slashes, dotfiles, case variants, and Express static redirects. Fix: normalize with `new URL(req.originalUrl, origin).pathname`, reject encoded slashes/backslashes/dot segments, resolve filesystem path, then verify it remains under the exact allowlisted directory.

- `PLAN.md:19` allows `/rush/*`, `/bandana-templates/*`, and `/ship-estimate/*` but not their asset dependencies if they reference root-relative assets later. Fix: audit every public page’s network requests and allowlist only the exact directories/files needed, with tests.

- `PLAN.md:19` misses `/signature` directory existence details; the repo has `signature/*.png`, and email clients may request exact old `github.io` URLs indefinitely. Fix: keep a dedicated stable public asset origin for signatures and update signatures before killing Pages.

- `PLAN.md:20` “other access:'pin' paths from registry” is not enforceable for external Google Sheets URLs in `frontdoor/registry.json:53-56`; the gate can hide links but cannot protect documents if Drive sharing is public or broad. Fix: audit and lock down Google Drive sharing separately, or do not claim the finance PIN protects those resources.

- `frontdoor/registry.json:28` marks `clock/admin.html` as finance-style `pin`, but the plan only names `/planetiq/*`; this leaves manager/admin timeclock pages ambiguous. Fix: define a server-side protected route map independent of registry UI labels and include `/clock/admin.html` and `/clock/report.html`.

- `index.html:4286-4287` and `schedule/index.html:412-413` embed the live `STATE_API_KEY`; after cutover, anyone with the old source, browser cache, or a copied file can still call `state-api` directly because `state-api/index.js:13` allows CORS `*`. Fix: rotate the exposed key and proxy state-api calls through the new gate using server-side credentials.

- `state-api/index.js:13-15` has public CORS and header auth only; the gate does not protect this separate Railway service. Fix: restrict CORS to the new gate origin, require server-to-server auth, and remove client-side `x-api-key` usage.

- `index.html:4613-4614` stores ShipStation API key/secret inside shared state payloads served back to the browser. Fix: move ShipStation credentials entirely server-side and scrub existing stored state.

- `capacity/index.html:154` and many `index.html` webhook calls point directly to public n8n/Railway endpoints; the gate does not stop external callers from invoking them. Fix: inventory every webhook, add server-side auth/rate limits, and proxy sensitive actions through the gate.

- `clock/report.html:53-56` accepts `?k=` and stores admin keys in session storage; URLs with `k` leak via browser history, screenshots, logs, and referrers. Fix: replace query-string admin keys with httpOnly scoped cookies or POST-only token exchange.

- `PLAN.md:23` `/health` includes Postgres `SELECT 1`, but the proposed gate is mostly static and auth; tying health to Postgres can take the whole site “red” for a dependency the gate may not need. Fix: split `/healthz` for service liveness from `/readyz`/status dependency checks.

- `PLAN.md:23` “one-click rollback = Railway rollback” is incomplete because the cutover also flips GitHub repo visibility, kills Pages, changes URLs, and may involve email signatures. Fix: write a timed rollback runbook with exact owner steps, expected propagation times, and pre-cutover backups of old URLs.

- `PLAN.md:24` says “AUDIT every external consumer” but makes it a cutover step, not a prerequisite; missed consumers are the highest blast-radius risk. Fix: make external URL inventory and owner signoff a hard pre-deploy gate.

- `PLAN.md:24` “flip repo private” may break Railway auto-deploy unless the Railway GitHub app has access to private repos and env/build settings are already verified. Fix: test private-repo deploy on a staging service before production cutover.

- `PLAN.md:24` does not account for GitHub Pages/CDN/browser caches of already-public internal HTML and JS. Fix: assume previously published content and embedded keys are compromised; rotate all exposed secrets and sensitive webhook tokens at cutover.

- `PLAN.md:30` asks whether caching can leak but does not mandate headers. Fix: set `Cache-Control: no-store, private` on all gated responses, `Vary: Cookie`, and only long-cache public immutable images/assets.

- `PLAN.md:17-20` lacks CSRF handling for `/gate` and finance unlock; SameSite=Lax helps, but login CSRF/session fixation edge cases remain. Fix: issue a CSRF token on the login page and regenerate session IDs/scopes on successful PIN entry.

- `PLAN.md:20` does not say finance cookie has narrower path/scope or shorter expiry. Fix: make finance sessions separate, short-lived, `Path=/planetiq` where possible, and require re-entry after idle timeout.

- `PLAN.md:22` says replace `frontdoor/app.js` with real POST `/gate`, but static serving must block direct navigation to `../index.html`, not just frontdoor UI flow. Fix: enforce auth middleware before all non-public static routes and test direct URL access.

- `frontdoor/app.js:97` and `frontdoor/app.js:149` open registry URLs blindly; if registry is ever edited badly, it can send users to external lookalikes. Fix: validate registry URLs against allowed same-origin paths plus approved external domains.

- `PLAN.md:23` status page is gated under `/frontdoor/status.html`; if auth itself is broken, the non-technical operator may not be able to see status. Fix: provide an unauthenticated minimal `/health-public` with plain-language status code plus the Google Chat alert details, without leaking internals.

- `PLAN.md:23` observability does not include auth metrics: failed PINs, lockouts, public allowlist hits, denied path attempts, webhook/API failures, and last successful state save. Fix: log structured events and show plain-language “what broke / who is affected / what to click” status cards.

- `PLAN.md:32` dismisses managed access too early; Cloudflare Access, Tailscale Funnel with auth, or Railway behind Cloudflare Access would reduce custom auth code and brute-force risk. Fix: compare custom PIN gate against Cloudflare Access one-time PIN/shared IdP plus a public-assets subdomain before building.

VERDICT: REVISE
### Claude's response (Round 1)
Verified Codex's three live-exposure claims against the repo — ALL REAL (STATE_API_KEY in index.html:4287 + schedule/index.html:413; ShipStation key+secret in the state payload index.html:4613; `?k=` admin key clock/report.html:53). Elevated them to a P0 pre-work section: rotate + proxy + CORS-restrict, treat all previously-published content as compromised.
Incorporated (24 of 26): Secure/Path/Max-Age cookie flags + server-side expiry; server-side session store w/ revoke-one/all; trust proxy + global circuit breaker + 6-8+ digit PIN + rotation-after-lockout; hardened allowlist (normalize, reject encoded tricks, fs-path containment, per-page asset audit + tests); stable signature origin updated pre-cutover; Drive-sharing honesty (PIN protects pages, not Drive docs — separate audit); server-side protected route map incl. clock/admin+report; webhook inventory + auth; ?k= replaced; healthz/readyz/health-public split (unauth plain-language status so a broken gate can't hide status); timed non-technical rollback runbook; consumer inventory as HARD pre-deploy gate w/ owner sign-off; staging test of private-repo autodeploy; rotate all published secrets at cutover; no-store+Vary:Cookie; CSRF token + session regeneration; scoped short-lived finance cookie w/ idle re-entry; auth middleware before ALL static; registry URL validation.
Arbiter substitutions (2, with reasons): (1) Sessions in the EXISTING Postgres, not Redis — one fewer service to run/watch for an 8-person team; same revocation semantics. (2) Cloudflare Access not adopted outright — it conflicts with the owner's locked "one team PIN, no per-user logins" requirement and adds a vendor; instead the comparison is mandated into the findings report as a decision input for the owner.

## Round 2 — Codex
(7 findings; full text in /tmp captured at run time, summarized here)
1. P0-3 missed clock/admin.html — same ?k= pattern (VERIFIED admin.html:67-69). 2. ship-estimate's n8n webhook is public BY DESIGN → needs anonymous-abuse controls class. 3. Public dirs need publish-only discipline + CI denylist for unexpected file types. 4. "any future access:pin path" unenforceable for external Drive links → rephrase same-origin + Drive audit gates tile visibility. 5. Global lockout = DoS lever → operator bypass/reset + pre-lockout warning. 6. no-store must be middleware-before-static + header tests incl. 304s. 7. Post-rotation rollback via repo re-public resurrects BROKEN pages → rollback = maintenance/redirect page, never naive re-public.
VERDICT: REVISE

### Claude's response (Round 2)
Accepted ALL 7 — each was correct and none conflicted with the owner's locked requirements. Edits: P0-3 widened to both clock pages + key rotation; P0-4 split sensitive-vs-deliberately-public webhook classes; publish-only + CI denylist added to allowlist section; protected-route wording restricted to same-origin + Drive-audit-gates-tile-visibility (+ honesty label); lockout repair path (pre-warning, documented reset, emergency rotation, sessions survive); cache headers via middleware-before-static + 304-inclusive header test; rollback redefined as maintenance/redirect page (old secrets never restored). No rejections this round.

## Round 3 — Codex
"No material plan blockers remain in PLAN.md after Round 2. The known credential leaks, public webhook abuse, route-protection boundaries, Drive-doc limitation, caching behavior, lockout recovery, public directory leakage, and rollback trap are now called out with concrete prerequisites or implementation tests. Residual risk is mostly execution quality: the allowlist normalizer, cache-header tests, webhook inventory, and rollback maintenance branch need to be implemented exactly as written. As a plan, it is now sound enough to proceed."
VERDICT: APPROVED

### Outcome
Converged in 3 rounds (26 → 7 → 0 findings). Plan approved for the owner's hosting decision + build sign-off. The most valuable byproduct: the review CONFIRMED live credential exposure on the current public site (STATE_API_KEY in 2 pages, ShipStation creds in state payloads, ?k= admin keys in 2 clock pages) — now P0 pre-work in the plan, urgent regardless of hosting choice.
