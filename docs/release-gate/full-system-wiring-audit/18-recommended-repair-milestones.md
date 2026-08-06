# 18 — Recommended Repair Milestones

Audit-only: these are recommendations, not implemented here.

## M1 — Failure taxonomy UX + telemetry (P0)

- Split access denial / init failure / playback-health failure in copy and codes
- Log stage snapshot when any recovery overlay appears (`sessionStartOk`, `tokenOk`, `sourceApplied`, `videoWidth`, `currentTime`, `paused`)
- Answer support question without console diving

## M2 — Health-guard correctness (P0)

- Do not start hard fallback until media pipeline has begun (or pause timer while document hidden / autoplay pending)
- Audio-only / dual-audio healthy predicates
- Force media controller recreate on Try Again

## M3 — Session end + DB hygiene (P0)

- `navigator.sendBeacon` / reliable end
- Reconcile stale `usage_sessions` / `active_sessions`
- Alert on open-session ratio

## M4 — API transport (P1)

- AbortSignal + timeouts + correlation IDs on player APIs

## M5 — Entitlement source-of-truth (P1)

- Dashboard/Amrita prefer `/v1/me` over stale Clerk publicMetadata
- Metadata sync job

## M6 — Brave media-block detection (P1)

- Detect `ERR_BLOCKED_BY_CLIENT` on Mux playlist/segments; distinct recovery copy
