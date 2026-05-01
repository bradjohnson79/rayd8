import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Rayd8PlayerEngine } from '../features/rayd8-player/Rayd8PlayerEngine'
import { useSession } from '../features/session/SessionProvider'

const EXIT_TRANSITION_MS = 260

export function Rayd8SessionOverlay() {
  const { endSession, isActive, sessionSource, sessionType } = useSession()
  const [mountedSessionType, setMountedSessionType] = useState<typeof sessionType>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isActive && sessionType) {
      let visibleFrameId: number | null = null

      const mountFrameId = window.requestAnimationFrame(() => {
        setMountedSessionType(sessionType)
        visibleFrameId = window.requestAnimationFrame(() => {
          setVisible(true)
        })
      })

      return () => {
        window.cancelAnimationFrame(mountFrameId)

        if (visibleFrameId !== null) {
          window.cancelAnimationFrame(visibleFrameId)
        }
      }
    }

    if (mountedSessionType) {
      const fadeFrameId = window.requestAnimationFrame(() => {
        setVisible(false)
      })

      const timeoutId = window.setTimeout(() => {
        setMountedSessionType(null)
      }, EXIT_TRANSITION_MS)

      return () => {
        window.cancelAnimationFrame(fadeFrameId)
        window.clearTimeout(timeoutId)
      }
    }
  }, [isActive, mountedSessionType, sessionType])

  useEffect(() => {
    if (!mountedSessionType) {
      document.body.classList.remove('session-active')
      return
    }

    document.body.classList.add('session-active')

    return () => {
      document.body.classList.remove('session-active')
    }
  }, [mountedSessionType])

  if (!mountedSessionType) {
    return null
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className={[
        'fixed inset-0 z-[9000] h-[100dvh] w-screen bg-black',
        'transition-opacity duration-300 ease-out',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <Rayd8PlayerEngine
        isAdminPreview={sessionSource === 'admin'}
        onClose={endSession}
        sessionType={mountedSessionType}
      />
    </div>,
    document.body,
  )
}
