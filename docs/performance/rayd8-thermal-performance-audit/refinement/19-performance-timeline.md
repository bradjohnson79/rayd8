# Performance Timeline

Events recorded via `recordRuntimeTimeline`:

- `load`
- `hero_decoded`
- `express_hls_create` / `express_hls_destroy`
- `stop` / `cleanup` / `idle`
- Amrita: use soak snapshots around start/pass/stop

Read: `window.__RAYD8_RUNTIME__.getTimeline()`

Example certification traces live in `artifacts/thermal-behavior-smoke.json`.
