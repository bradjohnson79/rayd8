import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HAMSA_WEBGL_TARGET_FPS, shouldRunHamsaWebglLoop } from './webglRenderLoop'

describe('webglRenderLoop', () => {
  it('targets 30 FPS for thermal headroom', () => {
    assert.equal(HAMSA_WEBGL_TARGET_FPS, 30)
  })

  it('does not run when idle', () => {
    assert.equal(shouldRunHamsaWebglLoop(false), false)
  })
})
