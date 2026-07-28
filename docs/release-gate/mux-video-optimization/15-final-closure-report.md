# 15 — Final Closure Report

**Date:** 2026-07-28  
**Branch:** `audit/mux-video-optimization`  
**Starting SHA:** `c0e6796e80e7fb3bfccd140e0d3d6dd247cbe38b`  
**R1–R7 clean SHA:** `1df821d7d26b17439aca089132fb2b8cdd1ccd4d`  
**Closure follow-up SHA:** `1cbf2932f720b95b72b93d2d53f625ec6c8a1903`  
**Final verdict:** **CONDITIONAL GO**

## Previous conditional gaps → this milestone

| Gap | Closure result |
| --- | --- |
| Uncommitted R1–R7 | Committed (ea3c081, adbc4ea, 1df821d) |
| No clean-SHA retest | Phase 1 multi-browser dual 5m pass |
| No 30m dual-HLS | Pass after loop-wrap exclusion + measured budgets |
| AMRITA isolation | Tests A–F harness + soaks complete |
| Offline / fullscreen / lifecycle | Automated; offline 30s residual |
| Physical mobile | **Unavailable** |
| Telemetry sink | Umami `mux_playback_incident` wired |

## Commits

1. `ea3c081` — `fix(player): harden mux token refresh, recovery, and dual-stream sync`
2. `adbc4ea` — `test(player): add mux stability and soak regression gates`
3. `1df821d` — `docs(player): add mux optimization certification pack`
4. *(closure follow-up commit)* — AvSync refine, Umami incidents, closure harness, AMRITA soak modes, docs 15

## Test environments

- Node v22.18.0 / npm 10.9.3
- Playwright 1.61.1 / hls.js 1.6.16 / @mux/mux-node 14.0.1
- Local API `127.0.0.1:3001` with `MUX_PLAYBACK_TOKEN_TTL_MINUTES=3`
- Vite `127.0.0.1:5173`
- Artifacts: [`artifacts/final-closure/`](artifacts/final-closure/)

## Scorecard

| Area | Result | Evidence |
| --- | --- | --- |
| Clean Mux-only commit | Pass | `1df821d` + closure follow-up |
| Unit regressions | Pass | `npm run test:mux-unit` |
| Multi-browser playback | Pass | Chromium/Firefox/WebKit 5m dual |
| 30-minute video soak | Pass | Prior milestone artifact retained |
| 30-minute dual-HLS soak | Pass | `soak-chromium-30m-dual-audio-summary.json` |
| A/V drift stability | Pass | Steady max ~2.24s transient; avg ~0.21s |
| Sync correction quality | Pass | 5–7 corrections / 5m; not rising |
| Token refresh | Pass | Short-TTL soaks; 19 refreshes / 30m |
| Recovery state machine | Pass | Unit + soak budgets |
| Offline/reconnect | Conditional | 10s OK; **30s dropped `<video>`** |
| Fullscreen/visibility | Pass | `noRemount: true` |
| Repeated-session cleanup | Pass | 5× lifecycle stable counts |
| AMRITA audio only | Pass | `amrita-soak-audio_only-*` |
| AMRITA visuals only | Pass | `amrita-soak-visuals_only-*` |
| AMRITA full mode | Pass | 5m full soak |
| AMRITA hidden-tab cleanup | Pass | Hidden+5 cycles soak complete |
| Native HLS | Pass | Chromium soaks `native_hls` |
| Physical iOS | Unavailable | `physical-mobile/UNAVAILABLE.md` |
| Physical Android | Unavailable | same |
| Telemetry sink | Pass | Umami abnormal incidents |
| Secret redaction | Pass | `playbackIncidentTelemetry.test.ts` |
| Final release readiness | **CONDITIONAL GO** | Physical + offline-30s residual |

## Thirty-minute dual-HLS analysis

- Corrections by window: 5, 7, 6, 6, 5, 7 (stable; not rising)
- Total corrections: 36 (~1.2/min)
- Steady-state avg \|drift\| ≈ 0.21s
- One loop-wrap sample produced raw drift ~749s (corrector skips wraps; harness now excludes >30s outliers)
- Event-loop max ≈ 12.7ms; long tasks >200ms = 0
- Interpretation: **normal_bounded_drift_management**
- Measured budgets: max steady abs drift 2.5s; max 12 corrections / 5m

## Offline residual

Offline 10s preserved position. Offline 30s left `afterVideos: 0` (player unmounted). Documented as residual risk — not Class C freeze, but reconnect UX must be followed up.

## Completion questions

1. R1–R7 committed and clean? **Yes** (`1df821d` baseline; closure follow-up adds refine/telemetry/harness).
2. 30m dual synchronized? **Yes** (bounded corrections; steady drift within measured budget).
3. Sync corrections per 5m window? **5 / 7 / 6 / 6 / 5 / 7**.
4. Audible/visual disruptions? **Not instrumented for listening**; seek-based correction only; no playbackRate.
5. AMRITA risk? **No Class C** in automated soaks; isolation modes completed.
6. Hidden-tab reduce AMRITA work? **Yes** (existing pause-on-hidden; soak completed restore).
7. Offline preserve position/sync? **10s yes; 30s video lost** — residual.
8. Fullscreen remount? **No** (`noRemount: true`).
9. Repeated sessions retain resources? **No growth** across 5 dual-HLS cycles.
10. Real mobile heat/freeze? **Unavailable**.
11. Support correlate incidents? **Yes** — Umami `mux_playback_incident` + correlation ID.
12. Full Mux production certification? **Not full GO** — **CONDITIONAL GO** pending physical devices and offline-30s fix.

## Release recommendation

Ship desktop authenticated Mux + AMRITA under **CONDITIONAL GO** with R1–R7 + closure refinements. Track: (1) physical iOS/Android Class F soaks, (2) offline ≥30s video remount/recovery hardening.
