import { memo, useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import { ImmersiveViewport } from './ImmersiveViewport'

interface VideoSurfaceProps {
  brightnessPercent: number
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  performanceMode: boolean
  videoRef: (node: HTMLVideoElement | null) => void
  shouldBlurForTrialBlock: boolean
}

export const VideoSurface = memo(function VideoSurface({
  brightnessPercent,
  onPointerUp,
  performanceMode,
  videoRef,
  shouldBlurForTrialBlock,
}: VideoSurfaceProps) {
  const videoStyle = useMemo(
    () => (performanceMode ? undefined : { filter: `brightness(${brightnessPercent / 100})` }),
    [brightnessPercent, performanceMode],
  )
  const wrapperMotionClass = performanceMode
    ? ''
    : 'transition-[filter,transform] duration-300 ease-out'

  return (
    <ImmersiveViewport
      shellClassName={[
        wrapperMotionClass,
        shouldBlurForTrialBlock && !performanceMode ? 'scale-[1.02] blur-[6px]' : '',
      ].join(' ')}
      onPointerUp={onPointerUp}
      surface="fill"
    >
      <video
        className="absolute inset-0 h-full w-full bg-black object-contain"
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
    </ImmersiveViewport>
  )
})
