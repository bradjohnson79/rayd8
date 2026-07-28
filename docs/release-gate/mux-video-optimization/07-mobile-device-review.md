# 07 — Mobile Device Review

## Emulated coverage

| Viewport / engine | Result |
| --- | --- |
| Chromium desktop | Phase 1 + 30m dual pass |
| WebKit desktop (native HLS) | Phase 1 5m dual pass |
| Firefox desktop | Phase 1 5m dual pass |
| Mobile viewport (`RAYD8_MUX_MOBILE_VIEWPORT=1`) | Harness support added |
| Physical iPhone / Android | **Unavailable** — see `artifacts/final-closure/physical-mobile/UNAVAILABLE.md` |

## Capability notes

- Prefer capability detection over UA sniffing.
- Mobile stability profile already uses tighter buffers and `startLevel: 1`.
- AMRITA pauses visual runtime on `visibilitychange` when document hidden.

## Residual

Physical thermal / Class F validation required for full **GO**.
