import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { trackUmamiEvent, trackUmamiEventOnce } from '../../services/umami'
import { ExpressInstallHelperModal } from '../pwa/ExpressInstallHelperModal'
import { ExpressInstallSuccessToast } from '../pwa/ExpressDownloadSheet'
import {
  DOWNLOAD_EXPRESS_CTA,
  getAppleInstallGuide,
  getExpressInstallCopy,
} from '../pwa/expressInstallCopy'
import { getInstallFlow, type InstallFlowAudience, type InstallFlowKind } from '../pwa/getInstallFlow'
import { usePlatformDetection } from '../pwa/usePlatformDetection'
import { usePwaInstall } from '../pwa/usePwaInstall'
import { MarketingButton } from './components/MarketingButton'

interface Rayd8ExpressPromoSectionProps {
  reducedEffects?: boolean
}

export function Rayd8ExpressPromoSection({
  reducedEffects = false,
}: Rayd8ExpressPromoSectionProps) {
  const navigate = useNavigate()
  const platform = usePlatformDetection()
  const { canPrompt, isInstalled, promptInstall, standalone } = usePwaInstall()
  const [installDialogFlow, setInstallDialogFlow] = useState<InstallFlowKind | null>(null)
  const [installDialogStatus, setInstallDialogStatus] = useState<
    'dismissed' | 'unavailable' | null
  >(null)
  const [installSuccessVisible, setInstallSuccessVisible] = useState(false)
  const sectionRef = useRef<HTMLElement | null>(null)
  const copy = getExpressInstallCopy(platform.platformKind)
  const appleGuide = getAppleInstallGuide(platform.platformKind)

  useEffect(() => {
    if (!installSuccessVisible) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setInstallSuccessVisible(false), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [installSuccessVisible])

  useEffect(() => {
    const element = sectionRef.current

    if (!element || !('IntersectionObserver' in window)) {
      trackUmamiEventOnce('rayd8_express_landing_shown', {
        platform: platform.platformKind,
      })
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return
        }

        trackUmamiEventOnce('rayd8_express_landing_shown', {
          platform: platform.platformKind,
        })
        observer.disconnect()
      },
      { threshold: 0.28 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [platform.platformKind])

  const openInstallDialog = useCallback(
    (requestedAudience: InstallFlowAudience) => {
      trackUmamiEvent('rayd8_express_landing_download_clicked', {
        canPrompt,
        platform: platform.platformKind,
        requestedAudience,
      })

      if (isInstalled) {
        navigate('/dashboard?source=express')
        return
      }

      setInstallDialogStatus(null)
      setInstallDialogFlow(
        getInstallFlow({
          canPrompt,
          platformKind: platform.platformKind,
          requestedAudience,
        }),
      )
    },
    [canPrompt, isInstalled, navigate, platform.platformKind],
  )

  const closeInstallDialog = useCallback(() => {
    setInstallDialogFlow(null)
    setInstallDialogStatus(null)
  }, [])

  const handleInstallDialogDownload = useCallback(async () => {
    if (!installDialogFlow) {
      return
    }

    trackUmamiEvent('rayd8_express_install_dialog_download_clicked', {
      canPrompt,
      flow: installDialogFlow,
      platform: platform.platformKind,
    })

    if (installDialogFlow === 'androidDesktop') {
      const result = await promptInstall()

      if (result === 'accepted') {
        closeInstallDialog()
        setInstallSuccessVisible(true)
        return
      }

      setInstallDialogStatus(result === 'dismissed' ? 'dismissed' : 'unavailable')
      return
    }

    if (installDialogFlow === 'apple') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: 'RAYD8 Express',
            text: 'Download RAYD8 Express',
            url: window.location.origin,
          })
          return
        } catch (error) {
          const shareError = error instanceof DOMException ? error.name : 'ShareUnavailable'
          setInstallDialogStatus(shareError === 'AbortError' ? 'dismissed' : 'unavailable')
          return
        }
      }

      setInstallDialogStatus('unavailable')
      return
    }

    setInstallDialogStatus('unavailable')
  }, [
    canPrompt,
    closeInstallDialog,
    installDialogFlow,
    platform.platformKind,
    promptInstall,
  ])

  return (
    <section
      className="relative overflow-hidden px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
      id="rayd8-express"
      ref={sectionRef}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/35 to-transparent"
      />
      <div className="mx-auto grid max-w-7xl gap-8 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.20),transparent_32%),radial-gradient(circle_at_82%_24%,rgba(59,130,246,0.18),transparent_32%),linear-gradient(135deg,rgba(5,9,16,0.88),rgba(4,7,12,0.96))] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:p-10">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-emerald-200/75">
            RAYD8 Express
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Download RAYD8 Express
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200/82 sm:text-lg">
            {copy.body}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-white/10 bg-black/18 p-5">
              <h3 className="text-sm font-medium tracking-wide text-white/90">Android / PC Users</h3>
              <MarketingButton
                className="mt-4 w-full"
                onClick={() => openInstallDialog('androidDesktop')}
              >
                {DOWNLOAD_EXPRESS_CTA}
              </MarketingButton>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-[1.35rem] border border-white/10 bg-black/18 p-5">
                <h3 className="text-sm font-medium tracking-wide text-white/90">iPhone / Mac Users</h3>
                <MarketingButton className="mt-4 w-full" onClick={() => openInstallDialog('apple')}>
                  {DOWNLOAD_EXPRESS_CTA}
                </MarketingButton>
              </div>
              <p className="text-xs leading-5 text-slate-200/60">
                RAYD8 Express not available through Mozilla Firefox browser. Please use your member
                dashboard to access RAYD8 when using this browser.
              </p>
            </div>
          </div>
        </div>

        <ExpressDeviceMockup reducedEffects={reducedEffects} standalone={standalone} />
      </div>

      {installDialogFlow ? (
        <ExpressInstallHelperModal
          flow={installDialogFlow}
          guide={installDialogFlow === 'apple' ? appleGuide : null}
          onClose={closeInstallDialog}
          onDownload={() => void handleInstallDialogDownload()}
          status={installDialogStatus}
        />
      ) : null}
      <ExpressInstallSuccessToast visible={installSuccessVisible} />
    </section>
  )
}

function ExpressDeviceMockup({
  reducedEffects,
  standalone,
}: {
  reducedEffects: boolean
  standalone: boolean
}) {
  return (
    <div className="relative mx-auto min-h-[28rem] w-full max-w-[28rem] lg:max-w-none">
      <div
        aria-hidden="true"
        className={[
          'absolute inset-8 rounded-full bg-emerald-300/18 blur-3xl',
          reducedEffects ? '' : 'animate-pulse',
        ]
          .filter(Boolean)
          .join(' ')}
      />
      <div className="absolute right-0 top-8 hidden w-72 rounded-[1.6rem] border border-white/10 bg-slate-950/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:block">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-200/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-200/80" />
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-200/65">
            RAYD8 Dashboard
          </p>
          <div className="mt-4 grid gap-2">
            <div className="h-3 rounded-full bg-emerald-200/35" />
            <div className="h-3 w-4/5 rounded-full bg-cyan-200/25" />
            <div className="mt-3 h-20 rounded-2xl bg-[radial-gradient(circle_at_30%_28%,rgba(16,185,129,0.55),transparent_32%),linear-gradient(135deg,rgba(59,130,246,0.36),rgba(15,23,42,0.76))]" />
          </div>
        </div>
      </div>

      <div className="relative mx-auto w-60 rounded-[2.6rem] border border-white/14 bg-black p-3 shadow-[0_28px_95px_rgba(0,0,0,0.42)] sm:ml-8 sm:mr-auto">
        <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,#071018,#05070b)]">
          <div className="px-4 pb-5 pt-8">
            <div className="rounded-3xl bg-[radial-gradient(circle_at_28%_18%,rgba(16,185,129,0.52),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(59,130,246,0.38),transparent_34%),rgba(255,255,255,0.05)] p-4">
              <p className="text-[9px] uppercase tracking-[0.26em] text-emerald-100/70">
                Express
              </p>
              <div className="mt-20 h-2 rounded-full bg-white/70" />
              <div className="mt-2 h-2 w-3/4 rounded-full bg-white/35" />
            </div>
            <div className="mt-4 grid gap-2">
              {['Expansion', 'Premium', 'REGEN'].map((item) => (
                <div
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2"
                  key={item}
                >
                  <span className="text-xs text-slate-200">{item}</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-200" />
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-emerald-300/18 px-3 py-2 text-center text-xs font-medium text-emerald-50">
              {standalone ? 'Running standalone' : 'One-tap launch'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
