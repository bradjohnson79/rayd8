import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type PrimeViewer = {
  flipped: boolean
  handheld: boolean
  toggleFlip: () => void
}

const PrimeViewerContext = createContext<PrimeViewer>({
  flipped: false,
  handheld: false,
  toggleFlip: () => {},
})

export function usePrimeViewer() {
  return useContext(PrimeViewerContext)
}

/** Phones and tablets: a coarse or no-hover pointer, and a short screen side in the tablet range. */
function detectHandheld() {
  const shortSide = Math.min(window.screen.width, window.screen.height)
  const handheldInput = window.matchMedia('(hover: none), (pointer: coarse)').matches
  return handheldInput && shortSide > 0 && shortSide <= 1200
}

/** Full-viewport frame. The stage inside stays a widescreen 16:9 on every device. */
export function PrimeLandscapeLock({ children }: { children: ReactNode }) {
  const [flipped, setFlipped] = useState(false)
  const [handheld, setHandheld] = useState(false)

  useEffect(() => {
    const update = () => setHandheld(detectHandheld())
    const coarse = window.matchMedia('(pointer: coarse)')
    const hover = window.matchMedia('(hover: none)')
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    coarse.addEventListener('change', update)
    hover.addEventListener('change', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      coarse.removeEventListener('change', update)
      hover.removeEventListener('change', update)
    }
  }, [])

  return (
    <PrimeViewerContext.Provider value={{ flipped, handheld, toggleFlip: () => setFlipped((current) => !current) }}>
      <div className="fixed inset-0 overflow-hidden bg-[#070b10]">
        <div
          className="absolute inset-0 flex overflow-hidden bg-[#070b10] text-white transition-transform duration-500"
          data-prime-flip={flipped ? '180' : '0'}
          data-prime-orientation="widescreen"
          style={flipped ? { transform: 'rotate(180deg)' } : undefined}
        >
          {children}
        </div>
      </div>
    </PrimeViewerContext.Provider>
  )
}
