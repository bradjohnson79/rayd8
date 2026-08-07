/**
 * Shared media-qualification reporter.
 *
 * The Rayd8PlayerEngine owns live media health; the SessionProvider owns the
 * usage heartbeat. This module lets the engine publish the current
 * qualification snapshot so the heartbeat can attest `mediaQualified` without
 * prop-drilling through the overlay boundary.
 *
 * INC-2026-08-06-VIDEO-LOOP: usage must only accrue when the required media
 * is actually healthy.
 */
import { isUsageQualified, type SessionMode, type UsageQualificationInput } from './mediaQualification'

export interface MediaQualificationSnapshot {
  sessionMode: SessionMode
  audioPlaying: boolean
  audioCurrentTime: number
  videoPlaying: boolean
  videoCurrentTime: number
  videoReadyState: number
  videoWidth: number
  startupStatus: UsageQualificationInput['startupStatus']
}

let current: MediaQualificationSnapshot | null = null

export function publishMediaQualification(snapshot: MediaQualificationSnapshot | null) {
  current = snapshot
}

export function clearMediaQualification() {
  current = null
}

/**
 * Returns whether usage is currently qualified. Fails closed: when no snapshot
 * has been published (engine not mounted / torn down), usage is unqualified.
 */
export function readMediaQualified(): boolean {
  if (!current) {
    return false
  }
  return isUsageQualified(current).qualified
}
