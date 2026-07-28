# Mux Video Freeze Audit — Task Completion Report

**Date:** 2026-07-28  
**Branch:** `audit/mux-video-optimization`  
**Baseline tag:** `audit/mux-baseline-c0e6796`  
**Starting SHA:** `c0e6796e80e7fb3bfccd140e0d3d6dd247cbe38b`  
**Verdict:** **CONDITIONAL GO**

Full scorecard: [`14-final-certification.md`](14-final-certification.md)

---

## Objective

Audit and harden every RAYD8 Mux/HLS playback path against multi-minute device freezes: inventory players, reproduce long-play failures, instrument freeze classes A–F, repair only confirmed defects, add regression gates, and certify under `docs/release-gate/mux-video-optimization/`.

---

## Outcome summary

| Area | Result |
| --- | --- |
| Class C tab freeze | **Not reproduced** on lab Mac |
| Class F device freeze | **Not tested** on physical mobile (keeps verdict conditional) |
| Dominant lab defect | **Class E A/V desync** on dual HLS (plus earlier false positives when audio track was empty) |
| Repairs shipped (uncommitted WIP on branch) | **R1–R7** evidence-gated |
| Desktop authenticated soaks | Chromium / Firefox / WebKit 5m; Chromium 30m video; Chromium 10m dual-audio — all complete |
| Unit regressions | `npm run test:mux-unit` pass |
| Speculative global quality cuts | Not applied |
| Auto combined A/V | Not enabled (asset map empty) |

---

## Work completed

### 1. Baseline and inventory

- Branched from `main` and tagged `audit/mux-baseline-c0e6796`.
- Confirmed architecture: signed Mux HLS via `hls.js` / native HLS; **no** `@mux/mux-player`.
- Primary path: `Rayd8PlayerEngine` + `VideoSurface` `<video>` + `SessionProvider` `GlobalAudioRail` `<audio>` (dual pipeline; default `audioTrack='none'`).
- Docs: [`01-player-inventory.md`](01-player-inventory.md), [`03-baseline-performance.md`](03-baseline-performance.md).

### 2. Instrumentation (freeze classes A–F)

- Responsiveness (event-loop delay, long tasks).
- Decode / buffer metrics.
- A/V drift sampling (gated on real audio `currentSrc`).
- Recovery / `loadSource` counters.
- Correlation ID + redacted diagnostics.
- Files: `playbackObservability.ts`, `playerDiagnostics.ts`.

### 3. Reproduction and soak harness

- Auth fixture: `npm run fixture:mux-soak-auth` → gitignored `web/e2e/.auth/mux-soak.env`.
- Stability script: `web/scripts/mux-playback-stability.mjs`.
- npm scripts: `test:mux-stability:smoke`, `test:mux-stability:soak`, `test:mux-unit`.
- Clerk modal OTP handled via `@clerk/testing` `clerk.signIn({ emailAddress })`.
- Dual-audio gate: `RAYD8_MUX_REQUIRE_DUAL_AUDIO`.

### 4. Evidence-gated repairs

| ID | Fix | Status |
| --- | --- | --- |
| R1 | Always schedule Mux JWT refresh at expiry−90s; pause/restore time; max 3 failures | Confirmed code bug fixed |
| R2 | Destroy prior hls.js controller before native `src` assignment | Confirmed leak fixed |
| R3 | `RecoveryStateMachine` budgets + terminal `FATAL_ERROR` | Correlated / unit-gated |
| R4 | Short TTL QA env (`MUX_PLAYBACK_TOKEN_TTL_MINUTES`) | Tooling |
| R5 | Local `127.0.0.1:5173` CORS/azp for soak | Local QA unblocker |
| R6 | Observability / freeze taxonomy / correlation ID | Shipped (client) |
| R7 | `AvSyncController` (resume / seek stalled audio / drift ≥0.5s) | Class E mitigated |

Details: [`05-repairs-applied.md`](05-repairs-applied.md)

### 5. Measured soak results

| Run | Duration | Result | Notes |
| --- | --- | --- | --- |
| Chromium / Firefox / WebKit | 5 min | Pass | Authenticated |
| Chromium video | 30 min | Pass | Video stayed mounted; event-loop healthy |
| Chromium dual-audio | 3 min | Pass | Real audio buffers + sync corrections |
| Chromium dual-audio | 10 min | Pass | Sample \|drift\| ≤~0.42s; 10 corrections; event-loop max 1.5ms; 0 long tasks >200ms; freeze logs = Class E only |

Summaries:

- [`artifacts/soak-chromium-30m-valid-summary.json`](artifacts/soak-chromium-30m-valid-summary.json)
- [`artifacts/soak-chromium-10m-dual-audio-summary.json`](artifacts/soak-chromium-10m-dual-audio-summary.json)

### 6. Certification pack

Fifteen docs under [`docs/release-gate/mux-video-optimization/`](./) (`00`–`14`) plus soak artifacts. Final scorecard: **CONDITIONAL GO**.

---

## Root-cause disposition (short)

| Hypothesis | Disposition |
| --- | --- |
| Dual-HLS buffer pressure as Class C | Inconclusive / not freeze cause in lab |
| Recovery-loop thrashing | Code risk bounded (R3); not reproduced in soak |
| Mid-play token refresh skip | **Confirmed** and fixed (R1) |
| Native HLS controller leak | **Confirmed** and fixed (R2) |
| Empty audio → false Class E | **Confirmed** false positive; gated |
| True dual A/V desync | **Confirmed Class E**; mitigated (R7) |
| AMRITA WebGL + Mux | Untested isolation matrix |
| Physical thermal / Class F | Untested |

---

## Deliverables checklist

- [x] Baseline branch/tag
- [x] Player inventory + freeze taxonomy
- [x] Observability instrumentation
- [x] Authenticated smoke/soak harness + auth fixture
- [x] Multi-browser 5m soaks
- [x] 30m Chromium video soak
- [x] Dual-audio 3m + 10m soaks
- [x] Repairs R1–R7
- [x] Unit tests for TTL / recovery / A/V sync
- [x] Docs `00`–`14` + artifacts
- [x] Final CONDITIONAL GO scorecard
- [ ] Git commit of Mux-only changes (not requested)
- [ ] Physical mobile Class F soaks
- [ ] Full AMRITA / offline / fullscreen matrices
- [ ] Production telemetry sink
- [ ] Optional 30m dual-audio soak

---

## How to re-run key gates

```bash
# Unit
npm run test:mux-unit

# Auth fixture (writes gitignored web/e2e/.auth/mux-soak.env)
npm run fixture:mux-soak-auth

# Dual-audio soak (API + Vite must be up; short TTL optional)
RAYD8_MUX_STABILITY_BASE_URL=http://127.0.0.1:5173 \
RAYD8_MUX_REQUIRE_DUAL_AUDIO=1 \
RAYD8_MUX_SOAK_MS=600000 \
npm --prefix web run test:mux-stability:soak
```

---

## Release recommendation

**CONDITIONAL GO** for desktop authenticated Mux sessions if R1–R7 ship with the soak harness retained for regression. Do not claim full GO until physical mobile Class F, AMRITA isolation, offline/fullscreen coverage, and production correlation telemetry are complete.

---

## Doc index

| Doc | Purpose |
| --- | --- |
| [`00-executive-summary.md`](00-executive-summary.md) | Verdict overview |
| [`01-player-inventory.md`](01-player-inventory.md) | Surfaces / engines |
| [`02-reproduction-matrix.md`](02-reproduction-matrix.md) | Reproduce plan |
| [`03-baseline-performance.md`](03-baseline-performance.md) | Pre-repair baseline |
| [`04-root-cause-analysis.md`](04-root-cause-analysis.md) | Hypothesis disposition |
| [`05-repairs-applied.md`](05-repairs-applied.md) | R1–R7 |
| [`06`–`09`](06-mux-configuration-review.md) | Mux config, mobile, lifecycle, network |
| [`10-automated-test-results.md`](10-automated-test-results.md) | Soak/unit table |
| [`11-before-after-comparison.md`](11-before-after-comparison.md) | Metrics delta |
| [`12-known-limitations.md`](12-known-limitations.md) | Gaps |
| [`13-production-monitoring-plan.md`](13-production-monitoring-plan.md) | Telemetry plan |
| [`14-final-certification.md`](14-final-certification.md) | Scorecard |
| **This file** | Task completion report |
