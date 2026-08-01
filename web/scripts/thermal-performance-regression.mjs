#!/usr/bin/env node
/**
 * Static + lightweight runtime regression guards for the thermal audit.
 * Fails closed if Priority-0 protections regress.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(webRoot, '..')
const outDir = path.join(
  repoRoot,
  'docs/performance/rayd8-thermal-performance-audit/artifacts',
)

const checks = []

function read(rel) {
  return readFileSync(path.join(repoRoot, rel), 'utf8')
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail })
}

const aura = read('hamsa/components/hamsa/AuraBackground.web.tsx')
const glyph = read('hamsa/components/hamsa/GlyphBackground.web.tsx')
const hand = read('hamsa/components/hamsa/HandOutlineGlow.web.tsx')
const gate = read('hamsa/utils/webglRenderLoop.ts')
const player = read('web/src/features/rayd8-player/Rayd8PlayerEngine.tsx')
const lifecycle = read('web/src/features/rayd8-player/useMobilePlaybackLifecycle.ts')
const amrita = read('web/public/amrita_app/app.js')
const shell = read('web/src/components/DashboardShell.tsx')
const hero = read('web/src/features/landing/HeroSection.tsx')
const auth = read('web/src/features/auth/useAuthReadiness.ts')
const session = read('web/src/features/session/SessionProvider.tsx')

check(
  'hamsa-webgl-gate-exists',
  gate.includes('shouldRunHamsaWebglLoop') && gate.includes('HAMSA_WEBGL_TARGET_FPS = 30'),
  'shared 30 FPS gate helper',
)
check(
  'hamsa-lazy-webgl',
  aura.includes('ensureGl') && aura.includes('if (!isPlayingRef.current)'),
  'Hamsa Aura defers WebGL until START',
)
check('hamsa-aura-uses-gate', aura.includes('shouldRunHamsaWebglLoop'), 'AuraBackground gated')
check('hamsa-glyph-uses-gate', glyph.includes('shouldRunHamsaWebglLoop'), 'GlyphBackground gated')
check('hamsa-hand-uses-gate', hand.includes('shouldRunHamsaWebglLoop'), 'HandOutlineGlow gated')
check(
  'hamsa-aura-lose-context',
  aura.includes('WEBGL_lose_context'),
  'Aura releases WebGL on unmount',
)
check(
  'player-visibility-all-sessions',
  /enabled:\s*isActive/.test(player),
  'visibility lifecycle enabled for all active sessions',
)
check(
  'player-pauses-on-hide',
  lifecycle.includes('pauseMediaForHiddenTab') && lifecycle.includes('video.pause('),
  'tab hide pauses media',
)
check(
  'player-default-performance-presentation',
  player.includes("VITE_RAYD8_PLAYBACK_PRESENTATION_MODE === 'cinematic'"),
  'performance presentation is default',
)
check(
  'amrita-cancel-raf-on-pause',
  amrita.includes('Stop the render loop while paused') &&
    amrita.includes('cancelAnimationFrame(state.frameId)') &&
    amrita.includes('Hard-stop when not running'),
  'Amrita cancels rAF while paused/hidden and does not re-arm',
)
check(
  'dashboard-session-minimal-ambient',
  shell.includes("isSessionActive") && shell.includes("'minimal'"),
  'dashboard drops ambient during active sessions',
)
check(
  'hero-uses-optimized-still',
  hero.includes('RAYD8_Hero.png') && !hero.includes('RAYD8-Premium.png'),
  'hero LCP still is optimized asset',
)
check(
  'auth-token-uses-cache',
  auth.includes('options?.forceRefresh') &&
    auth.includes("options?.forceRefresh ? { skipCache: true } : undefined") &&
    !/await getToken\(\{\s*skipCache:\s*true\s*\}\)/.test(auth.replace(/\n/g, ' ')),
  'getTokenSafe uses Clerk cache by default; skipCache only via forceRefresh',
)
check(
  'heartbeat-skips-when-hidden',
  session.includes("document.hidden") && session.includes('usage-heartbeat'),
  'session heartbeat skips while tab hidden',
)
check(
  'hero-asset-present',
  existsSync(path.join(webRoot, 'public/hero/RAYD8_Hero.png')),
  'optimized hero asset exists on disk',
)

mkdirSync(outDir, { recursive: true })
const summary = {
  generatedAt: new Date().toISOString(),
  passed: checks.every((c) => c.ok),
  checks,
}
writeFileSync(
  path.join(outDir, 'thermal-regression-summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
)

for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name} — ${item.detail}`)
}

if (!summary.passed) {
  console.error('\nThermal regression checks failed.')
  process.exit(1)
}

console.log('\nThermal regression checks passed.')
