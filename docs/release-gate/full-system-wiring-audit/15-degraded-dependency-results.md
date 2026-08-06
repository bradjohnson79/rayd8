# 15 — Degraded Dependency Results

## Umami noncritical (proven by code)

File: `web/src/services/umami.ts`

| Requirement | Evidence |
|---|---|
| Does not block dashboard rendering | `initializeUmami` schedules idle inject after `load`; never awaited by React tree |
| Does not block session startup | `trackUmamiEvent` is sync fire-and-forget; no promise returned to start path |
| Does not block playback | Player never awaits Umami |
| Does not throw unhandled on missing umami | Guards `window.umami`; queues ≤20 events |
| Does not hold init promise open | No promises in track path |

Blocking `cloud.umami.is` (Brave Shields) must **not** be classified as session failure.

## Other degraded deps

| Dependency | If degraded | Classification |
|---|---|---|
| Clerk | Cannot start | Access denial |
| API host | Cannot access/token/session | Access or init |
| Mux | No media | Init or playback-health |
| Neon | API 5xx | Init / soft denial |
| Adaptive postMessage | Visual tier only | Noncritical |
