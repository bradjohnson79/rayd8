# 12 — Known Limitations

- Authenticated browser intercept matrix not re-run live in this milestone.
- True Express audio-only (no video element) is supported by predicates but product UI remains video-first/combined/dual.
- sendBeacon cannot attach Authorization; unload relies on keepalive fetch + server reconcile.
- Reconciliation `--apply` is operator-gated; not auto-enabled in production cron.
- M4–M6 intentionally deferred (beyond optional correlation interfaces).
