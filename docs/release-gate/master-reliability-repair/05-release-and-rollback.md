# Release and Rollback

## SHAs

| Purpose | SHA | Subject |
|---------|-----|---------|
| Repair | `f4ace84` | fix(player): master reliability repair for session startup + usage accounting |
| Smoke infra | `efd5d8c` | test(reliability): full-system smoke orchestrator + hermetic server entry guard |

Branch: `fix/rayd8-master-reliability`

## Deploy order

The API and web changes are designed to be safe in either order, but the
recommended order is **API first, then web**:

1. **API (`f4ace84`)** — adds optional `sessionId` / `mediaQualified` fields and
   the correlation-ID echo. All new request fields are optional, so the current
   web client continues to work against the new API. Usage accrual becomes
   fail-closed: a missing `mediaQualified` is treated as unqualified, so until
   the new web client ships, trial usage accrues conservatively (less, not
   more). This is the safe direction.
2. **Web (`f4ace84`)** — begins sending `sessionId` and `mediaQualified`,
   enabling idempotent session start and accurate media-qualified accrual.

> Note: because the API fails closed on a missing `mediaQualified`, deploying
> API without web means trial usage is under-reported (heartbeats accrue 0)
> until the web client ships. Deploy web promptly after API. The reverse order
> (web first) is also safe: the current API ignores the extra fields.

## Rollback

- **Web:** revert to the prior Vercel deployment. The web changes are
  additive/defensive; rolling back restores prior behavior.
- **API:** revert `f4ace84` (and `efd5d8c` if deployed). The API changes are
  backward-compatible (all new fields optional), so a rollback does not strand
  the current web client.
- No database migrations are introduced by this milestone; no data rollback is
  required.

## Verification after deploy

```bash
npm --prefix web run smoke:rayd8:full-system          # deterministic gates
# In an environment with the Clerk secret + auth fixture + services:
npm --prefix web run smoke:rayd8:full-system:live     # + browser/live gates
```

Confirm in telemetry that `session_startup_incident` events carry the new
redaction-safe instrumentation counters and that `BROWSER_BLOCKED` /
`REQUEST_TIMEOUT` classifications appear instead of silent loops.
