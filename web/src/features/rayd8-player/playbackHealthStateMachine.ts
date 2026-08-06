export type PlaybackHealthMachineState =
  | 'IDLE'
  | 'WAITING_FOR_AUTH'
  | 'WAITING_FOR_ACCESS'
  | 'WAITING_FOR_SESSION'
  | 'WAITING_FOR_TOKEN'
  | 'WAITING_FOR_CONTROLLER'
  | 'WAITING_FOR_SOURCE'
  | 'WAITING_FOR_METADATA'
  | 'WAITING_FOR_AUTOPLAY'
  | 'WAITING_FOR_MEDIA_PROGRESS'
  | 'HEALTHY'
  | 'PAUSED_HIDDEN'
  | 'PAUSED_OFFLINE'
  | 'RECOVERING'
  | 'FAILED'
  | 'ENDED'

export type PlaybackPipelineMode = 'video' | 'audio' | 'dual' | 'combined'

export type MediaHealthSnapshot = {
  video: HTMLVideoElement | null
  audio: HTMLAudioElement | null
  mode: PlaybackPipelineMode
  audioRequired: boolean
  sourceApplied: boolean
  autoplayPending: boolean
  intentionallyPaused: boolean
  documentHidden: boolean
  offline: boolean
  ending: boolean
  replacingSource: boolean
  tokenRefreshing: boolean
  metadataReady: boolean
  mediaOwned: boolean
}

export type PlaybackHealthMachineEvent =
  | { type: 'RESET' }
  | { type: 'PIPELINE_PROGRESS'; state: PlaybackHealthMachineState }
  | { type: 'MEDIA_OWNED' }
  | { type: 'MARK_HEALTHY' }
  | { type: 'SOFT_RECOVER' }
  | { type: 'HARD_FAIL'; reason: string }
  | { type: 'AUTOPLAY_BLOCKED' }
  | { type: 'HIDDEN' }
  | { type: 'VISIBLE' }
  | { type: 'OFFLINE' }
  | { type: 'ONLINE' }
  | { type: 'END' }
  | { type: 'TICK_EVALUATE'; snapshot: MediaHealthSnapshot }

export type PlaybackHealthMachineContext = {
  state: PlaybackHealthMachineState
  hardTimerArmed: boolean
  softTimerArmed: boolean
  failReason: string | null
  pauseReason: 'hidden' | 'offline' | 'autoplay' | 'intentional' | 'replacing' | 'token_refresh' | null
  priorProgressState: PlaybackHealthMachineState | null
}

export const SOFT_RECOVERY_DELAY_MS = 5_000
export const HARD_FALLBACK_DELAY_MS = 9_000
export const HEALTH_POLL_MS = 500

const MEDIA_OWNED_STATES = new Set<PlaybackHealthMachineState>([
  'WAITING_FOR_METADATA',
  'WAITING_FOR_AUTOPLAY',
  'WAITING_FOR_MEDIA_PROGRESS',
  'HEALTHY',
  'PAUSED_HIDDEN',
  'PAUSED_OFFLINE',
  'RECOVERING',
])

export function createPlaybackHealthContext(): PlaybackHealthMachineContext {
  return {
    state: 'IDLE',
    hardTimerArmed: false,
    softTimerArmed: false,
    failReason: null,
    pauseReason: null,
    priorProgressState: null,
  }
}

/** HAVE_CURRENT_DATA — numeric so Node unit tests do not require DOM globals. */
const HAVE_CURRENT_DATA = 2

export function isMediaElementHealthy(media: HTMLMediaElement | null) {
  return Boolean(
    media && !media.paused && media.readyState >= HAVE_CURRENT_DATA && media.currentTime > 0.5,
  )
}

export function isVideoPlaybackHealthy(video: HTMLVideoElement | null) {
  return Boolean(isMediaElementHealthy(video) && video && video.videoWidth > 0)
}

export function isAudioPlaybackHealthy(audio: HTMLAudioElement | null) {
  return isMediaElementHealthy(audio)
}

export function evaluatePipelineHealthy(snapshot: MediaHealthSnapshot) {
  if (!snapshot.mediaOwned || !snapshot.sourceApplied) {
    return false
  }

  if (snapshot.mode === 'audio') {
    return isAudioPlaybackHealthy(snapshot.audio)
  }

  if (snapshot.mode === 'dual') {
    const videoOk = isVideoPlaybackHealthy(snapshot.video)
    if (!snapshot.audioRequired) {
      return videoOk
    }
    return videoOk && isAudioPlaybackHealthy(snapshot.audio)
  }

  // video-only or combined (AV on video element)
  return isVideoPlaybackHealthy(snapshot.video)
}

export function shouldArmHardTimer(ctx: PlaybackHealthMachineContext, snapshot: MediaHealthSnapshot) {
  if (!snapshot.mediaOwned || !snapshot.sourceApplied) return false
  if (!snapshot.metadataReady && ctx.state === 'WAITING_FOR_METADATA') return false
  if (snapshot.ending || snapshot.replacingSource || snapshot.tokenRefreshing) return false
  if (snapshot.documentHidden || snapshot.offline || snapshot.autoplayPending || snapshot.intentionallyPaused) {
    return false
  }
  if (ctx.state === 'FAILED' || ctx.state === 'ENDED' || ctx.state === 'HEALTHY') return false
  return (
    ctx.state === 'WAITING_FOR_MEDIA_PROGRESS' ||
    ctx.state === 'RECOVERING' ||
    ctx.state === 'WAITING_FOR_METADATA'
  )
}

export function shouldPauseHardTimer(snapshot: MediaHealthSnapshot) {
  return (
    snapshot.documentHidden ||
    snapshot.offline ||
    snapshot.autoplayPending ||
    snapshot.intentionallyPaused ||
    snapshot.ending ||
    snapshot.replacingSource ||
    snapshot.tokenRefreshing ||
    !snapshot.metadataReady
  )
}

export function reducePlaybackHealth(
  ctx: PlaybackHealthMachineContext,
  event: PlaybackHealthMachineEvent,
): PlaybackHealthMachineContext {
  switch (event.type) {
    case 'RESET':
      return createPlaybackHealthContext()
    case 'END':
      return { ...ctx, state: 'ENDED', hardTimerArmed: false, softTimerArmed: false }
    case 'PIPELINE_PROGRESS':
      return {
        ...ctx,
        state: event.state,
        hardTimerArmed: MEDIA_OWNED_STATES.has(event.state) ? ctx.hardTimerArmed : false,
      }
    case 'MEDIA_OWNED':
      return {
        ...ctx,
        state: ctx.state === 'IDLE' || !MEDIA_OWNED_STATES.has(ctx.state) ? 'WAITING_FOR_METADATA' : ctx.state,
      }
    case 'MARK_HEALTHY':
      return {
        ...ctx,
        state: 'HEALTHY',
        hardTimerArmed: false,
        softTimerArmed: false,
        failReason: null,
        pauseReason: null,
      }
    case 'SOFT_RECOVER':
      if (ctx.state === 'FAILED' || ctx.state === 'ENDED' || ctx.state === 'HEALTHY') return ctx
      return { ...ctx, state: 'RECOVERING' }
    case 'HARD_FAIL':
      return {
        ...ctx,
        state: 'FAILED',
        hardTimerArmed: false,
        softTimerArmed: false,
        failReason: event.reason,
      }
    case 'AUTOPLAY_BLOCKED':
      return {
        ...ctx,
        state: 'WAITING_FOR_AUTOPLAY',
        hardTimerArmed: false,
        pauseReason: 'autoplay',
        priorProgressState: ctx.state === 'WAITING_FOR_AUTOPLAY' ? ctx.priorProgressState : ctx.state,
      }
    case 'HIDDEN':
      return {
        ...ctx,
        state: 'PAUSED_HIDDEN',
        hardTimerArmed: false,
        pauseReason: 'hidden',
        priorProgressState:
          ctx.state === 'PAUSED_HIDDEN' || ctx.state === 'PAUSED_OFFLINE' ? ctx.priorProgressState : ctx.state,
      }
    case 'OFFLINE':
      return {
        ...ctx,
        state: 'PAUSED_OFFLINE',
        hardTimerArmed: false,
        pauseReason: 'offline',
        priorProgressState:
          ctx.state === 'PAUSED_HIDDEN' || ctx.state === 'PAUSED_OFFLINE' ? ctx.priorProgressState : ctx.state,
      }
    case 'VISIBLE':
    case 'ONLINE': {
      const resume =
        ctx.priorProgressState && MEDIA_OWNED_STATES.has(ctx.priorProgressState)
          ? ctx.priorProgressState === 'HEALTHY'
            ? 'WAITING_FOR_MEDIA_PROGRESS'
            : ctx.priorProgressState
          : 'WAITING_FOR_MEDIA_PROGRESS'
      return {
        ...ctx,
        state: resume,
        pauseReason: null,
        priorProgressState: null,
      }
    }
    case 'TICK_EVALUATE': {
      const snapshot = event.snapshot
      if (ctx.state === 'ENDED' || ctx.state === 'FAILED') return ctx
      if (!snapshot.mediaOwned) {
        return { ...ctx, hardTimerArmed: false, softTimerArmed: false }
      }
      if (evaluatePipelineHealthy(snapshot)) {
        return {
          ...ctx,
          state: 'HEALTHY',
          hardTimerArmed: false,
          softTimerArmed: false,
          failReason: null,
          pauseReason: null,
        }
      }
      if (snapshot.documentHidden) {
        return reducePlaybackHealth(ctx, { type: 'HIDDEN' })
      }
      if (snapshot.offline) {
        return reducePlaybackHealth(ctx, { type: 'OFFLINE' })
      }
      if (snapshot.autoplayPending) {
        return reducePlaybackHealth(ctx, { type: 'AUTOPLAY_BLOCKED' })
      }
      if (snapshot.metadataReady && ctx.state === 'WAITING_FOR_METADATA') {
        return {
          ...ctx,
          state: 'WAITING_FOR_MEDIA_PROGRESS',
          hardTimerArmed: shouldArmHardTimer(
            { ...ctx, state: 'WAITING_FOR_MEDIA_PROGRESS' },
            snapshot,
          ),
        }
      }
      return {
        ...ctx,
        hardTimerArmed: shouldArmHardTimer(ctx, snapshot),
        softTimerArmed:
          shouldArmHardTimer(ctx, snapshot) &&
          (ctx.state === 'WAITING_FOR_MEDIA_PROGRESS' || ctx.state === 'RECOVERING'),
      }
    }
    default:
      return ctx
  }
}

export function isHardFallbackVisible(ctx: PlaybackHealthMachineContext) {
  return ctx.state === 'FAILED'
}
