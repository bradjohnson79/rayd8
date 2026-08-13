# Smoke Certification — Gates A–N

The master smoke command is `web/scripts/rayd8-full-system-smoke.mjs`, exposed
as two npm scripts:

```bash
npm --prefix web run smoke:rayd8:full-system        # deterministic gates
npm --prefix web run smoke:rayd8:full-system:live   # + live browser/stability gates
```

Exit code is non-zero if any non-skipped gate fails. The orchestrator never
prints signed URLs or JWTs.

## Gate definitions

| Gate | Name | Type | What it proves |
|------|------|------|----------------|
| A | API typecheck | deterministic | API compiles under `tsc --noEmit` |
| B | API unit + contract tests | deterministic | player reliability, usage qualification, session-end idempotency, reconciliation, mux TTL |
| C | Web typecheck | deterministic | web compiles under `tsc -b` |
| D | Web lint (reliability scope) | deterministic | new/modified files are clean; engine `react-hooks/refs` errors held at baseline 4 |
| E | Web API transport tests | deterministic | timeout/abort/correlation/HTML-edge classification |
| F | Startup taxonomy + stage machine | deterministic | 0% overlay always reaches a terminal state |
| G | Browser-block + media qualification + instrumentation | deterministic | Brave classification, fail-closed usage, redaction-safe counters |
| H | Health + recovery + av-sync + telemetry | deterministic | bounded recovery, asymmetric A/V, telemetry redaction |
| I | No-playback-prompt static assertion | deterministic | no legacy playback-prompt overlays regress |
| J | Web production build | deterministic | `vite build` succeeds |
| K | Session idempotency + usage qualification contract | deterministic | incident contracts hold in isolation |
| L | Browser smoke matrix (chromium/firefox/webkit) | **live** | real playback startup across browsers |
| M | Brave browser-block classification | deterministic | Brave-blocked media classified with guidance |
| N | Live Mux + AMRITA stability | **live** | real Mux/AMRITA playback stability |

## Live gate readiness

Live gates (L, N) run only when **all** of the following hold; otherwise they
report `SKIP` with the specific reason so the deterministic certification still
completes:

- `--live` flag passed.
- Auth fixture present: `web/e2e/.auth/mux-soak.env`
  (generate with `npm --prefix api run fixture:mux-soak-auth`).
- `VITE_CLERK_PUBLISHABLE_KEY` or `CLERK_PUBLISHABLE_KEY` set.
- Web (`http://127.0.0.1:5173`) and API (`http://localhost:3001`) running.

## Baseline-aware lint gate (D)

`web/scripts/lint-reliability-scope.mjs` lints the reliability scope in two
parts:

1. **Clean scope** (new + modified modules) must have **0 errors**.
2. **`Rayd8PlayerEngine.tsx`** must not exceed the documented pre-existing
   baseline of **4 `react-hooks/refs` errors** and must not introduce any new
   error type. These 4 are a pre-existing render-time ref-access pattern that
   predates this repair; refactoring them is out of scope.

## Latest result (clean SHA `efd5d8c`)

```
PASS 12  FAIL 0  SKIP 2   →  CONDITIONAL GO
```

Supporting suites from the same SHA: full API `src` tests **84/84**, web
`test:session-startup-closure` green.
