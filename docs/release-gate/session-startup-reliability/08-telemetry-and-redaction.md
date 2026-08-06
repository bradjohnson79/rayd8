# 08 — Telemetry and Redaction

Event: `session_startup_incident` via Umami (`sessionStartupTelemetry.ts`).

Emits: overlay_shown (deduped), recovery_action, recovery_result.

Redacts: token/jwt/signed_url/email/user_id/session_id keys; JWT-looking strings; stream URLs.

Never blocks startup (try/catch + fire-and-forget).
