#!/usr/bin/env node
/**
 * AMRITA Mux isolation soaks (closure gate Tests A–F).
 *
 * Env:
 *   RAYD8_MUX_STABILITY_BASE_URL
 *   RAYD8_AMRITA_SOAK_MODE=full|audio_only|visuals_only|reduced
 *   RAYD8_MUX_SOAK_MS
 *   RAYD8_AMRITA_AUTH_ENV=web/e2e/.auth/mux-soak-amrita.env (optional; falls back to mux-soak.env)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, firefox, webkit } from 'playwright'
import { clerk, clerkSetup } from '@clerk/testing/playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, '..')
const repoRoot = resolve(webRoot, '..')
const artifactsDir = resolve(repoRoot, 'docs/release-gate/mux-video-optimization/artifacts/final-closure')
const baseUrl = process.env.RAYD8_MUX_STABILITY_BASE_URL ?? 'http://127.0.0.1:5173'
const soakMs = Number(process.env.RAYD8_MUX_SOAK_MS ?? 10 * 60_000)
const soakMode = process.env.RAYD8_AMRITA_SOAK_MODE ?? 'full'
const browserName = process.env.RAYD8_MUX_STABILITY_BROWSER ?? 'chromium'
const hiddenMs = Number(process.env.RAYD8_AMRITA_HIDDEN_MS ?? 180_000)
const cycles = Number(process.env.RAYD8_AMRITA_CYCLES ?? 0)

function loadAuthEnv() {
  const candidates = [
    process.env.RAYD8_AMRITA_AUTH_ENV,
    resolve(webRoot, 'e2e/.auth/mux-soak-amrita.env'),
    resolve(webRoot, 'e2e/.auth/mux-soak.env'),
  ].filter(Boolean)
  for (const path of candidates) {
    if (!existsSync(path)) continue
    const env = {}
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue
      const idx = line.indexOf('=')
      env[line.slice(0, idx)] = line.slice(idx + 1)
    }
    if (env.RAYD8_QA_EMAIL) return { ...env, path }
  }
  return null
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

async function snapshot(page) {
  const frame = page.frameLocator('iframe').first()
  const hasIframe = (await page.locator('iframe').count()) > 0
  if (hasIframe) {
    return frame.locator('body').evaluate(() => window.__AMRITA_SOAK__?.getSnapshot?.() ?? null)
  }
  return page.evaluate(() => window.__AMRITA_SOAK__?.getSnapshot?.() ?? null)
}

async function main() {
  mkdirSync(artifactsDir, { recursive: true })
  const auth = loadAuthEnv()
  if (!auth) throw new Error('Missing AMRITA/Mux soak auth env')

  await clerkSetup({
    publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  })

  const browser = await launchBrowser()
  const page = await browser.newPage()
  const report = {
    soakMode,
    soakMs,
    browserName,
    baseUrl,
    startedAt: new Date().toISOString(),
    samples: [],
    cycles: [],
  }

  try {
    await page.addInitScript((mode) => {
      try {
        localStorage.setItem('rayd8-amrita-soak-mode', mode)
        localStorage.setItem('rayd8-amrita-dual-pass-debug', 'true')
      } catch {
        // ignore
      }
    }, soakMode)

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await clerk.loaded({ page })
    await clerk.signIn({ page, emailAddress: auth.RAYD8_QA_EMAIL })
    await page.goto(`${baseUrl}/amrita-dashboard?rayd8AmritaSoak=${encodeURIComponent(soakMode)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2500)

    if (/subscription/i.test(page.url())) {
      report.verdict = 'AMRITA_ENTITLEMENT_MISSING'
      throw new Error('AMRITA dashboard redirected to subscription — entitlement fixture required')
    }

    await page.locator('iframe').first().waitFor({ state: 'attached', timeout: 60_000 })
    const frame = page.frameLocator('iframe').first()
    await frame.locator('#start-sequence').waitFor({ state: 'visible', timeout: 60_000 })
    await frame.locator('#start-sequence').click({ timeout: 30_000 })
    await page.waitForTimeout(4000)
    const boot = await snapshot(page)
    if (!boot) {
      throw new Error('AMRITA soak API __AMRITA_SOAK__ not available after start')
    }
    report.boot = boot

    const startedAt = Date.now()
    while (Date.now() - startedAt < soakMs) {
      const snap = await snapshot(page)
      report.samples.push({ at: Date.now(), ...snap })
      await page.waitForTimeout(Math.min(15_000, Math.max(3_000, soakMs / 10)))
    }

    if (process.env.RAYD8_AMRITA_HIDDEN === '1') {
      const client = await page.context().newCDPSession(page).catch(() => null)
      if (client) {
        await client.send('Page.setWebLifecycleState', { state: 'frozen' }).catch(() => null)
        await page.waitForTimeout(hiddenMs)
        await client.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => null)
        await page.waitForTimeout(3000)
        report.hiddenRestore = await snapshot(page)
      }
    }

    if (cycles > 0) {
      for (let i = 0; i < cycles; i += 1) {
        await frame.locator('body').evaluate(() => window.__AMRITA_SOAK__?.stop?.())
        await page.waitForTimeout(1000)
        const afterStop = await snapshot(page)
        await frame.locator('#start-sequence, button:has-text("Start")').first().click({ timeout: 20_000 }).catch(() => null)
        await page.waitForTimeout(4000)
        const afterStart = await snapshot(page)
        report.cycles.push({ cycle: i + 1, afterStop, afterStart })
      }
    }

    // Exit cleanup
    await frame.locator('body').evaluate(() => window.__AMRITA_SOAK__?.stop?.())
    await page.waitForTimeout(1000)
    report.afterExit = await snapshot(page)
    report.finishedAt = new Date().toISOString()
    report.verdict = 'AMRITA_SOAK_COMPLETE'

    const canvasGrowth = report.cycles.some(
      (c, idx) =>
        idx > 0 &&
        (c.afterStart?.canvasCount || 0) > (report.cycles[0].afterStart?.canvasCount || 0) + 1,
    )
    if (canvasGrowth) report.verdict = 'AMRITA_CANVAS_GROWTH'

    const out = resolve(artifactsDir, `amrita-soak-${soakMode}-${browserName}-${Date.now()}.json`)
    writeFileSync(out, JSON.stringify(report, null, 2))
    console.log(`Wrote ${out}`)
    console.log(`Verdict: ${report.verdict}`)
    if (report.verdict !== 'AMRITA_SOAK_COMPLETE') process.exitCode = 2
  } finally {
    await browser.close().catch(() => null)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
