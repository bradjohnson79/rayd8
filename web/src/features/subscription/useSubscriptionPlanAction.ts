import { useClerk } from '@clerk/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AUTH_LOADING_MESSAGE,
  CHECKOUT_FAILURE_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  useAuthReadiness,
} from '../auth/useAuthReadiness'
import { createBillingCheckout, type BillingPlan } from '../../services/billing'
import { flushStoredReferralCode } from '../../services/referrals'
import { trackUmamiEvent } from '../../services/umami'

const PLAN_STORAGE_KEY = 'rayd8_plan'
const RESUME_STORAGE_KEY = 'rayd8_subscription_resume'

export type SubscriptionPlan = 'free' | BillingPlan

interface UseSubscriptionPlanActionOptions {
  location: 'landing_teaser' | 'subscription_page'
}

export function normalizeSubscriptionPlan(value: string | null): SubscriptionPlan {
  return value === 'regen' || value === 'amrita' ? value : 'free'
}

function storePendingPlan(plan: SubscriptionPlan) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PLAN_STORAGE_KEY, plan)
  window.localStorage.setItem(RESUME_STORAGE_KEY, 'pending')
}

function consumePendingPlan() {
  if (typeof window === 'undefined') {
    return null
  }

  const shouldResume = window.localStorage.getItem(RESUME_STORAGE_KEY)
  const storedPlan = normalizeSubscriptionPlan(window.localStorage.getItem(PLAN_STORAGE_KEY))

  if (shouldResume !== 'pending') {
    return null
  }

  window.localStorage.removeItem(RESUME_STORAGE_KEY)
  window.localStorage.removeItem(PLAN_STORAGE_KEY)
  return storedPlan
}

export function useSubscriptionPlanAction({ location }: UseSubscriptionPlanActionOptions) {
  const { openSignIn, openSignUp } = useClerk()
  const navigate = useNavigate()
  const { getTokenSafe, status } = useAuthReadiness()
  const [activePlan, setActivePlan] = useState<SubscriptionPlan | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const isSubmittingRef = useRef(false)

  const startPlanAction = useCallback(
    async (plan: SubscriptionPlan) => {
      if (isSubmittingRef.current) {
        return false
      }

      setActivePlan(plan)
      setStatusMessage('')

      if (status === 'loading') {
        setStatusMessage(AUTH_LOADING_MESSAGE)
        return false
      }

      if (status !== 'signed-in') {
        storePendingPlan(plan)

        if (plan === 'free') {
          void openSignUp()
          return false
        }

        void openSignIn()
        return false
      }

      if (plan === 'free') {
        navigate('/dashboard')
        return true
      }

      setIsSubmitting(true)
      isSubmittingRef.current = true

      try {
        const tokenResult = await getTokenSafe()

        if (!tokenResult.token) {
          setStatusMessage(
            tokenResult.error === 'loading' ? AUTH_LOADING_MESSAGE : SESSION_EXPIRED_MESSAGE,
          )
          return false
        }

        await flushStoredReferralCode(tokenResult.token).catch(() => null)

        trackUmamiEvent('upgrade_click', {
          location,
          plan,
        })
        if (plan === 'amrita') {
          trackUmamiEvent('amrita_checkout_started', {
            location,
            plan,
          })
        }

        const response = await createBillingCheckout(plan, tokenResult.token)
        window.location.assign(response.checkoutUrl)
        return true
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : CHECKOUT_FAILURE_MESSAGE)
        return false
      } finally {
        isSubmittingRef.current = false
        setIsSubmitting(false)
      }
    },
    [getTokenSafe, location, navigate, openSignIn, openSignUp, status],
  )

  useEffect(() => {
    if (status !== 'signed-in') {
      return
    }

    const pendingPlan = consumePendingPlan()

    if (!pendingPlan) {
      return
    }

    void startPlanAction(pendingPlan)
  }, [startPlanAction, status])

  return {
    activePlan,
    isSubmitting,
    startPlanAction,
    statusMessage,
  }
}
