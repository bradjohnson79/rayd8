# 09 — Network Resilience and Token Expiry

## Token expiry (controlled)

| Case | Status |
| --- | --- |
| Short TTL enabled for local soak (`MUX_PLAYBACK_TOKEN_TTL_MINUTES=3`) | Implemented |
| Refresh scheduled ahead of expiry | Fixed (R1) |
| Refresh uses pause + restore time | Implemented |
| Bounded refresh failures | Max 3 |
| Tokens redacted from artifacts | Yes |
| Offline during refresh | Residual dedicated case |

## Closure offline matrix (dual-HLS Chromium)

Artifact: `artifacts/final-closure/closure-offline-dual-3m-summary.json`

| Scenario | Result |
| --- | --- |
| Offline 10s → online | Pass — video mounted; position preserved |
| Offline 30s → online | **Residual** — `afterVideos: 0` (video unmounted) |
| loadSource storm | Not observed across offline steps |

## Soak evidence

Short-TTL soaks show expected `loadSource` / token refresh counts without Class C unresponsiveness. 30m dual recorded 19 token refreshes under 3-minute TTL.

## Residual

Harden offline ≥30s so the player remains mounted or restores without full session teardown. This residual contributes to **CONDITIONAL GO**.
