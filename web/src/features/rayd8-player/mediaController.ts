import type { MutableRefObject } from 'react'
import { loadHls, type HlsController } from '../../lib/loadHls'

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
    throw new Error('This browser cannot play the current RAYD8® session stream.')
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

export async function tryPlay(media: HTMLMediaElement | null) {
  if (!media) {
    return false
  }

  try {
    await media.play()
    return true
  } catch {
    return false
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
