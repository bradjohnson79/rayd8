#!/usr/bin/env node
/**
 * Chromium-variant startup investigation harness.
 *
 * INC-2026-08-07-OPERA-STARTUP-HANG — correlates with:
 *   - INC-2026-08-06-VIDEO-LOOP (Brave)
 *   - INC-2026-08-06-PLAYBACK-TOKEN-CORS (Firefox)
 *
 * Framing question: which browser modifications expose startup assumptions
 * that Chrome masks?
 *
 * For each browser (chrome baseline, brave, opera, edge, firefox reference) the
 * harness signs in via @clerk/testing/playwright (same QA account as
 * mux-playback-stability.mjs), starts a REGEN session from the dashboard, and
 * collects ~30-45s of startup instrumentation, video element state, media
 * milestones, the first failing network request, playback-token request counts,
 * and feature-detection signals. Each browser is classified and compared against
 * the Chrome baseline for same-root determination.
 *
 * Browsers are skipped with status UNEXECUTED when their executable is missing.
 *
 * Never prints secrets, signed URLs, JWTs, or emails. Network failure records
 * carry only a urlType classification, HTTP status, the net error string, and a
 * failureClass — never the request URL.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, firefox } from 'playwright'
import { clerk, clerkSetup } from '@clerk/testing/playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, '..')
const repoRoot = resolve(webRoot, '..')
const artifactDir = resolve(
  repoRoot,
  'docs/release-gate/master-reliability-repair/artifacts/live-closure',
)
const artifactPath = resolve(artifactDir, 'chromium-variant-investigation.json')

const baseUrl =
  process.env.RAYD8_LIVE_BASE_URL ??
  process.env.RAYD8_MUX_STABILITY_BASE_URL ??
  'https://rayd8.app'

const collectMs = Number(process.env.RAYD8_VARIANT_COLLECT_MS ?? 35_000)
const pollIntervalMs = Number(process.env.RAYD8_VARIANT_POLL_MS ?? 2_500)
const tokenRequestCap = Number(process.env.RAYD8_VARIANT_TOKEN_CAP ?? 64)

const authEnvPath = resolve(webRoot, 'e2e/.auth/mux-soak.env')
const liveEnvPath = resolve(webRoot, '.env.live-smoke')

const CHROMIUM_AUTOMATION_ARGS = [
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-component-update',
]

const BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
const OPERA_PATH = '/Applications/Opera.app/Contents/MacOS/Opera'
const EDGE_PATH = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'

function loadEnvFile(path) {
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
  return parsed
}

function loadAuthEnv() {
  const parsed = loadEnvFile(authEnvPath)
  if (!parsed) return null
  return {
    RAYD8_QA_EMAIL: parsed.RAYD8_QA_EMAIL,
    RAYD8_QA_PASSWORD: parsed.RAYD8_QA_PASSWORD,
  }
}

function loadClerkKeys() {
  const liveEnv = loadEnvFile(liveEnvPath) ?? {}
  for (const [key, value] of Object.entries(liveEnv)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
  return {
    publishableKey:
      process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }
}

function executableMissing(path) {
  if (!path) return true
  return !existsSync(path)
}

// --- Browser launchers -------------------------------------------------------

async function launchChrome() {
  try {
    return await chromium.launch({ channel: 'chrome' })
  } catch {
    return chromium.launch()
  }
}

async function launchBrave() {
  if (executableMissing(BRAVE_PATH)) return null
  return chromium.launch({ executablePath: BRAVE_PATH, args: CHROMIUM_AUTOMATION_ARGS })
}

async function launchOpera() {
  if (executableMissing(OPERA_PATH)) return null
  return chromium.launch({ executablePath: OPERA_PATH, args: CHROMIUM_AUTOMATION_ARGS })
}

async function launchEdge() {
  try {
    return await chromium.launch({ channel: 'msedge' })
  } catch {
    if (executableMissing(EDGE_PATH)) return null
    return chromium.launch({ executablePath: EDGE_PATH, args: CHROMIUM_AUTOMATION_ARGS })
  }
}

async function launchFirefox() {
  return firefox.launch()
}

const BROWSERS = [
  { id: 'chrome', kind: 'chromium', launcher: launchChrome, role: 'baseline' },
  { id: 'brave', kind: 'chromium', launcher: launchBrave, role: 'variant' },
  { id: 'opera', kind: 'chromium', launcher: launchOpera, role: 'variant' },
  { id: 'edge', kind: 'chromium', launcher: launchEdge, role: 'variant' },
  { id: 'firefox', kind: 'gecko', launcher: launchFirefox, role: 'reference' },
]

// --- Redaction ---------------------------------------------------------------

const SECRET_KEY = /(?:signed_url|authorization|password|jwt|bearer|secret|token|email)/i

function redact(value) {
  return JSON.stringify(value, (key, v) => {
    if (typeof key === 'string' && SECRET_KEY.test(key)) return '[redacted]'
    if (typeof v === 'string') {
      let out = v.replace(/token=[^&\s]+/gi, 'token=[redacted]')
      if (/eyJ[A-Za-z0-9_-]{10,}\./.test(out)) return '[redacted]'
      if (/https?:\/\/\S+/i.test(out) && /stream|mux|playback|signed/i.test(out)) {
        return '[redacted-url]'
      }
      return out
    }
    return v
  }, 2)
}

// --- Network classification --------------------------------------------------

function classifyUrlType(url) {
  if (!url) return 'other'
  if (/token|playback-token|signed-url|\/signing|\/signed/i.test(url)) return 'playback-token'
  if (/\.m3u8($|\?)|\/manifest\/|\/m3u8/i.test(url)) return 'manifest'
  if (/\.(ts|m4s|aac|mp4)($|\?)|\/segment/i.test(url)) return 'segment'
  return 'other'
}

function classifyFailure(errorText, status) {
  const text = String(errorText ?? '')
  if (/cors|cross-origin/i.test(text)) return 'cors'
  if (/timeout|timed out/i.test(text)) return 'timeout'
  if (/abort/i.test(text)) return 'abort'
  if (/blocked|err_blocked|shield/i.test(text)) return 'browser_block'
  if (typeof status === 'number' && status >= 400) return 'http_error'
  return 'unknown'
}

// --- In-page collection ------------------------------------------------------

// Injected before any page navigation so media milestones + overlay text are
// captured from the earliest moment. Stored on window so the harness can read
// them back via page.evaluate.
const INIT_SCRIPT = `
  window.__rayd8VariantProbe = {
    milestones: { loadedmetadata: null, canplay: null, canplaythrough: null, playing: null },
    overlayTextSamples: [],
    overlayChangeCount: 0,
    lastOverlayText: null,
    tokenRequestCount: 0,
    startedAt: Date.now(),
    recordMilestone(name) {
      if (this.milestones[name] === null) this.milestones[name] = Date.now() - this.startedAt;
    },
    recordOverlayText(text) {
      if (text == null || text === '') return;
      if (text !== this.lastOverlayText) {
        this.overlayChangeCount += 1;
        this.lastOverlayText = text;
        if (this.overlayTextSamples.length < 40) {
          this.overlayTextSamples.push({ at: Date.now() - this.startedAt, text: String(text).slice(0, 60) });
        }
      }
    },
    bumpTokenRequest() {
      this.tokenRequestCount += 1;
    },
  };
  try { localStorage.setItem('rayd8-player-debug', 'true'); } catch (e) {}
  const attachMediaListeners = () => {
    const v = document.querySelector('video');
    if (v && !v.__rayd8VariantWired) {
      v.__rayd8VariantWired = true;
      for (const ev of ['loadedmetadata', 'canplay', 'canplaythrough', 'playing']) {
        v.addEventListener(ev, () => window.__rayd8VariantProbe.recordMilestone(ev));
      }
    }
  };
  const overlayPoll = () => {
    try {
      const el = document.querySelector('[data-rayd8-overlay],[data-rayd8-preload-overlay],[role="status"],[aria-live="polite"]');
      if (el) {
        const text = (el.textContent || '').trim();
        if (text) window.__rayd8VariantProbe.recordOverlayText(text);
      }
    } catch (e) {}
  };
  setInterval(() => { attachMediaListeners(); overlayPoll(); }, 500);
  document.addEventListener('DOMContentLoaded', attachMediaListeners);
`

async function collectSnapshot(page) {
  return page.evaluate(() => {
    const video = document.querySelector('video')
    const probe = window.__rayd8VariantProbe
    const startup = window.__rayd8StartupInstrumentation
    const overlayEl = document.querySelector(
      '[data-rayd8-overlay],[data-rayd8-preload-overlay],[role="status"],[aria-live="polite"]',
    )
    const rect = overlayEl?.getBoundingClientRect()
    const overlayVisible = Boolean(rect && rect.width > 0 && rect.height > 0)
    const overlayText = (overlayEl?.textContent || '').trim()
    const pctMatch = overlayText.match(/(\d+)\s*%/)
    return {
      href: location.href,
      videoPresent: Boolean(video),
      videoReadyState: video?.readyState ?? null,
      videoNetworkState: video?.networkState ?? null,
      videoWidth: video?.videoWidth ?? null,
      videoHeight: video?.videoHeight ?? null,
      videoCurrentTime: typeof video?.currentTime === 'number' ? video.currentTime : null,
      videoPaused: video?.paused ?? null,
      hasCurrentSrc: Boolean(video?.currentSrc || video?.src),
      milestones: probe ? { ...probe.milestones } : null,
      overlayVisible,
      overlayPercent: pctMatch ? Number(pctMatch[1]) : null,
      overlayChangeCount: probe?.overlayChangeCount ?? 0,
      overlayTextSamples: probe ? probe.overlayTextSamples.slice() : [],
      tokenRequestCount: probe?.tokenRequestCount ?? 0,
      startupInstrumentation: startup ?? null,
    }
  })
}

async function collectFeatureDetection(page) {
  return page.evaluate(() => {
    const ua = navigator.userAgent || ''
    const video = document.createElement('video')
    const hls = video.canPlayType('application/vnd.apple.mpegurl')
    return {
      nativeHlsCanPlayType: hls || 'no',
      mediaCapabilities: typeof navigator.mediaCapabilities === 'object',
      serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
      isBrave: Boolean(navigator.brave),
      privacyHints: [
        /brave/i.test(ua) ? 'brave_shields_hint' : null,
        /OPR\/|Opera\//i.test(ua) ? 'opera_vpn_hint' : null,
        /Edg\//i.test(ua) ? 'edge_tracking_prevention' : null,
      ].filter(Boolean),
    }
  })
}

// --- Session start (best-effort selectors) -----------------------------------

async function loginWithClerk(page, auth) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await clerk.loaded({ page })
  await clerk.signIn({ page, emailAddress: auth.RAYD8_QA_EMAIL })
  await page.goto(`${baseUrl}/dashboard?rayd8PlayerDebug=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  })
  await page.waitForURL(/dashboard/i, { timeout: 60_000 })
}

async function startRegenSession(page) {
  for (const name of [/remind me later/i, /^dismiss$/i]) {
    const btn = page.getByRole('button', { name }).first()
    if ((await btn.count()) > 0) {
      await btn.click({ timeout: 5_000 }).catch(() => null)
      await page.waitForTimeout(400)
    }
  }

  const regenNav = page.getByRole('button', { name: /rayd8®?\s*regen/i }).first()
  if ((await regenNav.count()) > 0) {
    await regenNav.click({ timeout: 10_000 }).catch(() => null)
    await page.waitForTimeout(1500)
  }

  await page.waitForTimeout(2500)
  let clickedStart = false
  const scopedStart = page
    .locator('#regen')
    .getByRole('button', { name: /start session/i })
    .first()
  if ((await scopedStart.count()) > 0) {
    await scopedStart.click({ timeout: 20_000 }).catch(() => null)
    clickedStart = true
  } else {
    const fallbacks = [
      page.getByRole('button', { name: /start session/i }).last(),
      page.getByRole('button', { name: /begin session/i }).first(),
      page.getByRole('button', { name: /^start$/i }).first(),
    ]
    for (const fb of fallbacks) {
      if ((await fb.count()) > 0) {
        await fb.click({ timeout: 10_000 }).catch(() => null)
        clickedStart = true
        break
      }
    }
  }

  await page.waitForTimeout(1000)
  const confirmStart = page
    .locator('#regen')
    .getByRole('button', { name: /start session/i })
    .first()
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

  return { clickedStart, videoAppeared }
}

// --- Per-browser investigation ----------------------------------------------

async function investigateBrowser(entry, auth) {
  const result = {
    id: entry.id,
    kind: entry.kind,
    role: entry.role,
    status: 'UNEXECUTED',
    reason: null,
    classification: null,
    evidence: null,
    sameFailureVsChrome: null,
    session: null,
    features: null,
    network: null,
    permanentZeroPercent: false,
    overlayFlicker: false,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  }

  let browser = null
  try {
    browser = await entry.launcher()
  } catch (error) {
    result.reason = `launcher failed: ${error?.message ?? String(error)}`
    result.finishedAt = new Date().toISOString()
    return result
  }
  if (!browser) {
    result.reason = 'executable missing'
    result.finishedAt = new Date().toISOString()
    return result
  }

  const context = await browser.newContext()
  const page = await context.newPage()
  await page.addInitScript(INIT_SCRIPT)

  // Network failure capture — first failing request only, urlType-classified.
  const firstFailure = {
    captured: false,
    urlType: null,
    status: null,
    errorText: null,
    failureClass: null,
  }
  let tokenRequestTotal = 0

  page.on('requestfailed', (request) => {
    if (firstFailure.captured) return
    const url = request.url()
    const urlType = classifyUrlType(url)
    const errorText = request.failure()?.errorText ?? 'net::ERR_FAILED'
    firstFailure.captured = true
    firstFailure.urlType = urlType
    firstFailure.status = null
    firstFailure.errorText = errorText
    firstFailure.failureClass = classifyFailure(errorText, null)
  })

  page.on('response', (response) => {
    const status = response.status()
    const url = response.url()
    if (status >= 400 && !firstFailure.captured) {
      firstFailure.captured = true
      firstFailure.urlType = classifyUrlType(url)
      firstFailure.status = status
      firstFailure.errorText = `HTTP ${status}`
      firstFailure.failureClass = classifyFailure('http_error', status)
    }
  })

  // Bounded playback-token request counting (via URL classification).
  page.on('request', (request) => {
    if (tokenRequestTotal >= tokenRequestCap) return
    const urlType = classifyUrlType(request.url())
    if (urlType === 'playback-token') {
      tokenRequestTotal += 1
      // Mirror into the in-page probe so snapshots stay consistent.
      page.evaluate(() => window.__rayd8VariantProbe?.bumpTokenRequest?.()).catch(() => null)
    }
  })

  try {
    await loginWithClerk(page, auth)
    const startResult = await startRegenSession(page)
    result.session = {
      clickedStart: startResult.clickedStart,
      videoAppeared: startResult.videoAppeared,
    }

    // Collect for the configured window.
    const startedAt = Date.now()
    const samples = []
    while (Date.now() - startedAt < collectMs) {
      const snap = await collectSnapshot(page).catch((error) => ({
        collectError: String(error?.message ?? error),
      }))
      samples.push({ at: Date.now(), ...snap })
      await delay(pollIntervalMs)
    }

    const finalSnap = samples[samples.length - 1] ?? (await collectSnapshot(page))
    const features = await collectFeatureDetection(page).catch(() => null)

    // Permanent 0%: preload overlay still visible after the collection window
    // with a percent reading of 0 (or null percent + overlay still up and no
    // video progress).
    const permanentZeroPercent =
      Boolean(finalSnap?.overlayVisible) &&
      (finalSnap?.overlayPercent === 0 ||
        (finalSnap?.overlayPercent == null && (finalSnap?.videoCurrentTime ?? 0) <= 0))

    // Overlay flicker: non-monotonic stage cycle OR rapid overlay text churn.
    const nonMonotonic = Boolean(
      finalSnap?.startupInstrumentation?.hasNonMonotonicCycle,
    )
    const overlayFlicker = nonMonotonic || (finalSnap?.overlayChangeCount ?? 0) >= 6

    result.features = features
    result.network = firstFailure.captured
      ? {
          urlType: firstFailure.urlType,
          status: firstFailure.status,
          errorText: firstFailure.errorText,
          failureClass: firstFailure.failureClass,
        }
      : { captured: false, urlType: null, status: null, errorText: null, failureClass: null }
    result.tokenRequestTotal = Math.min(tokenRequestTotal, tokenRequestCap)
    result.permanentZeroPercent = permanentZeroPercent
    result.overlayFlicker = overlayFlicker
    result.samples = samples.map((s) => ({
      at: s.at,
      videoPresent: s.videoPresent,
      videoReadyState: s.videoReadyState,
      videoNetworkState: s.videoNetworkState,
      videoWidth: s.videoWidth,
      videoHeight: s.videoHeight,
      videoCurrentTime: s.videoCurrentTime,
      hasCurrentSrc: s.hasCurrentSrc,
      overlayVisible: s.overlayVisible,
      overlayPercent: s.overlayPercent,
      overlayChangeCount: s.overlayChangeCount,
      tokenRequestCount: s.tokenRequestCount,
      milestones: s.milestones,
      startupStages: s.startupInstrumentation?.stages?.length ?? 0,
      hasNonMonotonicCycle: s.startupInstrumentation?.hasNonMonotonicCycle ?? false,
      collectError: s.collectError ?? null,
    }))
    result.finalStartupInstrumentation = finalSnap?.startupInstrumentation ?? null
    result.status = 'EXECUTED'
  } catch (error) {
    result.status = 'EXECUTED_WITH_ERROR'
    result.reason = String(error?.message ?? error)
    result.network = firstFailure.captured
      ? {
          urlType: firstFailure.urlType,
          status: firstFailure.status,
          errorText: firstFailure.errorText,
          failureClass: firstFailure.failureClass,
        }
      : null
    result.tokenRequestTotal = Math.min(tokenRequestTotal, tokenRequestCap)
  } finally {
    await context.close().catch(() => null)
    await browser.close().catch(() => null)
    result.finishedAt = new Date().toISOString()
  }

  result.classification = classifyBrowser(result)
  result.evidence = buildEvidence(result)
  return result
}

// --- Classification ----------------------------------------------------------

function classifyBrowser(result) {
  const net = result.network
  const blockingFailure =
    net?.failureClass === 'cors' || net?.failureClass === 'browser_block'
  const videoNeverAppeared = result.session?.videoAppeared === false
  const permanentZero = result.permanentZeroPercent

  if (videoNeverAppeared || permanentZero || (blockingFailure && !result.session?.videoAppeared)) {
    return 'UNSUPPORTED'
  }

  const final = result.samples?.[result.samples.length - 1]
  const reachedPlaying = Boolean(final?.milestones?.playing != null || final?.milestones?.playing === 0)
  const reachedCanPlay = final?.milestones?.canplay != null
  const hasCurrentSrc = Boolean(final?.hasCurrentSrc)
  const hasFlicker = result.overlayFlicker
  const hasRecoverableFailure =
    net?.failureClass === 'timeout' || net?.failureClass === 'abort' || net?.failureClass === 'http_error'

  if (reachedPlaying && hasCurrentSrc && !hasFlicker && !blockingFailure) {
    return 'FULLY_SUPPORTED'
  }
  if ((reachedCanPlay || reachedPlaying) && hasCurrentSrc && (hasFlicker || hasRecoverableFailure)) {
    return 'SUPPORTED_WITH_LIMITATIONS'
  }
  if (hasCurrentSrc && !reachedPlaying) {
    return 'CONDITIONALLY_SUPPORTED'
  }
  return 'CONDITIONALLY_SUPPORTED'
}

function buildEvidence(result) {
  const final = result.samples?.[result.samples.length - 1]
  const parts = []
  parts.push(`videoAppeared=${result.session?.videoAppeared ?? 'unknown'}`)
  if (final) {
    parts.push(`readyState=${final.videoReadyState}`)
    parts.push(`hasCurrentSrc=${final.hasCurrentSrc}`)
    parts.push(`currentTime=${final.videoCurrentTime}`)
    parts.push(`milestones=${JSON.stringify(final.milestones)}`)
  }
  if (result.network?.captured) {
    parts.push(
      `firstFailure=${result.network.urlType}/${result.network.failureClass}/${result.network.errorText}`,
    )
  } else {
    parts.push('firstFailure=none')
  }
  parts.push(`tokenRequests=${result.tokenRequestTotal ?? 0}`)
  parts.push(`permanentZero=${result.permanentZeroPercent}`)
  parts.push(`overlayFlicker=${result.overlayFlicker}`)
  parts.push(`nonMonotonic=${Boolean(result.finalStartupInstrumentation?.hasNonMonotonicCycle)}`)
  return parts.join('; ')
}

// --- Same-failure determination vs Chrome baseline ----------------------------

function determineSameFailure(variant, baseline) {
  if (!baseline || baseline.status === 'UNEXECUTED') return null
  if (variant.status === 'UNEXECUTED') return null

  const baseNet = baseline.network
  const varNet = variant.network

  const baseFailed = baseNet?.captured || baseline.classification === 'UNSUPPORTED'
  const varFailed = varNet?.captured || variant.classification === 'UNSUPPORTED'

  if (!baseFailed && !varFailed) return 'A_same_root' // both clean
  if (!baseFailed && varFailed) {
    // Variant exposes a latent issue Chrome masks.
    if (varNet?.failureClass === 'cors' || varNet?.failureClass === 'browser_block') {
      return 'C_distinct'
    }
    return 'B_latent_race'
  }
  if (baseFailed && varFailed) {
    if (
      baseNet?.failureClass === varNet?.failureClass &&
      baseNet?.urlType === varNet?.urlType
    ) {
      return 'A_same_root'
    }
    return 'C_distinct'
  }
  // baseFailed && !varFailed — variant cleaner than baseline; distinct path.
  return 'C_distinct'
}

// --- Main orchestration ------------------------------------------------------

async function main() {
  mkdirSync(artifactDir, { recursive: true })

  const auth = loadAuthEnv()
  const keys = loadClerkKeys()

  if (!auth?.RAYD8_QA_EMAIL || !auth?.RAYD8_QA_PASSWORD) {
    console.error(
      '[chromium-variant-investigation] Missing web/e2e/.auth/mux-soak.env — run ' +
        '`npm --prefix api run fixture:mux-soak-auth`. Aborting.',
    )
    process.exitCode = 2
    return
  }
  if (!keys.publishableKey) {
    console.error(
      '[chromium-variant-investigation] Missing Clerk publishable key (VITE_CLERK_PUBLISHABLE_KEY ' +
        'or CLERK_PUBLISHABLE_KEY from env or web/.env.live-smoke). Aborting.',
    )
    process.exitCode = 2
    return
  }

  await clerkSetup({
    frontendApiUrl: undefined,
    publishableKey: keys.publishableKey,
    secretKey: keys.secretKey,
  })

  console.log('=== Chromium-variant startup investigation ===')
  console.log(`base url: ${baseUrl}`)
  console.log(`collect window: ${collectMs}ms (poll ${pollIntervalMs}ms)`)
  console.log(`auth: <present>  clerk key: <present>`)
  console.log()

  const browserResults = []
  for (const entry of BROWSERS) {
    console.log(`--- ${entry.id} (${entry.role}) ---`)
    const result = await investigateBrowser(entry, auth)
    browserResults.push(result)
    console.log(
      `  status: ${result.status}` +
        (result.reason ? ` — ${result.reason}` : '') +
        (result.classification ? ` — ${result.classification}` : ''),
    )
    if (result.evidence) console.log(`  evidence: ${result.evidence}`)
  }

  // Same-failure determination vs Chrome baseline.
  const baseline = browserResults.find((r) => r.id === 'chrome')
  for (const r of browserResults) {
    if (r.id === 'chrome') continue
    r.sameFailureVsChrome = determineSameFailure(r, baseline)
  }

  const artifact = {
    incident: 'INC-2026-08-07-OPERA-STARTUP-HANG',
    correlatedIncidents: [
      'INC-2026-08-06-VIDEO-LOOP',
      'INC-2026-08-06-PLAYBACK-TOKEN-CORS',
    ],
    framingQuestion:
      'which browser modifications expose startup assumptions that Chrome masks?',
    baseUrl,
    collectMs,
    pollIntervalMs,
    tokenRequestCap,
    generatedAt: new Date().toISOString(),
    browsers: browserResults.map((r) => ({
      id: r.id,
      kind: r.kind,
      role: r.role,
      status: r.status,
      reason: r.reason,
      classification: r.classification,
      evidence: r.evidence,
      sameFailureVsChrome: r.sameFailureVsChrome,
      permanentZeroPercent: r.permanentZeroPercent,
      overlayFlicker: r.overlayFlicker,
      tokenRequestTotal: r.tokenRequestTotal ?? null,
      session: r.session,
      features: r.features,
      network: r.network,
      finalStartupInstrumentation: r.finalStartupInstrumentation,
      samples: r.samples,
    })),
  }

  writeFileSync(artifactPath, `${redact(artifact)}\n`)
  console.log(`\nWrote artifact: ${artifactPath}`)

  printConsoleSummary(browserResults, baseline)
}

function printConsoleSummary(results, baseline) {
  console.log('\n=== Investigation summary ===')
  console.log(`Framing question: which browser modifications expose startup assumptions that Chrome masks?`)
  console.log()

  const byId = Object.fromEntries(results.map((r) => [r.id, r]))
  for (const id of ['chrome', 'brave', 'opera', 'edge', 'firefox']) {
    const r = byId[id]
    if (!r) continue
    const tag = r.status === 'UNEXECUTED' ? 'UNEXECUTED' : r.classification ?? 'UNKNOWN'
    const same = r.sameFailureVsChrome ? ` [${r.sameFailureVsChrome} vs chrome]` : ''
    console.log(`  ${id.padEnd(8)} ${tag}${same}`)
    if (r.reason) console.log(`           reason: ${r.reason}`)
  }

  // Opera explicit answers.
  const opera = byId.opera
  const brave = byId.brave
  const ff = byId.firefox
  console.log('\n--- Opera (INC-2026-08-07-OPERA-STARTUP-HANG) ---')
  if (!opera || opera.status === 'UNEXECUTED') {
    console.log('  Opera was UNEXECUTED (executable missing or launcher failed).')
    console.log('  Install Opera at /Applications/Opera.app and re-run to populate the artifact.')
  } else {
    console.log(`  classification: ${opera.classification}`)
    console.log(`  permanent 0%: ${opera.permanentZeroPercent}`)
    console.log(`  overlay flicker: ${opera.overlayFlicker}`)
    console.log(`  first failure: ${opera.network?.captured ? `${opera.network.urlType}/${opera.network.failureClass}` : 'none'}`)
    console.log(`  token requests: ${opera.tokenRequestTotal ?? 0}`)
    console.log(`  same-failure vs chrome: ${opera.sameFailureVsChrome ?? 'n/a'}`)
    console.log(`  evidence: ${opera.evidence}`)
  }

  console.log('\n--- Cross-incident correlation ---')
  if (brave) {
    console.log(
      `  Brave (INC-2026-08-06-VIDEO-LOOP): ${brave.status === 'UNEXECUTED' ? 'UNEXECUTED' : brave.classification} ` +
        `— flicker=${brave.overlayFlicker}, sameVsChrome=${brave.sameFailureVsChrome ?? 'n/a'}`,
    )
  }
  if (ff) {
    console.log(
      `  Firefox (INC-2026-08-06-PLAYBACK-TOKEN-CORS): ${ff.status === 'UNEXECUTED' ? 'UNEXECUTED' : ff.classification} ` +
        `— firstFailure=${ff.network?.captured ? `${ff.network.urlType}/${ff.network.failureClass}` : 'none'}, ` +
        `sameVsChrome=${ff.sameFailureVsChrome ?? 'n/a'}`,
    )
  }

  console.log('\n--- Framing answer ---')
  const variants = results.filter((r) => r.role === 'variant' && r.status !== 'UNEXECUTED')
  const latent = variants.filter((r) => r.sameFailureVsChrome === 'B_latent_race')
  const distinct = variants.filter((r) => r.sameFailureVsChrome === 'C_distinct')
  const sameRoot = variants.filter((r) => r.sameFailureVsChrome === 'A_same_root')
  if (baseline?.status === 'UNEXECUTED') {
    console.log('  Chrome baseline did not execute; same-root determination unavailable.')
  } else {
    console.log(
      `  Chrome baseline: ${baseline?.classification ?? 'unknown'} ` +
        `(firstFailure=${baseline?.network?.captured ? `${baseline.network.urlType}/${baseline.network.failureClass}` : 'none'}).`,
    )
    console.log(
      `  Variants exposing latent races Chrome masks: ${latent.length ? latent.map((r) => r.id).join(', ') : 'none'}.`,
    )
    console.log(
      `  Variants with distinct failure modes: ${distinct.length ? distinct.map((r) => r.id).join(', ') : 'none'}.`,
    )
    console.log(
      `  Variants sharing the same root as Chrome: ${sameRoot.length ? sameRoot.map((r) => r.id).join(', ') : 'none'}.`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

