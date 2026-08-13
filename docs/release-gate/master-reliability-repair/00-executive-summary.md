# Master Reliability Repair — Executive Summary

**Milestone:** P0/P1 production reliability repair + regression + smoke certification
**Branch:** `fix/rayd8-master-reliability`
**Repair commit:** `f4ace84` — `fix(player): master reliability repair for session startup + usage accounting`
**Smoke infra commit:** `efd5d8c` — `test(reliability): full-system smoke orchestrator + hermetic server entry guard`
**Date:** 2026-08-07

## Verdict

**CONDITIONAL GO** — all 12 deterministic certification gates pass on a clean
SHA; the 2 live browser/stability gates are environment-gated (require the
Clerk publishable key + auth fixture + running services) and are ready to run
in CI or any environment where those secrets are present.

## Incidents addressed

| Incident | Symptom | Root cause (repaired) |
|----------|---------|-----------------------|
| `INC-2026-08-06-VIDEO-LOOP` | Brave/macOS + Brave/Linux: video buffers while audio continues, repeated request sequence, trial usage consumed | Unbounded `hls.js` retries; usage accrued on raw elapsed time regardless of media health; no browser-block classification |
| `INC-2026-08-06-PLAYBACK-TOKEN-CORS` | Firefox/Windows stuck at "Preparing Your RAYD8 Session / 0%", console shows `Cross-Origin Request Blocked`, `Status code: (null)` | `apiRequest` had no timeout (hung fetch never settled); `waitForPlaybackReady` timeout left the authority in `PRELOADING` so the 0% overlay never cleared; edge HTML error pages were misclassified |

## Certification scorecard (clean SHA `efd5d8c`)

```
PASS  A  API typecheck
PASS  B  API unit + contract tests
PASS  C  Web typecheck
PASS  D  Web lint (reliability scope, baseline-aware)
PASS  E  Web API transport tests
PASS  F  Startup taxonomy + stage machine
PASS  G  Browser-block + media qualification + instrumentation
PASS  H  Health + recovery + av-sync + telemetry
PASS  I  No-playback-prompt static assertion
PASS  J  Web production build
PASS  K  Session idempotency + usage qualification contract
SKIP  L  Browser smoke matrix (requires --live + Clerk secret)
PASS  M  Brave browser-block classification
SKIP  N  Live Mux + AMRITA stability (requires --live + Clerk secret)

PASS 12  FAIL 0  SKIP 2
```

Supporting suites from the same clean SHA: full API `src` tests **84/84**,
web `test:session-startup-closure` green.

## What changed (high level)

- **API:** centralized CORS config, correlation-ID echo on every response,
  `Cache-Control: no-store` on playback-token, idempotent session start,
  media-qualified usage accrual (fail-closed), heartbeat-after-end guard,
  hermetic server entry-point guard.
- **Web:** hardened `apiRequest` (timeout, abort, correlation ID, HTML-edge
  detection), bounded player GET retry, explicit startup stage machine,
  browser-block detection, media-qualification reporter wired to the usage
  heartbeat, bounded `hls.js` retries, expanded startup taxonomy + overlays,
  startup instrumentation counters (redaction-safe).

## How to reproduce the certification

```bash
npm --prefix web run smoke:rayd8:full-system        # deterministic gates
npm --prefix web run smoke:rayd8:full-system:live   # + browser/live gates (needs secrets)
```
