import type { RefObject } from 'react'

interface VideoLayerProps {
  videoRef: RefObject<HTMLVideoElement | null>
  errorMessage: string | null
  onError: (message: string | null) => void
}

export function VideoLayer({ videoRef, errorMessage, onError }: VideoLayerProps) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[2rem] bg-black">
      <video
        className="h-full w-full object-cover"
        loop
        muted
        onCanPlay={() => onError(null)}
        onError={() => onError('Video source unavailable. Update the media contract path to a valid file or stream URL.')}
        playsInline
        ref={videoRef}
      />

      {errorMessage ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center">
          <div className="max-w-md rounded-3xl border border-amber-300/20 bg-slate-950/90 px-5 py-4 text-sm leading-6 text-amber-100">
            {errorMessage}
          </div>
        </div>
      ) : null}
    </div>
  )
}
