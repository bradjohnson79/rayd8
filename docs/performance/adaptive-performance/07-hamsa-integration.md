# Hamsa Integration

Production: manager → `hamsa` controller → `rayd8:adaptive-performance:v1` message → internal `applyHamsaPerformanceProfile`.

`window.__HAMSA_PERF__` remains diagnostics/tests only.

Canvas sizing consumes `getHamsaRenderScale()`. Shader time uses elapsed `dt`.
