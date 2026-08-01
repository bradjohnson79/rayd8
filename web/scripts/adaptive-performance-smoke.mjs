#!/usr/bin/env node
/**
 * Lightweight adaptive performance smoke: unit suite + source invariants.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, '../docs/performance/adaptive-performance/artifacts')
mkdirSync(outDir, { recursive: true })

const result = spawnSync('npm', ['run', 'test:adaptive-units'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
})

const payload = {
  at: new Date().toISOString(),
  exitCode: result.status,
  pass: result.status === 0,
  stdoutTail: (result.stdout || '').split('\n').slice(-40),
  stderrTail: (result.stderr || '').split('\n').slice(-20),
}

writeFileSync(
  resolve(outDir, 'adaptive-unit-smoke.json'),
  `${JSON.stringify(payload, null, 2)}\n`,
)

console.log(result.stdout || '')
if (result.stderr) {
  console.error(result.stderr)
}
process.exit(result.status ?? 1)
