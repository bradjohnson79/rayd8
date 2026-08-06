# 11 — Before / After

| Finding | Before | Repair | After | Regression |
|---|---|---|---|---|
| Generic overlay | Health copy said session startup | Taxonomy overlays | Distinct init/media copy | taxonomy tests |
| Premature health fallback | Timers on mount | Gate on mediaOwned+sourceApplied | No hard fail pre-ownership | health machine tests |
| Hidden false fail | Timer continued | Pause + fresh re-arm | PAUSED_HIDDEN | unit |
| Autoplay false fail | play_failed → hard | AUTOPLAY_BLOCKED nonfatal | WAITING_FOR_AUTOPLAY | unit |
| Audio-only false fail | required videoWidth | audio predicate | healthy without videoWidth | unit |
| Stale controller retry | same-URL short-circuit | forceReload + destroy | fresh controller | forceReload tests |
| Unreliable end | fire-and-forget fetch | keepalive unload + idempotent end | duplicate-safe | idempotency tests |
| Stale opens | ~4.6k open | dry-run reconcile + soft start cleanup | operable hygiene | reconcile tests |
