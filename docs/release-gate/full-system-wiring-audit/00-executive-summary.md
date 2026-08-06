# 00 — Executive Summary

## Verdict: **FUNCTIONALLY DEGRADED**

The screenshot **"Trouble Starting Your Session"** is rendered by `PlaybackHealthFallbackOverlay` after the playback-health guard fails its 9s video-healthy check. It is **not** proof that backend session creation failed. Client `startSession` mounts the player **before** `/session/start` completes; health timers run concurrently with token/media init. Classify the screenshot as a **playback-health failure** (often a mislabel), unless stage evidence shows an earlier access/init failure.

## Locked answers (preview)

1. Overlay path = health fallback inside mounted `Rayd8PlayerEngine`.
2. Collapses slow media, autoplay block, source apply failure, readiness timeout, background pause, and possibly CDN blocks into one screen.
3. Try Again = fresh init effect + new token fetch; **same session ID**; HLS may reuse.
4. Reload = full end + new session ID.
5. Return Home cleans client media; server end is best-effort async.
6. Completed sessions should not block next start; **stale actives/usage limits** can.
7. Clerk UI vs API 401 split-state is possible.
8. Entitlement disagreement can prevent product entry.
9. Mux token/source failures can reach generic health or init screens.
10. Missing assets can prevent initialization.
11. DB stale opens are severe hygiene issue; hard-block depends on concurrency/limit logic.
12–15. Brave Shields mainly threaten third-party/analytics; aggressive blocks can hit media → health class.
16. Amrita postMessage = adaptive profile only; auth via parent Clerk object.
17. Handoffs are separate mounts; Express end is async.
18. Umami cannot block startup (proven).
19. Support cannot determine real cause from UI alone.
20. Next repair: M1 failure taxonomy + M2 health-guard correctness + M3 session-end hygiene.

## Baseline

- Branch: `audit/rayd8-system-wiring`
- SHA: `aa59a43f0333dcd7f931d8a4b2e7c66b2089fc97`
- Production code changes: **none**

## Lab gaps

- Brave not installed on host → Shields matrix CONDITIONAL (Chromium Umami-block simulation substituted).
- Authenticated Express intercept matrix CONDITIONAL (no stored E2E auth).
