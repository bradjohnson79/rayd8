# Phase 9 — AvSyncController Design Review

**Controller:** `web/src/features/rayd8-player/avSyncController.ts`  
**Review date:** 2026-07-28  
**Evidence:** Phase 1 Chromium 5m dual soak (`phase1-chromium-5m-sync.json`)

## Questionnaire answers

| Question | Answer |
| --- | --- |
| Authoritative clock | **Video** master; audio seeked to `video.currentTime` |
| Why drift reaccumulates | Independent HLS clocks + occasional audio stall/pause; looping video wraps skipped |
| Correction methods | `audio.play()` resume; seek stalled audio; seek when in correction band — **no** playbackRate, **no** source reload |
| Symmetric? | No — audio corrected toward video only |
| Hysteresis | **Yes (closure refine)** — enter at 0.5s, release at 0.25s |
| Startup sync separated? | **Yes** — `startupGraceMs` default 8s |
| Buffering excluded? | **Yes** — `seeking` / `readyState < 2` → `media_not_ready` |
| Background excluded? | **Yes** — `document.hidden` → `document_hidden` |
| Token refresh pause | Engine `systemPausedRef` still gates reconcile callers |
| Overlap / bounds | Cooldown 2.5s; max 12 corrections/minute |
| Reset on route exit | New controller per engine mount; `reset()` available |

## Phase 1 measured behavior (5m dual)

- Corrections: **4** in 5 minutes (mostly stall/seek/resume)
- Sample \|drift\| max: **0.36s**
- Interpretation: **normal_bounded_drift_management**
- Event-loop max: ~2.3ms; long tasks >200ms: 0

## Closure refinements applied

1. Hysteresis (`thresholdSeconds` / `releaseThresholdSeconds`)
2. Startup grace window
3. Pause during seeking / low readyState / hidden document
4. Slightly stricter rate budget (12/min, 2.5s cooldown)
5. No playback-rate micro-adjust (deferred — audible risk)

## Acceptance

R7 remains the dual-HLS sync strategy. Prior ~10 corrections / 10 minutes is consistent with **bounded drift management**, not an unresolved timing bug, once empty-audio false positives are excluded and hysteresis/grace are active.
