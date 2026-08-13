export type StartupStage =
  | 'AUTH_READINESS'
  | 'ACCESS_CHECK'
  | 'ENTITLEMENT_CHECK'
  | 'SESSION_CREATE'
  | 'SESSION_ATTACH'
  | 'PLAYBACK_ASSET_RESOLUTION'
  | 'PLAYBACK_TOKEN'
  | 'MEDIA_CONTROLLER_CREATE'
  | 'MEDIA_SOURCE_APPLY'
  | 'MEDIA_METADATA'
  | 'AUTOPLAY_PENDING'
  | 'MEDIA_READY'
  | 'PLAYBACK_HEALTH'
  | 'SESSION_END'
  | 'UNKNOWN'

export type StartupFailureCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'ACCESS_DENIED'
  | 'ENTITLEMENT_DENIED'
  | 'SESSION_START_FAILED'
  | 'SESSION_CONFLICT'
  | 'PLAYBACK_ASSET_MISSING'
  | 'PLAYBACK_TOKEN_FAILED'
  | 'MEDIA_SOURCE_FAILED'
  | 'MEDIA_START_TIMEOUT'
  | 'AUTOPLAY_BLOCKED'
  | 'PLAYBACK_STALLED'
  | 'NETWORK_OFFLINE'
  | 'REQUEST_TIMEOUT'
  | 'REQUEST_ABORTED'
  | 'BROWSER_BLOCKED'
  | 'SESSION_END_FAILED'
  | 'UNKNOWN_FAILURE'

export type StartupRecoverability =
  | 'automatic'
  | 'retry'
  | 'reauth'
  | 'return_home'
  | 'fatal'

export type StartupFailureSource =
  | 'frontend'
  | 'api'
  | 'mux'
  | 'media'
  | 'browser'
  | 'database'

export type RecoveryOverlayKind =
  | 'soft_denial'
  | 'init_failure'
  | 'media_start_failure'
  | 'browser_blocked'
  | 'offline'
  | 'auth_expired'
  | 'none'

export type PlayerStartupFailure = {
  stage: StartupStage
  code: StartupFailureCode
  recoverability: StartupRecoverability
  correlationId: string
  occurredAt: string
  technicalMessage?: string
  httpStatus?: number
  source?: StartupFailureSource
}

export type RecoveryOverlayCopy = {
  kind: RecoveryOverlayKind
  title: string
  body: string
  actions: Array<'try_again' | 'restart_playback' | 'reload_session' | 'return_home' | 'sign_in'>
  referenceCode: string
}

export function createStartupCorrelationId(seed?: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `r8-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return seed ? `${seed}:${random}` : random
}

/** Short support reference — never embeds user/session/token IDs. */
export function toSupportReferenceCode(correlationId: string) {
  let hash = 0
  for (let i = 0; i < correlationId.length; i += 1) {
    hash = (hash * 31 + correlationId.charCodeAt(i)) >>> 0
  }
  return `R8-${(hash % 0xffff).toString(16).toUpperCase().padStart(4, '0')}`
}

export function mapApiErrorToStartupFailure(input: {
  correlationId: string
  message?: string
  status?: number
  code?: string | null
  offline?: boolean
}): PlayerStartupFailure {
  const occurredAt = new Date().toISOString()
  const httpStatus = input.status
  const apiCode = (input.code || '').toLowerCase()

  // Transport-level timeout/abort carry status 0, so they must be classified
  // before the generic offline branch.
  if (apiCode === 'request_timeout' || httpStatus === 429) {
    return {
      stage: 'PLAYBACK_TOKEN',
      code: 'REQUEST_TIMEOUT',
      recoverability: 'retry',
      correlationId: input.correlationId,
      occurredAt,
      technicalMessage: input.message,
      httpStatus,
      source: httpStatus === 429 ? 'api' : 'browser',
    }
  }

  if (apiCode === 'request_aborted') {
    return {
      stage: 'PLAYBACK_TOKEN',
      code: 'REQUEST_ABORTED',
      recoverability: 'retry',
      correlationId: input.correlationId,
      occurredAt,
      technicalMessage: input.message,
      httpStatus,
      source: 'browser',
    }
  }

  if (input.offline || httpStatus === 0 || apiCode === 'network_error' || apiCode === 'edge_html_response') {
    return {
      stage: 'UNKNOWN',
      code: 'NETWORK_OFFLINE',
      recoverability: 'retry',
      correlationId: input.correlationId,
      occurredAt,
      technicalMessage: input.message,
      httpStatus,
      source: 'browser',
    }
  }

  if (httpStatus === 401 || apiCode.includes('auth') || apiCode.includes('unauthor')) {
    return {
      stage: 'AUTH_READINESS',
      code: httpStatus === 401 ? 'AUTH_EXPIRED' : 'AUTH_REQUIRED',
      recoverability: 'reauth',
      correlationId: input.correlationId,
      occurredAt,
      technicalMessage: input.message,
      httpStatus,
      source: 'api',
    }
  }

  if (httpStatus === 403 || apiCode.includes('entitlement') || apiCode.includes('plan') || apiCode.includes('limit')) {
    return {
      stage: 'ENTITLEMENT_CHECK',
      code: 'ENTITLEMENT_DENIED',
      recoverability: 'return_home',
      correlationId: input.correlationId,
      occurredAt,
      technicalMessage: input.message,
      httpStatus,
      source: 'api',
    }
  }

  if (apiCode.includes('asset') || httpStatus === 404) {
    return {
      stage: 'PLAYBACK_ASSET_RESOLUTION',
      code: 'PLAYBACK_ASSET_MISSING',
      recoverability: 'retry',
      correlationId: input.correlationId,
      occurredAt,
      technicalMessage: input.message,
      httpStatus,
      source: 'api',
    }
  }

  return {
    stage: 'PLAYBACK_TOKEN',
    code: 'PLAYBACK_TOKEN_FAILED',
    recoverability: 'retry',
    correlationId: input.correlationId,
    occurredAt,
    technicalMessage: input.message,
    httpStatus,
    source: 'api',
  }
}

export function mapMediaReasonToStartupFailure(input: {
  correlationId: string
  reason: string
  sourceApplied?: boolean
}): PlayerStartupFailure {
  const occurredAt = new Date().toISOString()
  const reason = input.reason

  if (reason === 'NotAllowedError' || reason === 'play_failed_autoplay' || reason === 'AUTOPLAY_BLOCKED') {
    return {
      stage: 'AUTOPLAY_PENDING',
      code: 'AUTOPLAY_BLOCKED',
      recoverability: 'automatic',
      correlationId: input.correlationId,
      occurredAt,
      technicalMessage: reason,
      source: 'browser',
    }
  }

  if (reason === 'BROWSER_BLOCKED') {
    return {
      stage: 'PLAYBACK_HEALTH',
      code: 'BROWSER_BLOCKED',
      recoverability: 'retry',
      correlationId: input.correlationId,
      occurredAt,
      technicalMessage: reason,
      source: 'browser',
    }
  }

  if (reason === 'media_source_not_applied' || reason === 'MEDIA_SOURCE_FAILED') {
    return {
      stage: 'MEDIA_SOURCE_APPLY',
      code: 'MEDIA_SOURCE_FAILED',
      recoverability: 'retry',
      correlationId: input.correlationId,
      occurredAt,
      technicalMessage: reason,
      source: 'media',
    }
  }

  if (reason === 'video_ref_missing' || reason === 'PLAYBACK_ASSET_MISSING') {
    return {
      stage: 'MEDIA_CONTROLLER_CREATE',
      code: 'PLAYBACK_ASSET_MISSING',
      recoverability: 'retry',
      correlationId: input.correlationId,
      occurredAt,
      technicalMessage: reason,
      source: 'frontend',
    }
  }

  if (input.sourceApplied || reason === 'playback_not_ready' || reason === 'startup_health_timeout' || reason === 'play_failed') {
    return {
      stage: 'PLAYBACK_HEALTH',
      code: reason === 'play_failed' ? 'MEDIA_START_TIMEOUT' : 'MEDIA_START_TIMEOUT',
      recoverability: 'retry',
      correlationId: input.correlationId,
      occurredAt,
      technicalMessage: reason,
      source: 'media',
    }
  }

  return {
    stage: 'UNKNOWN',
    code: 'UNKNOWN_FAILURE',
    recoverability: 'retry',
    correlationId: input.correlationId,
    occurredAt,
    technicalMessage: reason,
    source: 'frontend',
  }
}

export function selectRecoveryOverlay(input: {
  softDenialActive: boolean
  failure: PlayerStartupFailure | null
  initFailureVisible: boolean
  playbackHealthFailed: boolean
  offline?: boolean
}): RecoveryOverlayKind {
  if (input.softDenialActive) {
    return 'soft_denial'
  }

  if (input.offline || input.failure?.code === 'NETWORK_OFFLINE') {
    return 'offline'
  }

  if (input.failure?.code === 'AUTH_EXPIRED' || input.failure?.code === 'AUTH_REQUIRED') {
    return 'auth_expired'
  }

  if (input.failure?.code === 'ENTITLEMENT_DENIED' || input.failure?.code === 'ACCESS_DENIED') {
    return 'soft_denial'
  }

  if (input.failure?.code === 'BROWSER_BLOCKED') {
    return 'browser_blocked'
  }

  if (input.playbackHealthFailed) {
    return 'media_start_failure'
  }

  if (input.initFailureVisible || input.failure) {
    const stage = input.failure?.stage
    if (
      stage === 'PLAYBACK_HEALTH' ||
      stage === 'MEDIA_READY' ||
      stage === 'MEDIA_METADATA' ||
      stage === 'AUTOPLAY_PENDING'
    ) {
      return 'media_start_failure'
    }
    return 'init_failure'
  }

  return 'none'
}

export function getRecoveryOverlayCopy(input: {
  kind: RecoveryOverlayKind
  correlationId: string
}): RecoveryOverlayCopy | null {
  const referenceCode = toSupportReferenceCode(input.correlationId)

  switch (input.kind) {
    case 'init_failure':
      return {
        kind: 'init_failure',
        title: 'Unable to Prepare Your Session',
        body: 'RAYD8 could not finish preparing this session. Your session has not started.',
        actions: ['try_again', 'return_home'],
        referenceCode,
      }
    case 'media_start_failure':
      return {
        kind: 'media_start_failure',
        title: 'Your Session Is Ready, but Playback Did Not Start',
        body: 'The session was prepared, but the media stream did not become ready.',
        actions: ['restart_playback', 'reload_session', 'return_home'],
        referenceCode,
      }
    case 'browser_blocked':
      return {
        kind: 'browser_blocked',
        title: 'Your Browser Blocked the Video Stream',
        body: 'Audio is playing, but your browser blocked the video. On Brave, lower Shields for this site; otherwise disable strict extensions or allow media permissions, then restart playback.',
        actions: ['restart_playback', 'reload_session', 'return_home'],
        referenceCode,
      }
    case 'offline':
      return {
        kind: 'offline',
        title: 'Connection Interrupted',
        body: 'RAYD8 cannot reach the session service right now. Check your connection and try again.',
        actions: ['try_again', 'return_home'],
        referenceCode,
      }
    case 'auth_expired':
      return {
        kind: 'auth_expired',
        title: 'Please Sign In Again',
        body: 'Your secure session expired before RAYD8 could begin.',
        actions: ['sign_in', 'return_home'],
        referenceCode,
      }
    default:
      return null
  }
}

export function isInitStageFailure(failure: PlayerStartupFailure | null) {
  if (!failure) return false
  return (
    failure.stage === 'AUTH_READINESS' ||
    failure.stage === 'ACCESS_CHECK' ||
    failure.stage === 'ENTITLEMENT_CHECK' ||
    failure.stage === 'SESSION_CREATE' ||
    failure.stage === 'SESSION_ATTACH' ||
    failure.stage === 'PLAYBACK_ASSET_RESOLUTION' ||
    failure.stage === 'PLAYBACK_TOKEN' ||
    failure.stage === 'MEDIA_CONTROLLER_CREATE' ||
    failure.stage === 'MEDIA_SOURCE_APPLY'
  )
}
