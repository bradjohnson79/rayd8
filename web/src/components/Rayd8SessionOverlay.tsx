import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { logExpressPlaybackDebug } from '../features/rayd8-player/expressPlaybackDebug'
import { Rayd8PlayerEngine } from '../features/rayd8-player/Rayd8PlayerEngine'
import { useSession } from '../features/session/SessionProvider'

export function Rayd8SessionOverlay() {
  const { endSession, isActive, sessionSource, sessionType } = useSession()
  const activeSessionType = isActive ? sessionType : null

  useEffect(() => {
    if (activeSessionType) {
      logExpressPlaybackDebug('overlay_mount', { sessionType })
      logExpressPlaybackDebug('overlay_visible', { sessionType, visibleImmediately: true })
    }
  }, [activeSessionType, sessionType])

  useEffect(() => {
    if (!activeSessionType) {
      document.body.classList.remove('session-active')
      return
    }

    document.body.classList.add('session-active')

    return () => {
      document.body.classList.remove('session-active')
    }
  }, [activeSessionType])

  if (!activeSessionType) {
    return null
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className={[
        'fixed inset-0 z-[9000] h-[100dvh] w-screen bg-black',
        'opacity-100',
      ].join(' ')}
    >
      <Rayd8PlayerEngine
        isAdminPreview={sessionSource === 'admin'}
        onClose={endSession}
        sessionType={activeSessionType}
      />
    </div>,
    document.body,
  )
}
