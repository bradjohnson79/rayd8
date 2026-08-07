#!/usr/bin/env node
/**
 * RAYD8 full-system smoke certification orchestrator (Phase 1 live closure).
 *
 * Runs gates A–N and prints a release scorecard. Deterministic gates (unit,
 * contract, typecheck, lint, build, static assertions) always run. Live gates
 * (browser matrix, Mux/AMRITA stability, live session lifecycle) require
 * `--live` plus running web+api and the mux-soak auth fixture; otherwise they
 * report SKIP so the deterministic certification still completes.
 *
 * Phase 1 live closure additions:
 *   - RAYD8_LIVE_BASE_URL env (or --live) threads RAYD8_MUX_STABILITY_BASE_URL
 *     to browser scripts so they target a live deploy instead of a local
 *     preview server.
 *   - Missing-credential / missing-auth-fixture handling reports UNEXECUTED
 *     (distinct from SKIP; never counted as PASS) when --live is requested.
 *     SKIP is reserved for intentional non-live mode (--live not passed).
 *   - Expanded live browser matrix: chromium, firefox, webkit, brave (shields
 *     on), brave (shields off), opera.
 *   - live-product-smoke.mjs and chromium-variant-investigation.mjs run after
 *     the browser matrix when live ready (UNEXECUTED if file missing).
 *   - JSON summary artifact written to
 *     docs/release-gate/master-reliability-repair/artifacts/live-closure/
 *     full-system-live-smoke-summary.json.
 *   - Clerk key loaded from web/.env.live-smoke (dotenv-style) when --live.
 *
 * Usage:
 *   node scripts/rayd8-full-system-smoke.mjs           # deterministic gates
 *   node scripts/rayd8-full-system-smoke.mjs --live    # + browser/live gates
 *   RAYD8_LIVE_BASE_URL=https://... node scripts/rayd8-full-system-smoke.mjs --live
 *
 * Exit code is non-zero if any non-skipped gate fails.
 * Never prints signed URLs or JWTs.
 */
import { spawn, execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, '..')
const repoRoot = resolve(webRoot, '..')
const apiRoot = resolve(repoRoot, 'api')

const LIVE = process.argv.includes('--live')
const TSX = resolve(apiRoot, 'node_modules/tsx/dist/esm/index.mjs')
const authFixture = resolve(webRoot, 'e2e/.auth/mux-soak.env')
const liveEnvPath = resolve(webRoot, '.env.live-smoke')
const artifactDir = resolve(
  repoRoot,
  'docs/release-gate/master-reliability-repair/artifacts/live-closure',
)
const artifactPath = resolve(artifactDir, 'full-system-live-smoke-summary.json')

// Load Clerk keys from gitignored env files when --live.
// Never prints values; only presence is reported.
function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const parsed = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const idx = trimmed.indexOf('=')
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    parsed[key] = value
  }
  return parsed
}

function loadLiveSmokeEnv() {
  if (!LIVE) return null
  // Publishable key from Vercel pull; secret/testing token from local root/.api env.
  const candidates = [
    liveEnvPath,
    resolve(webRoot, '.env.live-smoke.secrets'),
    resolve(repoRoot, '.env'),
    resolve(apiRoot, '.env'),
  ]
  const merged = {}
  for (const path of candidates) {
    Object.assign(merged, parseEnvFile(path))
  }
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
  if (!process.env.CLERK_PUBLISHABLE_KEY && process.env.VITE_CLERK_PUBLISHABLE_KEY) {
    process.env.CLERK_PUBLISHABLE_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY
  }
  return merged
}

const liveSmokeEnv = loadLiveSmokeEnv()
const clerkKey =
  process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY

// Base URL threaded to browser scripts as RAYD8_MUX_STABILITY_BASE_URL.
const liveBaseUrl = process.env.RAYD8_LIVE_BASE_URL || null

function gitHead(cwd) {
  try {
    return execSync('git rev-parse HEAD', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return null
  }
}

function lastCommitTouching(path, cwd) {
  try {
    return execSync(`git log -1 --format=%H -- ${path}`, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return null
  }
}

function liveReadiness() {
  const reasons = []
  if (!existsSync(authFixture)) reasons.push('auth fixture missing')
  if (!clerkKey) reasons.push('CLERK_PUBLISHABLE_KEY not set')
  const credsOk = reasons.length === 0
  return {
    ok: LIVE && credsOk,
    liveRequested: LIVE,
    credsOk,
    reasons,
    liveBaseUrl,
  }
}

const results = []

function runCommand(label, gate, command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const startedAt = Date.now()
    const child = spawn(command, args, {
      cwd: options.cwd ?? webRoot,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.quiet ? 'pipe' : 'inherit',
    })
    let stderr = ''
    if (options.quiet) {
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk)
      })
    }
    child.on('close', (code) => {
      const durationMs = Date.now() - startedAt
      const status = code === 0 ? 'PASS' : 'FAIL'
      results.push({
        gate,
        label,
        field: options.field ?? null,
        status,
        durationMs,
        detail: code === 0 ? '' : `exit ${code}`,
      })
      if (code !== 0 && options.quiet && stderr) {
        console.log(`\n[${gate}] ${label} stderr (tail):`)
        console.log(stderr.split('\n').slice(-25).join('\n'))
      }
      console.log(`  [${status}] ${gate} — ${label} (${(durationMs / 1000).toFixed(1)}s)`)
      resolvePromise(code === 0)
    })
    child.on('error', (error) => {
      results.push({
        gate,
        label,
        field: options.field ?? null,
        status: 'FAIL',
        durationMs: 0,
        detail: String(error),
      })
      console.log(`  [FAIL] ${gate} — ${label} (spawn error)`)
      resolvePromise(false)
    })
  })
}

function skip(gate, label, reason, field = null) {
  results.push({ gate, label, field, status: 'SKIP', durationMs: 0, detail: reason })
  console.log(`  [SKIP] ${gate} — ${label} (${reason})`)
}

function unexecuted(gate, label, reason, field = null) {
  results.push({
    gate,
    label,
    field,
    status: 'UNEXECUTED',
    durationMs: 0,
    detail: reason,
  })
  console.log(`  [UNEXECUTED] ${gate} — ${label} (${reason})`)
}

function nodeTest(files, cwd = webRoot) {
  return ['--import', TSX, '--test', ...files]
}

// Browser stability env threaded to mux-playback-stability.mjs. When a live
// base URL is configured, it is forwarded as RAYD8_MUX_STABILITY_BASE_URL so
// the harness targets the live deploy instead of starting a local preview.
function browserStabilityEnv(extra = {}) {
  const env = {
    RAYD8_MUX_STABILITY_MODE: 'smoke',
    ...extra,
  }
  if (liveBaseUrl) {
    env.RAYD8_MUX_STABILITY_BASE_URL = liveBaseUrl
  }
  return env
}

async function main() {
  console.log('RAYD8 full-system smoke certification')
  console.log(`mode: ${LIVE ? 'deterministic + live' : 'deterministic'}`)
  if (LIVE) {
    console.log(
      `live base url: ${liveBaseUrl ? '<set>' : '<unset — harness starts local preview>'}`,
    )
    console.log(`clerk key: ${clerkKey ? '<present>' : '<missing>'}`)
    console.log(`auth fixture: ${existsSync(authFixture) ? '<present>' : '<missing>'}`)
    console.log(`live-smoke env: ${liveSmokeEnv ? '<loaded>' : '<absent>'}`)
  }
  console.log()

  // A — API typecheck
  await runCommand('A', 'API typecheck', 'npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
    cwd: apiRoot,
    quiet: true,
  })

  // B — API unit + contract tests (player reliability, usage qualification,
  // session-end idempotency, reconciliation, mux ttl)
  await runCommand(
    'B',
    'API unit + contract tests',
    'npx',
    [
      'vitest',
      'run',
      'src/routes/player.master-reliability.test.ts',
      'src/services/player/usageQualification.test.ts',
      'src/services/player/usageTracking.end.idempotency.test.ts',
      'src/services/player/staleSessionReconciliation.test.ts',
      'src/services/admin/muxAdmin.ttl.test.ts',
    ],
    { cwd: apiRoot, quiet: true, field: 'sessionEnd' },
  )

  // C — Web typecheck
  await runCommand('C', 'Web typecheck', 'npx', ['tsc', '-b'], { cwd: webRoot, quiet: true })

  // D — Web lint (baseline-aware reliability scope)
  await runCommand('D', 'Web lint (reliability scope)', 'node', [
    'scripts/lint-reliability-scope.mjs',
  ], { cwd: webRoot, quiet: true })

  // E — Web API transport tests (timeout/abort/correlation/retry)
  await runCommand(
    'E',
    'Web API transport tests',
    'node',
    nodeTest(['src/services/api.transport.test.ts', 'src/services/api.playerTransport.test.ts']),
    { quiet: true },
  )

  // F — Startup taxonomy + stage machine tests
  await runCommand(
    'F',
    'Startup taxonomy + stage machine',
    'node',
    nodeTest([
      'src/features/rayd8-player/sessionStartupTaxonomy.test.ts',
      'src/features/rayd8-player/startupStageMachine.test.ts',
    ]),
    { quiet: true },
  )

  // G — Browser-block + media-qualification + instrumentation tests
  await runCommand(
    'G',
    'Browser-block + media qualification + instrumentation',
    'node',
    nodeTest([
      'src/features/rayd8-player/browserBlockDetection.test.ts',
      'src/features/rayd8-player/mediaQualification.test.ts',
      'src/features/rayd8-player/startupInstrumentation.test.ts',
    ]),
    { quiet: true },
  )

  // H — Health / recovery / av-sync / telemetry unit tests
  await runCommand(
    'H',
    'Health + recovery + av-sync + telemetry',
    'node',
    nodeTest([
      'src/features/rayd8-player/playbackHealthStateMachine.test.ts',
      'src/features/playback-authority/recoveryStateMachine.test.ts',
      'src/features/rayd8-player/avSyncController.test.ts',
      'src/features/rayd8-player/playbackIncidentTelemetry.test.ts',
      'src/features/rayd8-player/mediaController.forceReload.test.ts',
    ]),
    { quiet: true, field: 'telemetry' },
  )

  // I — Static assertion: no legacy playback-prompt overlays
  await runCommand('I', 'No-playback-prompt static assertion', 'node', [
    'scripts/assert-no-playback-prompt.mjs',
  ], { quiet: true })

  // J — Web production build
  await runCommand('J', 'Web production build', 'npx', ['vite', 'build'], {
    cwd: webRoot,
    quiet: true,
  })

  // K — Session idempotency + usage qualification contract (explicit gate for
  // the incidents; re-asserts the API contract in isolation)
  await runCommand(
    'K',
    'Session idempotency + usage qualification contract',
    'npx',
    [
      'vitest',
      'run',
      'src/routes/player.master-reliability.test.ts',
      'src/services/player/usageQualification.test.ts',
    ],
    { cwd: apiRoot, quiet: true, field: 'usageQualification' },
  )

  // L — Browser smoke matrix — live only.
  // Phase 1 expanded matrix: chromium, firefox, webkit, brave (shields on),
  // brave (shields off), opera. Each via mux-playback-stability.mjs with
  // RAYD8_MUX_STABILITY_MODE=smoke and RAYD8_MUX_STABILITY_BROWSER=<name>.
  const live = liveReadiness()
  const browserMatrix = [
    { field: 'chrome', browser: 'chromium', extra: {} },
    { field: 'firefox', browser: 'firefox', extra: {} },
    { field: 'webkit', browser: 'webkit', extra: {} },
    { field: 'braveShieldsOn', browser: 'brave', extra: { RAYD8_BRAVE_SHIELDS: 'on' } },
    { field: 'braveShieldsOff', browser: 'brave', extra: { RAYD8_BRAVE_SHIELDS: 'off' } },
    { field: 'opera', browser: 'opera', extra: {} },
  ]

  function shieldsTag(entry) {
    return entry.extra.RAYD8_BRAVE_SHIELDS ? ` shields ${entry.extra.RAYD8_BRAVE_SHIELDS}` : ''
  }

  if (live.ok) {
    for (const entry of browserMatrix) {
      await runCommand(
        'L',
        `Browser smoke (${entry.browser}${shieldsTag(entry)})`,
        'node',
        ['scripts/mux-playback-stability.mjs'],
        {
          cwd: webRoot,
          field: entry.field,
          env: browserStabilityEnv({
            RAYD8_MUX_STABILITY_BROWSER: entry.browser,
            ...entry.extra,
          }),
        },
      )
    }
  } else if (live.liveRequested) {
    // --live requested but credentials/fixture missing -> UNEXECUTED (not SKIP)
    const reason = live.reasons.join('; ')
    for (const entry of browserMatrix) {
      unexecuted('L', `Browser smoke (${entry.browser}${shieldsTag(entry)})`, reason, entry.field)
    }
  } else {
    // Intentional non-live mode -> SKIP
    for (const entry of browserMatrix) {
      skip('L', `Browser smoke (${entry.browser}${shieldsTag(entry)})`, 'requires --live', entry.field)
    }
  }

  // M — Brave browser-block classification (unit-level; Brave runtime is a
  // manual/conditional gate documented in the release pack)
  await runCommand(
    'M',
    'Brave browser-block classification',
    'node',
    nodeTest(['src/features/rayd8-player/browserBlockDetection.test.ts']),
    { quiet: true },
  )

  // N — Live full-system smoke (Mux + AMRITA stability) — live only
  if (live.ok) {
    await runCommand('N', 'Mux stability smoke', 'node', ['scripts/mux-playback-stability.mjs'], {
      cwd: webRoot,
      field: 'regen',
      env: browserStabilityEnv(),
    })
    await runCommand('N', 'AMRITA stability smoke', 'node', ['scripts/amrita-mux-stability.mjs'], {
      cwd: webRoot,
      field: 'amrita',
      env: {
        RAYD8_AMRITA_SOAK_MODE: 'reduced',
        RAYD8_MUX_SOAK_MS: '60000',
        ...(liveBaseUrl ? { RAYD8_MUX_STABILITY_BASE_URL: liveBaseUrl } : {}),
      },
    })
  } else if (live.liveRequested) {
    const reason = live.reasons.join('; ')
    unexecuted('N', 'Mux stability smoke', reason, 'regen')
    unexecuted('N', 'AMRITA stability smoke', reason, 'amrita')
  } else {
    skip('N', 'Mux stability smoke', 'requires --live', 'regen')
    skip('N', 'AMRITA stability smoke', 'requires --live', 'amrita')
  }

  // O — Live product smoke + chromium variant investigation — live only.
  // Phase 1: run if the script files exist; otherwise UNEXECUTED with reason
  // "file missing". live-product-smoke.mjs populates product-level live smoke
  // fields; chromium-variant-investigation.mjs is a chromium-specific probe.
  const liveProductSmokePath = resolve(webRoot, 'scripts/live-product-smoke.mjs')
  const chromiumVariantPath = resolve(webRoot, 'scripts/chromium-variant-investigation.mjs')
  const liveProductFields = [
    'cors',
    'playbackToken',
    'hamsa',
    'globalPlayer',
    'guidedMeditation',
    'crossProductHandoff',
    'secondSession',
  ]

  if (live.ok) {
    if (existsSync(liveProductSmokePath)) {
      await runCommand('O', 'Live product smoke', 'node', ['scripts/live-product-smoke.mjs'], {
        cwd: webRoot,
        field: 'liveProduct',
        env: liveBaseUrl ? { RAYD8_LIVE_BASE_URL: liveBaseUrl } : {},
      })
    } else {
      for (const field of liveProductFields) {
        unexecuted('O', `Live product smoke (${field})`, 'file missing: scripts/live-product-smoke.mjs', field)
      }
    }
    if (existsSync(chromiumVariantPath)) {
      await runCommand(
        'O',
        'Chromium variant investigation',
        'node',
        ['scripts/chromium-variant-investigation.mjs'],
        {
          cwd: webRoot,
          field: 'chromiumVariant',
          env: liveBaseUrl ? { RAYD8_LIVE_BASE_URL: liveBaseUrl } : {},
        },
      )
    } else {
      unexecuted(
        'O',
        'Chromium variant investigation',
        'file missing: scripts/chromium-variant-investigation.mjs',
        'chromiumVariant',
      )
    }
  } else if (live.liveRequested) {
    const reason = live.reasons.join('; ')
    for (const field of liveProductFields) {
      unexecuted('O', `Live product smoke (${field})`, reason, field)
    }
    unexecuted('O', 'Chromium variant investigation', reason, 'chromiumVariant')
  } else {
    for (const field of liveProductFields) {
      skip('O', `Live product smoke (${field})`, 'requires --live', field)
    }
    skip('O', 'Chromium variant investigation', 'requires --live', 'chromiumVariant')
  }

  await writeScorecardAndArtifact(live)
}

function fieldStatus(field) {
  const matching = results.filter((r) => r.field === field)
  if (matching.length === 0) return { status: 'UNEXECUTED', detail: 'no gate mapped to field' }
  // FAIL dominates; then UNEXECUTED; then SKIP; then PASS
  const fail = matching.find((r) => r.status === 'FAIL')
  if (fail) return { status: 'FAIL', detail: fail.detail }
  const unexec = matching.find((r) => r.status === 'UNEXECUTED')
  if (unexec) return { status: 'UNEXECUTED', detail: unexec.detail }
  const skipEntry = matching.find((r) => r.status === 'SKIP')
  if (skipEntry) return { status: 'SKIP', detail: skipEntry.detail }
  return { status: 'PASS', detail: '' }
}

function computeOverall(live) {
  const hasFail = results.some((r) => r.status === 'FAIL')
  if (hasFail) return 'NO-GO'

  const unexecutedEntries = results.filter((r) => r.status === 'UNEXECUTED')
  if (unexecutedEntries.length > 0) {
    if (live.liveRequested) {
      // --live requested but required live gates did not execute (e.g. missing
      // credentials or missing script files) -> not GO.
      return 'NO-GO'
    }
    // Live wasn't requested; required live gates are UNEXECUTED -> CONDITIONAL GO
    return 'CONDITIONAL GO'
  }

  const hasSkip = results.some((r) => r.status === 'SKIP')
  if (hasSkip) {
    // SKIP only happens for intentional non-live mode when --live not passed.
    // Deterministic gates all PASS -> CONDITIONAL GO.
    return 'CONDITIONAL GO'
  }

  return 'GO'
}

async function writeScorecardAndArtifact(live) {
  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  const skipped = results.filter((r) => r.status === 'SKIP').length
  const unexec = results.filter((r) => r.status === 'UNEXECUTED').length

  console.log('\n=== RAYD8 smoke scorecard ===')
  for (const r of results) {
    const detail = r.detail ? ` — ${r.detail}` : ''
    console.log(`  ${r.status.padEnd(11)}  ${r.gate}  ${r.label}${detail}`)
  }
  console.log(`\n  PASS ${pass}  FAIL ${fail}  SKIP ${skipped}  UNEXECUTED ${unexec}`)

  const overall = computeOverall(live)

  // Build the JSON summary artifact.
  const artifactFields = [
    'chrome',
    'firefox',
    'webkit',
    'braveShieldsOn',
    'braveShieldsOff',
    'opera',
    'cors',
    'playbackToken',
    'regen',
    'amrita',
    'hamsa',
    'globalPlayer',
    'guidedMeditation',
    'crossProductHandoff',
    'usageQualification',
    'sessionEnd',
    'secondSession',
    'telemetry',
  ]
  const fieldSummary = {}
  for (const field of artifactFields) {
    fieldSummary[field] = fieldStatus(field)
  }

  const artifact = {
    releaseSha: gitHead(repoRoot),
    apiSha: lastCommitTouching('api', repoRoot) || gitHead(repoRoot),
    webSha: lastCommitTouching('web', repoRoot) || gitHead(repoRoot),
    timestamp: new Date().toISOString(),
    environment: LIVE
      ? (liveBaseUrl ? 'live-deploy' : 'live-local-preview')
      : 'deterministic-only',
    chrome: fieldSummary.chrome.status,
    firefox: fieldSummary.firefox.status,
    webkit: fieldSummary.webkit.status,
    braveShieldsOn: fieldSummary.braveShieldsOn.status,
    braveShieldsOff: fieldSummary.braveShieldsOff.status,
    opera: fieldSummary.opera.status,
    cors: fieldSummary.cors.status,
    playbackToken: fieldSummary.playbackToken.status,
    regen: fieldSummary.regen.status,
    amrita: fieldSummary.amrita.status,
    hamsa: fieldSummary.hamsa.status,
    globalPlayer: fieldSummary.globalPlayer.status,
    guidedMeditation: fieldSummary.guidedMeditation.status,
    crossProductHandoff: fieldSummary.crossProductHandoff.status,
    usageQualification: fieldSummary.usageQualification.status,
    sessionEnd: fieldSummary.sessionEnd.status,
    secondSession: fieldSummary.secondSession.status,
    telemetry: fieldSummary.telemetry.status,
    overall,
  }

  mkdirSync(artifactDir, { recursive: true })
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(`\nWrote live-closure summary: ${artifactPath}`)

  // Verdict line (never prints secrets).
  if (overall === 'NO-GO') {
    console.log('\nVERDICT: NO-GO (one or more gates failed or required live gates did not execute)')
    process.exitCode = 1
    return
  }

  if (overall === 'CONDITIONAL GO') {
    console.log('\nVERDICT: CONDITIONAL GO (deterministic gates green; live gates skipped or unexecuted)')
    return
  }

  console.log('\nVERDICT: GO (all gates green)')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
