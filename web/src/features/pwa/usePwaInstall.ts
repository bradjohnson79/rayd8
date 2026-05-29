import { useCallback, useEffect, useState } from 'react'
import { trackUmamiEventOnce } from '../../services/umami'
import { useStandaloneMode } from './useStandaloneMode'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function usePwaInstall() {
  const standalone = useStandaloneMode()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  const canPrompt = installPrompt !== null
  const isInstalled = installed || standalone

  const promptInstall = useCallback(async () => {
    if (!installPrompt) {
      return 'unavailable' as const
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)

    if (choice.outcome === 'accepted') {
      setInstalled(true)
      return 'accepted' as const
    }

    return 'dismissed' as const
  }, [installPrompt])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
      trackUmamiEventOnce('rayd8_express_installed', { method: 'appinstalled' })
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  return {
    canPrompt,
    isInstalled,
    promptInstall,
    standalone,
  }
}
