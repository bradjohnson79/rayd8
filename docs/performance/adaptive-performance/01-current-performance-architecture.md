# Current Performance Architecture (Baseline)

| Field | Value |
|------|-------|
| Branch start | `feat/rayd8-adaptive-performance` from `53336bc` |
| Prior Full-GO cert | `4f50b51` |
| Host | Apple Silicon arm64, macOS 15.6.1 |
| Recorded | 2026-08-01T18:26:07Z |

## Existing scaffolding (Full-GO)

- User modes Automatic / Standard / Reduced — `visualPerformancePreference.ts`
- Sidebar selector — dashboard
- Controller contract stubs — `runtimeControllers.ts` (previously unregistered)
- Registry + admin snapshot — `runtimeResourceRegistry.ts`
- Hamsa probe — `hamsaPerfProbe.ts` / Amrita `__AMRITA_SOAK__`
- Landing heuristics only (no runtime feedback loop)

## Timing

- Amrita: elapsed-time session clock (`getSessionElapsedMs`)
- Hamsa Aura: elapsed `dt` for shader time; frame gate for draw cadence

## Adaptive initiative gap

No sampler → policy → manager loop. Controllers not registered. This initiative closes that gap.
