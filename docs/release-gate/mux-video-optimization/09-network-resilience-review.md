# 09 — Network Resilience and Token Expiry

## Token expiry (controlled)

| Case | Status |
| --- | --- |
| Short TTL enabled for local soak (`MUX_PLAYBACK_TOKEN_TTL_MINUTES=3`) | Implemented |
| Refresh scheduled ahead of expiry | Fixed (R1) |
| Refresh uses pause + restore time | Implemented |
| Bounded refresh failures | Max 3 |
| Tokens redacted from artifacts | Yes |
| Staggered A/V expiry matrix | Partial — both rails share TTL helper; dedicated stagger test residual |
| Offline during refresh | Residual automated case |

## Soak evidence

Chromium short-TTL soak recorded `loadSourceCount: 4` over ~5 minutes without Class C unresponsiveness. Refresh no longer depends on the broken “only if <30m remaining” gate.

## Player recovery vs network

Major recovery is budgeted (R3). Infinite `loadSource` / HLS recreate storms fail unit regression (`test:recovery-machine`).
