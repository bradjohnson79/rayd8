import { useCallback, useState } from 'react'

const EXPRESS_DISMISSAL_STORAGE_KEY = 'rayd8_express_install_visibility'
const DAY_MS = 24 * 60 * 60 * 1000
const DISMISS_COOLDOWN_MS = 30 * DAY_MS
const REMIND_LATER_COOLDOWN_MS = 7 * DAY_MS

interface ExpressDismissalState {
  hiddenUntil: number
  reason: 'dismissed' | 'remind-later'
}

function readDismissalState(): ExpressDismissalState | null {
  if (typeof window === 'undefined') {
    return null
  }

  const rawValue = window.localStorage.getItem(EXPRESS_DISMISSAL_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<ExpressDismissalState>

    if (typeof parsed.hiddenUntil !== 'number') {
      return null
    }

    return {
      hiddenUntil: parsed.hiddenUntil,
      reason: parsed.reason === 'remind-later' ? 'remind-later' : 'dismissed',
    }
  } catch {
    return null
  }
}

function persistDismissalState(nextValue: ExpressDismissalState) {
  window.localStorage.setItem(EXPRESS_DISMISSAL_STORAGE_KEY, JSON.stringify(nextValue))
}

export function useExpressInstallDismissal() {
  const [dismissalState, setDismissalState] = useState(() => {
    const storedState = readDismissalState()

    if (!storedState || storedState.hiddenUntil <= Date.now()) {
      return null
    }

    return storedState
  })
  const hidden = dismissalState !== null

  const dismiss = useCallback(() => {
    const nextValue: ExpressDismissalState = {
      hiddenUntil: Date.now() + DISMISS_COOLDOWN_MS,
      reason: 'dismissed',
    }
    persistDismissalState(nextValue)
    setDismissalState(nextValue)
  }, [])

  const remindLater = useCallback(() => {
    const nextValue: ExpressDismissalState = {
      hiddenUntil: Date.now() + REMIND_LATER_COOLDOWN_MS,
      reason: 'remind-later',
    }
    persistDismissalState(nextValue)
    setDismissalState(nextValue)
  }, [])

  const clearDismissal = useCallback(() => {
    window.localStorage.removeItem(EXPRESS_DISMISSAL_STORAGE_KEY)
    setDismissalState(null)
  }, [])

  return {
    clearDismissal,
    dismiss,
    hidden,
    reason: dismissalState?.reason ?? null,
    remindLater,
  }
}
