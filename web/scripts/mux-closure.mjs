#!/usr/bin/env node
/**
 * Release-only Mux closure orchestrator.
 * Runs shorter closure scenarios; 30m dual soak is opt-in via RAYD8_MUX_CLOSURE_INCLUDE_30M=1.
 *
 * Not for PR CI.
 */

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, '..')
const outDir = resolve(
  webRoot,
  '../docs/release-gate/mux-video-optimization/artifacts/final-closure',
)

function run(label, env = {}) {
  return new Promise((resolvePromise, reject) => {
    console.log(`\n=== ${label} ===`)
    const child = spawn('node', ['scripts/mux-playback-stability.mjs'], {
      cwd: webRoot,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    })
    child.on('exit', (code) => {
      if (code === 0) resolvePromise({ label, code })
      else reject(new Error(`${label} failed with code ${code}`))
    })
  })
}

function runAmrita(label, env = {}) {
  return new Promise((resolvePromise, reject) => {
    console.log(`\n=== ${label} ===`)
    const child = spawn('node', ['scripts/amrita-mux-stability.mjs'], {
      cwd: webRoot,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    })
    child.on('exit', (code) => {
      if (code === 0) resolvePromise({ label, code })
      else reject(new Error(`${label} failed with code ${code}`))
    })
  })
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  const base = {
    RAYD8_MUX_FINAL_CLOSURE: '1',
    RAYD8_MUX_STABILITY_MODE: 'soak',
    RAYD8_MUX_REQUIRE_DUAL_AUDIO: '1',
  }

  const results = []
  results.push(
    await run('closure-offline-dual-3m', {
      ...base,
      RAYD8_MUX_STABILITY_SCENARIO: 'offline',
      RAYD8_MUX_SOAK_MS: String(3 * 60_000),
    }),
  )
  results.push(
    await run('closure-fullscreen-dual-3m', {
      ...base,
      RAYD8_MUX_STABILITY_SCENARIO: 'fullscreen',
      RAYD8_MUX_SOAK_MS: String(3 * 60_000),
    }),
  )
  results.push(
    await run('closure-lifecycle-5x', {
      ...base,
      RAYD8_MUX_STABILITY_SCENARIO: 'lifecycle',
      RAYD8_MUX_SOAK_MS: String(2 * 60_000),
    }),
  )

  if (process.env.RAYD8_MUX_CLOSURE_INCLUDE_AMRITA !== '0') {
    results.push(
      await runAmrita('amrita-audio-only-short', {
        RAYD8_AMRITA_SOAK_MODE: 'audio_only',
        RAYD8_MUX_SOAK_MS: String(Number(process.env.RAYD8_AMRITA_SHORT_MS ?? 120_000)),
      }),
    )
    results.push(
      await runAmrita('amrita-visuals-only-short', {
        RAYD8_AMRITA_SOAK_MODE: 'visuals_only',
        RAYD8_MUX_SOAK_MS: String(Number(process.env.RAYD8_AMRITA_SHORT_MS ?? 120_000)),
      }),
    )
  }

  if (process.env.RAYD8_MUX_CLOSURE_INCLUDE_30M === '1') {
    results.push(
      await run('closure-30m-dual', {
        ...base,
        RAYD8_MUX_STABILITY_SCENARIO: 'default',
        RAYD8_MUX_SOAK_MS: String(30 * 60_000),
      }),
    )
  }

  const summary = {
    finishedAt: new Date().toISOString(),
    results,
    note: 'Release-only closure orchestrator',
  }
  const path = resolve(outDir, `closure-orchestrator-${Date.now()}.json`)
  writeFileSync(path, JSON.stringify(summary, null, 2))
  console.log(`\nWrote ${path}`)
  console.log('CLOSURE_ORCHESTRATOR_COMPLETE')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
