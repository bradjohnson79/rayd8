# 03 — Baseline Performance (Pre-Repair)

**Branch:** `audit/mux-video-optimization`  
**Baseline tag:** `audit/mux-baseline-c0e6796`  
**Starting SHA:** `c0e6796e80e7fb3bfccd140e0d3d6dd247cbe38b`  
**Captured:** 2026-07-28

## Environment

| Item | Value |
| --- | --- |
| Node | v22.18.0 |
| npm | 10.9.3 |
| hls.js | 1.6.16 |
| @mux/mux-node | 14.0.1 |
| Playwright | 1.61.1 |
| Frontend Mux Player SDK | not present |

Artifact: [`artifacts/baseline-env.txt`](artifacts/baseline-env.txt)

## Architecture baseline (pre-measurement)

Live Mux path is **signed HLS** via `hls.js` or native HLS — not `@mux/mux-player`.

Typical member session uses:

- `Rayd8PlayerEngine` → muted looping `<video>`
- `GlobalAudioRail` → separate `<audio>` HLS pipeline
- Dual MSE buffers on desktop (`backBufferLength: 90`, `maxBufferLength: 40`, `maxMaxBufferLength: 120`)

## Pre-repair static findings (hypotheses remain UNTESTED until soak evidence)

| Finding | Status | Notes |
| --- | --- | --- |
| Mux JWT refresh never scheduled when TTL > 30m | **CONFIRMED (code)** | `MUX_*_REFRESH_MIN_DELAY_MS` skipped scheduling entirely for 12h tokens |
| Native HLS path left prior hls.js controller alive | **CONFIRMED (code)** | `setMediaSource` assigned `media.src` without destroying controller |
| Dual-HLS buffer pressure as freeze cause | UNTESTED | Needs sustained soak |
| Recovery-loop thrash as freeze cause | UNTESTED | Needs soak + recovery counters |
| CSS brightness compositing as freeze cause | UNTESTED | Needs A/B compositing matrix |
| AMRITA WebGL+audio concurrency as freeze cause | UNTESTED | Needs AMRITA isolation matrix |

## Instrumentation available at baseline

- `window.__RAYD8_PLAYER_DEBUG__` (gated)
- Soak metrics in `playbackSoakMetrics.ts`
- Extended observability added in this milestone (responsiveness, decode, A/V drift, freeze class)

## Pre-repair timed soak

Timed authenticated soak results are recorded after fixture + harness execution under `artifacts/`. This document freezes the starting SHA and package versions before those runs and before behavioral repairs land in the same branch.
