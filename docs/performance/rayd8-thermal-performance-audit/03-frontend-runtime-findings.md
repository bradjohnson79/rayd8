# Frontend Runtime Findings

## Ranked bottlenecks

1. **P0** `getToken({ skipCache: true })` — `web/src/features/auth/useAuthReadiness.ts` (repaired).
2. **P0** Monolithic `SessionProvider` context — player consumes full context; usage heartbeat mutates `experienceAccess` every 30s causing player rerenders during HLS (`SessionProvider.tsx` ~733–836). **Not repaired** (structural split deferred).
3. **P1** 1 Hz freeze poll + metrics sampling during playback (`Rayd8PlayerEngine.tsx`) — now early-exits when `document.hidden`.
4. **P1** Session heartbeat ignored visibility — now skips when hidden and ticks on visible.
5. **P1** `useTrialStatus` 60s poll inside player for free trial — residual.

## Repairs

- Token cache default
- Heartbeat visibility gate
- Freeze-check hidden early exit
- Visual Performance preference wired into landing + dashboard ambient

## Regression

- `web/src/features/performance/visualPerformancePreference.test.ts`
- `npm run test:thermal-units`
