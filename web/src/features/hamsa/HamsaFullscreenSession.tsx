import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImmersiveViewport } from '../rayd8-player/ImmersiveViewport'
import { detectHamsaAppUrl } from './hamsaContent'

export function HamsaFullscreenSession({ onClose }: { onClose: () => void }) {
  const [hamsaSrc] = useState(detectHamsaAppUrl)
  const [shellElement, setShellElement] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!shellElement?.requestFullscreen || document.fullscreenElement) {
      return undefined
    }

    void shellElement.requestFullscreen().catch(() => {
      // Browser fullscreen can be unavailable in installed app shells; the portaled overlay remains immersive.
    })

    return undefined
  }, [shellElement])

  const handleClose = useCallback(() => {
    if (document.fullscreenElement === shellElement) {
      void document.exitFullscreen().finally(onClose)
      return
    }

    onClose()
  }, [onClose, shellElement])

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
          src={hamsaSrc}
          title="HAMSA virtual healing hand"
        />
      </ImmersiveViewport>
      {createPortal(
        <button
          aria-label="Close HAMSA session"
          className="fixed right-[calc(1rem+env(safe-area-inset-right))] top-[calc(1rem+env(safe-area-inset-top))] z-[9010] rounded-full border border-white/12 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white/10"
          onClick={handleClose}
          type="button"
        >
          Exit
        </button>,
        document.body,
      )}
    </>
  )
}
