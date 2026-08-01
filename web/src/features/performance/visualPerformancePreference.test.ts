import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isVisualPerformanceMode,
  resolveVisualPerformanceProfile,
} from './visualPerformancePreference'

describe('visualPerformancePreference', () => {
  it('accepts only known modes', () => {
    assert.equal(isVisualPerformanceMode('automatic'), true)
    assert.equal(isVisualPerformanceMode('standard'), true)
    assert.equal(isVisualPerformanceMode('reduced'), true)
    assert.equal(isVisualPerformanceMode('cinematic'), false)
  })

  it('maps reduced to minimal without changing automatic signals', () => {
    assert.equal(resolveVisualPerformanceProfile('reduced', 'cinematic'), 'minimal')
    assert.equal(resolveVisualPerformanceProfile('reduced', 'balanced'), 'minimal')
  })

  it('maps standard down from cinematic to balanced', () => {
    assert.equal(resolveVisualPerformanceProfile('standard', 'cinematic'), 'balanced')
    assert.equal(resolveVisualPerformanceProfile('standard', 'minimal'), 'minimal')
  })

  it('keeps automatic profile when mode is automatic', () => {
    assert.equal(resolveVisualPerformanceProfile('automatic', 'cinematic'), 'cinematic')
    assert.equal(resolveVisualPerformanceProfile('automatic', 'balanced'), 'balanced')
  })
})
