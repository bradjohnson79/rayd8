# 06 — Session-End Reliability

Client:
1. Standard authenticated `endPlaybackSession` while active
2. `pagehide` → keepalive `fetch` with Authorization
3. sendBeacon not used as sole auth path (API requires Bearer); server reconcile covers abandonments

Server: `endUsageSession` returns early when `endedAt` set — no extra usage seconds; still deletes `active_sessions`.
