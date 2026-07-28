import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MUX_PLAYBACK_TOKEN_TTL_MINUTES,
  resolveMuxPlaybackTokenTtlMinutes,
} from './muxPlaybackTokenTtl.js'

describe('resolveMuxPlaybackTokenTtlMinutes', () => {
  it('defaults to 12 hours', () => {
    expect(
      resolveMuxPlaybackTokenTtlMinutes({
        nodeEnv: 'development',
        requestedMinutes: null,
      }),
    ).toBe(DEFAULT_MUX_PLAYBACK_TOKEN_TTL_MINUTES)
  })

  it('allows short TTL outside production', () => {
    expect(
      resolveMuxPlaybackTokenTtlMinutes({
        nodeEnv: 'development',
        requestedMinutes: 3,
      }),
    ).toBe(3)
  })

  it('blocks short TTL in production without explicit allow flag', () => {
    expect(
      resolveMuxPlaybackTokenTtlMinutes({
        nodeEnv: 'production',
        requestedMinutes: 3,
        allowShortInProduction: false,
      }),
    ).toBe(DEFAULT_MUX_PLAYBACK_TOKEN_TTL_MINUTES)
  })

  it('allows short TTL in production when explicitly enabled for soak', () => {
    expect(
      resolveMuxPlaybackTokenTtlMinutes({
        nodeEnv: 'production',
        requestedMinutes: 3,
        allowShortInProduction: true,
      }),
    ).toBe(3)
  })
})
