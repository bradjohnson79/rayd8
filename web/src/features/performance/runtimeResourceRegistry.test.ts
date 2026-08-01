import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  clearRuntimeTimeline,
  getRuntimeResourceSnapshot,
  markRuntimeCleanup,
  recordRuntimeTimeline,
  registerRuntimeResource,
  resetRuntimeResourceRegistry,
  unregisterRuntimeResource,
} from './runtimeResourceRegistry'

describe('runtimeResourceRegistry', () => {
  beforeEach(() => {
    resetRuntimeResourceRegistry()
    clearRuntimeTimeline()
  })

  it('tracks register/unregister counts by kind and owner', () => {
    registerRuntimeResource({
      id: 'hls-1',
      kind: 'hls_instance',
      owner: 'Express Player',
    })
    registerRuntimeResource({
      id: 'raf-amrita',
      kind: 'raf_loop',
      owner: 'Amrita',
    })
    registerRuntimeResource({
      id: 'gl-aura',
      kind: 'webgl_context',
      owner: 'Hamsa Aura',
    })

    let snap = getRuntimeResourceSnapshot()
    assert.equal(snap.hlsInstances, 1)
    assert.equal(snap.amritaLoops, 1)
    assert.equal(snap.hamsaContexts, 1)

    unregisterRuntimeResource('raf-amrita', 'pause')
    snap = getRuntimeResourceSnapshot()
    assert.equal(snap.amritaLoops, 0)
  })

  it('records timeline and cleanup marks', () => {
    recordRuntimeTimeline('load')
    recordRuntimeTimeline('amrita_start')
    markRuntimeCleanup('session_stop')
    const snap = getRuntimeResourceSnapshot()
    assert.equal(snap.timeline[0]?.name, 'load')
    assert.equal(snap.lastCleanup?.reason, 'session_stop')
  })
})
