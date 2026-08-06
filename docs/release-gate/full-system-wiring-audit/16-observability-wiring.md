# 16 — Observability Wiring

## What exists

- `logExpressPlaybackDebug` events (`health_hard_fallback`, `init_retry_tapped`, `health_reload_session`, etc.)
- `playbackObservability` local correlation IDs (not on API requests)
- Umami events including `mux_playback_incident`, `start_session`
- Server session UUID in DB

## Gaps vs support needs

| Need | Gap |
|---|---|
| Tie screenshot to stage | Overlay copy does not expose failure class (health vs init vs access) |
| Cross-service trace | No API correlation header |
| Distinguish `/session/start` success at overlay time | Not logged into the overlay; concurrent |
| Customer Brave blocks | No first-class blocked-by-client telemetry in UI |
| Stale sessions | DB shows mass open rows; limited ops alerting documented here |

**Support cannot reliably determine the real cause from current user-visible UI alone.** Debug logs help if the user can capture console around `health_hard_fallback`.
