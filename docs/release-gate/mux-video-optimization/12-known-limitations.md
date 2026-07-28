# 12 — Known Limitations

## Tooling limitations

- Playwright emulated browsers only; no BrowserStack/physical device farm in this environment.
- `performance.memory` / GPU-process pressure not uniformly available.
- Long-task observer depends on Chromium `PerformanceObserver` longtask support.

## Browser API limitations

- Native HLS (WebKit / some Chromium paths) does not expose hls.js level/bitrate APIs.
- `requestVideoFrameCallback` coverage varies; decode metrics rely on `getVideoPlaybackQuality()` when present.

## Missing physical-device coverage

- Class F thermal / OS kills require real phones/tablets.
- HW acceleration on/off comparison not executed.

## Product limitations

- Combined A/V asset map empty — dual pipeline remains default; combined path not auto-preferred (compatibility gate).
- Looping video + continuous bed audio are not a single timeline; sync corrector skips loop wraps.

## Unresolved / residual defects

- Harness session exit does not always unmount media (afterExit counts).
- Full offline/fullscreen/orientation/AMRITA isolation matrices incomplete.
- Physical mobile Class F (thermal / OS kill) not executed.
- Dual-audio 30-minute soak not run (10m dual-audio + 30m video-only complete).
- Class E `av_desync` threshold crossings still accumulate in long dual soaks even while sample drift stays bounded — expected while corrector works; not Class C.
- Production correlation telemetry wiring is planned (see monitoring plan) but not fully shipped as a backend sink in this milestone.
