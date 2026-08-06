# 08 — Database Wiring

**Project:** Neon `rayd8.app` (`curly-river-66984260`)  
**Mode:** Read-only aggregates (anonymized)

## Tables relevant to sessions

- `usage_sessions` — tracked playback sessions (`started_at`, `ended_at`, `last_heartbeat`, experience)
- `active_sessions` — device presence rows (`device_id`, heartbeats)
- `users`, `subscriptions` — entitlement
- No dedicated "resume token" table

## Aggregates (2026-08-06 audit)

| Metric | Value |
|---|---|
| `usage_sessions` total | 10,070 |
| `usage_sessions` with `ended_at IS NULL` | 4,675 |
| Open with heartbeat stale >1h | 4,664 |
| Open started >24h ago | 4,636 |
| `active_sessions` total | 4,675 |
| Active heartbeat stale >1h | 4,664 |
| Active heartbeat stale >24h | 4,631 |
| Users with >1 `active_sessions` row | 354 |
| Users without subscription row | 804 |

## Findings

1. **Large stale-open population** — nearly half of usage sessions never received an end marker; heartbeats are stale. Indicates `/session/end` / finalize path is frequently skipped (tab kill, overlay crash, network loss, or client not awaiting end).
2. **Multi-active users (354)** — possible concurrent devices or incomplete cleanup.
3. **Users without subscription row (804)** — entitlement path must tolerate missing subscription records (trial/free/orphans).

## Can DB state block a new session?

Static API path creates a **new** UUID on `/session/start` (`randomUUID`). Stale open rows alone do **not** appear to be a hard uniqueness block on start, but usage-limit / concurrent-device logic (if enforced via `active_sessions`) can soft-deny. Stale actives increase risk of false concurrency/limit pressure.

See `artifacts/db-session-aggregates.json`.
