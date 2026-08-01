#!/usr/bin/env node
/**
 * Behavioral smoke for Amrita loop invariants via Playwright + __AMRITA_SOAK__.
 * Hamsa lazy-context is asserted via static budget gates + probe contract.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const amritaRoot = path.join(webRoot, 'public/amrita_app')
const outDir = path.resolve(
  webRoot,
  '../docs/performance/rayd8-thermal-performance-audit/refinement/artifacts',
)

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
}

async function startStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      let rel = decodeURIComponent(url.pathname)
      if (rel === '/') rel = '/index.html'
      const filePath = path.join(amritaRoot, rel)
      if (!filePath.startsWith(amritaRoot)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      const data = await readFile(filePath)
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return { server, baseUrl: `http://127.0.0.1:${port}` }
}

async function main() {
  const { server, baseUrl } = await startStaticServer()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const results = []

  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForFunction(() => Boolean(window.__AMRITA_SOAK__), null, {
      timeout: 15_000,
    })

    let snap = await page.evaluate(() => window.__AMRITA_SOAK__.getSnapshot())
    results.push({
      name: 'idle-zero-loops',
      ok: snap.activeVisualLoops === 0 && snap.runtime === 'idle',
      snap,
    })

    await page.evaluate(() => window.__AMRITA_SOAK__.start())
    await page.waitForTimeout(800)
    snap = await page.evaluate(() => window.__AMRITA_SOAK__.getSnapshot())
    results.push({
      name: 'running-one-loop',
      ok: snap.runtime === 'running' && snap.activeVisualLoops === 1,
      snap,
    })

    await page.evaluate(() => {
      // Prefer soak pauseRendering if available; else click pause control.
      if (typeof window.__AMRITA_SOAK__.pauseRendering === 'function') {
        window.__AMRITA_SOAK__.pauseRendering()
      }
    })
    await page.waitForTimeout(400)
    snap = await page.evaluate(() => window.__AMRITA_SOAK__.getSnapshot())
    results.push({
      name: 'paused-zero-loops',
      ok: snap.runtime === 'paused' && snap.activeVisualLoops === 0,
      snap,
    })

    await page.evaluate(() => window.__AMRITA_SOAK__.resumeRendering())
    await page.waitForTimeout(500)
    snap = await page.evaluate(() => window.__AMRITA_SOAK__.getSnapshot())
    results.push({
      name: 'resumed-one-loop',
      ok: snap.runtime === 'running' && snap.activeVisualLoops === 1 && snap.resumeCount >= 1,
      snap,
    })

    // Double-start must not create a second loop.
    await page.evaluate(() => {
      window.__AMRITA_SOAK__.start()
      window.__AMRITA_SOAK__.start()
    })
    await page.waitForTimeout(300)
    snap = await page.evaluate(() => window.__AMRITA_SOAK__.getSnapshot())
    results.push({
      name: 'double-start-single-loop',
      ok: snap.activeVisualLoops === 1,
      snap,
    })

    await page.evaluate(() => window.__AMRITA_SOAK__.stop())
    await page.waitForTimeout(300)
    snap = await page.evaluate(() => window.__AMRITA_SOAK__.getSnapshot())
    results.push({
      name: 'stopped-zero-loops',
      ok: snap.runtime === 'idle' && snap.activeVisualLoops === 0,
      snap,
    })

    // Hidden-tab pause while running
    await page.evaluate(() => window.__AMRITA_SOAK__.start())
    await page.waitForTimeout(500)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(400)
    snap = await page.evaluate(() => window.__AMRITA_SOAK__.getSnapshot())
    results.push({
      name: 'hidden-pauses-loops',
      ok: snap.runtime === 'paused' && snap.activeVisualLoops === 0,
      snap,
    })
  } finally {
    await browser.close()
    server.close()
  }

  mkdirSync(outDir, { recursive: true })
  const summary = {
    generatedAt: new Date().toISOString(),
    passed: results.every((r) => r.ok),
    results,
  }
  writeFileSync(
    path.join(outDir, 'thermal-behavior-smoke.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  )

  for (const item of results) {
    console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}`)
  }

  if (!summary.passed) {
    process.exit(1)
  }
  console.log('\nThermal behavior smoke passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
