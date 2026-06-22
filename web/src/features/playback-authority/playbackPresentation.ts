export type SessionPlaybackStatus =
  | 'preloading'
  | 'ready'
  | 'playing'
  | 'recovering'

export type PlaybackMachineState =
  | 'IDLE'
  | 'PRELOADING'
  | 'READY'
  | 'PLAYING'
  | 'BUFFERING'
  | 'PASSIVE_RECOVERY'
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
    case 'FATAL_ERROR':
      return 'ready'
    case 'ENDED':
      return 'ready'
    default:
      return 'ready'
  }
}

export function createInitialPresentationSnapshot(): PlaybackPresentationSnapshot {
  return {
    interactionOverlayVisible: false,
    legacyPlaybackState: 'preloading',
    machine: 'PRELOADING',
  }
}
