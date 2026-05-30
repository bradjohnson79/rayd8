import { PlaybackScheduler } from '../rayd8-player/playbackScheduler'
import {
  getPlaybackPolicyTimings,
  resolvePlaybackPolicyProfile,
  type PlaybackPolicyProfile,
} from './playbackPolicy'
import {
  classifyPlaybackSignal,
  playbackSignalPriority,
  type PlaybackSignal,
} from './playbackSignals'
import {
  createInitialPresentationSnapshot,
  machineToLegacyPlaybackState,
  shouldShowInteractionOverlay,
  type PlaybackMachineState,
  type PlaybackPresentationSnapshot,
} from './playbackPresentation'
import {
  recordAuthorityDecision,
  recordInterruption,
  soakFreezeEnd,
  soakFreezeStart,
  soakMarkPlayingState,
} from './playbackSoakMetrics'

export type PlaybackKind = 'dual' | 'combined'

export interface PlaybackVideoDelegate {
  attemptMajorRecovery: (reason: 'stalled' | 'error') => Promise<boolean>
  attemptSoftResume: () => Promise<boolean>
}

export interface PlaybackAudioDelegate {
  attemptMajorRecovery: (reason: 'error' | 'health-check') => Promise<boolean>
  attemptSoftResume: () => Promise<boolean>
}

const noopAudioDelegate: PlaybackAudioDelegate = {
  attemptMajorRecovery: async () => true,
  attemptSoftResume: async () => true,
}

export function createPlaybackAuthority(): PlaybackAuthorityController {
  return new PlaybackAuthorityController(resolvePlaybackPolicyProfile())
}

export class PlaybackAuthorityController {
  private readonly listeners = new Set<() => void>()
  private readonly scheduler = new PlaybackScheduler()
  private snapshot: PlaybackPresentationSnapshot = createInitialPresentationSnapshot()
  private profile: PlaybackPolicyProfile
  private timings = getPlaybackPolicyTimings(resolvePlaybackPolicyProfile())
  private playbackKind: PlaybackKind = 'dual'
  private videoDelegate: PlaybackVideoDelegate | null = null
  private audioDelegate: PlaybackAudioDelegate | null = null

  private overlaySuppressed = false
  private activeHardInterruption = false
  private hardInterruptionPriority = 0
  private lastMajorRecoveryAt = 0
  private majorVideoRecoveryInFlight = false
  private majorAudioRecoveryInFlight = false
  private resumeOperationInFlight = false

  constructor(initialProfile: PlaybackPolicyProfile) {
    this.profile = initialProfile
    this.timings = getPlaybackPolicyTimings(this.profile)
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): PlaybackPresentationSnapshot => this.snapshot

  dispose() {
    this.scheduler.clearAll()
    this.listeners.clear()
    this.videoDelegate = null
    this.audioDelegate = null
    this.majorVideoRecoveryInFlight = false
    this.majorAudioRecoveryInFlight = false
    this.resumeOperationInFlight = false
    soakMarkPlayingState(false)
    this.snapshot = createInitialPresentationSnapshot()
  }

  setPlaybackKind(kind: PlaybackKind) {
    this.playbackKind = kind
  }

  registerVideoDelegate(delegate: PlaybackVideoDelegate) {
    this.videoDelegate = delegate
  }

  registerAudioDelegate(delegate: PlaybackAudioDelegate) {
    this.audioDelegate = delegate
  }

  clearVideoDelegate() {
    this.videoDelegate = null
  }

  clearAudioDelegate() {
    this.audioDelegate = null
  }

  dispatch(signal: PlaybackSignal): void {
    recordAuthorityDecision(signal.type, this.snapshot.machine)

    if (signal.type === 'lifecycle_preloading') {
      this.resetHardInterruptionState()
      this.overlaySuppressed = false
      this.commitPresentation('PRELOADING')
      return
    }

    if (signal.type === 'lifecycle_ready') {
      this.commitPresentation('READY')
      return
    }

    if (signal.type === 'lifecycle_play_attempt_finished') {
      if (signal.ok) {
        this.resetHardInterruptionState()
        this.overlaySuppressed = false
        this.commitPresentation('PLAYING')
      } else {
        this.enterGestureRequired(false)
      }
      return
    }

    if (signal.type === 'lifecycle_fatal') {
      this.commitPresentation('FATAL_ERROR')
      return
    }

    if (signal.type === 'lifecycle_idle') {
      this.resetHardInterruptionState()
      this.commitPresentation('IDLE')
      return
    }

    const priority = playbackSignalPriority(signal)
    const category = classifyPlaybackSignal(signal)

    if (
      this.activeHardInterruption &&
      priority < this.hardInterruptionPriority &&
      category !== 'hard_stop'
    ) {
      return
    }

    switch (signal.type) {
      case 'tab_hidden':
        return

      case 'tab_visible':
        this.scheduleTabVisibleResume()
        return

      case 'video_stall_observed':
        return

      case 'video_persistent_freeze':
        void this.runMajorVideoRecovery('stalled')
        return

      case 'video_error':
        void this.runMajorVideoRecovery('error')
        return

      case 'video_pause_while_expecting_play':
        if (this.profile === 'uninterrupted') {
          return
        }

        this.enterGestureRequired(false)
        return

      case 'video_ended_loop':
        void this.videoDelegate?.attemptSoftResume()
        return

      case 'audio_autoplay_blocked':
        this.enterGestureRequired(this.profile === 'uninterrupted')
        return

      case 'audio_error':
        void this.runMajorAudioRecovery('error')
        return

      case 'audio_paused_while_expected':
        void this.handleAudioPausedExpected(signal.reason)
        return

      default:
        return
    }
  }

  private delegates(): {
    audio: PlaybackAudioDelegate
    video: PlaybackVideoDelegate
  } | null {
    if (!this.videoDelegate) {
      return null
    }

    if (this.playbackKind === 'combined') {
      return {
        audio: this.audioDelegate ?? noopAudioDelegate,
        video: this.videoDelegate,
      }
    }

    if (!this.audioDelegate) {
      return null
    }

    return {
      audio: this.audioDelegate,
      video: this.videoDelegate,
    }
  }

  private resetHardInterruptionState() {
    this.activeHardInterruption = false
    this.hardInterruptionPriority = 0
    this.overlaySuppressed = false
  }

  private notify() {
    this.listeners.forEach((listener) => listener())
  }

  private commitPresentation(machine: PlaybackMachineState) {
    const interactionOverlayVisible =
      shouldShowInteractionOverlay(machine) && !this.overlaySuppressed

    this.snapshot = {
      interactionOverlayVisible,
      legacyPlaybackState: machineToLegacyPlaybackState(machine),
      machine,
    }

    soakMarkPlayingState(machine === 'PLAYING' || machine === 'BUFFERING')
    this.notify()
  }

  private enterGestureRequired(suppressOverlay: boolean) {
    this.activeHardInterruption = true
    this.hardInterruptionPriority = Math.max(this.hardInterruptionPriority, 68)
    this.overlaySuppressed = suppressOverlay
    recordInterruption('gesture_required')
    this.commitPresentation('WAITING_FOR_GESTURE')
  }

  private scheduleTabVisibleResume() {
    this.scheduler.clear('authority-tab-visible')
    this.scheduler.setTimeout('authority-tab-visible', () => {
      void this.runTabVisibleResume()
    }, this.timings.softResumeDebounceMs)
  }

  private async runTabVisibleResume() {
    if (this.resumeOperationInFlight) {
      return
    }

    const machine = this.snapshot.machine

    if (machine !== 'PLAYING' && machine !== 'BUFFERING') {
      return
    }

    const d = this.delegates()

    if (!d) {
      return
    }

    this.resumeOperationInFlight = true

    try {
      const videoOk = await d.video.attemptSoftResume()
      const audioOk = await d.audio.attemptSoftResume()

      if (videoOk && audioOk) {
        this.resetHardInterruptionState()
        this.commitPresentation('PLAYING')
        return
      }

      if (this.profile !== 'uninterrupted') {
        this.enterGestureRequired(false)
      }
    } finally {
      this.resumeOperationInFlight = false
    }
  }

  private async runMajorVideoRecovery(reason: 'stalled' | 'error') {
    if (this.majorVideoRecoveryInFlight) {
      return
    }

    const d = this.delegates()

    if (!d) {
      return
    }

    const now = Date.now()

    if (now - this.lastMajorRecoveryAt < this.timings.majorRecoveryCooldownMs) {
      return
    }

    this.lastMajorRecoveryAt = now
    this.majorVideoRecoveryInFlight = true

    soakFreezeStart()
    this.commitPresentation('PASSIVE_RECOVERY')

    try {
      const ok = await d.video.attemptMajorRecovery(reason)

      if (ok) {
        this.resetHardInterruptionState()
        this.commitPresentation('PLAYING')
      } else {
        this.enterGestureRequired(false)
      }
    } finally {
      soakFreezeEnd()
      this.majorVideoRecoveryInFlight = false
    }
  }

  private async runMajorAudioRecovery(reason: 'error' | 'health-check') {
    if (this.playbackKind === 'combined') {
      return
    }

    if (this.majorAudioRecoveryInFlight) {
      return
    }

    const d = this.delegates()

    if (!d) {
      return
    }

    const now = Date.now()

    if (now - this.lastMajorRecoveryAt < this.timings.majorRecoveryCooldownMs) {
      return
    }

    this.lastMajorRecoveryAt = now
    this.majorAudioRecoveryInFlight = true

    try {
      const ok = await d.audio.attemptMajorRecovery(reason)

      if (!ok && this.profile !== 'uninterrupted') {
        this.enterGestureRequired(false)
      }
    } finally {
      this.majorAudioRecoveryInFlight = false
    }
  }

  private async handleAudioPausedExpected(reason: 'health-check' | 'unknown') {
    if (this.playbackKind === 'combined') {
      return
    }

    const d = this.delegates()

    if (!d) {
      return
    }

    const soft = await d.audio.attemptSoftResume()

    if (soft) {
      return
    }

    await this.runMajorAudioRecovery(reason === 'health-check' ? 'health-check' : 'error')
  }
}
