# AMRITA Single-Pass Rollback

## Stable Backup

- Pre-change commit: `7c1034a7abf91a49d3e2f4056a8bc86ea678ebda`
- Backup tag: `amrita-single-pass-stable-2026-07-20`
- Upgrade branch: `feature/amrita-dual-pass-glyph-flow`

The backup tag was verified in a clean detached worktree before AMRITA runtime edits began.

## Baseline Runtime Semantics

Current AMRITA single-pass timing separates the overall session timer from glyph travel timing:

- `CONFIG.durations` controls the overall session length (`15 min`, `30 min`, `60 min`, or `Continuous`).
- Rate Of Charge controls glyph travel speed through `speedToDuration(speed)`.
- `speedToDuration(speed)` maps speed `1` to `24000ms` and speed `10` to `850ms` using the current quadratic easing.
- A current single-pass cycle is one down traversal plus one up traversal.
- Current full-cycle duration is `oneWayDurationMs * 2`.
- Session expiration stops the sequence immediately through `stopSequence()` rather than waiting for a cycle boundary.
- Pause/resume shifts active turn timestamps by the paused duration and preserves the session timer through `pausedAccumulatedMs`.
- `visibilitychange` currently pauses the runtime when the document becomes hidden.

Dual-pass implementation must preserve the overall session timer. Each pass keeps the existing one-way travel duration. With Pass 2 starting at 50%, one dual-pass direction is expected to last about `oneWayDurationMs * 1.5`, and a full down/up dual-pass cycle about `oneWayDurationMs * 3`.

## Baseline Validation

Baseline checks were run before AMRITA runtime edits:

- `npm --prefix web run build`: passed.
- `npm --prefix web run test:global-player-runtime`: passed.
- `npm --prefix web run lint`: failed on pre-existing repo-wide React/ESLint findings outside the AMRITA canvas runtime. The first failures were in `web/src/app/router.tsx`, `web/src/features/amrita/AmritaRoutePage.tsx`, `web/src/features/auth/useAuthReadiness.ts`, `web/src/features/dashboard/DashboardLayout.tsx`, `web/src/features/dashboard/useTrialStatus.ts`, `web/src/features/hamsa/HamsaFullscreenSession.tsx`, and `web/src/features/landing/components/Section.tsx`.

The baseline AMRITA single-pass runtime was still buildable and covered by the existing global player runtime smoke before dual-pass implementation began.

## Rollback Commands

To restore the single-pass AMRITA runtime files on the current branch:

```sh
git checkout amrita-single-pass-stable-2026-07-20 -- web/public/amrita_app web/src/features/amrita
```

To inspect or deploy the complete stable single-pass version:

```sh
git checkout amrita-single-pass-stable-2026-07-20
npm --prefix web run build
npm --prefix web run test:global-player-runtime
```

## Safety Notes

- This visual runtime upgrade does not require a database migration.
- Rolling back AMRITA runtime files does not modify user accounts, billing records, subscription state, or saved AMRITA local settings.
- Verify rollback with a manual `/amrita_app/index.html` single-pass smoke test before production use.

## Dual-Pass Validation Results

Post-implementation checks:

- `node --check web/public/amrita_app/app.js`: passed.
- `node --check web/scripts/amrita-dual-pass-regression.mjs`: passed.
- `npm --prefix web run build`: passed.
- `npm --prefix web run test:amrita-dual-pass`: passed.
- `npm --prefix web run test:no-playback-prompt`: passed.
- `npm --prefix web run test:global-player-runtime`: passed.
- IDE diagnostics for touched files: no linter errors found.
- `npm --prefix web run lint`: still fails on the same pre-existing repo-wide React lint categories captured in the baseline. The AMRITA runtime changes did not introduce touched-file lint diagnostics.

The AMRITA dual-pass regression verifies:

- Pass 1 begins downward alone.
- Pass 2 starts once at 50% downward.
- Both passes render from one immutable snapshot signature.
- Pass 1 waits while Pass 2 finishes downward.
- Upward motion starts only after both downward passes complete.
- Pass 2 starts once at 50% upward.
- Cycle replacement occurs after both upward passes complete.
- Pause/resume freezes pass progress and resumes without duplicating Pass 2.
- Session expiration clears both passes atomically across every major phase.
- A multi-cycle mobile viewport run keeps active draw count bounded to two passes.

Post-implementation rollback verification:

- A clean detached worktree was created from `amrita-single-pass-stable-2026-07-20`.
- The worktree resolved to `7c1034a7abf91a49d3e2f4056a8bc86ea678ebda`.
- The tagged `web/public/amrita_app/app.js` was checked for absence of dual-pass markers such as `SECOND_PASS_TRIGGER_PROGRESS` and `rayd8-amrita-dual-pass-debug`.
- The rollback tag remains the original single-pass runtime.

## Performance Findings

Dual-pass rendering uses:

- one animation loop;
- one immutable cycle snapshot;
- two canvas render traversals over the same snapshot;
- the existing `glyphImages` image cache;
- the existing `outlineGlyphCache` outline/bloom cache.

The regression's long-session check completed multiple cycles without pass accumulation or draw-count growth beyond `glyphCount * 2`.
