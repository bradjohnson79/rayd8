/**
 * Browser-blocked media classification.
 *
 * INC-2026-08-06-VIDEO-LOOP (Brave/macOS + Brave/Linux): when the browser
 * blocks or starves media delivery (shields, extensions, codec/policy), the
 * player must classify BROWSER_BLOCKED and show actionable copy instead of
 * looping silently while audio continues.
 */
import type { StartupFailureCode } from './sessionStartupTaxonomy'

export type BrowserFamily = 'brave' | 'firefox' | 'chrome' | 'safari' | 'unknown'

export interface BrowserBlockSignals {
  userAgent: string
  /** navigator.brave present / Brave detected. */
  isBrave: boolean
  videoReadyState: number
  videoCurrentTime: number
  /** HTMLMediaElement.networkState (2 = NETWORK_LOADING). */
  videoNetworkState: number
  videoError: { code: number; message?: string } | null
  audioPlaying: boolean
  /** Time since media source was applied. */
  elapsedMs: number
  manifestRequests: number
  segmentRequests: number
}

export interface BrowserBlockVerdict {
  blocked: boolean
  code?: StartupFailureCode
  family: BrowserFamily
  reason?: string
}

/** Grace window before we conclude the browser is starving the video. */
const BLOCK_GRACE_MS = 8_000

export function detectBrowserFamily(signals: Pick<BrowserBlockSignals, 'userAgent' | 'isBrave'>): BrowserFamily {
  if (signals.isBrave || /brave/i.test(signals.userAgent)) {
    return 'brave'
  }
  if (/firefox/i.test(signals.userAgent)) {
    return 'firefox'
  }
  if (/edg\//i.test(signals.userAgent)) {
    return 'chrome'
  }
  if (/chrome|chromium|crios/i.test(signals.userAgent)) {
    return 'chrome'
  }
  if (/safari/i.test(signals.userAgent)) {
    return 'safari'
  }
  return 'unknown'
}

const MEDIA_ERR_SRC_NOT_SUPPORTED = 4

export function classifyBrowserBlock(signals: BrowserBlockSignals): BrowserBlockVerdict {
  const family = detectBrowserFamily(signals)

  const videoProgressing = signals.videoReadyState >= 2 && signals.videoCurrentTime > 0
  if (videoProgressing) {
    return { blocked: false, family }
  }

  // Never conclude a block during the startup grace window.
  if (signals.elapsedMs < BLOCK_GRACE_MS) {
    return { blocked: false, family }
  }

  // If audio is also dead this is a generic stall, not a browser block.
  if (!signals.audioPlaying) {
    return { blocked: false, family }
  }

  // Audio alive + video starved: either the browser blocked the source
  // outright, or it never let segment delivery begin.
  const srcNotSupported = signals.videoError?.code === MEDIA_ERR_SRC_NOT_SUPPORTED
  const segmentsNeverStarted = signals.segmentRequests === 0 && signals.manifestRequests > 0

  if (srcNotSupported || segmentsNeverStarted) {
    return {
      blocked: true,
      code: 'BROWSER_BLOCKED',
      family,
      reason: srcNotSupported ? 'src_not_supported' : 'segments_never_started',
    }
  }

  return { blocked: false, family }
}
