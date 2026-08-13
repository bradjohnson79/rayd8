/**
 * CORS config contract — EXTRA_CORS_ORIGIN for staging/preview origins.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('buildCorsOptions EXTRA_CORS_ORIGIN', () => {
  afterEach(() => {
    delete process.env.EXTRA_CORS_ORIGIN
    vi.resetModules()
  })

  it('includes a single EXTRA_CORS_ORIGIN in the allow-list', async () => {
    process.env.EXTRA_CORS_ORIGIN = 'https://rayd8-staging.example.com'
    vi.resetModules()
    const mod = await import('./cors.js')
    expect(mod.allowedCorsOrigins).toContain('https://rayd8-staging.example.com')
    expect(mod.allowedCorsOrigins).toContain('https://rayd8.app')
    expect(mod.buildCorsOptions().origin).toContain('https://rayd8-staging.example.com')
  })

  it('accepts comma-separated EXTRA_CORS_ORIGIN values', async () => {
    process.env.EXTRA_CORS_ORIGIN =
      'https://preview-a.example.com, https://preview-b.example.com'
    vi.resetModules()
    const mod = await import('./cors.js')
    expect(mod.allowedCorsOrigins).toContain('https://preview-a.example.com')
    expect(mod.allowedCorsOrigins).toContain('https://preview-b.example.com')
  })

  it('ignores non-http EXTRA_CORS_ORIGIN entries', async () => {
    process.env.EXTRA_CORS_ORIGIN = 'javascript:alert(1),https://ok.example.com'
    vi.resetModules()
    const mod = await import('./cors.js')
    expect(mod.allowedCorsOrigins).not.toContain('javascript:alert(1)')
    expect(mod.allowedCorsOrigins).toContain('https://ok.example.com')
  })
})
