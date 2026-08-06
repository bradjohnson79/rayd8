# Umami noncritical proof

Source: `web/src/services/umami.ts`

- initializeUmami: idle injection after load; early returns; no throw to app
- trackUmamiEvent: if no window.umami, queue max 20; never throws; never returns Promise to callers
- Call sites (dashboard/session/player) do not await trackUmamiEvent

Conclusion: Umami failure/blocking cannot hold session initialization open.
