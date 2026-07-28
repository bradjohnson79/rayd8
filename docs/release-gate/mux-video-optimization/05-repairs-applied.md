# 05 — Repairs Applied

Repairs are evidence-gated. Hypothesis statuses use: `UNTESTED` | `NOT REPRODUCED` | `CORRELATED` | `CONFIRMED` | `REJECTED` | `INCONCLUSIVE`.

## R1 — Mux token refresh never scheduled for long-lived JWTs

| Field | Value |
| --- | --- |
| Hypothesis | Mid-play token refresh / `loadSource` |
| Status before repair | **CONFIRMED (code)** — scheduling skipped when TTL remaining > 30 minutes |
| Evidence | `MUX_*_REFRESH_MIN_DELAY_MS` early-return in engine + audio rail; 12h tokens never scheduled a refresh timer |
| Freeze class relevance | Prevents future Class A stalls after natural expiry; not the multi-minute client freeze by itself |
| Change | Always schedule refresh at `expires - 90s`; pause before reload; restore `currentTime`; bound failures (`MUX_REFRESH_MAX_FAILURES=3`) |
| Files | `Rayd8PlayerEngine.tsx`, `SessionProvider.tsx` |
| Rollback | Restore previous skip + `pauseBeforeLoad: false` path |

## R2 — Native HLS left prior hls.js controller alive

| Field | Value |
| --- | --- |
| Hypothesis | Timer/listener/HLS leakage |
| Status | **CONFIRMED (code)** |
| Evidence | `setMediaSource` native branch assigned `media.src` without destroying existing controller |
| Change | Destroy HLS controller before native `src` assignment |
| Files | `mediaController.ts` |
| Rollback | Remove destroy block in native branch |

## R3 — Unbounded major recovery storm

| Field | Value |
| --- | --- |
| Hypothesis | Recovery-loop thrashing |
| Status | **CORRELATED (code + unit)** — cooldown existed but no hard session/window/`loadSource` budget or terminal state |
| Evidence | `simulateUnboundedRecoveryStorm` unit test; authority could re-enter major recovery after cooldown indefinitely across a long session |
| Change | `RecoveryStateMachine` with window/session/`loadSource` budgets, exponential backoff, `FATAL_ERROR` terminal; wired into `PlaybackAuthorityController` |
| Files | `recoveryStateMachine.ts`, `playbackAuthority.ts` |
| Regression | `npm --prefix web run test:recovery-machine` |
| Rollback | Remove machine checks from authority |

## R4 — QA short Mux TTL for deliberate expiry soaks

| Field | Value |
| --- | --- |
| Hypothesis | Token expiry contribution |
| Status | Tooling — enables measurement (not a freeze root cause claim) |
| Change | `MUX_PLAYBACK_TOKEN_TTL_MINUTES` + `RAYD8_ALLOW_SHORT_MUX_TTL` gated resolver |
| Files | `muxPlaybackTokenTtl.ts`, `muxAdmin.ts`, `env.ts` |
| Regression | `npm --prefix api run test:mux-ttl` |

## R5 — Local auth azp / CORS for `127.0.0.1`

| Field | Value |
| --- | --- |
| Status | **CONFIRMED** local soak blocker (not production freeze) |
| Evidence | Clerk JWT azp `http://127.0.0.1:5173` rejected; CORS blocked |
| Change | Allow `http://127.0.0.1:5173` in CORS + authorized parties |
| Files | `server.ts`, `auth.ts` |

## R6 — Observability (dev/QA gated)

| Field | Value |
| --- | --- |
| Change | Responsiveness watchdog, decode metrics, A/V drift, freeze classification, correlation ID; redact tokens in diagnostics logs |
| Files | `playbackObservability.ts`, `playerDiagnostics.ts` |

## R7 — Dual-pipeline A/V desync correction

| Field | Value |
| --- | --- |
| Hypothesis | Dual HLS / independent clocks |
| Status | **CONFIRMED** Class E; **mitigated**; closure refinements applied |
| Freeze class | **E A/V desynchronization** (not Class C) |
| Evidence | Pre-repair: drift → **278s**. Closure 30m dual: 5–7 corrections/5m, steady avg \|drift\| ~0.21s, event-loop max ~12.7ms |
| Change | `AvSyncController` video-master seek/resume; hysteresis 0.5/0.25; startup grace; pause on seek/buffer/hidden; skip loop wraps; wired into freeze-poll + interval |
| Files | `avSyncController.ts`, `Rayd8PlayerEngine.tsx`, `SessionProvider.tsx` |
| Regression | `npm --prefix web run test:av-sync`; 30m dual soak |
| Rollback | Remove reconcile interval / marker |

## R8 — Umami abnormal incident telemetry (closure)

| Field | Value |
| --- | --- |
| Change | `playbackIncidentTelemetry.ts` emits privacy-safe `mux_playback_incident` on abnormal freeze classes |
| Files | `playbackIncidentTelemetry.ts`, `playbackObservability.ts` |
| Regression | `npm --prefix web run test:mux-telemetry` |

## Not applied (awaiting soak disposition)

- Dual-pipeline buffer reduction — UNTESTED as freeze cause
- Default performance presentation / brightness filter removal — UNTESTED (A/B pending)
- Auto prefer combined A/V — blocked pending semantic compatibility matrix (map empty)
- AMRITA visual budget changes — UNTESTED beyond existing hidden-tab pause
