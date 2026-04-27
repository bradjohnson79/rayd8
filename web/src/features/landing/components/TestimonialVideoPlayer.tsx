import { useEffect, useRef, useState } from 'react'

interface TestimonialVideo {
  id: string
  title: string
  youtubeId: string
}

interface TestimonialVideoPlayerProps {
  onPlaybackStarted: () => void
  onVideoEnded: () => void
  shouldAutoplay?: boolean
  video: TestimonialVideo
}

interface YouTubePlayer {
  destroy: () => void
}

interface YouTubePlayerEvent {
  data: number
  target: {
    playVideo: () => void
  }
}

interface YouTubePlayerConstructor {
  new (
    element: HTMLElement,
    options: {
      events: {
        onReady?: (event: YouTubePlayerEvent) => void
        onStateChange?: (event: YouTubePlayerEvent) => void
      }
      height: string
      playerVars: Record<string, number>
      videoId: string
      width: string
    },
  ): YouTubePlayer
}

interface YouTubeNamespace {
  Player: YouTubePlayerConstructor
  PlayerState: {
    ENDED: number
    PLAYING: number
  }
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null

function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT)
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise
  }

  youtubeApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]')
    const previousReady = window.onYouTubeIframeAPIReady

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      if (window.YT?.Player) {
        resolve(window.YT)
        return
      }
      reject(new Error('YouTube IFrame API did not initialize correctly.'))
    }

    if (existingScript) {
      return
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => reject(new Error('Failed to load YouTube IFrame API.'))
    document.head.appendChild(script)
  })

  return youtubeApiPromise
}

export function TestimonialVideoPlayer({
  onPlaybackStarted,
  onVideoEnded,
  shouldAutoplay = false,
  video,
}: TestimonialVideoPlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    let cancelled = false

    if (!host) {
      return
    }

    setLoadError(false)
    host.innerHTML = ''

    void loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) {
          return
        }

        playerRef.current = new YT.Player(hostRef.current, {
          events: {
            onReady: (event) => {
              if (shouldAutoplay) {
                event.target.playVideo()
              }
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                onPlaybackStarted()
                return
              }

              if (event.data === YT.PlayerState.ENDED) {
                onVideoEnded()
              }
            },
          },
          height: '100%',
          playerVars: {
            autoplay: shouldAutoplay ? 1 : 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          videoId: video.youtubeId,
          width: '100%',
        })
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
        }
      })

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [onPlaybackStarted, onVideoEnded, shouldAutoplay, video.youtubeId])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.6rem] bg-[#05080c]">
      {loadError ? (
        <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm leading-7 text-slate-300">
          Unable to load this testimonial right now.
        </div>
      ) : (
        <div
          aria-label={video.title}
          className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full"
          ref={hostRef}
        />
      )}
    </div>
  )
}
