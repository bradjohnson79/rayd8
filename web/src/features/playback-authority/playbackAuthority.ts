import { PlaybackScheduler } from '../rayd8-player/playbackScheduler'
import {
  getPlaybackPolicyTimings,
  resolvePlaybackPolicyProfile,
  type PlaybackPolicyProfile,
} from './playbackPolicy'
import {
  type PlaybackSignal,
} from './playbackSignals'
import {
  createInitialPresentationSnapshot,
  machineToLegacyPlaybackState,
  type PlaybackMachineState,
  type PlaybackPresentationSnapshot,
} from './playbackPresentation'
import {
  recordAuthorityDecision,
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
      this.commitPresentation('PRELOADING')
      return
    }

    if (signal.type === 'lifecycle_ready') {
      this.commitPresentation('READY')
      return
    }

    if (signal.type === 'lifecycle_play_attempt_finished') {
      if (signal.ok) {
        this.commitPresentation('PLAYING')
      } else {
        void this.runSilentResumeRecovery()
      }
      return
    }

    if (signal.type === 'lifecycle_fatal') {
      this.commitPresentation('FATAL_ERROR')
      return
    }

    if (signal.type === 'lifecycle_idle') {
      this.commitPresentation('IDLE')
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
        void this.runSilentResumeRecovery()
        return

      case 'video_ended_loop':
        void this.videoDelegate?.attemptSoftResume()
        return

      case 'audio_autoplay_blocked':
        void this.runSilentResumeRecovery()
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

  private notify() {
    this.listeners.forEach((listener) => listener())
  }

  private commitPresentation(machine: PlaybackMachineState) {
    this.snapshot = {
      interactionOverlayVisible: false,
      legacyPlaybackState: machineToLegacyPlaybackState(machine),
      machine,
    }

    soakMarkPlayingState(machine === 'PLAYING' || machine === 'BUFFERING')
    this.notify()
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
        this.commitPresentation('PLAYING')
        return
      }

      this.commitPresentation('PASSIVE_RECOVERY')
    } finally {
      this.resumeOperationInFlight = false
    }
  }

  private async runSilentResumeRecovery() {
    if (this.resumeOperationInFlight) {
      return
    }

    const d = this.delegates()

    if (!d) {
      this.commitPresentation('READY')
      return
    }

    this.resumeOperationInFlight = true
    this.commitPresentation('PASSIVE_RECOVERY')

    try {
      const videoOk = await d.video.attemptSoftResume()
      const audioOk = await d.audio.attemptSoftResume()

      if (videoOk && audioOk) {
        this.commitPresentation('PLAYING')
        return
      }

      this.commitPresentation('READY')
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
        this.commitPresentation('PLAYING')
      } else {
        this.commitPresentation('READY')
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

      if (!ok) {
        this.commitPresentation('READY')
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
