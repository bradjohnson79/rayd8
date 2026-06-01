import { RedirectToSignIn } from '@clerk/react'
import { useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'

import { trackUmamiEvent } from '../../services/umami'
import {
  AUTH_LOADING_MESSAGE,
  AUTH_LOADING_SLOW_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  useAuthReadiness,
} from '../auth/useAuthReadiness'

const AMRITA_APP_URL = '/amrita_app/index.html'

function AmritaLaunchScreen() {
  const trackedRef = useRef(false)

  useEffect(() => {
    if (trackedRef.current) {
      return
    }

    trackedRef.current = true
    trackUmamiEvent('amrita_main_menu_opened', {
      location: 'amrita_route',
    })
  }, [])

  return (
    <main className="h-[100dvh] min-h-[100dvh] w-screen overflow-hidden bg-[#02030a] text-white">
      <iframe
        allow="autoplay; fullscreen; clipboard-read; clipboard-write; screen-wake-lock"
        className="block h-full w-full border-0 bg-[#02030a]"
        src={AMRITA_APP_URL}
        title="RAYD8 Amrita main menu"
      />
    </main>
  )
}

function AmritaLoadingScreen() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#02030a] px-6 text-white">
      <div className="max-w-md rounded-3xl border border-cyan-100/12 bg-white/[0.045] px-6 py-5 text-center text-sm text-slate-300 backdrop-blur-xl">
        <p>{AUTH_LOADING_MESSAGE}</p>
        <p className="mt-3 text-slate-400">{AUTH_LOADING_SLOW_MESSAGE}</p>
      </div>
    </main>
  )
}

function AmritaSignedOutScreen() {
  return (
    <>
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#02030a] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-cyan-100/12 bg-white/[0.045] px-6 py-5 text-center text-sm text-slate-300 backdrop-blur-xl">
          {SESSION_EXPIRED_MESSAGE}
        </div>
      </main>
      <RedirectToSignIn redirectUrl="/amrita-dashboard" />
    </>
  )
}

export function AmritaRoutePage() {
  const { authUser, status } = useAuthReadiness()

  if (status === 'loading') {
    return <AmritaLoadingScreen />
  }

  if (status === 'signed-out') {
    return <AmritaSignedOutScreen />
  }

  if (authUser?.plan !== 'amrita') {
    return <Navigate replace to="/subscription?plan=amrita" />
  }

  return <AmritaLaunchScreen />
}
