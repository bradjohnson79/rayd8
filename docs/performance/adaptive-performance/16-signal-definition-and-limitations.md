# Signal Definition and Limitations

## Primary signals

| Signal | Use | Notes |
|--------|-----|-------|
| Frame interval vs target | Sustained delay → downgrade | Requires ≥3 samples |
| Long tasks | Burst count in window | PerformanceObserver when present |
| Buffering | Media path | Feeds media policy more than GPU tier |
| Registry growth | Supporting primary | Registered resources only |
| Visibility | Freeze recovery while hidden | Visual pause only |

## Supporting

| Signal | Rule |
|--------|------|
| Heap (`performance.memory`) | Never alone; Chromium-only; GC noise |
| Battery / connection / deviceMemory | Optional Automatic bias only; never required |

## Missing APIs

No PerformanceObserver / memory / connection / battery → Automatic remains functional with conservative defaults. Standard is **not** auto-reduced solely for missing optional APIs.
