# 14 — Final Certification Scorecard

| Area | Result | Evidence |
|---|---|---|
| Failure taxonomy | Pass | sessionStartupTaxonomy |
| User-facing error distinction | Pass | StartupRecoveryOverlay |
| Incident stage snapshot | Pass | sessionStartupTelemetry |
| Telemetry redaction | Pass | sanitize tests |
| Health-guard start semantics | Pass | mediaOwned gating |
| Hidden-page behavior | Pass | PAUSED_HIDDEN |
| Offline behavior | Pass | PAUSED_OFFLINE |
| Autoplay-pending behavior | Pass | WAITING_FOR_AUTOPLAY |
| Video-only health | Pass | predicate |
| Audio-only health | Pass | predicate |
| Dual-stream health | Pass | predicate |
| Fresh playback retry | Pass | forceReload |
| Media-controller cleanup | Pass | destroy on restart |
| Session-end delivery | Pass | keepalive unload |
| Session-end idempotency | Pass | endedAt short-circuit |
| Page-exit fallback | Pass | pagehide handler |
| Stale-session classification | Pass | isHeartbeatStale |
| Reconciliation dry run | Pass | sessions:reconcile |
| Second-session cleanliness | Pass (static) | Reload new session; Restart preserves |
| Final readiness | **CONDITIONAL GO** | Live auth/Brave gaps |

**Final clean SHA:** `af97d0be0cb89ac3ead058a9c16f630aa2197c02`  
**Baseline tag:** `baseline/session-startup-reliability-pre` (`a8ecb87`)

## Answers

1. Original screenshot path = playback-health hard fallback after mount.  
2. Same screen no longer collapses init vs media vs access — soft denial and init overlays are distinct; media-start has distinct copy.  
3. Health timer begins after mediaOwned + sourceApplied (+ not paused).  
4. Paused when hidden/offline/autoplay/intentional pause/ending/replacing/token refresh/metadata not ready.  
5. Autoplay → WAITING_FOR_AUTOPLAY; hidden → PAUSED_HIDDEN with fresh re-arm on visible.  
6. Audio-only: audio progress; dual: video (+ audio if required); combined: video predicate.  
7. Yes — destroyPrimaryVideoPipeline + forceReload.  
8. Yes — Restart Playback does not call startSession.  
9. Yes — Reload ends and starts new backend session.  
10. No — duplicate end short-circuits on endedAt.  
11. pagehide keepalive fetch; reconcile covers leftovers.  
12. last_heartbeat older than threshold (default 60m).  
13. No — soft reconcile + non-blocking start.  
14. Yes — stage/code/reference via telemetry.  
15. Yes — redaction tests.  
16. Static/unit proven; live auth CONDITIONAL.  
17. CONDITIONAL GO for release with operator dry-run reconcile before broad apply.
