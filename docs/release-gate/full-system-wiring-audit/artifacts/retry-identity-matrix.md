

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

