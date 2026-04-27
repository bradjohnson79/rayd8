import { Suspense, lazy } from 'react'
import { Outlet } from 'react-router-dom'
import { SessionProvider } from '../features/session/SessionProvider'

const Rayd8SessionOverlay = lazy(() =>
  import('./Rayd8SessionOverlay').then((module) => ({
    default: module.Rayd8SessionOverlay,
  })),
)

export function SessionAppShell() {
  return (
    <SessionProvider>
      <Outlet />
      <Suspense fallback={null}>
        <Rayd8SessionOverlay />
      </Suspense>
    </SessionProvider>
  )
}
