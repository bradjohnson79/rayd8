import { useEffect, useRef } from 'react'
import { getAdaptivePerformanceManager } from './adaptivePerformanceManager'
import {
  createAdaptivePerfApplyMessage,
  registerAdaptivePerfIframeTarget,
} from './adaptivePerformanceBridge'

/**
 * Surfaces report session start/stop; manager owns activity state.
 */
export function useAdaptiveSessionLifecycle(active: boolean) {
  useEffect(() => {
    const manager = getAdaptivePerformanceManager()
    if (!manager || !active) {
      return
    }
    manager.notifySessionStarted()
    return () => manager.notifySessionStopped()
  }, [active])
}

export function useAdaptiveIframeTarget(iframe: HTMLIFrameElement | null) {
  const unregisterRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!iframe) {
      return
    }

    const bind = () => {
      unregisterRef.current?.()
      unregisterRef.current = registerAdaptivePerfIframeTarget(iframe.contentWindow)
      const profile = getAdaptivePerformanceManager()?.getProfile()
      if (profile && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage(
            createAdaptivePerfApplyMessage(profile),
            window.location.origin,
          )
        } catch {
          /* ignore */
        }
      }
    }

    iframe.addEventListener('load', bind)
    if (iframe.contentWindow) {
      bind()
    }

    return () => {
      iframe.removeEventListener('load', bind)
      unregisterRef.current?.()
      unregisterRef.current = null
    }
  }, [iframe])
}
