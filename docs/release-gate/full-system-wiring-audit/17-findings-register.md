# 17 — Findings Register

| ID | Severity | Confidence | Finding | Evidence | Recommended repair (later) |
|---|---|---|---|---|---|
| SESSION-001 | High | High | Health-fallback overlay copy mislabels playback-health failure as session startup failure | `PlaybackHealthFallbackOverlay` + `usePlaybackHealthGuard` 9s failed | Separate copy/telemetry by failure class |
| SESSION-002 | High | High | Health timers start concurrent with token/media; not gated on `/session/start` | Effect ordering in SessionProvider + engine | Optionally gate health on media pipeline start; do not change in this audit |
| SESSION-003 | High | High | Healthy predicate requires `videoWidth>0` + `currentTime>0.5` — audio-only cannot pass | `isVideoPlaybackHealthy` | Product-specific healthy predicates |
| SESSION-004 | Medium | High | Try Again does not create new session ID; may reuse HLS controller for same URL | `handleRetryInitialization` + `setMediaSource` short-circuit | Documented; consider force recreate on retry |
| SESSION-005 | Medium | High | `/session/end` finalize is async fire-and-forget | `endSession` | Await/beacon end; reconcile stale opens |
| DB-001 | High | High | ~4.6k stale open usage/active sessions (heartbeat >1h) | Neon aggregates artifact | Cleanup job + end-session reliability |
| DB-002 | Medium | High | 354 users with multiple active_sessions | Aggregates | Concurrent-device policy review |
| AUTH-001 | Medium | High | Clerk UI vs API token split-state possible | Auth wiring | Surface API auth failure distinctly |
| ENT-001 | Medium | High | Clerk metadata vs DB plan disagreement can block product UX | Support pattern + Amrita gate | Prefer `/v1/me` plan; sync metadata |
| API-001 | Medium | High | `apiRequest` lacks timeout/AbortSignal/correlation ID | `services/api.ts` | Add signal + correlation |
| OBS-001 | High | High | Support cannot classify screenshot from UI | Overlay + missing stage fields | Structured incident codes in UI/telemetry |
| BRAVE-001 | Medium | Medium | Third-party Umami block expected under Shields; must stay noncritical | umami.ts + Shields behavior | Keep noncritical; document |
| BRAVE-002 | Medium | Low-Med | Media CDN blocked by aggressive Shields would present as health failure | Policy table | Detect blocked media; distinct copy |
| AMRITA-001 | Low | High | No session postMessage protocol; auth via parent Clerk object | AmritaRoutePage + audio-layer | Optional formal handshake (future) |
| TELEMETRY-001 | Low | High | Umami cannot block startup | umami.ts | None |

Production code was **not** changed to fix these findings (audit-only).
