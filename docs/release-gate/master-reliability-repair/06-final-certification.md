# Final Certification

**Milestone:** RAYD8 master reliability repair — session startup, playback
token delivery, recovery loops, session-state cleanup, error classification.
**Branch:** `fix/rayd8-master-reliability`
**Clean verification SHA:** `efd5d8c`
**Date:** 2026-08-07

## Verdict: CONDITIONAL GO

All 12 deterministic certification gates pass on a clean SHA. The 2 live
browser/stability gates are environment-gated (Clerk secret + auth fixture +
running services) and are ready to run in CI. No deterministic gate fails; no
regression was introduced.

## Scorecard (clean SHA `efd5d8c`)

| Gate | Result |
|------|--------|
| A — API typecheck | PASS |
| B — API unit + contract tests | PASS |
| C — Web typecheck | PASS |
| D — Web lint (reliability scope) | PASS |
| E — Web API transport tests | PASS |
| F — Startup taxonomy + stage machine | PASS |
| G — Browser-block + media qualification + instrumentation | PASS |
| H — Health + recovery + av-sync + telemetry | PASS |
| I — No-playback-prompt static assertion | PASS |
| J — Web production build | PASS |
| K — Session idempotency + usage qualification contract | PASS |
| L — Browser smoke matrix | SKIP (requires --live + Clerk secret) |
| M — Brave browser-block classification | PASS |
| N — Live Mux + AMRITA stability | SKIP (requires --live + Clerk secret) |

**PASS 12 · FAIL 0 · SKIP 2**

Supporting suites from the same clean SHA: full API `src` tests **84/84**,
web `test:session-startup-closure` green.

## Completion answers

**Are both incidents repaired and regression-covered?**
Yes. `INC-2026-08-06-VIDEO-LOOP` (usage drain, request storm, silent Brave
loop) and `INC-2026-08-06-PLAYBACK-TOKEN-CORS` (permanent 0%, hung fetch, edge
HTML misclassification) each have deterministic reproduction tests that failed
before the fix and pass after, folded into the smoke gates.

**Is the 0% preparation overlay guaranteed to reach a terminal state?**
Yes. An explicit startup stage machine drives the overlay; every startup
reaches `ready` or `failed`, and every terminal failure clears the overlay.
The `waitForPlaybackReady` timeout and the health-guard hard fallback both
transition the authority out of `PRELOADING`.

**Is trial usage protected from dead-video accrual?**
Yes, fail-closed on both sides. The client attests `mediaQualified` only when
the required media is healthy; the server accrues only when
`mediaQualified === true`, clamped to the heartbeat cap, never negative, and
never after session end.

**Are request storms bounded?**
Yes. `hls.js` internal retries are explicitly capped, and the recovery state
machine bounds higher-level recovery (3 major/window, 8/session, 6
load_source/session). Player-critical GETs use bounded, backoff-delayed retry
that never retries 4xx denials or already-timed-out requests.

**Is the certification reproducible?**
Yes. `npm --prefix web run smoke:rayd8:full-system` reproduces the deterministic
scorecard from a clean checkout; `:live` adds the browser/stability gates where
secrets are available. The API server entry-point guard keeps the contract
tests hermetic regardless of whether a dev server is running.

**What is the residual risk?**
Low and documented: the live browser matrix has not executed in this local
environment (missing Clerk secret), the 4 pre-existing engine lint errors are
held at baseline, and Cloudflare dashboard settings are recommended but applied
outside this repo. See `04-known-limitations.md`.
