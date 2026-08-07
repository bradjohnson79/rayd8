# RAYD8 Master Reliability Repair — Summary Report

**Date:** 2026-08-07
**Branch:** `fix/rayd8-master-reliability`
**Milestone type:** P0/P1 production reliability repair + regression + smoke certification
**Final verdict:** **CONDITIONAL GO**

---

## 1. Result at a glance

| Metric | Value |
|--------|-------|
| Deterministic smoke gates | **12 PASS / 0 FAIL / 2 SKIP** |
| Full API `src` test suite | **84/84 passing** |
| Web session-startup closure | green |
| Files changed | 38 |
| Lines | +3,054 / −81 |
| Clean verification SHA | `efd5d8c` |

The 2 skips are the live browser/stability gates, which require the Clerk
publishable key + auth fixture + running services. They are fully wired and
skip gracefully; run them in CI where the secret is present.

---

## 2. Incidents resolved

### Incident A — `INC-2026-08-06-VIDEO-LOOP`
Brave/macOS + Brave/Linux: video buffers while audio continues, a repeated
request sequence is observed, and trial usage is consumed despite dead video.

**Root causes repaired:**
- Unbounded `hls.js` internal retries → request storm.
- Usage accrued on raw elapsed time with no media-health attestation.
- No classification for "browser blocked the video stream" → silent loop.

### Incident B — `INC-2026-08-06-PLAYBACK-TOKEN-CORS`
Firefox/Windows stuck at "Preparing Your RAYD8 Session / 0%"; console shows
`Cross-Origin Request Blocked` and `Status code: (null)`.

**Root causes repaired:**
- `apiRequest` had no timeout → a hung fetch never settled.
- `waitForPlaybackReady` timeout left the playback authority in `PRELOADING`,
  so the 0% overlay never cleared.
- Edge HTML error pages (52x / challenge) were misclassified.

---

## 3. What was repaired

### API (`api/`)
- Centralized CORS config (`config/cors.ts`) shared by server and tests —
  explicit origins (never wildcard), `credentials: true`, `Vary: Origin`, CORS
  headers preserved on 4xx/5xx.
- Correlation ID (`x-rayd8-correlation-id`) echoed or minted on every response.
- `Cache-Control: no-store` on `playback-token`.
- Idempotent `session/start` for a client-supplied `sessionId` (no duplicates
  on retry).
- Media-qualified usage accrual (`usageQualification.ts`) — fail-closed:
  accrues only when `mediaQualified === true`, clamped, never negative, never
  after session end.
- Hermetic server entry-point guard (`server.ts`) so importing `buildServer()`
  in tests no longer binds the port or calls `process.exit(1)`.

### Web (`web/`)
- Hardened `apiRequest` — 15s timeout, caller `AbortSignal` composition,
  correlation ID, and HTML-edge detection (`EDGE_HTML_RESPONSE`).
- Bounded player GET retry (`playerTransport.ts`) — exponential backoff, never
  retries 4xx denials or already-timed-out requests.
- Explicit startup stage machine (`startupStageMachine.ts`) — guarantees every
  startup reaches `ready` or `failed` and clears the 0% overlay.
- Browser-block detection (`browserBlockDetection.ts`) — classifies
  `BROWSER_BLOCKED` (Brave/Firefox/Chrome/Safari) with actionable overlay copy.
- Media-qualification reporter (`mediaQualification.ts` +
  `mediaQualificationReporter.ts`) wired to the usage heartbeat.
- Bounded `hls.js` retries in `mediaController.ts`.
- Expanded startup taxonomy + recovery overlays (`sessionStartupTaxonomy.ts`).
- Redaction-safe startup instrumentation counters (`startupInstrumentation.ts`)
  emitted via session-startup telemetry.

---

## 4. Certification — gates A–N

Reproduce with:

```bash
npm --prefix web run smoke:rayd8:full-system        # deterministic gates
npm --prefix web run smoke:rayd8:full-system:live   # + browser/live gates
```

| Gate | Name | Result |
|------|------|--------|
| A | API typecheck | PASS |
| B | API unit + contract tests | PASS |
| C | Web typecheck | PASS |
| D | Web lint (reliability scope, baseline-aware) | PASS |
| E | Web API transport tests | PASS |
| F | Startup taxonomy + stage machine | PASS |
| G | Browser-block + media qualification + instrumentation | PASS |
| H | Health + recovery + av-sync + telemetry | PASS |
| I | No-playback-prompt static assertion | PASS |
| J | Web production build | PASS |
| K | Session idempotency + usage qualification contract | PASS |
| L | Browser smoke matrix (chromium/firefox/webkit) | SKIP — live |
| M | Brave browser-block classification | PASS |
| N | Live Mux + AMRITA stability | SKIP — live |

---

## 5. Commits

| SHA | Subject |
|-----|---------|
| `f4ace84` | fix(player): master reliability repair for session startup + usage accounting |
| `efd5d8c` | test(reliability): full-system smoke orchestrator + hermetic server entry guard |
| `acb41de` | docs(release-gate): master reliability repair certification pack |

---

## 6. Known limitations / residual risk (low)

1. **Live browser matrix** not executed locally (Clerk secret absent); run in CI.
2. **4 pre-existing `react-hooks/refs` lint errors** in `Rayd8PlayerEngine.tsx`
   held at baseline (refactor is a separate change).
3. **Cloudflare dashboard settings** for `api.rayd8.app` recommended but applied
   outside this repo (code-level mitigations already in place).
4. **Pre-existing compiled smoke-test DB failures** (`normalized_email`
   not-null) are environmental and unrelated; the `src` suite is green.

---

## 7. Deploy & rollback

- **Order:** API first, then web. All new API fields are optional; the API
  fails closed on a missing `mediaQualified` (under-reports, never over-), so
  ship web promptly after API.
- **Rollback:** revert the commits; changes are additive/backward-compatible
  and introduce no DB migrations.

Full detail lives in the numbered pack alongside this summary
(`00-executive-summary.md` … `06-final-certification.md`).
