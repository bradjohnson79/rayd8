import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('runSeoAudit', () => {
  it('returns a degraded response without a fake score when Chromium cannot launch', async () => {
    const launch = vi.fn().mockRejectedValue(new Error('Chromium executable missing'))

    vi.doMock('node:fs/promises', () => ({
      access: vi.fn().mockResolvedValue(undefined),
    }))
    vi.doMock('puppeteer', () => ({
      default: {
        executablePath: vi.fn(() => '/tmp/chrome'),
        launch,
      },
    }))
    vi.doMock('../../env.js', () => ({
      env: {
        APP_URL: 'https://rayd8.app',
      },
    }))

    const { runSeoAudit } = await import('./seo.audit.service.js')
    const result = await runSeoAudit(['/'])

    expect(result.status).toBe('degraded')
    if (result.status !== 'degraded') {
      throw new Error('Expected degraded SEO audit result.')
    }
    expect('score' in result).toBe(false)
    expect(result.partialResults).toEqual([])
    expect(result.message).toBe('SEO browser capture temporarily unavailable.')
    expect(result.diagnostics[0]).toMatchObject({
      message: 'Chromium executable missing',
      stage: 'browser_launch',
    })
    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining([
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ]),
        headless: true,
      }),
    )
  })

  it('exposes the Render-safe runtime launch configuration', async () => {
    vi.doMock('puppeteer', () => ({
      default: {
        executablePath: vi.fn(() => '/usr/bin/chromium'),
        launch: vi.fn(),
      },
    }))
    vi.doMock('../../env.js', () => ({
      env: {
        APP_URL: 'https://rayd8.app',
        PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
      },
    }))

    const { getSeoAuditRuntimeConfig } = await import('./seo.audit.service.js')

    expect(getSeoAuditRuntimeConfig()).toEqual({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      envExecutablePathSet: true,
      executablePath: '/usr/bin/chromium',
      headless: true,
      navigationTimeoutMs: 15_000,
      packageName: 'puppeteer',
    })
  })
})
