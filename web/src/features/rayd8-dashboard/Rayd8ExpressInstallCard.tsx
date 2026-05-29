import { useEffect, useRef, useState } from 'react'
import { trackUmamiEvent, trackUmamiEventOnce } from '../../services/umami'
import { ExpressDownloadSheet, ExpressInstallSuccessToast } from '../pwa/ExpressDownloadSheet'
import {
  getExpressInstallCopy,
  requestExpressDownload,
  shouldUseNativeInstallPrompt,
} from '../pwa/expressInstallCopy'
import { useExpressInstallDismissal } from '../pwa/useExpressInstallDismissal'
import { usePlatformDetection, type ExpressPlatformKind } from '../pwa/usePlatformDetection'
import { usePwaInstall } from '../pwa/usePwaInstall'

export function Rayd8ExpressInstallCard() {
  const platform = usePlatformDetection()
  const { canPrompt, isInstalled, promptInstall, standalone } = usePwaInstall()
  const { dismiss, hidden, remindLater } = useExpressInstallDismissal()
  const [downloadSheetOpen, setDownloadSheetOpen] = useState(false)
  const [installSuccessVisible, setInstallSuccessVisible] = useState(false)
  const launchTrackedRef = useRef(false)
  const copy = getExpressInstallCopy(platform.platformKind)
  const canUseNativePrompt = shouldUseNativeInstallPrompt(platform.platformKind, canPrompt)
  const cardVisible = !standalone && !hidden && !isInstalled

  useEffect(() => {
    if (launchTrackedRef.current) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const launchSource = params.get('source')

    if (!standalone && launchSource !== 'express') {
      return
    }

    launchTrackedRef.current = true
    trackUmamiEventOnce('rayd8_express_launch', {
      displayMode: standalone ? 'standalone' : 'browser',
      platform: platform.platformKind,
      source: launchSource === 'express' ? 'express' : 'standalone',
    })
  }, [platform.platformKind, standalone])

  useEffect(() => {
    if (!cardVisible) {
      return
    }

    trackUmamiEventOnce('rayd8_express_card_shown', {
      canPrompt,
      platform: platform.platformKind,
    })
  }, [canPrompt, cardVisible, platform.platformKind])

  useEffect(() => {
    if (!installSuccessVisible) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setInstallSuccessVisible(false), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [installSuccessVisible])

  if (standalone) {
    return (
      <>
        <div className="rounded-[1.35rem] border border-emerald-200/15 bg-emerald-300/[0.07] px-4 py-3 text-sm text-emerald-50/86 shadow-[0_14px_44px_rgba(16,185,129,0.12)] backdrop-blur-xl">
          <span className="text-[10px] uppercase tracking-[0.28em] text-emerald-200/70">
            Running in RAYD8 Express
          </span>
        </div>
        <ExpressInstallSuccessToast visible={installSuccessVisible} />
      </>
    )
  }

  if (hidden || isInstalled) {
    return <ExpressInstallSuccessToast visible={installSuccessVisible} />
  }

  const handleInstall = async () => {
    trackUmamiEvent('rayd8_express_install_clicked', {
      canPrompt,
      platform: platform.platformKind,
    })

    const result = await requestExpressDownload({
      canUseNativePrompt,
      promptInstall,
    })

    if (result === 'accepted') {
      setInstallSuccessVisible(true)
      return
    }

    if (result === 'fallback') {
      setDownloadSheetOpen(true)
    }
  }

  const handleRemindLater = () => {
    trackUmamiEvent('rayd8_express_remind_later', { platform: platform.platformKind })
    remindLater()
  }

  const handleDismiss = () => {
    trackUmamiEvent('rayd8_express_dismissed', { platform: platform.platformKind })
    dismiss()
  }

  return (
    <>
      <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_12%_18%,rgba(134,59,255,0.24),transparent_30%),radial-gradient(circle_at_86%_24%,rgba(34,211,238,0.16),transparent_28%),rgba(5,7,12,0.72)] p-5 text-white shadow-[0_22px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <PlatformIcon platformKind={platform.platformKind} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-200/70">
                {copy.eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {copy.title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/82">
                {copy.body}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['One-tap access', 'Stay signed in', 'Faster launch', 'Phone, tablet and desktop', 'Immersive fullscreen'].map((benefit) => (
                  <span
                    className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/72"
                    key={benefit}
                  >
                    {benefit}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <button
              className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(16,185,129,0.95),rgba(59,130,246,0.92))] px-5 py-3 text-sm font-medium text-white shadow-[0_16px_45px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5"
              onClick={() => void handleInstall()}
              type="button"
            >
              {copy.cta}
            </button>
            <button
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.06]"
              onClick={handleRemindLater}
              type="button"
            >
              Remind me later
            </button>
            <button
              className="rounded-full px-5 py-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-slate-200"
              onClick={handleDismiss}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {downloadSheetOpen ? (
        <ExpressDownloadSheet
          copy={copy.sheet}
          onClose={() => setDownloadSheetOpen(false)}
        />
      ) : null}
      <ExpressInstallSuccessToast visible={installSuccessVisible} />
    </>
  )
}

function PlatformIcon({ platformKind }: { platformKind: ExpressPlatformKind }) {
  const icon =
    platformKind === 'ios' || platformKind === 'android' ? (
      <path d="M9 3.75h6A2.25 2.25 0 0 1 17.25 6v12A2.25 2.25 0 0 1 15 20.25H9A2.25 2.25 0 0 1 6.75 18V6A2.25 2.25 0 0 1 9 3.75Zm1.5 13.5h3" />
    ) : (
      <path d="M4.5 5.25h15v9.75h-15V5.25Zm5.25 13.5h4.5m-6.75 0h9" />
    )

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.07] text-emerald-100 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
      <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
        <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
          {icon}
        </g>
      </svg>
    </div>
  )
}
