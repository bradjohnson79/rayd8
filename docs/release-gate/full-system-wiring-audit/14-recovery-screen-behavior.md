# 14 — Recovery Screen Behavior

## Buttons on PlaybackHealthFallbackOverlay

| Button | Handler | Effect |
|---|---|---|
| Try Again | `handleRetryInitialization` | Clear init failure UI + video error; `resetPlaybackHealth()`; `initRetryKey++` → re-run sync effect + re-arm health timers. **Same** client session; **no** new `/session/start`. |
| Reload Session | `handleReloadSession` | `onClose()`/`endSession` then rAF `startSession(...)`. **New** server session UUID. Full unmount/remount. |
| Return Home | `onClose` → `endSession` | Tear down overlay/engine/audio; best-effort `/session/end`. |

## Retry freshness via identities

| Identity | Try Again | Reload Session |
|---|---|---|
| New HTTP request for token | Yes (effect re-runs `fetchPlaybackPayload`) | Yes (new mount) |
| New AbortController | Yes (new preload controller in effect) | Yes |
| New playback token | Yes (refetch) unless cache somewhere (none in client helper) | Yes |
| New session ID | **No** | **Yes** (`randomUUID` server-side) |
| New player instance | No (same React tree) | Yes (remount) |
| New HLS controller | Only if `setMediaSource` destroys/recreates; **may reuse** if same URL/profile | Yes (unmount destroy) |
| Cleared prior error | Yes | Yes (unmount) |
| Cleared health timers | Yes (effect cleanup + resetKey) | Yes (unmount) |
| Correlation ID | Client observability ID local only; **not** sent on API | Same |

## Accidental reuse risks (Try Again)

- Same tracked `session.id`
- Possible HLS controller reuse when `currentSource === sourceUrl`
- No abort of in-flight `apiRequest` fetches (no signal) — stale responses guarded by local `requestId` / `cancelled`
- Rejected promises from prior run ignored if `cancelled`
- Expired token: refetch should get new token if Clerk token still valid

## Return Home cleanliness

Unmount destroys HLS + resets media; SessionProvider clears tracking and fires finalize asynchronously (**not awaited**). Explains stale DB open sessions.
