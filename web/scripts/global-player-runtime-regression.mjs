import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const port = Number(process.env.RAYD8_RUNTIME_TEST_PORT ?? 4177)
const baseUrl = `http://127.0.0.1:${port}`
const viewports = [
  { height: 900, label: 'desktop', width: 1440 },
  { height: 844, label: 'mobile', width: 390 },
]
const routes = [
  { path: '/', requiresVisualSurface: false },
  { path: '/hamsa-app/', requiresVisualSurface: true },
  { path: '/hamsa-mobile-app/', requiresVisualSurface: true },
  { path: '/amrita_app/index.html', requiresVisualSurface: true },
  { path: '/admin/global-players/expansion', protectedRoute: true },
  { path: '/admin/global-players/premium', protectedRoute: true },
  { path: '/admin/global-players/regen', protectedRoute: true },
]
const forbiddenPatterns = [
  /tap\s+to\s+start\s+playback/i,
  /playback\s+paused/i,
  /your\s+browser\s+needs\s+one\s+more\s+tap/i,
  /resume\s+session/i,
  /tap\s+once\s+to\s+unlock/i,
  /waiting\s+for\s+first\s+tap/i,
]

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
      if (response.ok) {
        return
      }
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

async function installAudioRejectionMock(page) {
  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function playWithRejectedAudio() {
      if (this.tagName.toLowerCase() === 'audio') {
        return Promise.reject(new DOMException('Audio autoplay rejected by test.', 'NotAllowedError'))
      }

      return originalPlay.call(this)
    }
  })
}

async function assertNoForbiddenPrompt(page, label) {
  const visibleText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
  const match = forbiddenPatterns.find((pattern) => pattern.test(visibleText))

  if (match) {
    throw new Error(`${label}: forbidden playback prompt matched ${match}.`)
  }
}

async function assertVisualSurface(page, label) {
  const visualSurfaceVisible = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('video, canvas, iframe, img, #root'))
    const elementVisible = candidates.some((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })

    if (elementVisible) {
      return true
    }

    const documentRect = document.documentElement.getBoundingClientRect()
    const bodyRect = document.body.getBoundingClientRect()
    return documentRect.width > 0 && documentRect.height > 0 && bodyRect.width > 0
  })

  if (!visualSurfaceVisible) {
    throw new Error(`${label}: no visible visual surface was detected.`)
  }
}

const server = startPreviewServer()
server.stdout.on('data', () => undefined)
server.stderr.on('data', () => undefined)

try {
  await waitForServer(server)
  const browser = await launchBrowser()

  try {
    for (const viewport of viewports) {
      for (const route of routes) {
        const page = await browser.newPage({ viewport })
        await installAudioRejectionMock(page)
        const label = `${viewport.label} ${route.path}`

        await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 })
        await assertNoForbiddenPrompt(page, label)

        if (!route.protectedRoute || route.requiresVisualSurface) {
          await assertVisualSurface(page, label)
        }

        await page.close()
      }
    }
  } finally {
    await browser.close()
  }

  console.log('Global player runtime regression passed.')
} finally {
  server.kill('SIGTERM')
}
