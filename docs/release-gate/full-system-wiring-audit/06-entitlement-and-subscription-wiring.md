# 06 — Entitlement and Subscription Wiring

## Entitlement vs technical readiness (per product)

### Express / REGEN

| Step | Mechanism |
|---|---|
| Permitted | `/v1/player/access` + plan/trial rules |
| Config resolves | Asset ID from experience/mode/audio |
| Session record | `POST /session/start` → `usage_sessions` / `active_sessions` |
| Playback init | playback-token + setMediaSource |
| Reports active | Heartbeats; client playing state |
| Exits cleanly | `endSession` → `/session/end` (best-effort) |

### AMRITA

| Step | Mechanism |
|---|---|
| Permitted | Parent `getMe` / plan gate (and Clerk metadata if used by UI) |
| Config resolves | Static `/amrita_app` assets |
| Session record | Not Express `usage_sessions` path |
| Playback/iframe init | Iframe load + internal audio layer |
| Active | Iframe runtime |
| Exit | Route leave; adaptive unregister |

### HAMSA

| Step | Mechanism |
|---|---|
| Permitted | Dashboard/product gating |
| Config | Hamsa bundle |
| Session | Local fullscreen session |
| Init | Canvas / audio |
| Exit | Close handlers + adaptive cleanup |

## Entitlement disagreement

Clerk `publicMetadata.plan` vs Neon `users.plan` / `subscriptions` can disagree. If UI trusts stale Clerk metadata and `/v1/me` fails, users can be redirected to purchase despite active Stripe/DB entitlement (observed support case pattern).

**Never conflate** a valid 403 entitlement denial with Mux/media health failure.
