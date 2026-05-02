import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthReadiness } from '../auth/useAuthReadiness'
import {
  captureReferralSession,
  flushStoredReferralCode,
  markReferralSessionCaptured,
  normalizeReferralCode,
  shouldCaptureReferralSession,
  storeReferralCode,
} from '../../services/referrals'

export function ReferralAttributionManager() {
  const location = useLocation()
  const { getTokenSafe, status } = useAuthReadiness()
  const attachCodeRef = useRef<string | null>(null)

  useEffect(() => {
    const referralCode = normalizeReferralCode(new URLSearchParams(location.search).get('ref'))

    if (!referralCode) {
      return
    }

    storeReferralCode(referralCode)

    if (!shouldCaptureReferralSession(referralCode)) {
      return
    }

    void captureReferralSession(referralCode)
      .then(() => {
        markReferralSessionCaptured(referralCode)
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.info('[referrals] capture failed', error)
        }
      })
  }, [location.search])

  useEffect(() => {
    if (status !== 'signed-in') {
      attachCodeRef.current = null
      return
    }

    const referralCode = normalizeReferralCode(window.localStorage.getItem('rayd8_ref'))

    if (!referralCode || attachCodeRef.current === referralCode) {
      return
    }

    let cancelled = false
    attachCodeRef.current = referralCode

    async function attachPendingReferral() {
      try {
        const tokenResult = await getTokenSafe()

        if (!tokenResult.token) {
          return
        }

        await flushStoredReferralCode(tokenResult.token)
      } catch (error) {
        if (import.meta.env.DEV) {
          console.info('[referrals] attach failed', error)
        }
      } finally {
        if (!cancelled) {
          attachCodeRef.current = null
        }
      }
    }

    void attachPendingReferral()

    return () => {
      cancelled = true
    }
  }, [getTokenSafe, status])

  return null
}
