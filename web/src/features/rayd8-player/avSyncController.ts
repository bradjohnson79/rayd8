/**
 * Bounded dual-pipeline A/V sync corrector.
 * Video is the master clock while both streams are advancing.
 * Handles paused/stalled audio; skips correction across video loop wraps.
 * Uses hysteresis, startup grace, and pause during seek/buffer/hidden.
 */

export interface AvSyncConfig {
  thresholdSeconds: number
  /** Release threshold once correcting (hysteresis). */
  releaseThresholdSeconds: number
  intervalMs: number
  maxCorrectionsPerMinute: number
  minSecondsBetweenCorrections: number
  loopWrapEpsilonSeconds: number
  stallEpsilonSeconds: number
  /** Ignore drift until both streams have been playing this long. */
  startupGraceMs: number
}

export const DEFAULT_AV_SYNC_CONFIG: AvSyncConfig = {
  thresholdSeconds: 0.5,
  releaseThresholdSeconds: 0.25,
  intervalMs: 2_000,
  maxCorrectionsPerMinute: 12,
  minSecondsBetweenCorrections: 2.5,
  loopWrapEpsilonSeconds: 2,
  stallEpsilonSeconds: 0.05,
  startupGraceMs: 8_000,
}

export interface AvSyncSample {
  audioTime: number
  corrected: boolean
  driftSeconds: number
  reason:
    | 'none'
    | 'audio_resume'
    | 'audio_stall_seek'
    | 'seek'
    | 'skipped_loop_wrap'
    | 'budget'
    | 'paused_video'
    | 'startup_grace'
    | 'media_not_ready'
    | 'document_hidden'
  videoTime: number
}

export class AvSyncController {
  private readonly config: AvSyncConfig
  private correctionTimestamps: number[] = []
  private lastCorrectionAt = 0
  private totalCorrections = 0
  private maxAbsDrift = 0
  private lastVideoTime: number | null = null
  private lastAudioTime: number | null = null
  private sessionStartedAt: number | null = null
  private inCorrectionBand = false

  constructor(config: Partial<AvSyncConfig> = {}) {
    this.config = { ...DEFAULT_AV_SYNC_CONFIG, ...config }
  }

  reset() {
    this.correctionTimestamps = []
    this.lastCorrectionAt = 0
    this.totalCorrections = 0
    this.maxAbsDrift = 0
    this.lastVideoTime = null
    this.lastAudioTime = null
    this.sessionStartedAt = null
    this.inCorrectionBand = false
  }

  getSnapshot() {
    return {
      maxAbsDriftSeconds: this.maxAbsDrift,
      totalCorrections: this.totalCorrections,
      thresholdSeconds: this.config.thresholdSeconds,
      releaseThresholdSeconds: this.config.releaseThresholdSeconds,
      inCorrectionBand: this.inCorrectionBand,
    }
  }

  reconcile(video: HTMLMediaElement | null, audio: HTMLMediaElement | null, now = Date.now()): AvSyncSample | null {
    if (!video || !audio) {
      return null
    }

    if (!video.currentSrc || !audio.currentSrc) {
      return null
    }

    if (typeof document !== 'undefined' && document.hidden) {
      return {
        videoTime: video.currentTime,
        audioTime: audio.currentTime,
        driftSeconds: video.currentTime - audio.currentTime,
        corrected: false,
        reason: 'document_hidden',
      }
    }

    if (video.seeking || audio.seeking || video.readyState < 2 || audio.readyState < 2) {
      return {
        videoTime: video.currentTime,
        audioTime: audio.currentTime,
        driftSeconds: video.currentTime - audio.currentTime,
        corrected: false,
        reason: 'media_not_ready',
      }
    }

    if (this.sessionStartedAt === null) {
      this.sessionStartedAt = now
    }

    const videoTime = video.currentTime
    const audioTime = audio.currentTime
    const driftSeconds = videoTime - audioTime
    this.maxAbsDrift = Math.max(this.maxAbsDrift, Math.abs(driftSeconds))

    const loopWrap =
      this.lastVideoTime !== null &&
      videoTime + this.config.loopWrapEpsilonSeconds < this.lastVideoTime
    const audioStalled =
      this.lastAudioTime !== null &&
      Math.abs(audioTime - this.lastAudioTime) <= this.config.stallEpsilonSeconds
    const videoAdvancing =
      this.lastVideoTime !== null &&
      videoTime > this.lastVideoTime + this.config.stallEpsilonSeconds

    this.lastVideoTime = videoTime
    this.lastAudioTime = audioTime

    if (now - this.sessionStartedAt < this.config.startupGraceMs) {
      return { videoTime, audioTime, driftSeconds, corrected: false, reason: 'startup_grace' }
    }

    if (video.paused) {
      return { videoTime, audioTime, driftSeconds, corrected: false, reason: 'paused_video' }
    }

    if (audio.paused) {
      if (!this.canCorrect(now)) {
        return { videoTime, audioTime, driftSeconds, corrected: false, reason: 'budget' }
      }

      void audio.play().catch(() => undefined)
      this.markCorrected(now)
      return { videoTime, audioTime, driftSeconds, corrected: true, reason: 'audio_resume' }
    }

    if (loopWrap) {
      return { videoTime, audioTime, driftSeconds, corrected: false, reason: 'skipped_loop_wrap' }
    }

    const absDrift = Math.abs(driftSeconds)
    if (this.inCorrectionBand) {
      if (absDrift <= this.config.releaseThresholdSeconds) {
        this.inCorrectionBand = false
      }
    } else if (absDrift >= this.config.thresholdSeconds) {
      this.inCorrectionBand = true
    }

    // Audio reports playing but time is frozen while video advances.
    if (audioStalled && videoAdvancing && absDrift >= this.config.thresholdSeconds) {
      if (!this.canCorrect(now)) {
        return { videoTime, audioTime, driftSeconds, corrected: false, reason: 'budget' }
      }

      try {
        audio.currentTime = Math.max(0, videoTime)
      } catch {
        // Ignore seek failures and still attempt play.
      }
      void audio.play().catch(() => undefined)
      this.markCorrected(now)
      return { videoTime, audioTime, driftSeconds, corrected: true, reason: 'audio_stall_seek' }
    }

    if (!this.inCorrectionBand || absDrift < this.config.thresholdSeconds) {
      return { videoTime, audioTime, driftSeconds, corrected: false, reason: 'none' }
    }

    if (!this.canCorrect(now)) {
      return { videoTime, audioTime, driftSeconds, corrected: false, reason: 'budget' }
    }

    try {
      audio.currentTime = Math.max(0, videoTime)
      this.markCorrected(now)
      return { videoTime, audioTime, driftSeconds, corrected: true, reason: 'seek' }
    } catch {
      return { videoTime, audioTime, driftSeconds, corrected: false, reason: 'none' }
    }
  }

  private canCorrect(now: number) {
    this.correctionTimestamps = this.correctionTimestamps.filter((ts) => now - ts <= 60_000)
    if (this.correctionTimestamps.length >= this.config.maxCorrectionsPerMinute) {
      return false
    }

    if (
      this.lastCorrectionAt > 0 &&
      now - this.lastCorrectionAt < this.config.minSecondsBetweenCorrections * 1000
    ) {
      return false
    }

    return true
  }

  private markCorrected(now: number) {
    this.lastCorrectionAt = now
    this.correctionTimestamps.push(now)
    this.totalCorrections += 1
  }
}
