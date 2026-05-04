import { memo, useMemo, type PointerEvent as ReactPointerEvent } from 'react'

interface VideoSurfaceProps {
  brightnessPercent: number
  fitMode: 'contain' | 'cover'
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  videoRef: (node: HTMLVideoElement | null) => void
  shouldBlurForTrialBlock: boolean
}

export const VideoSurface = memo(function VideoSurface({
  brightnessPercent,
  fitMode,
  onPointerUp,
  videoRef,
  shouldBlurForTrialBlock,
}: VideoSurfaceProps) {
  const videoStyle = useMemo(
    () => ({ filter: `brightness(${brightnessPercent / 100})` }),
    [brightnessPercent],
  )
  const objectFitClass = fitMode === 'contain' ? 'object-contain' : 'object-cover'

  return (
    <div
      className={[
        'absolute inset-0 flex items-center justify-center overflow-hidden bg-black transition-[filter,transform] duration-300',
        shouldBlurForTrialBlock ? 'scale-[1.02] blur-[6px]' : '',
      ].join(' ')}
      onPointerUp={onPointerUp}
    >
      <video
        className={[
          'absolute inset-0 h-full w-full bg-black',
          objectFitClass,
        ].join(' ')}
        loop
        muted
        ref={videoRef}
        style={videoStyle}
      />
    </div>
  )
})
