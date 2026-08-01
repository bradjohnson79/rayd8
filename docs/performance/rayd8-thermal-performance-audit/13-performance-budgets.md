# Performance Budgets

| Budget | Baseline observed | Proposed | Justification | Final |
|--------|-------------------|----------|---------------|-------|
| Public hero still | 1.5 MB | ≤100 KB | LCP image must not dominate | **52 KB met** |
| Public route initial JS (app, excl. Clerk CDN) | Clerk chunk ~507 KB raw | ≤200 KB app-owned gzip on `/` | Marketing must stay light | Partial — app chunks OK; Clerk still large |
| Active Hamsa idle animation loops | 3 | 0 | Idle means idle | **Met** |
| Active Amrita loops when paused/hidden | 1 | 0 | Idle means idle | **Met** |
| Simultaneous Express media decoders when tab hidden | 2 | 0 | Thermal | **Met in code** |
| Canvas DPR (Amrita) | ≤1.65 | ≤1.65 | Retina bound | Met (unchanged) |
| Hamsa target FPS when running | ~60 | ≤30 | Thermal headroom | **Met** |
| Homepage LCP (prod-like) | ~5s+ | ≤2.5s | Customer load complaint | **Not met** (Clerk-bound) |
| 30-min heap growth | Unknown | ≤15% after GC | Long session | Pending measurement |
| CLS | 0.007 | ≤0.1 | UX | Met |

Do not treat Lighthouse score alone as pass/fail.
