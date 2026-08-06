# Twenty final answers

1. `PlaybackHealthFallbackOverlay` via `playbackHealthFallbackVisible` in `Rayd8PlayerEngine`.
2. Media not healthy in 9s: source apply fail, readiness fail, play fail, autoplay block, background pause, slow Mux, CDN block — collapsed into one screen.
3. Try Again: new init effect/token/preload abort; same session ID; HLS maybe reused.
4. Reload: endSession + new startSession → new session UUID; clears player instance.
5. Return Home: destroys media controllers; async session finalize.
6. Clean completion should not block; stale actives / usage limits can.
7. Yes — Clerk UI signed-in vs API 401.
8. Yes — access/plan disagreement.
9. Yes — via init or health paths.
10. Yes.
11. Stale DB can pressure limits/concurrency; start creates new UUID.
12. Umami commonly; media/API only under aggressive settings.
13. Yes where Shields touch third-party/fingerprint/cookies.
14. Shields (scripts/cookies/fingerprinting), private windows.
15. Only if failure was Shields-caused; do not disable merely to pass.
16. Adaptive applyProfile only; origin-checked; no session ack protocol.
17. Separate mounts; Express end async — handoff OK if navigated cleanly; DB stale risk.
18. No — Umami proven noncritical.
19. No — UI mislabels; need console/stage telemetry.
20. M1 taxonomy + M2 health-guard + M3 session-end/DB hygiene.
