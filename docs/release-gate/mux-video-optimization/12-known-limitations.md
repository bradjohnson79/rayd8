# 12 — Known Limitations

## Residual (blocks full GO)

- Physical iOS/Android Class F soaks not executed.
- Offline ≥30s can unmount the session `<video>` in automation (10s offline recovers).

## Tooling

- Playwright emulated browsers; mobile viewport is not a phone.
- Loop-wrap samples can produce huge raw A/V drift; harness excludes abs drift >30s from budgets.
- AMRITA isolation durations in closure used scaled times (2–5m) plus a 5m full soak; 20–30m AMRITA full optional follow-up.

## Product

- Combined A/V asset map still empty — dual pipeline remains default.
- AvSync corrects audio toward video only (no playbackRate).
- Production Umami incidents are abnormal-only (not continuous metrics).
