# Performance Budgets (Executable)

Run: `npm run test:thermal-budgets` (CI FAIL on breach).

| Gate | Threshold | Rationale |
|------|-----------|-----------|
| Hero still | ≤100KB | LCP |
| Brand mark | ≤80KB | Top transfer after hero fix |
| Hamsa lazy WebGL | ensureGl gated | Idle means idle |
| Amrita paused loops | activeVisualLoops API + hard-stop | Thermal |
| Hidden media pause | enabled isActive | MacBook tab hide |
| Runtime registry/controllers | present | Platform durability |
| Public isolation | Landing no Hamsa/Amrita runtime | Bundle |

Measured: hero 52700, mark 65396 — PASS.
