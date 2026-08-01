# Backend / Database Latency Findings

Primary customer complaint maps more strongly to **frontend thermal + marketing LCP** than API wait.

Relevant frontend→API pressure:

- Usage heartbeat every 30s during sessions (now visibility-gated)
- Dashboard usage poll 15s when idle (already visibility-aware)
- Token refresh storms mitigated by restoring Clerk cache

No production DB query plan changes in this pass. Residual: measure `/api` subscription lookups under logged-in cold start separately if support tickets persist after thermal merge.
