# Module Boundaries

| Module | Responsibility |
|--------|----------------|
| `performanceSampler.ts` | Observations only |
| `adaptivePerformancePolicy.ts` | Pure tier decisions |
| `adaptivePerformanceManager.ts` | Mode, activity, profile, subscriptions |
| `runtimeControllers.ts` | Register/unregister/apply isolation |
| `runtimeResourceRegistry.ts` | Ownership evidence |

Observers, policy, preferences, dispatch, and logging are not fused into one mega-class.
