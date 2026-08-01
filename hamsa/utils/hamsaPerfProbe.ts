export type HamsaSurface = "aura" | "glyph" | "hand"

interface HamsaSurfaceState {
  hasContext: boolean
  activeLoop: boolean
  lastDrawAt: number | null
}

const surfaces: Record<HamsaSurface, HamsaSurfaceState> = {
  aura: { hasContext: false, activeLoop: false, lastDrawAt: null },
  glyph: { hasContext: false, activeLoop: false, lastDrawAt: null },
  hand: { hasContext: false, activeLoop: false, lastDrawAt: null },
}

let renderFps = 30
let renderScale = 1
let renderingPaused = false
let isPlayingGlobal = false

export function setHamsaPlaying(isPlaying: boolean) {
  isPlayingGlobal = isPlaying
}

export function setHamsaSurfaceContext(surface: HamsaSurface, hasContext: boolean) {
  surfaces[surface].hasContext = hasContext
}

export function setHamsaSurfaceLoop(surface: HamsaSurface, activeLoop: boolean) {
  surfaces[surface].activeLoop = activeLoop
}

export function markHamsaDraw(surface: HamsaSurface) {
  surfaces[surface].lastDrawAt = Date.now()
}

export function getHamsaTargetFps() {
  return renderFps
}

export function getHamsaRenderScale() {
  return renderScale
}

export function isHamsaRenderingPaused() {
  return renderingPaused
}

export function setHamsaRenderFPS(fps: number) {
  renderFps = Math.max(1, Math.min(60, fps))
}

export function setHamsaRenderScale(scale: number) {
  renderScale = Math.max(0.5, Math.min(1.5, scale))
}

export function setHamsaRenderingPaused(paused: boolean) {
  renderingPaused = paused
}

/** Internal apply path used by adaptive bridge (not window globals). */
export function applyHamsaPerformanceProfile(input: {
  targetFps: number
  renderScale: number
  pauseRendering?: boolean
}) {
  setHamsaRenderFPS(input.targetFps)
  setHamsaRenderScale(input.renderScale)
  if (typeof input.pauseRendering === 'boolean') {
    setHamsaRenderingPaused(input.pauseRendering)
  }
}

export function getHamsaPerfSnapshot() {
  const contexts = (Object.values(surfaces) as HamsaSurfaceState[]).filter(
    (s) => s.hasContext,
  ).length
  const activeLoops = (Object.values(surfaces) as HamsaSurfaceState[]).filter(
    (s) => s.activeLoop,
  ).length
  return {
    contexts,
    activeLoops,
    isPlaying: isPlayingGlobal,
    renderingPaused,
    renderFps,
    renderScale,
    surfaces: { ...surfaces },
    lastDrawAt: Math.max(
      0,
      ...Object.values(surfaces).map((s) => s.lastDrawAt ?? 0),
    ),
  }
}

export function installHamsaPerfProbe() {
  if (typeof window === "undefined") {
    return
  }

  ;(
    window as Window & {
      __HAMSA_PERF__?: {
        getSnapshot: typeof getHamsaPerfSnapshot
        setRenderFPS: (fps: number) => void
        setRenderScale: (scale: number) => void
        pauseRendering: () => void
        resumeRendering: () => void
        dispose: () => void
        status: () => ReturnType<typeof getHamsaPerfSnapshot>
      }
    }
  ).__HAMSA_PERF__ = {
    getSnapshot: getHamsaPerfSnapshot,
    setRenderFPS(fps: number) {
      setHamsaRenderFPS(fps)
    },
    setRenderScale(scale: number) {
      setHamsaRenderScale(scale)
    },
    pauseRendering() {
      setHamsaRenderingPaused(true)
    },
    resumeRendering() {
      setHamsaRenderingPaused(false)
    },
    dispose() {
      setHamsaRenderingPaused(true)
      for (const key of Object.keys(surfaces) as HamsaSurface[]) {
        surfaces[key].activeLoop = false
      }
    },
    status: getHamsaPerfSnapshot,
  }

  installHamsaAdaptiveBridge()
}

const ADAPTIVE_PERF_MESSAGE_TYPE = 'rayd8:adaptive-performance:v1'

function installHamsaAdaptiveBridge() {
  if (typeof window === 'undefined') {
    return
  }
  const w = window as Window & { __RAYD8_HAMSA_ADAPTIVE_BRIDGE__?: boolean }
  if (w.__RAYD8_HAMSA_ADAPTIVE_BRIDGE__) {
    return
  }
  w.__RAYD8_HAMSA_ADAPTIVE_BRIDGE__ = true
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) {
      return
    }
    const data = event.data as {
      type?: string
      action?: string
      profile?: {
        targetFps?: number
        renderScale?: number
        pauseHiddenTabRendering?: boolean
      }
    }
    if (data?.type !== ADAPTIVE_PERF_MESSAGE_TYPE || data.action !== 'applyProfile') {
      return
    }
    const profile = data.profile
    if (!profile) {
      return
    }
    applyHamsaPerformanceProfile({
      targetFps: Number(profile.targetFps) || 30,
      renderScale: Number(profile.renderScale) || 1,
      pauseRendering: Boolean(profile.pauseHiddenTabRendering && document.hidden),
    })
  })
}
