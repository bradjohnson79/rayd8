# 07 — API Contract and Timeout Review

## Player endpoints

| Endpoint | Auth | Success effect | Notable errors |
|---|---|---|---|
| `GET /v1/player/access` | Bearer | Allows `startSession` | 401/403 → dashboard denial |
| `GET /v1/player/playback-token` | Bearer | Signed Mux URL | 401/403 trial codes → soft denial; 5xx → init failure path |
| `POST /v1/player/session/start` | Bearer | DB session UUID | Restriction soft denial; does not gate media init |
| `POST .../heartbeat` | Bearer | Extends session | Usage-limit soft denial |
| `POST .../end` | Bearer | Closes session | Best-effort from client |

## Client transport gaps

- `apiRequest` uses plain `fetch` — **no AbortSignal**, **no correlation ID header**, no explicit timeout wrapper.
- Player init cancellation is local (`cancelled` flag + preload AbortController) only.
- Concurrent overlapping token/session calls possible on rapid retry/reload.

## Error → UI matrix (static + short intercept intent)

| Condition | Likely UI | Retry freshness | Stuckness risk |
|---|---|---|---|
| 401 access | Dashboard / soft denial | New token needed | Medium if Clerk UI still signed-in |
| 403 entitlement | Soft denial / upgrade | New session won't help without plan | Low if soft denial shown |
| 404 asset/token | Init failure / health path | Try Again refetches token | Medium |
| 409/422 | Soft denial / error message | Depends on code | Medium |
| 429 | Error/init | Retry may rehit limit | Medium |
| 5xx | Init failure or soft denial | Try Again new request | Medium |
| Timeout / abort | Health fallback if media never healthy | Try Again new init effect | **High** — mislabeled overlay |
| Malformed/empty JSON | Init catch → initFailureVisible | Try Again | Medium |

## No session-resume API

Client Reload creates a **new** session ID; there is no resume endpoint.
