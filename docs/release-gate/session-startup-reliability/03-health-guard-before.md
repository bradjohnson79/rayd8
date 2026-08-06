# 03 — Health Guard Before

Source: `web/src/features/rayd8-player/usePlaybackHealthGuard.ts` at baseline `a8ecb87`.

| Topic | Before |
|---|---|
| Start condition | `enabled: !activeSoftDenialState` on player mount |
| Timeout start | Immediately when effect runs (concurrent with token/media) |
| Soft / hard | 5s soft recovery (`play` retry); 9s hard `failed` |
| Healthy predicate | video present, `!paused`, `readyState >= HAVE_CURRENT_DATA`, `videoWidth > 0`, `currentTime > 0.5` |
| Reset | `resetKey` / `reset()` / effect cleanup |
| Retry | bumps `initRetryKey`; may reuse HLS if same URL |
| Hidden page | Guard does not pause; mobile lifecycle may pause media → false fail |
| Autoplay | `play_failed` → soft recovery → hard fail |
| Audio-only | Cannot satisfy (requires videoWidth) |
| Dual-stream | Video-only predicate |
| Native / hls.js | Same predicate |
| Strict Mode | DEV double effect; timers cleaned on unmount |
