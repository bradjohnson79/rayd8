# Adaptive Controller Interfaces

Types: `AdaptiveRuntimeController` in `runtimeControllers.ts`.

| Surface | Methods |
|---------|---------|
| Hamsa | `__HAMSA_PERF__`: setRenderFPS, setRenderScale, pauseRendering, resumeRendering, dispose, status |
| Amrita | `__AMRITA_SOAK__`: same shape |
| Express | pause/resume/dispose via playback authority + endSession cleanup |

Visual Performance Reduced calls `applyReducedVisualPerformance()` (FPS 20, scale 0.75) without changing session timing.

No full Adaptive Manager in this milestone — interfaces only.
