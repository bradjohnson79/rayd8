# Network / Bundle Findings

## Public homepage (production preview after repairs)

Top transfer drivers:

| Asset | Transfer |
|-------|----------|
| `/rayd8-mark.png` | ~273 KB |
| Clerk app chunk | ~149 KB (507 KB raw) |
| Clerk CDN UI | ~300+ KB combined |
| Hero `RAYD8_Hero.png` | **~52 KB** (was ~1.5 MB Premium) |
| framer-motion chunk | ~42 KB |
| CSS | ~25 KB gzip / 182 KB raw |

Lighthouse (headless Chrome, local preview): performance score **0.75**, LCP **~5.3s**, TBT **14ms**, CLS **0.007**.

## Route chunking

Public routes do **not** load Hamsa/Amrita runtime chunks (lazy member routes only). Confirmed in router audit.

## Remaining load work

- Compress `/rayd8-mark.png`
- Defer/lazy Clerk UI on logged-out marketing where possible
- Optional: further CSS split
