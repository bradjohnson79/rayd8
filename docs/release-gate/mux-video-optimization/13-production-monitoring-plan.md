# 13 — Production Monitoring Plan

## Sink (implemented)

**Umami** custom event `mux_playback_incident` via `trackUmamiEvent` in [`playbackIncidentTelemetry.ts`](../../web/src/features/rayd8-player/playbackIncidentTelemetry.ts).

- Abnormal freeze classes only (`browser_tab_freeze`, `player_ui_freeze`, `media_stall`, `graphics_freeze`, `device_instability`)
- Deduped for 60s per correlation/class/reason
- Fail-silent; never interrupts playback
- Redaction unit-tested (`test:mux-telemetry`)

## Privacy-safe fields

correlationId, releaseSha (`VITE_RELEASE_SHA`), freezeClass, pipeline/engine, recovery counts, drift summary, visibility/fullscreen booleans, route/session category when provided.

## Never send

JWTs, signed URLs, Clerk tokens, intention/sankalpa text, health content, emails, raw secrets.

## Support ask

Share playback `correlationId` from `window.__RAYD8_PLAYER_DEBUG__` (debug builds) or approximate session start + browser + experience.
