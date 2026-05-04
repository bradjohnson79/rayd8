import assert from 'node:assert/strict'
import {
  shouldTriggerSessionWarning,
  TWO_HOURS_MS,
} from '../../web/src/features/rayd8-player/sessionWarning.ts'

const startTime = 1_000_000

assert.equal(
  shouldTriggerSessionWarning({
    allowExtendedSessions: false,
    now: startTime + TWO_HOURS_MS - 1,
    sessionStartTime: startTime,
  }),
  false,
  'warning must not trigger before exactly two hours',
)

assert.equal(
  shouldTriggerSessionWarning({
    allowExtendedSessions: false,
    now: startTime + TWO_HOURS_MS,
    sessionStartTime: startTime,
  }),
  true,
  'warning must trigger at exactly two hours',
)

const warningShownAt = startTime + TWO_HOURS_MS

assert.equal(
  shouldTriggerSessionWarning({
    allowExtendedSessions: false,
    now: warningShownAt + TWO_HOURS_MS - 1,
    sessionStartTime: warningShownAt,
  }),
  false,
  'timer reset after warning must not trigger before the next exact two-hour window',
)

assert.equal(
  shouldTriggerSessionWarning({
    allowExtendedSessions: true,
    now: startTime + TWO_HOURS_MS * 2,
    sessionStartTime: startTime,
  }),
  false,
  'extended sessions must bypass the two-hour warning',
)

assert.equal(
  shouldTriggerSessionWarning({
    allowExtendedSessions: false,
    now: startTime + TWO_HOURS_MS * 2,
    sessionStartTime: null,
  }),
  false,
  'missing session start time must not trigger',
)

console.log('Session warning timing checks passed.')
