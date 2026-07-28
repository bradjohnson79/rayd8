# 00 — Executive Summary

## Verdict: **CONDITIONAL GO**

Authenticated Mux/HLS playback on RAYD8 was audited, instrumented, repaired for confirmed defects, and soak-tested across Chromium, Firefox, and WebKit. A multi-minute **browser-tab freeze (Class C)** or **full-device freeze (Class F)** was **not reproduced** on the lab host. Event-loop delay stayed low (~≤16ms; 1.5ms in the 10m dual-audio soak) with **zero** long tasks >200ms during valid Chromium soaks including a **30-minute video soak** and a **10-minute dual-audio soak**.

See [`14-final-certification.md`](14-final-certification.md) for the scorecard.

## What was wrong

1. **Mux JWT refresh never scheduled** for normal 12h tokens (code-confirmed) — fixed (R1).
2. **Native HLS path could leak hls.js controllers** — fixed (R2).
3. **Major recovery lacked hard budgets** — bounded state machine + unit regression (R3).
4. **False Class E desync alarm** when `audioTrack='none'` (default) left an empty `<audio>` — observability gated; soak harness enables a real audio track for dual-pipeline certification.
5. **True Class E desync** on dual HLS with live audio — mitigated by A/V sync corrector (R7); 10m dual soak kept sample \|drift\| ≤~0.42s with 10 corrections.
6. Local soak blocked by missing `127.0.0.1` CORS/azp — fixed for local QA (R5).

## What remains conditional

- Physical mobile / thermal Class F validation
- Complete AMRITA A–F isolation matrix and offline/fullscreen automation matrix
- Production telemetry sink wiring beyond client correlation ID helpers
- Optional 30-minute dual-audio soak (10m dual-audio complete; 30m video-only complete)

## Branch / baseline

- Branch: `audit/mux-video-optimization`
- Baseline tag: `audit/mux-baseline-c0e6796`
- Starting SHA: `c0e6796e80e7fb3bfccd140e0d3d6dd247cbe38b`
