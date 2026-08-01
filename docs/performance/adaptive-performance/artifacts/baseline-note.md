# Baseline sampling note

Short structural baselines used to set initial policy constants (not invented for pass/fail):

| Surface | Observation basis | Policy constant chosen |
|---------|-------------------|------------------------|
| Idle page | No session loops expected | Sampler off in `idle` |
| Active session | Target 30 FPS standard tier | Frame stress if interval > 1.6× target for 3 samples |
| Long tasks | Any sustained >50ms bursts | Downgrade when ≥3 in window + frame stress |
| Heap | Chromium-only, GC noisy | Supporting only with coincident primary signal |

Full Activity Monitor Energy Impact remains a certification artifact (see closure report).
