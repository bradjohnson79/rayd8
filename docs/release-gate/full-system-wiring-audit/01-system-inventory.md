# 01 — System Inventory

**Branch:** `audit/rayd8-system-wiring`  
**Baseline SHA:** `aa59a43f0333dcd7f931d8a4b2e7c66b2089fc97`  
**Recorded at:** 2026-08-06T01:39:21Z  
**Host:** macOS 15.6.1 (arm64)  
**Node / npm:** v22.18.0 / 10.9.3  
**Playwright:** 1.62.1  
**Production code changed during audit:** **No**

## Key packages

| Package | Version | Role |
|---|---|---|
| `@clerk/react` | ^6.4.2 | Web auth UI / session tokens |
| `@clerk/backend` | ^3.2.13 | API auth verification |
| `hls.js` | ^1.6.16 | MSE HLS for non-native browsers |
| `@mux/mux-node` | ^14.0.1 | Signed playback tokens / admin Mux |

## Surfaces

| Surface | Entry | Session model |
|---|---|---|
| Express / REGEN (Expansion, Premium, Regen) | `Rayd8Dashboard` → `SessionProvider.startSession` → `Rayd8SessionOverlay` → `Rayd8PlayerEngine` | Backend `usage_sessions` + client overlay |
| AMRITA | `/amrita` → `AmritaRoutePage` → same-origin iframe `/amrita_app/` | Parent entitlement gate; iframe Clerk object access |
| HAMSA | Dashboard / route → `HamsaFullscreenSession` / Hamsa iframe | Adaptive bridge + local canvas |
| Admin preview | Dashboard admin start | Bypasses member access check; uses admin Mux token |

## External dependencies

| Dependency | Critical for session? | Notes |
|---|---|---|
| Clerk | Yes | Tokens for API |
| Neon Postgres | Yes | users, subscriptions, usage/active sessions |
| Mux | Yes (Express/REGEN video) | Signed URLs via `/v1/player/playback-token` |
| Stripe | Entitlement only | Webhooks update plan/subscription |
| Umami (`cloud.umami.is`) | **No** | Fire-and-forget; pending queue capped at 20 |
| Vercel (web) / Render (API) | Hosting | |

## API player surface (`api/src/routes/player.ts`)

- `GET /v1/player/access`
- `GET /v1/player/playback-token`
- `POST /v1/player/session/start`
- `POST /v1/player/session/heartbeat`
- `POST /v1/player/session/end`
- **No** backend session-resume endpoint

## Working tree policy

Untracked leftover outside this audit: `docs/performance/.../FULL-GO-REFINEMENT-REPORT.md` — left out of audit commits.
