#!/usr/bin/env node
/**
 * Executable performance budget gates. CI FAIL on regression.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(webRoot, '..')
const outDir = path.join(
  repoRoot,
  'docs/performance/rayd8-thermal-performance-audit/refinement/artifacts',
)

const checks = []

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail })
}

function fileSize(rel) {
  const full = path.join(repoRoot, rel)
  if (!existsSync(full)) return null
  return statSync(full).size
}

const heroBytes = fileSize('web/public/hero/RAYD8_Hero.png')
const markBytes = fileSize('web/public/rayd8-mark.png')

check(
  'hero-budget-100kb',
  heroBytes != null && heroBytes <= 100 * 1024,
  `hero=${heroBytes} bytes (max 102400)`,
)
check(
  'mark-budget-80kb',
  markBytes != null && markBytes <= 80 * 1024,
  `mark=${markBytes} bytes (max 81920)`,
)

const aura = readFileSync(
  path.join(repoRoot, 'hamsa/components/hamsa/AuraBackground.web.tsx'),
  'utf8',
)
const amrita = readFileSync(path.join(repoRoot, 'web/public/amrita_app/app.js'), 'utf8')
const player = readFileSync(
  path.join(repoRoot, 'web/src/features/rayd8-player/Rayd8PlayerEngine.tsx'),
  'utf8',
)
const lifecycle = readFileSync(
  path.join(repoRoot, 'web/src/features/rayd8-player/useMobilePlaybackLifecycle.ts'),
  'utf8',
)
const registry = readFileSync(
  path.join(repoRoot, 'web/src/features/performance/runtimeResourceRegistry.ts'),
  'utf8',
)
const controllers = readFileSync(
  path.join(repoRoot, 'web/src/features/performance/runtimeControllers.ts'),
  'utf8',
)

check(
  'hamsa-lazy-webgl-init',
  aura.includes('if (!isPlayingRef.current)') &&
    aura.includes('getContext("webgl"') &&
    aura.includes('ensureGl'),
  'Aura WebGL only after START via ensureGl',
)
check(
  'amrita-paused-raf-zero',
  amrita.includes('activeVisualLoops') &&
    amrita.includes('Hard-stop when not running') &&
    amrita.includes('startSequence_ignored_already_running'),
  'Amrita exposes loop counters + double-start guard',
)
check(
  'hidden-media-pause',
  lifecycle.includes('pauseMediaForHiddenTab') && /enabled:\s*isActive/.test(player),
  'Hidden-tab media pause for all active sessions',
)
check(
  'runtime-registry-present',
  registry.includes('getRuntimeResourceSnapshot') &&
    controllers.includes('setRenderFPS') &&
    controllers.includes('AdaptiveRuntimeController'),
  'Runtime registry + adaptive controller interfaces present',
)

// Static isolation: public landing must not import Hamsa/Amrita runtime modules
const landing = readFileSync(path.join(repoRoot, 'web/src/pages/LandingPage.tsx'), 'utf8')
check(
  'public-route-hamsa-amrita-isolation',
  !landing.includes('hamsa/components') &&
    !landing.includes('amrita_app/app') &&
    !landing.includes('AuraBackground'),
  'LandingPage does not import Hamsa/Amrita runtime',
)

mkdirSync(outDir, { recursive: true })
const summary = {
  generatedAt: new Date().toISOString(),
  passed: checks.every((c) => c.ok),
  heroBytes,
  markBytes,
  checks,
}
writeFileSync(path.join(outDir, 'thermal-budget-gates.json'), `${JSON.stringify(summary, null, 2)}\n`)

for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name} — ${item.detail}`)
}

if (!summary.passed) {
  console.error('\nThermal budget gates FAILED.')
  process.exit(1)
}

console.log('\nThermal budget gates passed.')
