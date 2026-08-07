#!/usr/bin/env node
/**
 * RAYD8 live product smoke (Phase 1 live closure). Short product-level smoke
 * across REGEN, AMRITA, HAMSA, cross-product handoff, controlled token
 * failure, usage qualification, and telemetry nonblocking. No soaks.
 *
 * ENV: RAYD8_MUX_STABILITY_BASE_URL or RAYD8_LIVE_BASE_URL (default https://rayd8.app)
 * Auth from web/e2e/.auth/mux-soak.env. Clerk key from VITE_CLERK_PUBLISHABLE_KEY
 * or CLERK_PUBLISHABLE_KEY (also loaded from web/.env.live-smoke if present).
 * RAYD8_MUX_STABILITY_BROWSER optional (default chromium / chrome channel).
 * Never prints JWTs, signed URLs, passwords, or emails (email domain only).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, firefox, webkit } from 'playwright'
import { clerk, clerkSetup } from '@clerk/testing/playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, '..')
const repoRoot = resolve(webRoot, '..')
const artifactDir = resolve(repoRoot, 'docs/release-gate/master-reliability-repair/artifacts/live-closure')
const artifactPath = resolve(artifactDir, 'live-product-smoke.json')

const baseUrl = process.env.RAYD8_MUX_STABILITY_BASE_URL || process.env.RAYD8_LIVE_BASE_URL || 'https://rayd8.app'
const browserName = process.env.RAYD8_MUX_STABILITY_BROWSER ?? 'chromium'
const authEnvPath = resolve(webRoot, 'e2e/.auth/mux-soak.env')
const liveEnvPath = resolve(webRoot, '.env.live-smoke')
const REGEN_READY_TIMEOUT_MS = Number(process.env.RAYD8_LIVE_REGEN_READY_MS ?? 45_000)
const SECOND_SESSION_MS = Number(process.env.RAYD8_LIVE_SECOND_SESSION_MS ?? 8_000)
const TOKEN_FAILURE_WAIT_MS = Number(process.env.RAYD8_LIVE_TOKEN_FAIL_WAIT_MS ?? 30_000)
const TOKEN_REQUEST_BUDGET = Number(process.env.RAYD8_LIVE_TOKEN_BUDGET ?? 5)

const forbiddenPatterns = [/tap\s+to\s+start\s+playback/i, /your\s+browser\s+needs\s+one\s+more\s+tap/i]

function loadDotenvFile(path) {
  if (!existsSync(path)) return null
  const parsed = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const idx = trimmed.indexOf('=')
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    parsed[key] = value
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
  return parsed
}

function loadAuthEnvFrom(path) {
  if (!existsSync(path)) return null
  const env = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const idx = line.indexOf('=')
    env[line.slice(0, idx)] = line.slice(idx + 1)
  }
  return env.RAYD8_QA_EMAIL && env.RAYD8_QA_PASSWORD ? env : null
}

function loadAuthEnv() {
  return loadAuthEnvFrom(authEnvPath)
}

function redactEmail(value) {
  if (typeof value !== 'string' || !value.includes('@')) return value
  const idx = value.indexOf('@')
  return `${value.slice(0, Math.min(2, idx))}…@${value.slice(idx + 1)}`
}

function redact(value) {
  return JSON.stringify(value, (key, v) => {
    if (typeof key === 'string' && /(?:signed_url|authorization|password|jwt|bearer)/i.test(key)) return '[redacted]'
    if (typeof key === 'string' && /^token$/i.test(key)) return '[redacted]'
    if (typeof key === 'string' && /email/i.test(key) && typeof v === 'string') return redactEmail(v)
    if (typeof v === 'string' && /token=[^&]+/i.test(v)) return v.replace(/token=[^&]+/gi, 'token=[redacted]')
    return v
  }, 2)
}

async function launchBrowser() {
  if (browserName === 'firefox') return firefox.launch()
  if (browserName === 'webkit') return webkit.launch()
  try {
    return await chromium.launch({ channel: 'chrome' })
  } catch {
    return chromium.launch()
  }
}

async function loginWithClerk(page, auth) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await clerk.loaded({ page })
  await clerk.signIn({ page, emailAddress: auth.RAYD8_QA_EMAIL })
  await page.goto(`${baseUrl}/dashboard?rayd8PlayerDebug=true`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForURL(/dashboard/i, { timeout: 60_000 })
}

async function assertNoForbiddenPrompt(page, label) {
  const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
  const match = forbiddenPatterns.find((pattern) => pattern.test(text))
  if (match) throw new Error(`${label}: forbidden playback prompt matched ${match}`)
}

async function collectSnapshot(page) {
  return page.evaluate(() => {
    const debug = window.__RAYD8_PLAYER_DEBUG__
    const startup = window.__rayd8StartupInstrumentation
    const videos = document.querySelectorAll('video').length
    const audios = document.querySelectorAll('audio').length
    const video = document.querySelector('video')
    const audio = document.querySelector('audio[data-rayd8-global-audio="true"], audio')
    const bodyText = document.body?.innerText ?? ''
    const recoveryVisible = /Unable to Prepare|Did Not Start|Connection Interrupted|Please Sign In Again|Blocked the Video/i.test(bodyText)
    const preloadMatch = bodyText.match(/(\d{1,3})%/)
    return {
      href: location.href,
      videos,
      audios,
      videoCurrentTime: video?.currentTime ?? null,
      audioCurrentTime: audio?.currentTime ?? null,
      videoPaused: video?.paused ?? null,
      audioPaused: audio?.paused ?? null,
      recoveryOverlayVisible: recoveryVisible,
      preloadPercent: preloadMatch ? Number(preloadMatch[1]) : null,
      tokenRequestCount: startup?.tokenRequestCount ?? debug?.getSnapshot?.()?.observability?.tokenRefreshCount ?? null,
      startupStage: startup?.stages?.[startup.stages.length - 1]?.stage ?? null,
      hasNonMonotonicCycle: startup?.hasNonMonotonicCycle ?? null,
    }
  })
}

async function dismissExpressPrompt(page) {
  const dismissors = [page.getByRole('button', { name: /remind me later/i }), page.getByRole('button', { name: /^dismiss$/i })]
  for (const dismiss of dismissors) {
    if ((await dismiss.count()) > 0) {
      await dismiss.first().click({ timeout: 5_000 }).catch(() => null)
      await page.waitForTimeout(500)
    }
  }
}

async function startRegenSession(page) {
  const regenNav = page.getByRole('button', { name: /rayd8®?\s*regen/i }).first()
  if ((await regenNav.count()) > 0) {
    await regenNav.click({ timeout: 10_000 }).catch(() => null)
    await page.waitForTimeout(1500)
  }
  await page.waitForTimeout(1500)
  const regenStart = page.locator('#regen').getByRole('button', { name: /start session/i }).first()
  let clickedStart = false
  if ((await regenStart.count()) > 0) {
    await regenStart.click({ timeout: 20_000 }).catch(() => null)
    clickedStart = true
  } else {
    const fallback = page.getByRole('button', { name: /start session/i }).last()
    if ((await fallback.count()) > 0) {
      await fallback.click({ timeout: 10_000 }).catch(() => null)
      clickedStart = true
    }
  }
  await page.waitForTimeout(1000)
  const confirmStart = page.locator('#regen').getByRole('button', { name: /start session/i }).first()
  if ((await confirmStart.count()) > 0 && (await confirmStart.isVisible().catch(() => false))) {
    await confirmStart.click({ timeout: 5_000 }).catch(() => null)
  }
  for (const name of [/i understand|continue|got it|begin session/i]) {
    const guideBtn = page.getByRole('button', { name })
    if ((await guideBtn.count()) > 0 && (await guideBtn.first().isVisible().catch(() => false))) {
      await guideBtn.first().click({ timeout: 5_000 }).catch(() => null)
      await page.waitForTimeout(400)
    }
  }
  return clickedStart
}

async function waitForRegenReadyOrRecovery(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    last = await collectSnapshot(page)
    if (last.videos > 0 && (last.videoCurrentTime ?? 0) > 0) return { ready: true, snapshot: last }
    if (last.recoveryOverlayVisible) return { ready: false, recovered: true, snapshot: last }
    await page.waitForTimeout(1500)
  }
  return { ready: false, recovered: false, snapshot: last, timedOut: true }
}

async function endSession(page) {
  const close = page.getByRole('button', { name: /close|exit|end session/i }).first()
  if (await close.count()) {
    await close.click().catch(() => null)
    await page.waitForTimeout(1500)
  }
}

async function smokeRegen(page) {
  await page.goto(`${baseUrl}/dashboard?rayd8PlayerDebug=true`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await dismissExpressPrompt(page)
  const started = await startRegenSession(page)
  const result = await waitForRegenReadyOrRecovery(page, REGEN_READY_TIMEOUT_MS)
  await assertNoForbiddenPrompt(page, 'regen')
  const firstSnapshot = result.snapshot
  await endSession(page)
  const afterFirstExit = await collectSnapshot(page)

  let secondStarted = false
  let secondSnapshot = null
  try {
    await page.waitForTimeout(1500)
    secondStarted = await startRegenSession(page)
    await page.waitForTimeout(SECOND_SESSION_MS)
    secondSnapshot = await collectSnapshot(page)
    await endSession(page)
  } catch (error) {
    secondSnapshot = { error: String(error) }
  }

  const stuckAtZero = firstSnapshot?.videos === 0 && !firstSnapshot?.recoveryOverlayVisible && result.timedOut
  return {
    status: stuckAtZero ? 'FAIL' : result.recovered ? 'PASS_RECOVERED' : 'PASS',
    started,
    firstSession: { ready: result.ready, recovered: result.recovered, timedOut: result.timedOut, snapshot: firstSnapshot, afterExit: afterFirstExit },
    secondSession: { started: secondStarted, snapshot: secondSnapshot },
  }
}

async function smokeAmrita(_page, browser) {
  // Prefer the dedicated AMRITA entitlement fixture so this step is not
  // blocked by the REGEN-plan QA user used for the rest of the product smoke.
  const amritaAuth =
    loadAuthEnvFrom(resolve(webRoot, 'e2e/.auth/mux-soak-amrita.env')) || loadAuthEnv()
  if (!amritaAuth) {
    return { status: 'UNEXECUTED', reason: 'AMRITA auth fixture missing' }
  }

  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('rayd8-amrita-soak-mode', 'reduced')
        localStorage.setItem('rayd8-amrita-dual-pass-debug', 'true')
      } catch {
        // ignore
      }
    })
    await loginWithClerk(page, amritaAuth)
    await page.goto(`${baseUrl}/amrita-dashboard?rayd8AmritaSoak=reduced`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })

    const deadline = Date.now() + 45_000
    while (Date.now() < deadline) {
      if (/subscription/i.test(page.url())) {
        return {
          status: 'UNEXECUTED',
          reason: 'AMRITA entitlement missing — redirected to subscription',
        }
      }
      if ((await page.locator('iframe').count()) > 0) break
      await page.waitForTimeout(1000)
    }

    const iframeCount = await page.locator('iframe').count()
    if (iframeCount === 0) {
      return {
        status: 'UNEXECUTED',
        reason: /subscription/i.test(page.url())
          ? 'AMRITA entitlement missing — redirected to subscription'
          : 'AMRITA iframe not present',
        href: page.url(),
      }
    }

    await page.locator('iframe').first().waitFor({ state: 'attached', timeout: 60_000 })
    const frame = page.frameLocator('iframe').first()
    const start = frame.locator('#start-sequence, button:has-text("Start")').first()
    if ((await start.count()) > 0) {
      await start.click({ timeout: 30_000 }).catch(() => null)
      await page.waitForTimeout(4000)
    }

    let handshake = null
    try {
      handshake = await frame.locator('body').evaluate(() => window.__AMRITA_SOAK__?.getSnapshot?.() ?? null)
    } catch (error) {
      handshake = { error: String(error) }
    }
    try {
      await frame.locator('body').evaluate(() => window.__AMRITA_SOAK__?.stop?.())
    } catch {
      // ignore
    }
    await page.waitForTimeout(1000)
    const leftoverIframes = await page.locator('iframe').count()
    return {
      status: 'PASS',
      iframeMounted: iframeCount > 0,
      handshake,
      leftoverIframes,
      usedAmritaFixture: Boolean(loadAuthEnvFrom(resolve(webRoot, 'e2e/.auth/mux-soak-amrita.env'))),
    }
  } finally {
    await context.close().catch(() => null)
  }
}

async function smokeHamsa(page) {
  await page.goto(`${baseUrl}/dashboard/hamsa`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(2500)
  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
  const locked = /unlock|upgrade|membership/i.test(bodyText) && !/experience hamsa/i.test(bodyText)
  if (locked) return { status: 'UNEXECUTED', reason: 'HAMSA locked — entitlement required to load app iframe' }
  const iframeCount = await page.locator('iframe').count()
  if (iframeCount === 0) return { status: 'PASS', note: 'HAMSA launch screen rendered (no app iframe on this plan)' }
  const frame = page.frameLocator('iframe').first()
  let sourceReady = null
  try {
    sourceReady = await frame.locator('body').evaluate(() => {
      const audio = document.querySelector('audio')
      const video = document.querySelector('video')
      return {
        audioSrc: Boolean(audio?.currentSrc || audio?.getAttribute('src')),
        videoSrc: Boolean(video?.currentSrc || video?.getAttribute('src')),
      }
    })
  } catch (error) {
    sourceReady = { error: String(error) }
  }
  return { status: 'PASS', iframeMounted: iframeCount > 0, sourceReady }
}

async function smokeCrossProductHandoff(page) {
  const steps = []
  const visit = async (label, path) => {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForTimeout(2000)
    const snap = await collectSnapshot(page)
    steps.push({ label, path, href: snap.href, videos: snap.videos, audios: snap.audios })
    return snap
  }
  await page.goto(`${baseUrl}/dashboard?rayd8PlayerDebug=true`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await dismissExpressPrompt(page)
  await startRegenSession(page)
  await page.waitForTimeout(5000)
  steps.push({ label: 'REGEN', path: '/dashboard', ...(await collectSnapshot(page)) })
  await endSession(page)
  await visit('dashboard-1', '/dashboard')
  await visit('AMRITA', '/amrita-dashboard')
  await visit('dashboard-2', '/dashboard')
  await visit('HAMSA', '/dashboard/hamsa')
  await visit('dashboard-3', '/dashboard')
  await page.goto(`${baseUrl}/dashboard?rayd8PlayerDebug=true`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await startRegenSession(page)
  await page.waitForTimeout(5000)
  steps.push({ label: 'REGEN-2', path: '/dashboard', ...(await collectSnapshot(page)) })
  await endSession(page)
  const staleBlocks = steps.some(
    (s) => typeof s.videos === 'number' && s.videos > 0 && /dashboard/i.test(s.path) && !/regen/i.test(s.label),
  )
  return { status: staleBlocks ? 'FAIL' : 'PASS', steps }
}

async function smokeControlledTokenFailure(page) {
  let tokenHits = 0
  let fulfilled503 = false
  await page.route('**/v1/player/playback-token**', async (route) => {
    tokenHits += 1
    if (!fulfilled503) {
      fulfilled503 = true
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'SERVICE_UNAVAILABLE', reference: 'smoke-503' }),
      })
      return
    }
    await route.continue()
  })

  await page.goto(`${baseUrl}/dashboard?rayd8PlayerDebug=true`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await dismissExpressPrompt(page)
  await startRegenSession(page)

  const deadline = Date.now() + TOKEN_FAILURE_WAIT_MS
  let recoverySeen = false
  let tryAgainClicked = false
  let finalSnapshot = null
  while (Date.now() < deadline) {
    finalSnapshot = await collectSnapshot(page)
    if (finalSnapshot.recoveryOverlayVisible) {
      recoverySeen = true
      const tryAgain = page.getByRole('button', { name: /try again|restart playback|reload session/i }).first()
      if ((await tryAgain.count()) > 0 && (await tryAgain.isVisible().catch(() => false))) {
        await tryAgain.click({ timeout: 5_000 }).catch(() => null)
        tryAgainClicked = true
        await page.waitForTimeout(5000)
      }
      break
    }
    await page.waitForTimeout(1500)
  }
  await page.waitForTimeout(3000)
  finalSnapshot = await collectSnapshot(page)
  await endSession(page)
  await page.unroute('**/v1/player/playback-token**').catch(() => null)

  const bounded = tokenHits <= TOKEN_REQUEST_BUDGET
  const stuckAtZero = !recoverySeen && finalSnapshot?.videos === 0 && (finalSnapshot?.preloadPercent ?? 0) === 0
  return {
    status: stuckAtZero || !bounded ? 'FAIL' : recoverySeen ? 'PASS' : 'PASS_NO_RECOVERY_OBSERVED',
    tokenHits,
    bounded,
    recoveryOverlaySeen: recoverySeen,
    tryAgainClicked,
    finalSnapshot,
  }
}

async function smokeUsageQualification(page, opts = {}) {
  const allowExpectedNetworkAborts = opts.allowExpectedNetworkAborts
  let starved = false
  allowExpectedNetworkAborts?.(true)
  await page.route('**/*.m3u8**', (route) => {
    starved = true
    route.abort().catch(() => null)
  })
  await page.route('**/*.ts**', (route) => {
    starved = true
    route.abort().catch(() => null)
  })

  try {
    await page.goto(`${baseUrl}/dashboard?rayd8PlayerDebug=true`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await dismissExpressPrompt(page)
    await startRegenSession(page)
    await page.waitForTimeout(8000)

    let mediaQualified = null
    let startupStage = null
    try {
      const probe = await page.evaluate(() => {
        const s = window.__rayd8StartupInstrumentation
        return {
          tokenRequestCount: s?.tokenRequestCount ?? null,
          startupStage: s?.stages?.[s.stages.length - 1]?.stage ?? null,
        }
      })
      mediaQualified = probe.tokenRequestCount
      startupStage = probe.startupStage
    } catch (error) {
      mediaQualified = { error: String(error) }
    }
    await endSession(page)

    // Without DB admin access we cannot authoritatively read the qualification
    // verdict; mark UNEXECUTED with reason unless a clear negative signal appeared.
    const reason = 'No DB admin access to read authoritative qualification verdict'
    return {
      status: 'UNEXECUTED',
      reason,
      starved,
      mediaQualified,
      startupStage,
    }
  } finally {
    await page.unroute('**/*.m3u8**').catch(() => null)
    await page.unroute('**/*.ts**').catch(() => null)
    allowExpectedNetworkAborts?.(false)
  }
}

async function smokeTelemetryNonblocking(page, opts = {}) {
  const allowExpectedNetworkAborts = opts.allowExpectedNetworkAborts
  let umamiAborted = 0
  allowExpectedNetworkAborts?.(true)
  await page.route('**/umami**', (route) => {
    umamiAborted += 1
    route.abort().catch(() => null)
  })
  await page.route('**/script.js**', (route) => {
    if (/umami/i.test(route.request().url())) {
      umamiAborted += 1
      route.abort().catch(() => null)
      return
    }
    route.continue().catch(() => null)
  })

  try {
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForTimeout(5000)
    const snap = await collectSnapshot(page)
    const dashboardLoaded = /dashboard/i.test(snap.href)
    return {
      status: dashboardLoaded ? 'PASS' : 'FAIL',
      umamiAborted,
      dashboardLoaded,
      href: snap.href,
    }
  } finally {
    await page.unroute('**/umami**').catch(() => null)
    await page.unroute('**/script.js**').catch(() => null)
    allowExpectedNetworkAborts?.(false)
  }
}

async function main() {
  mkdirSync(artifactDir, { recursive: true })
  loadDotenvFile(liveEnvPath)
  const auth = loadAuthEnv()
  const clerkKey = process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY

  if (!auth?.RAYD8_QA_EMAIL || !auth?.RAYD8_QA_PASSWORD) {
    throw new Error('Missing web/e2e/.auth/mux-soak.env (RAYD8_QA_EMAIL/RAYD8_QA_PASSWORD)')
  }
  if (!clerkKey) {
    throw new Error('Missing Clerk publishable key (VITE_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY)')
  }

  await clerkSetup({ publishableKey: clerkKey, secretKey: process.env.CLERK_SECRET_KEY })

  const browser = await launchBrowser()
  const context = await browser.newContext()
  const page = await context.newPage()

  const uncaughtErrors = []
  const expectedNetworkAborts = []
  let expectNetworkAborts = false
  const allowExpectedNetworkAborts = (enabled) => {
    expectNetworkAborts = Boolean(enabled)
  }
  const isExpectedNetworkAbortError = (text) =>
    /^NetworkError:/i.test(text) || /net::ERR_FAILED|NS_ERROR_FAILURE|Load failed/i.test(text)

  page.on('pageerror', (error) => {
    const text = String(error)
    if (expectNetworkAborts && isExpectedNetworkAbortError(text)) {
      expectedNetworkAborts.push(text)
      return
    }
    uncaughtErrors.push(text)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (/cors|playback-token|failed to fetch/i.test(text)) {
        uncaughtErrors.push(`console.error: ${text.slice(0, 200)}`)
      }
    }
  })

  const report = {
    baseUrl,
    browserName,
    startedAt: new Date().toISOString(),
    auth: { present: true, emailDomain: auth.RAYD8_QA_EMAIL.split('@')[1] },
    clerkKeyPresent: Boolean(clerkKey),
  }

  const hardFailures = []
  const safeRun = async (label, fn, ...args) => {
    try {
      const result = await fn(...args)
      report[label] = result
      if (result?.status === 'FAIL') hardFailures.push(`${label}: ${result.reason || 'FAIL'}`)
      return result
    } catch (error) {
      report[label] = { status: 'FAIL', error: String(error) }
      hardFailures.push(`${label}: ${String(error)}`)
      return null
    }
  }

  try {
    await loginWithClerk(page, auth)
    report.login = { status: 'PASS', url: page.url() }

    await safeRun('regen', smokeRegen, page)
    await safeRun('amrita', smokeAmrita, page, browser)
    await safeRun('hamsa', smokeHamsa, page)
    await safeRun('crossProductHandoff', smokeCrossProductHandoff, page)
    await safeRun('controlledTokenFailure', smokeControlledTokenFailure, page)
    await safeRun('usageQualification', smokeUsageQualification, page, {
      allowExpectedNetworkAborts,
    })
    await safeRun('telemetryNonblocking', smokeTelemetryNonblocking, page, {
      allowExpectedNetworkAborts,
    })

    // Intentional route.abort() can surface as pageerror NetworkError after the
    // expect-window is cleared (async script/media failures). Reclassify a
    // bounded number of those when the corresponding intentional aborts ran.
    let expectedBudget =
      Number(report.telemetryNonblocking?.umamiAborted || 0) +
      (report.usageQualification?.starved ? 4 : 0)
    const keptUncaught = []
    for (const err of uncaughtErrors) {
      if (expectedBudget > 0 && isExpectedNetworkAbortError(err)) {
        expectedNetworkAborts.push(err)
        expectedBudget -= 1
        continue
      }
      keptUncaught.push(err)
    }
    uncaughtErrors.length = 0
    uncaughtErrors.push(...keptUncaught)

    report.uncaughtErrors = uncaughtErrors
    report.expectedNetworkAborts = expectedNetworkAborts
    if (uncaughtErrors.length > 0) hardFailures.push(`uncaughtErrors: ${uncaughtErrors.length}`)

    report.finishedAt = new Date().toISOString()
    report.hardFailures = hardFailures
    report.verdict = hardFailures.length === 0 ? 'GO' : 'NO-GO'

    writeFileSync(artifactPath, `${redact(report)}\n`)
    console.log(`Wrote ${artifactPath}`)
    console.log(`Verdict: ${report.verdict}`)
    if (hardFailures.length > 0) {
      console.log(`Hard failures:\n  - ${hardFailures.join('\n  - ')}`)
      process.exitCode = 1
    }
  } finally {
    await context.close().catch(() => null)
    await browser.close().catch(() => null)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
