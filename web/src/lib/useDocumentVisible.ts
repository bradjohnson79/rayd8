import { useEffect, useState } from 'react'

const TAB_HIDDEN_ATTRIBUTE = 'data-tab-hidden'

let hasInstalledRootSync = false

function installRootSync() {
  if (hasInstalledRootSync || typeof document === 'undefined') {
    return
  }
  hasInstalledRootSync = true

  const apply = () => {
    const isHidden = document.visibilityState !== 'visible'
    if (isHidden) {
      document.documentElement.setAttribute(TAB_HIDDEN_ATTRIBUTE, 'true')
    } else {
      document.documentElement.removeAttribute(TAB_HIDDEN_ATTRIBUTE)
    }
  }

  apply()
  document.addEventListener('visibilitychange', apply)
}

function readVisibility() {
  if (typeof document === 'undefined') {
    return true
  }
  return document.visibilityState === 'visible'
}

export function useDocumentVisible(): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(() => readVisibility())

  useEffect(() => {
    installRootSync()

    const handleChange = () => {
      setIsVisible(readVisibility())
    }

    handleChange()
    document.addEventListener('visibilitychange', handleChange)
    return () => document.removeEventListener('visibilitychange', handleChange)
  }, [])

  return isVisible
}
