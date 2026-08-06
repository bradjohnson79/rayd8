# 13 — Blocked Request and Policy Review

## CORS (API)

`api/src/server.ts` registers `@fastify/cors` with `credentials: true`, methods including GET/POST, allowed headers `Content-Type` + `Authorization`, origin allowlist `allowedCorsOrigins`.

## CSP / cookies / SW

| Policy area | Observation |
|---|---|
| API CORS | Explicit allowlist — misconfigured origin → browser CORS failure (not health mislabel if pre-mount) |
| Clerk cookies | Third-party/partitioned cookie policies can create auth split-state |
| Service worker | No evidence SW is required for session start |
| Mux media | Cross-origin media; depends on Mux CORS + signed URL |
| Umami | Third-party script `cloud.umami.is` — commonly Shields-blocked; **noncritical** |
| Amrita iframe | Same-origin `/amrita_app` — not cross-site iframe |

## Blocked-request table (expected classes)

| Domain class | If blocked | User-visible class |
|---|---|---|
| `api.rayd8.app` / Render API | Auth/access/session/token fail | Access or init |
| Clerk | Signed-out / 401 | Access denial |
| Mux stream host | No media progress | **Playback-health** or init |
| `cloud.umami.is` | Analytics missing | None (proven noncritical) |
