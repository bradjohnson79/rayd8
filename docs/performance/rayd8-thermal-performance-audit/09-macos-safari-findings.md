# macOS / Safari Findings

## Environment

Audit host is Apple Silicon MacBook-class (arm64, macOS 15.6.1). Automated evidence in this pass is **Chromium headless Lighthouse** + static/source verification.

## Safari-specific risks addressed in code

- Retina WebGL: Hamsa no longer multiplies idle full-screen redraw; Amrita already caps DPR
- Hidden tab decoding: desktop visibility pause now applies (critical for Safari energy impact)
- CSS `filter: brightness` on video removed by default (Safari compositing cost)

## Still required before GO

- Manual Safari Web Inspector: Hamsa idle Energy Impact before/after START
- Activity Monitor: browser process CPU/GPU during Amrita pause + Express tab-hide
- Battery vs plugged comparison

Until those are captured, verdict remains **CONDITIONAL GO**.
