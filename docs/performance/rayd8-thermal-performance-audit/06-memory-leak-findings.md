# Memory Leak Findings

## Static

- Hamsa WebGL now loses context on unmount (reduces retained GPU memory across route cycles)
- Amrita `stopSequence` already cancelled rAF; pause path now also hard-stops
- Player visibility pause reduces decoder residency while hidden

## Runtime soak status

| Test | Status |
|------|--------|
| 10× start/stop static policy regression | PASS (`test:thermal-regression`) |
| 5 / 15 / 30 min heap plateau | **Not completed** this pass |
| Playwright Hamsa/Amrita lifecycle | **Not completed** (policy unit + static gates only) |

Residual risk: SessionProvider + HLS controller accumulation across many sessions should be re-measured with Chrome heap snapshots before GO.
