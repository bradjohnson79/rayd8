import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ConversionButton } from './components/ConversionButton'

const HERO_VIDEO_PATH = '/hero/RAYD8_Hero.mp4'
const HERO_STILL = '/hero/RAYD8-Premium.png'

interface HeroSectionProps {
  reducedEffects?: boolean
}

export const HeroSection = memo(function HeroSection({ reducedEffects = false }: HeroSectionProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [isVideoReady, setIsVideoReady] = useState(false)
  const shouldRenderVideo = !reducedEffects && !videoFailed

  const tryPlay = useCallback((video: HTMLVideoElement) => {
    video.muted = true
    void video.play().catch(() => undefined)
  }, [])

  const markPlayable = useCallback(
    (video: HTMLVideoElement) => {
      setIsVideoReady(true)
      tryPlay(video)
    },
    [tryPlay],
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video || !shouldRenderVideo) {
      return
    }

    const syncPlayback = () => {
      if (document.visibilityState !== 'visible') {
        video.pause()
        return
      }
      tryPlay(video)
    }

    video.loop = true
    if (document.visibilityState === 'visible') {
      tryPlay(video)
    }
    document.addEventListener('visibilitychange', syncPlayback)
    return () => document.removeEventListener('visibilitychange', syncPlayback)
  }, [isVideoReady, shouldRenderVideo, tryPlay])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !shouldRenderVideo) {
      return
    }

    video.loop = true

    const onEnded = () => {
      video.currentTime = 0
      tryPlay(video)
    }

    const onPause = () => {
      if (document.visibilityState !== 'visible' || !video) {
        return
      }
      if (video.seeking) {
        return
      }
      const playAttempt = () => {
        if (document.visibilityState !== 'visible' || !video) {
          return
        }
        if (video.paused && !video.ended) {
          tryPlay(video)
        }
      }
      requestAnimationFrame(() => requestAnimationFrame(playAttempt))
    }

    video.addEventListener('ended', onEnded)
    video.addEventListener('pause', onPause)
    return () => {
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('pause', onPause)
    }
  }, [isVideoReady, shouldRenderVideo, tryPlay])

  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden" id="hero">
      {shouldRenderVideo ? (
        <>
          <img
            alt=""
            aria-hidden
            className="absolute inset-0 z-0 h-full w-full min-h-full min-w-full object-cover"
            decoding="async"
            draggable={false}
            fetchPriority="high"
            src={HERO_STILL}
          />
          <video
            ref={videoRef}
            aria-hidden
            autoPlay
            className={[
              'absolute inset-0 z-[1] h-full w-full min-h-full min-w-full object-cover',
              isVideoReady ? 'opacity-100' : 'opacity-0',
              'transition-opacity duration-500',
            ].join(' ')}
            loop
            muted
            onCanPlay={(e) => markPlayable(e.currentTarget)}
            onError={() => setVideoFailed(true)}
            onLoadStart={() => setIsVideoReady(false)}
            onLoadedData={(e) => markPlayable(e.currentTarget)}
            onStalled={() => {
              const v = videoRef.current
              if (v) {
                tryPlay(v)
              }
            }}
            playsInline
            preload="metadata"
          >
            <source src={HERO_VIDEO_PATH} type="video/mp4" />
          </video>
        </>
      ) : (
        <img
          alt=""
          className="absolute inset-0 z-0 h-full w-full object-cover"
          decoding="async"
          draggable={false}
          fetchPriority="high"
          src={HERO_STILL}
        />
      )}

      <div
        className={[
          'absolute inset-0 z-[1] bg-black/55',
          reducedEffects ? '' : 'backdrop-blur-[2px]',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-3 z-[2] rounded-[1.5rem] border border-white/12 shadow-[0_0_50px_rgba(0,0,0,0.35)] sm:inset-5 sm:rounded-[1.75rem] md:inset-8"
      />

      <div className="relative z-[3] mx-auto flex w-full max-w-7xl flex-col px-4 pb-20 pt-24 sm:px-6 sm:pb-24 sm:pt-[30vh] lg:px-8 lg:pt-[34vh]">
        <div className="max-w-3xl">
          <p className="text-[10px] font-medium uppercase leading-relaxed tracking-[0.36em] text-emerald-200/80 sm:text-[11px] sm:tracking-[0.4em]">
            Living visual resonance
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:mt-6 sm:text-5xl md:text-6xl lg:text-7xl">
            Turn Your Space Into a Living Field of Regeneration
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200/90 sm:mt-6 sm:text-lg">
            RAYD8® is the world&apos;s first digital scalar-inspired visual resonance system designed to
            elevate your state physically, mentally, and energetically in minutes.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 sm:mt-10">
            <ConversionButton
              guestMode="signUp"
              label="Start Free Trial"
              to="/subscription?plan=free"
              variant="ghost"
            />
            <ConversionButton
              guestMode="signIn"
              label="Experience REGEN Subscription"
              to="/subscription?plan=regen"
            />
          </div>

          <div className="mt-8 flex flex-wrap gap-2.5 text-xs text-white/75 sm:mt-10 sm:gap-3 sm:text-sm">
            {['No equipment required', 'Works on any screen', 'Results felt within minutes'].map((item) => (
              <div
                className="rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-1.5 backdrop-blur-sm sm:px-4 sm:py-2"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
})
