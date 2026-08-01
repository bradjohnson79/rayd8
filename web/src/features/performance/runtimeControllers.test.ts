import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { EffectivePerformanceProfile } from './adaptivePerformanceTypes'
import {
  __resetRuntimeControllersForTests,
  applyProfileToControllers,
  getControllerFailureCount,
  getRuntimeControllerCount,
  registerRuntimeController,
} from './runtimeControllers'

function profile(partial: Partial<EffectivePerformanceProfile> = {}): EffectivePerformanceProfile {
  return {
    version: 1,
    mode: 'automatic',
    effectiveTier: 'standard',
    visualEffectsTier: 'standard',
    targetFps: 30,
    renderScale: 1,
    maxDevicePixelRatio: 1.65,
    allowDecorativeMotion: true,
    allowHeavyBlur: true,
    allowAnimatedGradients: true,
    mediaNetworkPolicy: 'auto',
    pauseOffscreenRendering: true,
    pauseHiddenTabRendering: true,
    reason: null,
    lastTierChangeAt: null,
    ordinaryTierChangesThisSession: 0,
    activityState: 'page-active',
    ...partial,
  }
}

describe('runtimeControllers ownership', () => {
  it('keeps at most one controller per id across remount x10', () => {
    __resetRuntimeControllersForTests()
    for (let i = 0; i < 10; i += 1) {
      const unregister = registerRuntimeController({
        id: 'hamsa',
        applyProfile() {},
      })
      unregister()
      registerRuntimeController({
        id: 'hamsa',
        applyProfile() {},
      })
    }
    assert.equal(getRuntimeControllerCount(), 1)
    __resetRuntimeControllersForTests()
  })

  it('isolates controller failures during dispatch', () => {
    __resetRuntimeControllersForTests()
    let healthyCalls = 0
    registerRuntimeController({
      id: 'bad',
      applyProfile() {
        throw new Error('boom')
      },
    })
    registerRuntimeController({
      id: 'good',
      applyProfile() {
        healthyCalls += 1
      },
    })
    applyProfileToControllers(profile())
    assert.equal(healthyCalls, 1)
    assert.equal(getControllerFailureCount('bad'), 1)
    __resetRuntimeControllersForTests()
  })
})
