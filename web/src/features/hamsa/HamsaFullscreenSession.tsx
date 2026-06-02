import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImmersiveViewport } from '../rayd8-player/ImmersiveViewport'
import { detectHamsaAppUrl } from './hamsaContent'

export function HamsaFullscreenSession({ onClose }: { onClose: () => void }) {
  const [hamsaSrc] = useState(detectHamsaAppUrl)
  const [fullscreenError, setFullscreenError] = useState(false)
  const [iframeLoadState, setIframeLoadState] = useState<'loading' | 'ready' | 'slow'>('loading')
  const [retryKey, setRetryKey] = useState(0)
  const [shellElement, setShellElement] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    setIframeLoadState('loading')
    const timeoutId = window.setTimeout(() => {
      setIframeLoadState((currentState) => (currentState === 'loading' ? 'slow' : currentState))
    }, 10000)

    return () => window.clearTimeout(timeoutId)
  }, [hamsaSrc, retryKey])

  const handleClose = useCallback(() => {
    if (document.fullscreenElement === shellElement) {
      void document.exitFullscreen().finally(onClose)
      return
    }

    onClose()
  }, [onClose, shellElement])

  const handleRequestFullscreen = useCallback(() => {
    if (!shellElement?.requestFullscreen || document.fullscreenElement) {
      return
    }

    void shellElement.requestFullscreen().catch(() => {
      setFullscreenError(true)
    })
  }, [shellElement])

  const handleRetry = useCallback(() => {
    setIframeLoadState('loading')
    setRetryKey((currentKey) => currentKey + 1)
  }, [])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [handleClose])

  if (typeof document === 'undefined') {
    return null
  }

  return (
    <>
      <ImmersiveViewport
        portal
        shellClassName="z-[8990] text-white"
        onShellRef={setShellElement}
      >
        <iframe
          allow="autoplay; fullscreen; clipboard-read; clipboard-write; screen-wake-lock"
          className="block h-full w-full border-0 bg-black"
          key={retryKey}
          onError={() => setIframeLoadState('slow')}
          onLoad={() => setIframeLoadState('ready')}
          src={hamsaSrc}
          title="HAMSA virtual healing hand"
        />
        {iframeLoadState !== 'ready' ? (
          <div className="absolute inset-0 z-[9005] flex items-center justify-center bg-black/82 p-6 text-center">
            <div className="max-w-sm rounded-[2rem] border border-white/12 bg-slate-950/92 p-6 text-white shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-cyan-300" />
              <h3 className="mt-5 text-2xl font-semibold">
                {iframeLoadState === 'slow' ? 'HAMSA is taking longer than expected.' : 'Loading HAMSA...'}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {iframeLoadState === 'slow'
                  ? 'The session may still be loading. You can retry the HAMSA app or exit the session.'
                  : 'Preparing the HAMSA app for your device.'}
              </p>
              {fullscreenError ? (
                <p className="mt-3 text-xs leading-5 text-amber-200">
                  Fullscreen was blocked, so HAMSA will continue in viewport mode.
                </p>
              ) : null}
              <div className="mt-6 flex flex-col gap-3">
                <button
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:-translate-y-0.5"
                  onClick={handleRetry}
                  type="button"
                >
                  Tap to retry
                </button>
                <button
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/5"
                  onClick={handleClose}
                  type="button"
                >
                  Exit Session
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {fullscreenError && iframeLoadState === 'ready' ? (
          <div className="pointer-events-none absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[9005] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-amber-300/20 bg-black/70 px-4 py-3 text-center text-xs text-amber-100 backdrop-blur">
            Fullscreen was blocked, so HAMSA is continuing in viewport mode.
          </div>
        ) : null}
      </ImmersiveViewport>
      {createPortal(
        <div className="fixed right-[calc(1rem+env(safe-area-inset-right))] top-[calc(1rem+env(safe-area-inset-top))] z-[9010] flex items-center gap-2">
          <button
            aria-label="Enter HAMSA fullscreen"
            className="rounded-full border border-white/12 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white/10"
            onClick={handleRequestFullscreen}
            type="button"
          >
            Fullscreen
          </button>
          <button
            aria-label="Close HAMSA session"
            className="rounded-full border border-white/12 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white/10"
            onClick={handleClose}
            type="button"
          >
            Exit
          </button>
        </div>,
        document.body,
      )}
    </>
  )
}
