# Adaptive Performance — Executive Summary

| Field | Value |
|------|-------|
| Branch | `feat/rayd8-adaptive-performance` |
| Base tip | `53336bc` (Full-GO refinement) |
| Clean cert SHA | `da93733` |
| Modes | Automatic / Standard / Reduced |
| Profile | `EffectivePerformanceProfile` v1 |
| Verdict | See `ADAPTIVE-PERFORMANCE-REPORT.md` |

## What shipped

Separated **sampler → policy → manager → controllers**. Presentation cost adapts; RAYD8 protocol clocks do not.

## Non-goals preserved

No protocol/timing/glyph/two-pass changes; no heap-alone downgrades; no mega-manager; GPU visual stress ≠ media network stress.
