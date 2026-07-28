# 11 — Before / After Comparison

## Chromium authenticated dual pipeline

| Metric | Before repairs | After R7 (10m) | Closure 30m dual |
| --- | --- | --- | --- |
| Event-loop max | ~13ms | 1.5ms | **~12.7ms** |
| Long tasks >200ms | 0 | 0 | **0** |
| Steady avg \|drift\| | →278s (or false empty audio) | ≤0.42s sample | **~0.21s** |
| Corrections / 5m | 0 / runaway | ~10 / 10m | **5–7** |
| Rising correction rate | n/a | n/a | **No** |
| Class C freezes | Not seen | Not seen | **Not seen** |
| Token refresh | Never (12h) | Scheduled | 19 refreshes @ 3m TTL |

## Interpretation

Closure confirms dual-HLS sync is **bounded drift management**, not runaway desync. Loop-wrap samples can spike raw drift; harness excludes abs >30s from budgets.
