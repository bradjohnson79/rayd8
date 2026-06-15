import type { MutableRefObject } from 'react'
import { loadHls, type HlsController } from '../../lib/loadHls'
import { logExpressPlaybackDebug } from './expressPlaybackDebug'
import {
  waitForAudioPlaybackReady,
  waitForVisiblePlaybackSurface,
} from './playbackSurfaceReady'

export type { HlsController }

export interface MediaStabilityProfile {
  backBufferLength: number
  capLevelToPlayerSize?: boolean
  enableWorker?: boolean
  lowLatencyMode?: boolean
  maxBufferLength: number
  maxMaxBufferLength: number
  startLevel?: number
}

export interface MediaDiagnostics {
  recordController?: (action: 'create' | 'destroy') => void
  recordSourceLoad?: (sourceUrl: string) => void
}

export type PlayFailureReason =
  | 'MediaElementMissing'
  | 'DocumentNotVisible'
  | 'MediaNotConnected'
  | 'MediaSourceMissing'
  | 'PlaybackSurfaceNotReady'
  | 'NotAllowedError'
  | 'UnknownError'

export type TryPlayResult =
  | { ok: true }
  | { message?: string; ok: false; reason: PlayFailureReason }

function isLikelyFireTvBrowser() {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /\bAFT\w+\b|Silk\//i.test(navigator.userAgent)
}

function getUnsupportedStreamMessage() {
  if (isLikelyFireTvBrowser()) {
    return 'This Fire TV browser cannot play the secure RAYD8 stream. Please use RAYD8 on Safari, Chrome, Edge, or a supported mobile/tablet browser, then cast or mirror from that device when available.'
  }

  return 'This browser cannot play the current RAYD8® session stream. Please use Safari, Chrome, Edge, or another browser with HLS or MediaSource playback support.'
}

export async function setMediaSource(input: {
  controllerProfileRef?: MutableRefObject<string | null>
  controllerRef: MutableRefObject<HlsController | null>
  diagnostics?: MediaDiagnostics
  generationRef: MutableRefObject<number>
  media: HTMLMediaElement | null
  options?: { pauseBeforeLoad?: boolean }
  profileKey?: string
  requestGeneration: number
  sourceUrl: string
  stabilityProfile: MediaStabilityProfile
}): Promise<boolean> {
  const {
    controllerProfileRef,
    controllerRef,
    diagnostics,
    generationRef,
    media,
    options,
    profileKey = 'default',
    requestGeneration,
    sourceUrl,
    stabilityProfile,
  } = input

  if (!media || generationRef.current !== requestGeneration) {
    return false
  }

  const currentSource = media.currentSrc || media.getAttribute('src')

  if (currentSource === sourceUrl && (!controllerRef.current || controllerProfileRef?.current === profileKey)) {
    return true
  }

  if (options?.pauseBeforeLoad ?? true) {
    media.pause()
  }

  diagnostics?.recordSourceLoad?.(sourceUrl)

  if (media.canPlayType('application/vnd.apple.mpegurl')) {
    if (generationRef.current !== requestGeneration) {
      return false
    }

    media.src = sourceUrl
    media.load()
    return true
  }

  const Hls = await loadHls()

  if (generationRef.current !== requestGeneration) {
    return false
  }

  if (!Hls.isSupported()) {
    throw new Error(getUnsupportedStreamMessage())
  }

  if (controllerRef.current && controllerProfileRef?.current !== profileKey) {
    diagnostics?.recordController?.('destroy')
    controllerRef.current.destroy()
    controllerRef.current = null
    if (controllerProfileRef) {
      controllerProfileRef.current = null
    }
  }

  if (!controllerRef.current) {
    diagnostics?.recordController?.('create')
    controllerRef.current = new Hls({
      backBufferLength: stabilityProfile.backBufferLength,
      capLevelToPlayerSize: stabilityProfile.capLevelToPlayerSize ?? true,
      enableWorker: stabilityProfile.enableWorker ?? true,
      lowLatencyMode: stabilityProfile.lowLatencyMode ?? false,
      maxBufferLength: stabilityProfile.maxBufferLength,
      maxMaxBufferLength: stabilityProfile.maxMaxBufferLength,
      startLevel: stabilityProfile.startLevel ?? -1,
    })
    if (controllerProfileRef) {
      controllerProfileRef.current = profileKey
    }
    controllerRef.current.attachMedia(media)
  }

  if (generationRef.current !== requestGeneration) {
    return false
  }

  controllerRef.current.loadSource(sourceUrl)
  return true
}

function getPlayFailureReason(error: unknown): PlayFailureReason {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'NotAllowedError'
  }

  if (error instanceof Error && error.name === 'NotAllowedError') {
    return 'NotAllowedError'
  }

  return 'UnknownError'
}

export async function tryPlayVideo(media: HTMLMediaElement | null): Promise<TryPlayResult> {
  if (!media) {
    logExpressPlaybackDebug('play_failed', {
      message: 'No media element available.',
      name: 'MediaElementMissing',
      readyState: 0,
      videoWidth: 0,
    })
    return { ok: false, reason: 'MediaElementMissing' }
  }

  const surfaceReady = await waitForVisiblePlaybackSurface(media)

  if (!surfaceReady) {
    logExpressPlaybackDebug('play_failed', {
      currentTime: media.currentTime,
      message: 'Playback surface was not visible or laid out before play().',
      name: 'PlaybackSurfaceNotReady',
      readyState: media.readyState,
      videoWidth: media instanceof HTMLVideoElement ? media.videoWidth : 0,
    })
    return { ok: false, reason: 'PlaybackSurfaceNotReady' }
  }

  logExpressPlaybackDebug('play_called', {
    currentTime: media.currentTime,
    readyState: media.readyState,
    videoWidth: media instanceof HTMLVideoElement ? media.videoWidth : 0,
  })

  try {
    await media.play()
    logExpressPlaybackDebug('play_success', {
      currentTime: media.currentTime,
      readyState: media.readyState,
      videoWidth: media instanceof HTMLVideoElement ? media.videoWidth : 0,
    })
    return { ok: true }
  } catch (error) {
    const reason = getPlayFailureReason(error)
    logExpressPlaybackDebug('play_failed', {
      currentTime: media.currentTime,
      message: error instanceof Error ? error.message : String(error),
      name: reason,
      readyState: media.readyState,
      videoWidth: media instanceof HTMLVideoElement ? media.videoWidth : 0,
    })
    return {
      message: error instanceof Error ? error.message : String(error),
      ok: false,
      reason,
    }
  }
}

export async function tryPlayAudio(media: HTMLMediaElement | null): Promise<TryPlayResult> {
  if (!media) {
    logExpressPlaybackDebug('audio_play_failed', {
      currentSrc: '',
      message: 'No audio element available.',
      reason: 'MediaElementMissing',
      readyState: 0,
    })
    return { ok: false, reason: 'MediaElementMissing' }
  }

  const ready = await waitForAudioPlaybackReady(media)

  if (!ready.ok) {
    return ready
  }

  logExpressPlaybackDebug('audio_play_called', {
    currentSrc: media.currentSrc,
    reason: 'play_called',
    readyState: media.readyState,
  })

  try {
    await media.play()
    logExpressPlaybackDebug('audio_play_success', {
      currentSrc: media.currentSrc,
      reason: 'play_succeeded',
      readyState: media.readyState,
    })
    return { ok: true }
  } catch (error) {
    const reason = getPlayFailureReason(error)

    logExpressPlaybackDebug('audio_play_failed', {
      currentSrc: media.currentSrc,
      message: error instanceof Error ? error.message : String(error),
      reason,
      readyState: media.readyState,
    })
    return {
      message: error instanceof Error ? error.message : String(error),
      ok: false,
      reason,
    }
  }
}

export function resetMedia(media: HTMLMediaElement | null) {
  if (!media) {
    return
  }

  media.pause()
  media.removeAttribute('src')
  media.load()
}

export function destroyHlsController(
  controllerRef: MutableRefObject<HlsController | null>,
  diagnostics?: MediaDiagnostics,
) {
  if (!controllerRef.current) {
    return
  }

  try {
    diagnostics?.recordController?.('destroy')
    controllerRef.current.destroy()
  } catch {
    // Best-effort: HLS.js may already be torn down on this element.
  } finally {
    controllerRef.current = null
  }
}
