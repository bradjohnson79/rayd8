# 03 — Session Startup Failure Trace

## Central question (locked)

**Did the session fail to start, or did the session start successfully and then get mislabeled as a startup failure because the playback-health guard did not observe the expected media state?**

## Screenshot locus (confirmed)

| Item | Value |
|---|---|
| Component | `PlaybackHealthFallbackOverlay` |
| File | `web/src/features/rayd8-player/PlayerSessionStatusOverlays.tsx` |
| Mount gate | `playbackHealthFallbackVisible && !activeSoftDenialState` in `Rayd8PlayerEngine.tsx` |
| Copy | "Trouble Starting Your Session" / "We're having trouble initializing your session." |
| Sibling | `initFailureVisible` → "Unable to initialize session." (different overlay) |

**Verdict on locus:** The screenshot is the **playback-health fallback**, not the hard `initFailureVisible` path. Classification as a backend session-create failure is **not justified by the UI alone**.

## Stage ordering (member start)

1. `getTokenSafe` + `GET /v1/player/access` (dashboard, pre-mount)
2. `SessionProvider.startSession` → client `isActive=true` (no server call inline)
3. `Rayd8SessionOverlay` mounts `Rayd8PlayerEngine`
4. **Concurrent effects:**
   - `POST /v1/player/session/start` (`beginTracking`)
   - `GET /v1/player/playback-token` → `setMediaSource` → readiness → `play()`
   - `usePlaybackHealthGuard` armed immediately when `!activeSoftDenialState` (0ms reset, 500ms poll, 5s soft, 9s hard)

**Overlay vs backend session creation:** The health-fallback overlay can appear **after** client session activation and **independent of** `/session/start` success. Static ordering proves the overlay is **not** proof that `/session/start` failed. When the overlay appears after a successful token + source attach, classify as **playback-health failure**, not initialization/session-create failure.

## Stage table at overlay time (health-fallback path)

| Stage | Typical status when health overlay shows | Evidence basis |
|---|---|---|
| Authentication | Success (or soft-denial would suppress overlay) | Soft denial bypasses health overlay |
| Access and entitlement | Success (dashboard gated) / or soft-denied later | Pre-mount access; token restrictions → soft denial |
| Backend session creation (`/session/start`) | **Unknown / often Success** | Not awaited by player init; may succeed while media unhealthy |
| Player mount | **Success** | Overlay only renders inside mounted engine |
| Mux token generation | Success or Failure | Failures more often → `initFailureVisible` or soft denial; delayed token can still trip health |
| Media source assignment | Success or Failure | `media_source_not_applied` → soft recovery then hard fallback |
| Media readiness events | **Failure / Incomplete** | Guard requires playing + `videoWidth>0` + `currentTime>0.5` |
| Playback-health guard observation | **Failure** | `status === 'failed'` after 9s |

## Classification taxonomy

1. **Access denial** — auth/entitlement soft denial or dashboard block; health overlay suppressed when `activeSoftDenialState`.
2. **Initialization failure** — `initFailureVisible` (missing video element; catch-all after token/source errors without soft denial).
3. **Playback-health failure** — path advanced into mounted player; guard did not observe healthy video within 9s → screenshot overlay.

## Paths that feed health soft-recovery (then hard fallback)

From `Rayd8PlayerEngine.tsx`:
- `reportPlaybackStartupFailure('media_source_not_applied')`
- `reportPlaybackStartupFailure('playback_not_ready')`
- `reportPlaybackStartupFailure('play_failed')`
- Timer-only: 9s without `isVideoPlaybackHealthy`

`reportStartupFailure` only logs + runs soft recovery; UI hard fallback is timer-driven.

## Health-guard timer / reset semantics (observe-only)

| Topic | Behavior |
|---|---|
| When timing starts | Effect runs when `enabled` (`!activeSoftDenialState`); deps include `resetKey` |
| Healthy mark | `!paused && readyState>=HAVE_CURRENT_DATA && videoWidth>0 && currentTime>0.5` |
| Soft recovery | 5s → `onSoftRecovery` = muted `play()` retry ×2 |
| Hard fallback | 9s → `status='failed'` → overlay |
| Resets | `reset()`; effect cleanup clears timers; `resetKey` change re-arms |
| `resetKey` | `${sessionType}:${videoMode}:${audioTrack}:${initRetryKey}` |
| Backgrounding | Guard itself has **no** visibility pause; mobile lifecycle may pause media → can prevent healthy predicate |
| Autoplay block | `play_failed` / paused video fails healthy check → soft then hard |
| Audio-only | **Cannot** satisfy guard (video-only predicate; no audio element inspection) |
| Native HLS vs hls.js | Same healthy predicate; readiness sequence differs in `setMediaSource` / `waitForPlaybackReady` |
| Token refresh | Mux refresh does **not** change `resetKey`; does not intentionally restart health timer |
| Retry clears | Try Again: clear init UI + `resetPlaybackHealth` + bump `initRetryKey` → effect cleanup + new timers |
| Old timers survive? | Cleanup clears soft/hard/poll on effect teardown; Strict Mode double-mount cleans first lifecycle |
| React Strict Mode | `main.tsx` wraps app in `<StrictMode>` → DEV double effect mount/unmount; timers cleaned on unmount |

## Before vs after backend session creation

**Answer:** The screenshot overlay appears **after client session start and player mount**. It is **not sequenced after a confirmed `/session/start` failure**. Backend session creation commonly **already succeeded or is in flight** when the health overlay shows. Treat the screenshot as **post-create / post-mount playback-health mislabel** unless stage evidence shows earlier failure.
