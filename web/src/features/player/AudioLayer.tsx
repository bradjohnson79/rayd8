import type { RefObject } from 'react'

interface AudioLayerProps {
  audioRef: RefObject<HTMLAudioElement | null>
  onError: (message: string | null) => void
}

export function AudioLayer({ audioRef, onError }: AudioLayerProps) {
  return (
    <audio
      loop
      onCanPlay={() => onError(null)}
      onError={() => onError('Audio source unavailable. Supply a valid loopable audio track for this plan.')}
      preload="auto"
      ref={audioRef}
    />
  )
}
