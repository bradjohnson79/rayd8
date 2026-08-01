# Safari / macOS Certification

| Field | Value |
|------|-------|
| Hardware | Apple Silicon arm64 |
| macOS | 15.6.1 (24G90) |
| Safari | 18.6 (20621.3.11.11.3) |
| Chrome | 150.0.7871.187 |
| Power | Record at test time (plugged recommended) |

## Automated

- Chromium Playwright Amrita loop smoke: PASS
- Production build: PASS

## Manual Energy Impact protocol (required for Full GO)

Windows: idle 3m, active 5m+, pause 2m, hidden 2m, recovery 3m, long 30m.

Correlate with `__RAYD8_RUNTIME__.getTimeline()` / `__AMRITA_SOAK__.getSnapshot()`.

**This pass:** browser versions recorded; full Activity Monitor trend screenshots not attached — CONDITIONAL.
