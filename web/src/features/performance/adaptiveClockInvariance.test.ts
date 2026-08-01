import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Protocol clock must advance by elapsed wall/session time, not by frame count.
 * Lower FPS / mid-session tier switches must not stretch Amrita or Hamsa timing.
 */
describe('protocol clock invariance contracts', () => {
  it('Amrita session elapsed uses startedAt/pausedAccumulated, not frame count', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'public/amrita_app/app.js'),
      'utf8',
    )
    assert.match(source, /function getSessionElapsedMs/)
    assert.match(source, /sessionStartedAt/)
    assert.match(source, /pausedAccumulatedMs/)
    assert.doesNotMatch(
      source,
      /function getSessionElapsedMs[\s\S]{0,200}frameCount/,
    )
  })

  it('Amrita adaptive bridge never mutates sessionStartedAt', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'public/amrita_app/app.js'),
      'utf8',
    )
    const bridge = source.match(
      /function applyAmritaAdaptiveProfile\(profile\) \{[\s\S]*?\n\}/,
    )
    assert.ok(bridge, 'adaptive profile applicator missing')
    assert.doesNotMatch(bridge![0], /sessionStartedAt/)
    assert.doesNotMatch(bridge![0], /pausedAccumulatedMs/)
  })

  it('Hamsa aura progression accumulates elapsed dt independent of draw cadence', () => {
    const source = readFileSync(
      resolve(process.cwd(), '../hamsa/components/hamsa/AuraBackground.web.tsx'),
      'utf8',
    )
    assert.match(source, /elapsedTimeRef\.current \+= dt/)
    assert.match(source, /getHamsaRenderScale/)
    // Frame gate may skip draws, but elapsed still advances in drawOnce when playing.
    assert.match(source, /if \(isPlayingRef\.current\)/)
  })
})
