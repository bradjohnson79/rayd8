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
const mode = process.env.RAYD8_MUX_STABILITY_MODE ?? 'smoke'
const soakMs = Number(process.env.RAYD8_MUX_SOAK_MS ?? (mode === 'soak' ? 5 * 60_000 : 45_000))
const port = Number(process.env.RAYD8_RUNTIME_TEST_PORT ?? 4178)
const baseUrl = process.env.RAYD8_MUX_STABILITY_BASE_URL ?? `http://127.0.0.1:${port}`
const browserName = process.env.RAYD8_MUX_STABILITY_BROWSER ?? 'chromium'
const authEnvPath = resolve(webRoot, 'e2e/.auth/mux-soak.env')

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

async function launchBrowser() {
  if (browserName === 'firefox') return firefox.launch()
  if (browserName === 'webkit') return webkit.launch()
  try {
    return await chromium.launch({ channel: 'chrome' })
  } catch {
    return chromium.launch()
  }
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
    return {
      href: location.href,
      videos,
      audios,
      debug: debug?.getSnapshot?.() ?? null,
      correlationId: debug?.getCorrelationId?.() ?? null,
    }
  })
}

async function runAuthenticatedSession(page, auth) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('rayd8-player-debug', 'true')
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

  // Default product audio track is 'none'. For dual-pipeline certification, enable a bed track.
  const audioButton = page.getByRole('button', { name: /audio|select audio/i }).first()
  if ((await audioButton.count()) > 0) {
    await audioButton.click({ timeout: 5_000 }).catch(() => null)
    await page.waitForTimeout(400)
    const trackOption = page
      .getByRole('button', { name: /expansion track|premium track|monastic|soul awakening/i })
      .first()
    if ((await trackOption.count()) > 0) {
      await trackOption.click({ timeout: 5_000 }).catch(() => null)
    } else {
      const options = page.locator('button').filter({ hasText: /track|awakening|monastic/i })
      if ((await options.count()) > 0) {
        await options.first().click({ timeout: 5_000 }).catch(() => null)
      }
    }
    await page.waitForTimeout(2500)
  }

  await assertNoForbiddenPrompt(page, 'post-start')
  const started = clickedStart && videoAppeared

  if (!started) {
    throw new Error('Authenticated session did not mount a <video> element after Start Session.')
  }

  const requireDualAudio = process.env.RAYD8_MUX_REQUIRE_DUAL_AUDIO !== '0'
  if (requireDualAudio) {
    const audioReady = await page.evaluate(() => {
      const audio = document.querySelector('audio[data-rayd8-global-audio="true"], audio')
      return Boolean(audio && (audio.currentSrc || audio.getAttribute('src')))
    })
    if (!audioReady) {
      throw new Error('Dual-pipeline soak requires an audio track with currentSrc (audioTrack was none/failed).')
    }
  }

  const samples = []
  const startedAt = Date.now()
  while (Date.now() - startedAt < soakMs) {
    const sample = await collectSnapshot(page)
    samples.push({ at: Date.now(), ...sample })
    if (sample.videos < 1) {
      throw new Error(
        `Playback video element disappeared during soak at sample ${samples.length} (href=${sample.href}).`,
      )
    }
    await assertNoForbiddenPrompt(page, 'during-soak')
    await page.waitForTimeout(Math.min(15_000, Math.max(2_000, soakMs / 10)))
  }

  // Exit / cleanup if close control exists.
  const close = page.getByRole('button', { name: /close|exit|end session/i }).first()
  if (await close.count()) {
    await close.click().catch(() => null)
    await page.waitForTimeout(1500)
  }

  const afterExit = await collectSnapshot(page)
  return { started, samples, afterExit, soakMs }
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
  const page = await browser.newPage()
  const report = {
    mode,
    browserName,
    baseUrl,
    soakMs,
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
    report.verdict =
      report.authenticated && report.session?.started
        ? 'AUTHENTICATED_RUN_COMPLETE'
        : report.authenticated
          ? 'AUTH_PRESENT_BUT_SESSION_START_UNCONFIRMED'
          : 'SHELL_ONLY_NO_AUTH'

    const outPath = resolve(
      artifactsDir,
      `mux-stability-${mode}-${browserName}-${Date.now()}.json`,
    )
    writeFileSync(outPath, redact(report))
    console.log(`Wrote ${outPath}`)
    console.log(`Verdict: ${report.verdict}`)

    if (mode === 'soak' && !report.authenticated) {
      process.exitCode = 2
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
