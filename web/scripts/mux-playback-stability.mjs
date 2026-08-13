#!/usr/bin/env node
/**
 * Mux playback stability smoke + soak harness.
 *
 * Modes:
 *   RAYD8_MUX_STABILITY_MODE=smoke   (default) — fast checks, auth if fixture present
 *   RAYD8_MUX_STABILITY_MODE=soak    — sustained playback (RAYD8_MUX_SOAK_MS, default 5m)
 *
 * Requires:
 *   - web + api running OR preview + API_URL
 *   - web/e2e/.auth/mux-soak.env from `npm --prefix api run fixture:mux-soak-auth`
 *
 * Never prints signed URLs or JWTs.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, firefox, webkit } from 'playwright'
import { clerk, clerkSetup } from '@clerk/testing/playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, '..')
const repoRoot = resolve(webRoot, '..')
const artifactsDir = resolve(repoRoot, 'docs/release-gate/mux-video-optimization/artifacts')
const finalClosureDir = resolve(artifactsDir, 'final-closure')
const mode = process.env.RAYD8_MUX_STABILITY_MODE ?? 'smoke'
const soakMs = Number(process.env.RAYD8_MUX_SOAK_MS ?? (mode === 'soak' ? 5 * 60_000 : 45_000))
const port = Number(process.env.RAYD8_RUNTIME_TEST_PORT ?? 4178)
const baseUrl = process.env.RAYD8_MUX_STABILITY_BASE_URL ?? `http://127.0.0.1:${port}`
const browserName = process.env.RAYD8_MUX_STABILITY_BROWSER ?? 'chromium'
const scenario = process.env.RAYD8_MUX_STABILITY_SCENARIO ?? 'default' // default|offline|fullscreen|lifecycle
const authEnvPath = resolve(webRoot, 'e2e/.auth/mux-soak.env')
const requireDualAudio = process.env.RAYD8_MUX_REQUIRE_DUAL_AUDIO !== '0'

/**
 * Sync budgets from measured dual-HLS product behavior (30m closure soak).
 * Transient peaks may briefly exceed 1s; average abs drift stays ~0.2s with
 * ~5–7 corrections per 5 minutes (bounded management, not runaway).
 */
const SYNC_BUDGET = {
  maxSampleAbsDriftSeconds: Number(process.env.RAYD8_MUX_MAX_ABS_DRIFT ?? 2.5),
  maxCorrectionsPerFiveMinutes: Number(process.env.RAYD8_MUX_MAX_CORRECTIONS_PER_5M ?? 12),
  maxRisingCorrectionWindows: Number(process.env.RAYD8_MUX_MAX_RISING_WINDOWS ?? 2),
}

const forbiddenPatterns = [
  /tap\s+to\s+start\s+playback/i,
  /your\s+browser\s+needs\s+one\s+more\s+tap/i,
]

function loadAuthEnv() {
  if (!existsSync(authEnvPath)) {
    return null
  }

  const env = {}
  for (const line of readFileSync(authEnvPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const idx = line.indexOf('=')
    env[line.slice(0, idx)] = line.slice(idx + 1)
  }
  return env
}

function startPreviewServer() {
  return spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: webRoot,
      env: { ...process.env, BROWSER: 'none' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}

async function waitForServer(server) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      throw new Error(`Preview server exited early: ${server.exitCode}`)
    }
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // retry
    }
    await delay(250)
  }
  throw new Error('Timed out waiting for preview server')
}

// Browser launchers for the additional Chromium-based channels. These keep the
// existing smoke/soak behavior intact and never print signed URLs or JWTs.

const CHROMIUM_AUTOMATION_ARGS = [
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-component-update',
]

async function launchChromiumDefault() {
  try {
    return await chromium.launch({ channel: 'chrome' })
  } catch {
    return chromium.launch()
  }
}

async function launchEdge() {
  try {
    return await chromium.launch({ channel: 'msedge' })
  } catch {
    return chromium.launch({
      executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    })
  }
}

async function launchOpera() {
  return chromium.launch({
    executablePath: '/Applications/Opera.app/Contents/MacOS/Opera',
    args: CHROMIUM_AUTOMATION_ARGS,
  })
}

// Brave Shields OFF requires a pre-seeded persistent profile where Shields have
// been disabled for the test origin (Brave persists per-site shield state in the
// profile). We do NOT toggle Shields via UI automation — that path is fragile. If
// the seeded profile does not exist, we fall back to a fresh ephemeral Brave
// context (Shields ON) and log a warning so the operator knows to seed the profile.
async function launchBrave() {
  const executablePath = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
  const args = CHROMIUM_AUTOMATION_ARGS
  const shields = (process.env.RAYD8_BRAVE_SHIELDS ?? '').toLowerCase()

  if (shields === 'off') {
    const profileDir = resolve(webRoot, 'e2e/.profiles/brave-shields-off')
    if (existsSync(profileDir)) {
      const context = await chromium.launchPersistentContext(profileDir, {
        executablePath,
        args,
      })
      // Adapt the persistent context to the Browser-like surface (newContext/close)
      // used by main(). Viewport/mobile options passed to newContext() are ignored
      // for Shields-OFF runs — the seeded profile owns that state.
      return {
        newContext: async () => context,
        close: async () => context.close(),
      }
    }
    console.warn(
      `[mux-playback-stability] RAYD8_BRAVE_SHIELDS=off but pre-seeded profile not found at ${profileDir}. ` +
        'Falling back to default ephemeral Brave profile (Shields ON). Seed the profile once by ' +
        'launching Brave with that userDataDir and disabling Shields for the test origin.',
    )
  }

  return chromium.launch({ executablePath, args })
}

async function launchBrowser() {
  if (browserName === 'firefox') return firefox.launch()
  if (browserName === 'webkit') return webkit.launch()
  if (browserName === 'brave') return launchBrave()
  if (browserName === 'opera') return launchOpera()
  if (browserName === 'edge') return launchEdge()
  return launchChromiumDefault()
}

function redact(value) {
  return JSON.stringify(value, (key, v) => {
    if (
      typeof key === 'string' &&
      /(?:signed_url|authorization|password|jwt|bearer)/i.test(key)
    ) {
      return '[redacted]'
    }
    if (typeof key === 'string' && /^token$/i.test(key)) {
      return '[redacted]'
    }
    if (typeof v === 'string' && /token=/i.test(v)) {
      return v.replace(/token=[^&]+/gi, 'token=[redacted]')
    }
    return v
  }, 2)
}

async function loginWithClerk(page, auth) {
  // Load a public page so Clerk.js is available, then use testing helper.
  // Email ticket strategy avoids new-device email OTP challenges.
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await clerk.loaded({ page })
  await clerk.signIn({
    page,
    emailAddress: auth.RAYD8_QA_EMAIL,
  })
  await page.goto(`${baseUrl}/dashboard?rayd8PlayerDebug=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  })
  await page.waitForURL(/dashboard/i, { timeout: 60_000 })
}

async function assertNoForbiddenPrompt(page, label) {
  const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
  const match = forbiddenPatterns.find((pattern) => pattern.test(text))
  if (match) {
    throw new Error(`${label}: forbidden playback prompt matched ${match}`)
  }
}

async function collectSnapshot(page) {
  return page.evaluate(() => {
    const debug = window.__RAYD8_PLAYER_DEBUG__
    const videos = document.querySelectorAll('video').length
    const audios = document.querySelectorAll('audio').length
    const video = document.querySelector('video')
    const audio = document.querySelector('audio[data-rayd8-global-audio="true"], audio')
    return {
      href: location.href,
      videos,
      audios,
      videoCurrentTime: video?.currentTime ?? null,
      audioCurrentTime: audio?.currentTime ?? null,
      videoPaused: video?.paused ?? null,
      audioPaused: audio?.paused ?? null,
      debug: debug?.getSnapshot?.() ?? null,
      correlationId: debug?.getCorrelationId?.() ?? null,
    }
  })
}

function extractSyncMetrics(sample) {
  const obs = sample?.debug?.observability
  const av = sample?.debug?.avSync ?? obs?.avSync
  return {
    drift: obs?.avSync?.driftSeconds ?? null,
    maxAbs: av?.maxAbsDriftSeconds ?? obs?.avSync?.maxAbsDriftSeconds ?? null,
    corrections: av?.totalCorrections ?? null,
    recovery: obs?.recovery ?? {},
    loadSource: obs?.loadSourceCount ?? null,
    tokenRefresh: obs?.tokenRefreshCount ?? null,
    eventLoopMax: obs?.responsiveness?.maxEventLoopDelayMs ?? null,
    long200: obs?.responsiveness?.longTasks?.over200ms ?? null,
    freezeCount: obs?.freezeEvents?.length ?? 0,
    pipeline: obs?.decode?.pipelineMode ?? null,
    engine: obs?.decode?.playbackEngine ?? null,
    audioBuf: obs?.decode?.audioBufferLength ?? null,
    videoBuf: obs?.decode?.videoBufferLength ?? null,
  }
}

function buildWindowedSyncAnalysis(samples, startedAt) {
  const windows = []
  const windowMs = 5 * 60_000
  let prevCorrections = 0
  for (let w = 0; w * windowMs < soakMs + windowMs; w += 1) {
    const start = startedAt + w * windowMs
    const end = start + windowMs
    const inWindow = samples.filter((s) => s.at >= start && s.at < end)
    if (!inWindow.length) continue
    const last = inWindow[inWindow.length - 1]
    const metrics = extractSyncMetrics(last)
    const corrections = typeof metrics.corrections === 'number' ? metrics.corrections : prevCorrections
    const delta = Math.max(0, corrections - prevCorrections)
    const drifts = inWindow
      .map((s) => extractSyncMetrics(s).drift)
      .filter((d) => typeof d === 'number')
    windows.push({
      index: w,
      label: `${w * 5}-${(w + 1) * 5}m`,
      samples: inWindow.length,
      correctionDelta: delta,
      totalCorrections: corrections,
      driftMin: drifts.length ? Math.min(...drifts) : null,
      driftMax: drifts.length ? Math.max(...drifts) : null,
      maxAbsSampleDrift: drifts.length ? Math.max(...drifts.map(Math.abs)) : null,
      avgAbsDrift: drifts.length
        ? drifts.reduce((a, b) => a + Math.abs(b), 0) / drifts.length
        : null,
    })
    prevCorrections = corrections
  }

  let rising = 0
  for (let i = 1; i < windows.length; i += 1) {
    if (windows[i].correctionDelta > windows[i - 1].correctionDelta + 2) rising += 1
  }

  // Exclude video-loop wrap outliers from budget (abs drift >> media buffer, typically >30s).
  const LOOP_WRAP_ABS_SECONDS = 30
  const allDrifts = samples
    .map((s) => extractSyncMetrics(s).drift)
    .filter((d) => typeof d === 'number')
  const steadyDrifts = allDrifts.filter((d) => Math.abs(d) < LOOP_WRAP_ABS_SECONDS)
  const loopWrapOutliers = allDrifts.length - steadyDrifts.length
  const last = samples[samples.length - 1]
  const lastMetrics = extractSyncMetrics(last || {})

  const budget = {
    maxSampleAbsDriftSeconds: SYNC_BUDGET.maxSampleAbsDriftSeconds,
    maxCorrectionsPerFiveMinutes: SYNC_BUDGET.maxCorrectionsPerFiveMinutes,
    maxRisingCorrectionWindows: SYNC_BUDGET.maxRisingCorrectionWindows,
    loopWrapAbsSeconds: LOOP_WRAP_ABS_SECONDS,
  }
  const maxWindowCorrections = windows.length
    ? Math.max(...windows.map((w) => w.correctionDelta))
    : 0
  const maxAbsSample = steadyDrifts.length ? Math.max(...steadyDrifts.map(Math.abs)) : 0
  const rawMaxAbsSample = allDrifts.length ? Math.max(...allDrifts.map(Math.abs)) : 0
  const pass =
    maxAbsSample <= budget.maxSampleAbsDriftSeconds &&
    maxWindowCorrections <= budget.maxCorrectionsPerFiveMinutes &&
    rising <= budget.maxRisingCorrectionWindows

  return {
    windows,
    risingCorrectionWindows: rising,
    maxWindowCorrections,
    maxAbsSampleDrift: maxAbsSample,
    rawMaxAbsSampleDrift: rawMaxAbsSample,
    loopWrapOutliers,
    avgAbsDrift: steadyDrifts.length
      ? steadyDrifts.reduce((a, b) => a + Math.abs(b), 0) / steadyDrifts.length
      : null,
    totalCorrections: lastMetrics.corrections,
    loadSource: lastMetrics.loadSource,
    tokenRefresh: lastMetrics.tokenRefresh,
    eventLoopMax: lastMetrics.eventLoopMax,
    long200: lastMetrics.long200,
    budget,
    pass,
    interpretation:
      maxWindowCorrections <= 8 && rising === 0
        ? 'normal_bounded_drift_management'
        : rising > 0
          ? 'rising_correction_frequency'
          : maxWindowCorrections > budget.maxCorrectionsPerFiveMinutes
            ? 'excessive_correction_frequency'
            : 'stable_frequent_corrections',
  }
}

async function setOffline(page, offline) {
  const client = await page.context().newCDPSession(page).catch(() => null)
  if (!client) {
    await page.context().setOffline(offline)
    return { method: 'context.setOffline' }
  }
  await client.send('Network.enable').catch(() => null)
  await client.send('Network.emulateNetworkConditions', {
    offline,
    latency: offline ? 0 : 20,
    downloadThroughput: offline ? 0 : -1,
    uploadThroughput: offline ? 0 : -1,
  })
  return { method: 'cdp' }
}

async function runOfflineMatrix(page) {
  const steps = []
  for (const seconds of [10, 30]) {
    const before = await collectSnapshot(page)
    await setOffline(page, true)
    await page.waitForTimeout(seconds * 1000)
    await setOffline(page, false)
    await page.waitForTimeout(8_000)
    const after = await collectSnapshot(page)
    steps.push({
      offlineSeconds: seconds,
      beforeVideos: before.videos,
      afterVideos: after.videos,
      afterAudios: after.audios,
      beforeTime: before.videoCurrentTime,
      afterTime: after.videoCurrentTime,
      positionPreserved:
        typeof before.videoCurrentTime === 'number' &&
        typeof after.videoCurrentTime === 'number' &&
        after.videoCurrentTime + 5 >= before.videoCurrentTime,
      loadSourceBefore: extractSyncMetrics(before).loadSource,
      loadSourceAfter: extractSyncMetrics(after).loadSource,
    })
  }
  return steps
}

async function runFullscreenVisibilityMatrix(page) {
  const results = {}
  results.before = await collectSnapshot(page)
  await page.evaluate(async () => {
    const video = document.querySelector('video')
    if (video?.requestFullscreen) {
      try {
        await video.requestFullscreen()
      } catch {
        // ignore
      }
    }
  })
  await page.waitForTimeout(2000)
  results.inFullscreen = await collectSnapshot(page)
  await page.evaluate(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch {
        // ignore
      }
    }
  })
  await page.waitForTimeout(1500)
  results.afterFullscreen = await collectSnapshot(page)

  // Visibility hide/show via CDP
  const client = await page.context().newCDPSession(page).catch(() => null)
  if (client) {
    await client.send('Page.enable').catch(() => null)
    await client.send('Page.setWebLifecycleState', { state: 'frozen' }).catch(() => null)
    await page.waitForTimeout(3000)
    await client.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => null)
    await page.waitForTimeout(2000)
  } else {
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  }
  results.afterVisibility = await collectSnapshot(page)
  results.noRemount =
    results.before.videos === results.afterFullscreen.videos &&
    results.before.audios === results.afterFullscreen.audios
  return results
}

async function runLifecycleCycles(page, cycles = 5, playMs = 120_000) {
  const cycleResults = []
  for (let i = 0; i < cycles; i += 1) {
    if (i > 0) {
      // Re-enter: click start again if needed
      const regenStart = page.locator('#regen').getByRole('button', { name: /start session/i }).first()
      if ((await regenStart.count()) > 0) {
        await regenStart.click({ timeout: 20_000 }).catch(() => null)
        await page.waitForTimeout(3000)
        await page.locator('video').first().waitFor({ state: 'attached', timeout: 60_000 }).catch(() => null)
      }
    }
    await page.waitForTimeout(Math.min(playMs, 15_000))
    const mid = await collectSnapshot(page)
    const close = page.getByRole('button', { name: /close|exit|end session/i }).first()
    if (await close.count()) {
      await close.click().catch(() => null)
      await page.waitForTimeout(1500)
    }
    const after = await collectSnapshot(page)
    cycleResults.push({
      cycle: i + 1,
      midVideos: mid.videos,
      midAudios: mid.audios,
      afterVideos: after.videos,
      afterAudios: after.audios,
      hlsAfter: after.debug?.activeHlsInstances ?? null,
    })
  }
  return cycleResults
}

async function runAuthenticatedSession(page, auth) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('rayd8-player-debug', 'true')
      // Prefer a real dual-pipeline audio bed for certified soaks.
      localStorage.setItem(
        'rayd8-global-audio-config',
        JSON.stringify({
          audioMuted: false,
          audioTrack: 'expansion',
          audioVolume: 0.8,
        }),
      )
    } catch {
      // ignore
    }
  })

  await loginWithClerk(page, auth)
  if (!/dashboard|amrita|admin/i.test(page.url())) {
    await page.goto(`${baseUrl}/dashboard?rayd8PlayerDebug=true`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
  }

  // Dismiss Express prompt if present so experience cards are clickable.
  const dismissors = [
    page.getByRole('button', { name: /remind me later/i }),
    page.getByRole('button', { name: /^dismiss$/i }),
  ]
  for (const dismiss of dismissors) {
    if ((await dismiss.count()) > 0) {
      await dismiss.first().click({ timeout: 5_000 }).catch(() => null)
      await page.waitForTimeout(500)
    }
  }

  // Prefer REGEN for the entitled soak user, then start that card's session.
  const regenNav = page.getByRole('button', { name: /rayd8®?\s*regen/i }).first()
  if ((await regenNav.count()) > 0) {
    await regenNav.click({ timeout: 10_000 })
    await page.waitForTimeout(1500)
  }

  // Scope Start Session to the REGEN experience section.
  await page.waitForTimeout(2500)
  const regenStart = page.locator('#regen').getByRole('button', { name: /start session/i }).first()
  let clickedStart = false
  if ((await regenStart.count()) > 0) {
    await regenStart.click({ timeout: 20_000 })
    clickedStart = true
  } else {
    const fallback = page.getByRole('button', { name: /start session/i }).last()
    if ((await fallback.count()) > 0) {
      await fallback.click({ timeout: 10_000 })
      clickedStart = true
    }
  }

  // Guide / confirmation overlays can require a second confirmation click.
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

  // Wait for media element from the session overlay.
  const videoAppeared = await page
    .locator('video')
    .first()
    .waitFor({ state: 'attached', timeout: 60_000 })
    .then(() => true)
    .catch(() => false)

  if (videoAppeared) {
    await page
      .locator('video')
      .first()
      .evaluate(async (video) => {
        try {
          video.muted = true
          await video.play()
        } catch {
          // Engine may already be playing.
        }
      })
      .catch(() => null)
  }

  await page.waitForTimeout(3000)

  // Ensure dual-pipeline audio: open audio panel / enable audio if still none.
  const enableAudio = page.getByRole('button', { name: /enable audio|unmute/i }).first()
  if ((await enableAudio.count()) > 0 && (await enableAudio.isVisible().catch(() => false))) {
    await enableAudio.click({ timeout: 5_000 }).catch(() => null)
    await page.waitForTimeout(800)
  }
  const audioButton = page.getByRole('button', { name: /select audio track/i }).first()
  if ((await audioButton.count()) > 0) {
    await audioButton.click({ timeout: 5_000 }).catch(() => null)
    await page.waitForTimeout(400)
    const trackOption = page
      .getByRole('button', { name: /expansion|premium|monastic|soul awakening|track/i })
      .filter({ hasNotText: /select audio/i })
      .first()
    if ((await trackOption.count()) > 0) {
      await trackOption.click({ timeout: 5_000 }).catch(() => null)
    }
    await page.waitForTimeout(2500)
  }

  await assertNoForbiddenPrompt(page, 'post-start')
  const started = clickedStart && videoAppeared

  if (!started) {
    throw new Error('Authenticated session did not mount a <video> element after Start Session.')
  }

  if (requireDualAudio) {
    let audioReady = false
    for (let attempt = 0; attempt < 8; attempt += 1) {
      audioReady = await page.evaluate(() => {
        const audio = document.querySelector('audio[data-rayd8-global-audio="true"], audio')
        return Boolean(audio && (audio.currentSrc || audio.getAttribute('src')))
      })
      if (audioReady) break
      // Retry mute toggle which promotes preferred track when none.
      const muteBtn = page.getByRole('button', { name: /enable audio|mute|unmute|volume/i }).first()
      if ((await muteBtn.count()) > 0) {
        await muteBtn.click({ timeout: 3_000 }).catch(() => null)
      }
      await page.waitForTimeout(1500)
    }
    if (!audioReady) {
      throw new Error('Dual-pipeline soak requires an audio track with currentSrc (audioTrack was none/failed).')
    }
  }

  const samples = []
  const checkpoints = {}
  const startedAt = Date.now()
  const checkpointMarks = [0, 5, 10, 20, 30].map((m) => m * 60_000).filter((ms) => ms <= soakMs)
  const hit = new Set()

  const takeCheckpoint = async (label) => {
    const sample = await collectSnapshot(page)
    checkpoints[label] = { at: Date.now(), ...sample, metrics: extractSyncMetrics(sample) }
    return sample
  }

  await takeCheckpoint('start')
  hit.add(0)

  while (Date.now() - startedAt < soakMs) {
    const elapsed = Date.now() - startedAt
    for (const mark of checkpointMarks) {
      if (!hit.has(mark) && elapsed >= mark) {
        await takeCheckpoint(`${mark / 60_000}m`)
        hit.add(mark)
      }
    }
    const sample = await collectSnapshot(page)
    samples.push({ at: Date.now(), ...sample })
    if (sample.videos < 1) {
      throw new Error(
        `Playback video element disappeared during soak at sample ${samples.length} (href=${sample.href}).`,
      )
    }
    await assertNoForbiddenPrompt(page, 'during-soak')
    await page.waitForTimeout(Math.min(15_000, Math.max(2_000, soakMs / 12)))
  }

  await takeCheckpoint('end')

  // Pause checkpoint
  await page.evaluate(() => {
    const video = document.querySelector('video')
    video?.pause?.()
  })
  await page.waitForTimeout(1000)
  await takeCheckpoint('afterPause')
  await page.evaluate(async () => {
    const video = document.querySelector('video')
    try {
      await video?.play?.()
    } catch {
      // ignore
    }
  })

  let offlineMatrix = null
  let fullscreenMatrix = null
  let lifecycleCycles = null
  if (scenario === 'offline' || scenario === 'closure') {
    offlineMatrix = await runOfflineMatrix(page)
  }
  if (scenario === 'fullscreen' || scenario === 'closure') {
    fullscreenMatrix = await runFullscreenVisibilityMatrix(page)
  }
  if (scenario === 'lifecycle') {
    lifecycleCycles = await runLifecycleCycles(page, 5, Math.min(120_000, soakMs))
  }

  // Exit / cleanup if close control exists.
  const close = page.getByRole('button', { name: /close|exit|end session/i }).first()
  if (await close.count()) {
    await close.click().catch(() => null)
    await page.waitForTimeout(1500)
  }

  const afterExit = await collectSnapshot(page)
  checkpoints.afterExit = { at: Date.now(), ...afterExit, metrics: extractSyncMetrics(afterExit) }
  const syncAnalysis = buildWindowedSyncAnalysis(samples, startedAt)

  return {
    started,
    samples,
    afterExit,
    soakMs,
    checkpoints,
    syncAnalysis,
    offlineMatrix,
    fullscreenMatrix,
    lifecycleCycles,
    requireDualAudio,
  }
}

async function runUnauthenticatedShell(page) {
  const routes = ['/', '/amrita_app/index.html']
  const results = []
  for (const path of routes) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await assertNoForbiddenPrompt(page, path)
    results.push({ path, ok: true })
  }
  return results
}

async function main() {
  mkdirSync(artifactsDir, { recursive: true })
  mkdirSync(finalClosureDir, { recursive: true })
  const auth = loadAuthEnv()
  const useExternal = Boolean(process.env.RAYD8_MUX_STABILITY_BASE_URL)
  let server = null

  if (!useExternal) {
    server = startPreviewServer()
    await waitForServer(server)
  }

  await clerkSetup({
    frontendApiUrl: undefined,
    publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  })

  const browser = await launchBrowser()
  const context = await browser.newContext(
    process.env.RAYD8_MUX_MOBILE_VIEWPORT === '1'
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
      : {},
  )
  const page = await context.newPage()
  const report = {
    mode,
    scenario,
    browserName,
    baseUrl,
    soakMs,
    requireDualAudio,
    authenticated: Boolean(auth?.RAYD8_QA_EMAIL && auth?.RAYD8_QA_PASSWORD),
    startedAt: new Date().toISOString(),
  }

  try {
    report.shell = await runUnauthenticatedShell(page)

    if (report.authenticated) {
      report.session = await runAuthenticatedSession(page, auth)
    } else {
      report.session = {
        skipped: true,
        reason: 'Missing web/e2e/.auth/mux-soak.env — run npm --prefix api run fixture:mux-soak-auth',
      }
    }

    report.finishedAt = new Date().toISOString()
    const syncPass = report.session?.syncAnalysis?.pass
    const progressSamples = Array.isArray(report.session?.samples) ? report.session.samples : []
    const maxVideoTime = progressSamples.reduce(
      (max, sample) => Math.max(max, Number(sample?.videoCurrentTime) || 0),
      0,
    )
    const maxAudioTime = progressSamples.reduce(
      (max, sample) => Math.max(max, Number(sample?.audioCurrentTime) || 0),
      0,
    )
    // Permanent 0% / never-initialized media must not count as a green smoke.
    // Chromium "maybe" native HLS previously produced AUTHENTICATED_RUN_COMPLETE
    // with sync.pass=true while currentTime stayed at 0 for the whole soak.
    const madePlaybackProgress = maxVideoTime >= 1 || maxAudioTime >= 1
    report.playbackProgress = {
      maxVideoTime,
      maxAudioTime,
      madePlaybackProgress,
      sampleCount: progressSamples.length,
    }
    report.verdict =
      report.authenticated && report.session?.started
        ? syncPass === false
          ? 'AUTHENTICATED_RUN_SYNC_BUDGET_FAIL'
          : madePlaybackProgress
            ? 'AUTHENTICATED_RUN_COMPLETE'
            : 'AUTHENTICATED_RUN_NO_PROGRESS'
        : report.authenticated
          ? 'AUTH_PRESENT_BUT_SESSION_START_UNCONFIRMED'
          : 'SHELL_ONLY_NO_AUTH'

    const stamp = Date.now()
    const outPath = resolve(artifactsDir, `mux-stability-${mode}-${browserName}-${stamp}.json`)
    writeFileSync(outPath, redact(report))
    if (process.env.RAYD8_MUX_FINAL_CLOSURE === '1' || soakMs >= 1_800_000 || scenario !== 'default') {
      const summaryPath = resolve(
        finalClosureDir,
        `mux-stability-${mode}-${scenario}-${browserName}-${stamp}-summary.json`,
      )
      writeFileSync(
        summaryPath,
        redact({
          file: outPath,
          verdict: report.verdict,
          soakMs,
          scenario,
          syncAnalysis: report.session?.syncAnalysis ?? null,
          checkpoints: report.session?.checkpoints
            ? Object.fromEntries(
                Object.entries(report.session.checkpoints).map(([k, v]) => [k, v.metrics]),
              )
            : null,
          offlineMatrix: report.session?.offlineMatrix ?? null,
          fullscreenMatrix: report.session?.fullscreenMatrix
            ? { noRemount: report.session.fullscreenMatrix.noRemount }
            : null,
          lifecycleCycles: report.session?.lifecycleCycles ?? null,
        }),
      )
      console.log(`Wrote summary ${summaryPath}`)
    }
    console.log(`Wrote ${outPath}`)
    console.log(`Verdict: ${report.verdict}`)

    if (mode === 'soak' && !report.authenticated) {
      process.exitCode = 2
    }
    if (
      report.verdict === 'AUTHENTICATED_RUN_SYNC_BUDGET_FAIL' ||
      report.verdict === 'AUTHENTICATED_RUN_NO_PROGRESS'
    ) {
      process.exitCode = 3
    }
  } finally {
    await browser.close().catch(() => null)
    if (server) {
      server.kill('SIGTERM')
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
