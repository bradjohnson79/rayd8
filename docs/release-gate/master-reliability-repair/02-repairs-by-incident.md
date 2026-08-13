# Repairs by Incident

Every repair below is covered by a deterministic reproduction/regression test
that failed (or asserted the desired contract) before the fix and passes after.

## Incident B — playback-token CORS / permanent 0%

### B1. `apiRequest` had no timeout → hung fetch never settles
- **Fix (`web/src/services/api.ts`):** `apiRequest` now composes the caller's
  `AbortSignal` with a hard timeout (default 15s). A timeout rejects with
  `REQUEST_TIMEOUT`; a caller abort rejects with `REQUEST_ABORTED`; a network
  failure rejects with `NETWORK_ERROR`. All carry a correlation ID.
- **Taxonomy:** `REQUEST_TIMEOUT`, `REQUEST_ABORTED`, and `429` map to
  retryable failures, distinct from a hard offline state.
- **Tests:** `web/src/services/api.transport.test.ts`.

### B2. `waitForPlaybackReady` timeout left the authority in PRELOADING
- **Fix (`web/src/features/rayd8-player/Rayd8PlayerEngine.tsx`):** when playback
  is not ready after the ready window, the engine now dispatches
  `lifecycle_ready` to the playback authority so `isPreloading` clears and the
  recovery overlay replaces the 0% preparation overlay. The same dispatch was
  added on the health-guard hard-fallback path.
- **Stage machine (`startupStageMachine.ts`):** explicit
  `idle → starting → ready | failed` machine; every terminal state hides the
  preparation overlay. Buffer percent only displays during media-waiting stages
  and only when video is required.
- **Tests:** `web/src/features/rayd8-player/startupStageMachine.test.ts`.

### B3. Edge HTML error pages misclassified (`Status code: (null)`)
- **Fix (`web/src/services/api.ts`):** a non-JSON response (HTML challenge /
  52x edge page) is detected and classified as `EDGE_HTML_RESPONSE`, which the
  taxonomy maps to a retryable network failure instead of a silent success or
  an unhelpful error.
- **Fix (API CORS):** centralized CORS config (`api/src/config/cors.ts`) shared
  by the server and tests; credentials enabled with explicit origins (never a
  wildcard), `Vary: Origin` set, and CORS headers preserved on 4xx/5xx.
- **Tests:** `api/src/routes/player.master-reliability.test.ts`,
  `web/src/services/api.transport.test.ts`.

### B4. No correlation between frontend incident and API logs
- **Fix:** the API echoes or mints `x-rayd8-correlation-id` on every response
  (`api/src/server.ts` onRequest hook); the web client sends and adopts it.
- **Tests:** `api/src/routes/player.master-reliability.test.ts`.

## Incident A — video loop / usage drain / request storm

### A1. Trial usage accrued while required video was dead
- **Fix (client):** `mediaQualification.ts` decides whether the *required*
  media for the session mode is healthy and playing (dual/combined/video_only
  require healthy video with `videoWidth > 0`; dual also requires healthy
  audio). `mediaQualificationReporter.ts` lets the engine publish the snapshot
  to the `SessionProvider` heartbeat without prop-drilling.
- **Fix (server):** `usageQualification.ts`
  (`computeQualifiedHeartbeatAccrual`) is fail-closed — usage accrues only when
  `mediaQualified === true`, clamped to the heartbeat cap, never negative. The
  heartbeat/end routes accept and forward the flag.
- **Tests:** `web/src/features/rayd8-player/mediaQualification.test.ts`,
  `api/src/services/player/usageQualification.test.ts`.

### A2. Repeated request sequence (request storm)
- **Fix (`web/src/features/rayd8-player/mediaController.ts`):** `hls.js`
  internal retries are now bounded — `manifestLoadingMaxRetry: 2`,
  `levelLoadingMaxRetry: 2`, `fragLoadingMaxRetry: 3` with explicit retry
  delays. Escalation beyond these limits is handled by the bounded recovery
  state machine (max 3 major/window, 8/session, 6 load_source/session).
- **Tests:** `web/src/features/playback-authority/recoveryStateMachine.test.ts`,
  `web/src/features/rayd8-player/mediaController.forceReload.test.ts`.

### A3. Silent loop with audio continuing (Brave)
- **Fix (`browserBlockDetection.ts`):** classifies `BROWSER_BLOCKED` when audio
  is playing but the video is starved (no segments, src-not-supported, or zero
  readyState past a grace window), with Brave/Firefox/Chrome/Safari detection.
  The taxonomy maps it to a `browser_blocked` overlay with actionable copy
  (lower Brave Shields, disable strict extensions, allow media permissions).
- **Tests:** `web/src/features/rayd8-player/browserBlockDetection.test.ts`,
  `sessionStartupTaxonomy.test.ts`.

### A4. Duplicate sessions on retry
- **Fix:** the client mints a `sessionId` per `startSession` and the API
  `session/start` is idempotent for a client-supplied ID — a retry returns the
  existing session instead of inserting a duplicate.
- **Tests:** `api/src/routes/player.master-reliability.test.ts`,
  `api/src/services/player/usageTracking.end.idempotency.test.ts`.

### A5. Heartbeat after session end resurrected/accrued
- **Fix (`api/src/services/player/usageTracking.ts`):** heartbeat on an
  already-ended session returns `alreadyEnded` and accrues nothing.
- **Tests:** `api/src/services/player/usageTracking.end.idempotency.test.ts`.

## Cross-cutting

### Telemetry (structured + redacted)
- Startup incidents carry redaction-safe instrumentation counters
  (`signedUrlRequestCount`, `signedUrlRequestTotal`, `mediaMountCount`,
  `softRecoveryCount`, `majorRecoveryCount`). Field names were chosen to avoid
  the telemetry secret-key redaction regex. No tokens, signed URLs, or PII.
- **Tests:** `web/src/features/rayd8-player/startupInstrumentation.test.ts`,
  `playbackIncidentTelemetry.test.ts`.

### Hermetic server entry point
- **Fix (`api/src/server.ts`):** the auto-`start()` is guarded behind an
  entry-point check so importing `buildServer()` in tests no longer binds the
  port or calls `process.exit(1)`. This keeps the API contract tests hermetic
  whether or not a dev server is running, and preserves production/dev
  auto-start behavior.
