# 07 — Mobile Device Review

## Emulated coverage

| Viewport / engine | Result |
| --- | --- |
| Chromium desktop | Authenticated 5m+ soaks complete |
| WebKit desktop (native HLS path) | Authenticated soak complete |
| Firefox desktop | Authenticated soak complete |
| Mobile viewport automation | Included in older shell regression; dedicated long mobile soak residual |
| Physical iPhone / Android | **Not available** — residual risk for Class F thermal/device kills |

## Capability notes

- Prefer capability detection over UA sniffing (existing mobile playback refactor flag).
- Mobile stability profile already uses tighter buffers and `startLevel: 1`.
- AMRITA pauses visual runtime on `visibilitychange` when document hidden.
- Plays-inline / wake-lock paths exist in `useWakeLock` / `useMobilePlaybackLifecycle`.

## Residual mobile risks

1. Physical thermal degradation under dual decode + overlays.
2. iOS fullscreen / orientation remount edge cases.
3. Native HLS instrumentation gaps vs hls.js level metrics.
