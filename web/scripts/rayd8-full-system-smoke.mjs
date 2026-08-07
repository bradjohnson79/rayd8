#!/usr/bin/env node
/**
 * RAYD8 full-system smoke certification orchestrator.
 *
 * Runs gates A–N and prints a release scorecard. Deterministic gates (unit,
 * contract, typecheck, lint, build, static assertions) always run. Live gates
 * (browser matrix, Mux/AMRITA stability, live session lifecycle) require
 * `--live` plus running web+api and the mux-soak auth fixture; otherwise they
 * report SKIP so the deterministic certification still completes.
 *
 * Usage:
 *   node scripts/rayd8-full-system-smoke.mjs           # deterministic gates
 *   node scripts/rayd8-full-system-smoke.mjs --live    # + browser/live gates
 *
 * Exit code is non-zero if any non-skipped gate fails.
 * Never prints signed URLs or JWTs.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, '..')
const repoRoot = resolve(webRoot, '..')
const apiRoot = resolve(repoRoot, 'api')

const LIVE = process.argv.includes('--live')
const TSX = resolve(apiRoot, 'node_modules/tsx/dist/esm/index.mjs')
const authFixture = resolve(webRoot, 'e2e/.auth/mux-soak.env')
const clerkKey = process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY

function liveReadiness() {
  if (!LIVE) return { ok: false, reason: 'requires --live' }
  if (!existsSync(authFixture)) return { ok: false, reason: 'auth fixture missing' }
  if (!clerkKey) return { ok: false, reason: 'CLERK_PUBLISHABLE_KEY not set' }
  return { ok: true, reason: '' }
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
      results.push({ gate, label, status, durationMs, detail: code === 0 ? '' : `exit ${code}` })
      if (code !== 0 && options.quiet && stderr) {
        console.log(`\n[${gate}] ${label} stderr (tail):`)
        console.log(stderr.split('\n').slice(-25).join('\n'))
      }
      console.log(`  [${status}] ${gate} — ${label} (${(durationMs / 1000).toFixed(1)}s)`)
      resolvePromise(code === 0)
    })
    child.on('error', (error) => {
      results.push({ gate, label, status: 'FAIL', durationMs: 0, detail: String(error) })
      console.log(`  [FAIL] ${gate} — ${label} (spawn error)`)
      resolvePromise(false)
    })
  })
}

function skip(gate, label, reason) {
  results.push({ gate, label, status: 'SKIP', durationMs: 0, detail: reason })
  console.log(`  [SKIP] ${gate} — ${label} (${reason})`)
}

function nodeTest(files, cwd = webRoot) {
  return ['--import', TSX, '--test', ...files]
}

async function main() {
  console.log('RAYD8 full-system smoke certification')
  console.log(`mode: ${LIVE ? 'deterministic + live' : 'deterministic'}\n`)

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
    { cwd: apiRoot, quiet: true },
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
    { quiet: true },
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
    { cwd: apiRoot, quiet: true },
  )

  // L — Browser smoke matrix (Chrome/Firefox/WebKit) — live only
  const live = liveReadiness()
  if (live.ok) {
    for (const browser of ['chromium', 'firefox', 'webkit']) {
      await runCommand(
        'L',
        `Browser smoke (${browser})`,
        'node',
        ['scripts/mux-playback-stability.mjs'],
        {
          cwd: webRoot,
          env: {
            RAYD8_MUX_STABILITY_MODE: 'smoke',
            RAYD8_MUX_STABILITY_BROWSER: browser,
          },
        },
      )
    }
  } else {
    skip('L', 'Browser smoke matrix', live.reason)
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
      env: { RAYD8_MUX_STABILITY_MODE: 'smoke' },
    })
    await runCommand('N', 'AMRITA stability smoke', 'node', ['scripts/amrita-mux-stability.mjs'], {
      cwd: webRoot,
      env: { RAYD8_AMRITA_SOAK_MODE: 'reduced', RAYD8_MUX_SOAK_MS: '60000' },
    })
  } else {
    skip('N', 'Live Mux + AMRITA stability', live.reason)
  }

  // Scorecard
  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  const skipped = results.filter((r) => r.status === 'SKIP').length

  console.log('\n=== RAYD8 smoke scorecard ===')
  for (const r of results) {
    const detail = r.detail ? ` — ${r.detail}` : ''
    console.log(`  ${r.status.padEnd(4)}  ${r.gate}  ${r.label}${detail}`)
  }
  console.log(`\n  PASS ${pass}  FAIL ${fail}  SKIP ${skipped}`)

  if (fail > 0) {
    console.log('\nVERDICT: NO-GO (one or more deterministic gates failed)')
    process.exitCode = 1
    return
  }

  if (skipped > 0) {
    console.log('\nVERDICT: CONDITIONAL GO (deterministic gates green; live gates skipped)')
    return
  }

  console.log('\nVERDICT: GO (all gates green)')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
