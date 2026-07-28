# 13 — Production Monitoring Plan

## Correlation ID

Dev/QA builds expose `window.__RAYD8_PLAYER_DEBUG__.getCorrelationId()` / snapshot `correlationId` (`rayd8-pb-<uuid>`).

Support ask: “Please share the playback correlation ID from the session (or approximate start time + browser + experience).”

## Privacy-safe failure fields

Record when abnormal recovery/fatal occurs (application telemetry — do not send secrets):

- correlation ID
- app release / player implementation version
- route category / session category (expansion|premium|regen|amrita)
- anonymized asset id
- browser family/version, OS family/version, device class
- native HLS vs hls.js
- combined vs dual pipeline
- visual / constrained mode flags
- stall classification (A–F)
- buffer levels, dropped-frame ratio (when available)
- recovery action + attempt counts
- token-refresh state (boolean/count only — never JWT)
- A/V drift summary
- page visibility
- fatal app error code (non-PII)

## Never send

Signed URLs, JWTs, Mux signing secrets, sankalpa/intention text, health content, full personal identifiers.

## Separation taxonomy

| Bucket | Signals |
| --- | --- |
| Mux delivery | manifest/segment 4xx/5xx, token 403 after refresh fail |
| Browser decode | media error, corrupted frames, MediaSource missing |
| Application / React | update-depth, uncaught exceptions |
| GPU / visuals | context loss, AMRITA counters, long compositor tasks |
| Auth / entitlement | 401/403 access, trial gates |
| Network | offline, stalled fetches |
| Asset-specific | single playbackId correlation across users |

## Mux Data

Confirm environment keys for Mux Data where already provisioned; attach custom metadata sparingly using the fields above.
