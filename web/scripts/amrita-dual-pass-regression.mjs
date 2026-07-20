import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const port = Number(process.env.RAYD8_AMRITA_TEST_PORT ?? 4178)
const baseUrl = `http://127.0.0.1:${port}`
const route = '/amrita_app/index.html'
const fastSpeed = 10
const phaseNames = {
  downPass1: 'down-pass-1',
  downBoth: 'down-both',
  downPass2Finishing: 'down-pass-2-finishing',
  upPass1: 'up-pass-1',
  upBoth: 'up-both',
  upPass2Finishing: 'up-pass-2-finishing',
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function startPreviewServer() {
  return spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        BROWSER: 'none',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}

async function waitForServer(server) {
  let lastError = null

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Preview server exited early with code ${server.exitCode}.`)
    }

    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch (error) {
      lastError = error
    }

    await delay(250)
  }

  throw new Error(`Timed out waiting for preview server. ${lastError ?? ''}`)
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome' })
  } catch {
    return chromium.launch()
  }
}

async function createPage(browser, viewport = { height: 900, width: 1440 }) {
  const page = await browser.newPage({ viewport })
  await page.addInitScript(() => {
    window.localStorage.setItem('rayd8-amrita-dual-pass-debug', 'true')
    const originalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function playWithRejectedAudio() {
      if (this.tagName.toLowerCase() === 'audio') {
        return Promise.reject(new DOMException('Audio autoplay rejected by test.', 'NotAllowedError'))
      }

      return originalPlay.call(this)
    }
  })
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForFunction(() => Boolean(window.__AMRITA_DUAL_PASS_DIAGNOSTICS__), null, { timeout: 5000 })
  await page.evaluate((speed) => window.__AMRITA_DUAL_PASS_DIAGNOSTICS__.setSpeed(speed), fastSpeed)
  await page.locator('#start-sequence').click()
  await waitForState(page, (state) => state.runtime === 'running' && state.cycle, 'runtime start')
  return page
}

async function getState(page) {
  return page.evaluate(() => window.__AMRITA_DUAL_PASS_DIAGNOSTICS__.getState())
}

async function waitForState(page, predicate, label, timeoutMs = 7000) {
  const startedAt = Date.now()
  let lastState = null

  while (Date.now() - startedAt < timeoutMs) {
    lastState = await getState(page)
    if (predicate(lastState)) return lastState
    await delay(35)
  }

  throw new Error(`${label} did not occur. Last state: ${JSON.stringify(lastState)}`)
}

function activePasses(state) {
  return state.cycle.passes.filter((pass) => pass.startedAt !== null)
}

function passState(state, passId) {
  return state.cycle.passes.find((pass) => pass.passId === passId)
}

function assertProgressFrozen(before, after, passId) {
  const beforeProgress = passState(before, passId).progress
  const afterProgress = passState(after, passId).progress
  const difference = Math.abs(afterProgress - beforeProgress)
  assert(
    difference < 0.02,
    `pass ${passId} progress should freeze while paused; before=${beforeProgress}, after=${afterProgress}`,
  )
}

function assertSingleSnapshot(state, label) {
  const snapshot = state.cycle.snapshot
  assert(snapshot.passCount === 2, `${label}: expected two configured passes`)
  assert(snapshot.glyphCount > 0, `${label}: expected glyph instances`)
  assert(snapshot.instanceSignature.length === snapshot.glyphCount, `${label}: invalid instance signature`)
  assert(snapshot.drawOrder.length === snapshot.glyphCount, `${label}: invalid draw order`)
  assert(snapshot.triggerProgress === 0.5, `${label}: unexpected trigger progress`)
}

async function runSequenceTest(browser) {
  const page = await createPage(browser)
  try {
    const initial = await waitForState(
      page,
      (state) => state.cycle?.phase === phaseNames.downPass1 && activePasses(state).length === 1,
      'down pass 1 alone',
    )
    assertSingleSnapshot(initial, 'initial')
    const initialSignature = JSON.stringify(initial.cycle.snapshot.instanceSignature)

    const downBoth = await waitForState(page, (state) => state.cycle?.phase === phaseNames.downBoth, 'down both')
    assert(activePasses(downBoth).length === 2, 'down both: expected both passes active')
    assert(passState(downBoth, 2).progress < passState(downBoth, 1).progress, 'down both: pass 2 should trail pass 1')
    assert(JSON.stringify(downBoth.cycle.snapshot.instanceSignature) === initialSignature, 'snapshot changed after pass 2 start')

    const downFinishing = await waitForState(
      page,
      (state) => state.cycle?.phase === phaseNames.downPass2Finishing,
      'down pass 2 finishing',
    )
    assert(passState(downFinishing, 1).completed, 'down finishing: pass 1 should wait at bottom')
    assert(!passState(downFinishing, 2).completed, 'down finishing: pass 2 should still be moving')

    const upPass1 = await waitForState(page, (state) => state.cycle?.phase === phaseNames.upPass1, 'up pass 1')
    assert(upPass1.cycle.direction === 'up', 'up pass 1: expected upward direction')
    assert(activePasses(upPass1).length === 1, 'up pass 1: expected pass 1 alone')

    const upBoth = await waitForState(page, (state) => state.cycle?.phase === phaseNames.upBoth, 'up both')
    assert(activePasses(upBoth).length === 2, 'up both: expected both passes active')
    assert(passState(upBoth, 2).progress < passState(upBoth, 1).progress, 'up both: pass 2 should trail pass 1')

    await waitForState(page, (state) => state.turnIndex >= 1 && state.cycle?.phase === phaseNames.downPass1, 'next cycle')
  } finally {
    await page.close()
  }
}

async function runPauseResumeTest(browser) {
  const page = await createPage(browser)
  try {
    await waitForState(page, (state) => state.cycle?.phase === phaseNames.downBoth, 'pause setup')
    await page.locator('[data-runtime-action="pause"]').click({ force: true })
    const paused = await waitForState(page, (state) => state.runtime === 'paused', 'paused')
    await delay(300)
    const stillPaused = await getState(page)
    assert(stillPaused.runtime === 'paused', 'runtime should remain paused')
    assert(stillPaused.cycle.phase === paused.cycle.phase, 'paused phase should not change')
    assertProgressFrozen(paused, stillPaused, 1)
    assertProgressFrozen(paused, stillPaused, 2)
    await page.locator('[data-runtime-action="pause"]').click({ force: true })
    await waitForState(page, (state) => state.runtime === 'running' && state.cycle?.phase === phaseNames.upPass1, 'resume continuation')
  } finally {
    await page.close()
  }
}

async function runExpirationTest(browser, targetPhase) {
  const page = await createPage(browser)
  try {
    await waitForState(page, (state) => state.cycle?.phase === targetPhase, `expiration setup ${targetPhase}`)
    const expired = await page.evaluate(() => window.__AMRITA_DUAL_PASS_DIAGNOSTICS__.expireSession())
    assert(expired, `${targetPhase}: expected test session expiration to be applied`)
    await waitForState(
      page,
      (state) => state.runtime === 'idle' && state.cycle === null && state.activeGlyphDrawCount === 0,
      `expiration cleanup ${targetPhase}`,
    )
  } finally {
    await page.close()
  }
}

async function runLongSessionTest(browser) {
  const page = await createPage(browser, { height: 844, width: 390 })
  try {
    const state = await waitForState(page, (nextState) => nextState.turnIndex >= 3, 'long session cycles', 12000)
    assert(state.runtime === 'running', 'long session: runtime should still be running')
    assert(state.activeGlyphDrawCount <= state.cycle.snapshot.glyphCount * 2, 'long session: unexpected draw count growth')
    assert(activePasses(state).length <= 2, 'long session: pass accumulation detected')
  } finally {
    await page.close()
  }
}

const server = startPreviewServer()
server.stdout.on('data', () => undefined)
server.stderr.on('data', () => undefined)

try {
  await waitForServer(server)
  const browser = await launchBrowser()

  try {
    await runSequenceTest(browser)
    await runPauseResumeTest(browser)
    for (const phase of Object.values(phaseNames)) {
      await runExpirationTest(browser, phase)
    }
    await runLongSessionTest(browser)
  } finally {
    await browser.close()
  }

  console.log('AMRITA dual-pass regression passed.')
} finally {
  server.kill('SIGTERM')
}
