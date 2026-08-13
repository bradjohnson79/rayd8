# Incidents and Scope

## Incident A — `INC-2026-08-06-VIDEO-LOOP`

**Reported:** Brave/macOS and Brave/Linux. Video buffers/loops while audio
continues. A repeated request sequence is observed. Trial usage is consumed
even though the required video never plays.

**Reproduction focus:**
- Repeated request sequence → unbounded `hls.js` internal retries plus
  higher-level recovery loops.
- Trial usage consumed during dead video → heartbeat accrued on raw elapsed
  time with no media-health attestation.
- Silent loop with audio continuing → no classification for "browser blocked
  the video stream."

## Incident B — `INC-2026-08-06-PLAYBACK-TOKEN-CORS`

**Reported:** Firefox/Windows stuck at "Preparing Your RAYD8 Session" with 0%.
Browser console shows `Cross-Origin Request Blocked` and `Status code: (null)`.

**Reproduction focus:**
- `Status code: (null)` + CORS block → the fetch never produced a usable
  response (hung/stall or an edge HTML error page without CORS headers).
- Permanent 0% → `apiRequest` had no timeout, so a hung fetch never rejected;
  and when `waitForPlaybackReady` timed out it returned `false` without
  transitioning the playback authority out of `PRELOADING`, leaving the
  preparation overlay up forever.

## Scope

This milestone is a **repair + regression + smoke certification**, not another
audit. For each incident:

1. Reproduce the defect with a deterministic failing test.
2. Repair the root cause.
3. Add a regression test that must pass without being weakened.
4. Fold the repair into the full-system smoke certification.

### In scope

- Playback-token transport (CORS, edge errors, redirects, caching).
- API transport for player-critical calls (timeout, abort, correlation, retry).
- Startup failure taxonomy + the 0% preparation state machine.
- Recovery/remount loop bounding (hls.js + recovery state machine).
- Retry semantics (Try Again vs Reload Session).
- Audio/video asymmetric failure handling.
- Session-end reliability and idempotency.
- Stale-session hygiene (read-only, dry-run reconciliation).
- Media-qualified usage accounting.
- Brave/browser-blocked media classification.
- Cloudflare/edge code-level mitigations + infra recommendations.
- Structured, redacted incident telemetry.

### Out of scope (documented, not repaired here)

- Cloudflare dashboard configuration for `api.rayd8.app` (infrastructure-level;
  recommendations recorded in `04-known-limitations.md`).
- The 4 pre-existing `react-hooks/refs` lint errors in `Rayd8PlayerEngine.tsx`
  (a pre-existing render-time ref-access pattern; held at baseline, not
  introduced by this repair).
- Live browser matrix execution in environments lacking the Clerk secret.
