# Known Limitations and Follow-ups

## 1. Live browser matrix requires secrets not present locally

Gates L and N (browser smoke matrix, live Mux/AMRITA stability) require the
Clerk publishable key, the mux-soak auth fixture, and running web+api services.
The Clerk publishable key is a secret that is **not** present in this local
environment (no `web/.env` / `web/.env.local`; only a placeholder in
`.env.example`). The gates are fully wired and skip gracefully with a clear
reason; run them in CI or any environment where the secret is configured:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_... npm --prefix web run smoke:rayd8:full-system:live
```

**Follow-up:** run the live matrix (chromium, firefox, webkit, plus a Brave
pass via a Chromium channel with the Brave executable) in CI on every release.

## 2. Pre-existing `react-hooks/refs` lint errors in the engine

`Rayd8PlayerEngine.tsx` has 4 pre-existing `react-hooks/refs` errors
(accessing `.current` during render) plus 1 `exhaustive-deps` warning. These
predate this repair and were confirmed against the baseline (via `git stash`).
The lint gate holds them at baseline and fails only if the count grows or a new
error type appears.

**Follow-up:** refactor the render-time ref reads into effects/state in a
separate change; the engine is ~3.2k lines and the refactor is non-trivial.

## 3. Cloudflare / edge configuration is infrastructure-level

The `Status code: (null)` + CORS symptom is consistent with Cloudflare
returning a 52x error or challenge page for `api.rayd8.app` without CORS
headers. Core Cloudflare configuration lives in the Cloudflare dashboard, not
this repo. Code-level mitigations are in place (HTML-edge detection, request
timeouts, API CORS hardening on every status).

**Recommended Cloudflare settings (apply in the dashboard):**
- Ensure error/challenge pages for the API hostname are not interposed on
  `/v1/player/*` (or that they echo the request `Origin` with
  `Access-Control-Allow-Origin` and `Vary: Origin`).
- Disable any Managed Challenge / Bot Fight Mode on the API path used by the
  player token endpoint.
- Do not cache `playback-token` responses (the API already sends
  `Cache-Control: no-store`).

## 4. Pre-existing compiled smoke-test DB failures (unrelated)

`dist/services/notifications/notifications.smoke.test.js` (compiled output run
against a real DB) has 5 failures from a Postgres not-null constraint on
`normalized_email`. These are environmental, pre-existing, and unrelated to
this repair; the `src` suite (84/84) is green. They only surface if the
compiled `dist` tests are run against a live DB.

## 5. Brave runtime verification is manual

Brave is not a Playwright browser; it is exercised via a Chromium channel with
the Brave executable. The Brave **classification logic** is unit-tested (gate
M), but an end-to-end Brave run is a manual/conditional step documented for
the release runbook.
