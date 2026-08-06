# 01 — Baseline and Scope

| Field | Value |
|---|---|
| Starting branch | `audit/rayd8-system-wiring` |
| Starting SHA | `a8ecb87282275def6ad9ca8ff865c4df242fd302` |
| Repair branch | `fix/session-startup-reliability` |
| Baseline tag | `baseline/session-startup-reliability-pre` |
| Recorded at | 2026-08-06T01:53:10Z |
| Node / npm | v22.18.0 / 10.9.3 |

## Scope

Included: M1 failure taxonomy/UX/telemetry, M2 health-guard correctness + fresh retry, M3 session-end reliability + stale-session reconciliation (dry-run default).

Excluded: M4–M6 beyond minimal correlation-id header interface; soaks; player redesign; entitlement metadata migration; Brave media-block detection.

## Audit findings addressed

`SESSION-001`–`SESSION-005`, `DB-001`, `OBS-001`.
