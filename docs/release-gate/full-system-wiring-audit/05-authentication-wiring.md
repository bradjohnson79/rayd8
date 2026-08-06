# 05 — Authentication Wiring

## Split-state risk

| Layer | Source of truth | Failure mode |
|---|---|---|
| Clerk UI | Browser Clerk session | Can show signed-in chrome |
| API calls | Bearer from `getTokenSafe()` | 401 if token missing/expired |
| `/v1/me` | DB user + plan fields | Stale Clerk `publicMetadata.plan` can disagree with DB |

## Observed wiring

- Dashboard session start requires token before `/access`.
- Player token fetch uses Clerk token again; trial/preview codes become soft denial, not health overlay.
- `SessionProvider.beginTracking` can set auth soft denial if `/session/start` returns auth errors.
- Amrita route gates via `getTokenSafe` + `getMe`; iframe reads parent Clerk object (same-origin), not postMessage auth.

## Split-state conclusion

**Yes — stale authentication can appear valid in the UI** while API returns 401. Soft-denial paths exist after mount; pre-mount dashboard gates reduce but do not eliminate race around token expiry mid-init.
