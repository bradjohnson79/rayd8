# 05 — Retry Semantics

| Action | Backend session | Media pipeline |
|---|---|---|
| Restart Playback | Preserved | Destroy controller, clear source, new token fetch, `forceReload` |
| Reload Session | `endSession` then new `startSession` | Full remount |
| Return Home | `endSession` | Unmount |

Identity proofs: `mediaController.forceReload.test.ts`, engine source invariants.
