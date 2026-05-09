import type { SessionPlaybackStatus } from '../rayd8-player/sessionWarning'

export type PlaybackMachineState =
  | 'IDLE'
  | 'PRELOADING'
  | 'READY'
  | 'PLAYING'
  | 'BUFFERING'
  | 'PASSIVE_RECOVERY'
  | 'WAITING_FOR_GESTURE'
  | 'INTERRUPTED'
  | 'FATAL_ERROR'
  | 'ENDED'

export interface PlaybackPresentationSnapshot {
  interactionOverlayVisible: boolean
  legacyPlaybackState: SessionPlaybackStatus
  machine: PlaybackMachineState
}

export function machineToLegacyPlaybackState(machine: PlaybackMachineState): SessionPlaybackStatus {
  switch (machine) {
    case 'PRELOADING':
      return 'preloading'
    case 'READY':
    case 'IDLE':
      return 'ready'
    case 'PLAYING':
    case 'BUFFERING':
      return 'playing'
    case 'PASSIVE_RECOVERY':
      return 'recovering'
    case 'WAITING_FOR_GESTURE':
    case 'INTERRUPTED':
      return 'interaction-required'
    case 'FATAL_ERROR':
      return 'ready'
    case 'ENDED':
      return 'ready'
    default:
      return 'ready'
  }
}

export function shouldShowInteractionOverlay(machine: PlaybackMachineState): boolean {
  return machine === 'WAITING_FOR_GESTURE' || machine === 'INTERRUPTED'
}

export function createInitialPresentationSnapshot(): PlaybackPresentationSnapshot {
  return {
    interactionOverlayVisible: false,
    legacyPlaybackState: 'preloading',
    machine: 'PRELOADING',
  }
}
