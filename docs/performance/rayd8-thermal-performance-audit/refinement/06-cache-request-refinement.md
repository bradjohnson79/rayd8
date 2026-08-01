# Cache / Request Refinement

- Default `getToken()` uses Clerk cache.
- `getTokenSafe({ forceRefresh: true })` is the only `skipCache` path.
- Heartbeat skips when `document.hidden`.
- No remaining blanket `skipCache: true` on readiness.
