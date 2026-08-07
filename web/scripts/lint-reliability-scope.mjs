#!/usr/bin/env node
/**
 * Baseline-aware lint gate for the reliability repair scope.
 *
 * - New/modified modules must be 100% clean (0 errors).
 * - Rayd8PlayerEngine.tsx has a documented pre-existing baseline of
 *   react-hooks/refs errors (accessing .current during render). The gate fails
 *   only if the engine introduces a NEW error beyond that baseline.
 */

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, '..')

const CLEAN_FILES = [
  'src/services/api.ts',
  'src/services/player.ts',
  'src/services/playerTransport.ts',
  'src/features/session/SessionProvider.tsx',
  'src/features/rayd8-player/sessionStartupTaxonomy.ts',
  'src/features/rayd8-player/sessionStartupTelemetry.ts',
  'src/features/rayd8-player/mediaController.ts',
  'src/features/rayd8-player/startupStageMachine.ts',
  'src/features/rayd8-player/browserBlockDetection.ts',
  'src/features/rayd8-player/mediaQualification.ts',
  'src/features/rayd8-player/mediaQualificationReporter.ts',
  'src/features/rayd8-player/startupInstrumentation.ts',
]

const ENGINE_FILE = 'src/features/rayd8-player/Rayd8PlayerEngine.tsx'
// Pre-existing baseline: react-hooks/refs errors present before this repair.
const ENGINE_REFS_BASELINE = 4

function runEslint(files, json = false) {
  return new Promise((resolvePromise) => {
    const args = ['eslint', ...(json ? ['--format', 'json'] : []), ...files]
    const child = spawn('npx', args, { cwd: webRoot })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (c) => (stdout += String(c)))
    child.stderr?.on('data', (c) => (stderr += String(c)))
    child.on('close', (code) => resolvePromise({ code: code ?? 1, stdout, stderr }))
    child.on('error', () => resolvePromise({ code: 1, stdout, stderr }))
  })
}

async function main() {
  // 1) Clean scope must have zero errors.
  const clean = await runEslint(CLEAN_FILES)
  if (clean.code !== 0) {
    console.log('Clean-scope lint FAILED:')
    console.log(clean.stdout)
    console.log(clean.stderr)
    process.exitCode = 1
    return
  }
  console.log(`Clean-scope lint: ${CLEAN_FILES.length} files, 0 errors`)

  // 2) Engine must not exceed the documented react-hooks/refs baseline and
  //    must not introduce any other error type.
  const engine = await runEslint([ENGINE_FILE], true)
  let refsErrors = 0
  let otherErrors = 0
  try {
    const report = JSON.parse(engine.stdout)
    const messages = report[0]?.messages ?? []
    for (const message of messages) {
      if (message.severity !== 2) continue
      if (message.ruleId === 'react-hooks/refs') {
        refsErrors += 1
      } else {
        otherErrors += 1
      }
    }
  } catch {
    console.log('Engine lint: could not parse eslint JSON output')
    process.exitCode = 1
    return
  }

  if (otherErrors > 0) {
    console.log(`Engine lint FAILED: ${otherErrors} new non-refs error(s) introduced`)
    process.exitCode = 1
    return
  }

  if (refsErrors > ENGINE_REFS_BASELINE) {
    console.log(
      `Engine lint FAILED: react-hooks/refs errors ${refsErrors} exceed baseline ${ENGINE_REFS_BASELINE}`,
    )
    process.exitCode = 1
    return
  }

  console.log(
    `Engine lint: ${refsErrors} react-hooks/refs error(s) at/below baseline ${ENGINE_REFS_BASELINE}, 0 new error types`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
