# Amrita Refinement

## Loop invariants (behavioral smoke)

| Case | Result |
|------|--------|
| Idle | activeVisualLoops = 0 |
| Running | = 1 |
| Paused | = 0 |
| Resumed | = 1, resumeCount ≥ 1 |
| Double start | still 1 |
| Stopped | = 0 |
| Hidden while running | pauses → 0 |

## Controllers

`__AMRITA_SOAK__` now includes setRenderFPS/setRenderScale/pauseRendering/resumeRendering/dispose/status.

## Two-pass

No timing/protocol changes. Dual-pass sequencing unchanged.
