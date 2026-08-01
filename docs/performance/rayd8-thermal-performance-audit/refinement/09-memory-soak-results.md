# Memory Soak Results

## Completed in this pass

- Amrita behavioral lifecycle smoke (start/pause/resume/double-start/stop/hide) — PASS (`artifacts/thermal-behavior-smoke.json`)
- Amrita 10× start/pause/resume/stop cycles — PASS (`artifacts/amrita-10cycle-lifecycle.json`); `finalLoopsZero=true`, no measured heap growth in Chromium `performance.memory` samples
- Production build clean — PASS

## Protocol for 5/15/30m (operators)

Use production preview + Activity Monitor / Safari Web Inspector:

1. Record heap at t=0, mid, end
2. Force GC where available
3. Assert plateau (not monotonic growth)
4. After stop: `activeVisualLoops=0`, Hamsa contexts=0 after navigate-away

## Status

Full instrumented 30-minute heap plateau artifacts for Hamsa + Amrita are **pending physical soak windows**. Automated loop invariants passed; long-session Energy/heap certification remains a Full-GO blocker (see closure).
