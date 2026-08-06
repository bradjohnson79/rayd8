# 12 — Browser Functional Matrix

Short functional checks only (no soaks).

| Browser | Dashboard load | Auth surface | Express start wiring | Notes |
|---|---|---|---|---|
| Chrome | Pass (lab) | Pass when signed in | Static+prior evidence | Baseline |
| Brave default Shields | **CONDITIONAL — Brave not installed** | — | Same code path | Shields simulation via Chromium route.abort |
| Firefox | Pass shell | CONDITIONAL | hls.js path likely | |
| Safari/WebKit | Pass shell | CONDITIONAL | Native HLS likely | |
| Edge | Unavailable | — | — | Gap |
| Android Chrome | Unavailable | — | — | Gap |
| iOS Safari | Unavailable | — | — | Gap |

## Product short matrix (static + limited live)

| Product | Launch | Exit | Return dashboard | Entitlement≠tech readiness split documented |
|---|---|---|---|---|
| Express Expansion | Wired | `endSession` | Yes | Yes |
| Express Premium | Wired | same | Yes | Yes |
| REGEN | Wired | same | Yes | Yes |
| Admin preview | Wired (bypass access) | same | Yes | Yes |
| AMRITA | Route+iframe | Route leave | Yes | Yes |
| HAMSA | Session component | Close | Yes | Yes |

## Second session after failure class

| Failure class | Recover → dashboard → second start | Leak risk (static) |
|---|---|---|
| 401 | Soft denial / reauth; Reload ends session | Token split-state |
| 403 | Soft denial | Low if denial UI shown |
| 500 | Try Again / Reload | Try Again keeps session ID |
| Timeout | Health overlay | Try Again may reuse session; Reload new ID |
| Mux token failure | Init/soft denial | Cleared on retry key / reload |
| Missing asset | Init/health | Same |
| Brave blocked request | Health/init/auth | Depends on what was blocked |
| AMRITA iframe init failure | Leave route | Adaptive unregister on cleanup |
| Return Home | `endSession` | Finalize async — stale DB rows possible |

**Static proof:** Reload issues new server session UUID; Try Again does not.


## Short probe notes

- Chromium/Firefox/WebKit: `https://rayd8.app/` → 200; `/dashboard` redirects to Clerk sign-in (unauthenticated lab).
- Amrita route reachable as URL (`/amrita`) without auth crash in shell probe.
- Authenticated Express start / second-session-after-failure classes: **CONDITIONAL** — no lab auth storage; covered by static identity proofs in `artifacts/static-identity-proofs.json` and recovery identity matrix.
