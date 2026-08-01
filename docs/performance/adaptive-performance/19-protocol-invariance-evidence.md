# Protocol Invariance Evidence

| Check | Evidence |
|-------|----------|
| Amrita elapsed clock | `getSessionElapsedMs` uses start + pause accumulation |
| Adaptive apply does not touch clock fields | `applyAmritaAdaptiveProfile` contract test |
| Hamsa visual time | `elapsedTimeRef += dt` while playing; draw cadence gated separately |
| Render scale | Canvas buffer size only |

Commands:

```bash
npm --prefix web run test:adaptive-units
```
