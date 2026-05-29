import { memo, useMemo, type PointerEvent as ReactPointerEvent } from 'react'

interface VideoSurfaceProps {
  brightnessPercent: number
  enforceWidescreen: boolean
  fitMode: 'contain' | 'cover'
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  performanceMode: boolean
  videoRef: (node: HTMLVideoElement | null) => void
  shouldBlurForTrialBlock: boolean
}

export const VideoSurface = memo(function VideoSurface({
  brightnessPercent,
  enforceWidescreen,
  fitMode,
  onPointerUp,
  performanceMode,
  videoRef,
  shouldBlurForTrialBlock,
}: VideoSurfaceProps) {
  const videoStyle = useMemo(
    () => (performanceMode ? undefined : { filter: `brightness(${brightnessPercent / 100})` }),
    [brightnessPercent, performanceMode],
  )
  const objectFitClass = fitMode === 'contain' ? 'object-contain' : 'object-cover'
  const viewportClass = enforceWidescreen
    ? 'relative aspect-video w-[min(100vw,calc(100dvh*16/9))] max-h-full max-w-full'
    : 'absolute inset-0 h-full w-full'
  const wrapperMotionClass = performanceMode
    ? ''
    : 'transition-[filter,transform] duration-300 ease-out'

  return (
    <div
      className={[
        'absolute inset-0 flex items-center justify-center overflow-hidden bg-black',
        wrapperMotionClass,
        shouldBlurForTrialBlock && !performanceMode ? 'scale-[1.02] blur-[6px]' : '',
      ].join(' ')}
      onPointerUp={onPointerUp}
    >
      <div className={viewportClass}>
        <video
          className={[
            'absolute inset-0 h-full w-full bg-black',
            objectFitClass,
          ].join(' ')}
          loop
          muted
          preload="metadata"
          ref={videoRef}
          style={videoStyle}
        />
        {performanceMode && brightnessPercent < 100 ? (
          <div
            className="pointer-events-none absolute inset-0 bg-black"
            style={{ opacity: 1 - brightnessPercent / 100 }}
          />
        ) : null}
      </div>
    </div>
  )
})
