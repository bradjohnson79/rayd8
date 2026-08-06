# 07 — Database Reconciliation

- Open = `usage_sessions.ended_at IS NULL`
- Stale default = last_heartbeat older than 60 minutes
- Script: `npm run sessions:reconcile` (dry-run default); `--apply` required for writes
- Soft reconcile on `/session/start` for caller's stale rows (non-blocking)
- No schema migration in this milestone
