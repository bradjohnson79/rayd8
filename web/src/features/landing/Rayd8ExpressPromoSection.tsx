import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { trackUmamiEvent, trackUmamiEventOnce } from '../../services/umami'
import { useAuthUser } from '../dashboard/useAuthUser'
import { getExpressInstallCopy, shouldUseNativeInstallPrompt } from '../pwa/expressInstallCopy'
import { usePlatformDetection } from '../pwa/usePlatformDetection'
import { usePwaInstall } from '../pwa/usePwaInstall'
import { MarketingButton } from './components/MarketingButton'

const BENEFITS = ['One-tap access', 'Stay signed in', 'Fast daily launch', 'Phone, tablet, desktop']
const PLATFORMS = ['iPhone', 'iPad', 'Android', 'Mac', 'Desktop PC']

interface Rayd8ExpressPromoSectionProps {
  reducedEffects?: boolean
}

export function Rayd8ExpressPromoSection({
  reducedEffects = false,
}: Rayd8ExpressPromoSectionProps) {
  const navigate = useNavigate()
  const user = useAuthUser()
  const platform = usePlatformDetection()
  const { canPrompt, isInstalled, promptInstall, standalone } = usePwaInstall()
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const sectionRef = useRef<HTMLElement | null>(null)
  const copy = getExpressInstallCopy(platform.platformKind, canPrompt)
  const canUseNativePrompt = shouldUseNativeInstallPrompt(platform.platformKind, canPrompt)
  const authenticated = user.isAuthenticated
  const primaryLabel = copy.cta

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

  const handlePrimaryClick = useCallback(async () => {
    trackUmamiEvent('rayd8_express_landing_primary_clicked', {
      authenticated,
      canPrompt,
      label: primaryLabel,
      platform: platform.platformKind,
    })

    if (isInstalled) {
      navigate('/dashboard?source=express')
      return
    }

    if (canUseNativePrompt) {
      const result = await promptInstall()

      if (result === 'accepted') {
        return
      }

      if (result === 'unavailable') {
        setInstructionsOpen(true)
        return
      }

      return
    }

    setInstructionsOpen(true)
  }, [
    authenticated,
    canPrompt,
    canUseNativePrompt,
    isInstalled,
    navigate,
    platform.platformKind,
    primaryLabel,
    promptInstall,
  ])

  const handleInstallPromptClick = useCallback(async () => {
    trackUmamiEvent('rayd8_express_landing_modal_install_clicked', {
      canPrompt,
      platform: platform.platformKind,
    })

    if (!canUseNativePrompt) {
      return
    }

    const result = await promptInstall()

    if (result !== 'unavailable') {
      setInstructionsOpen(false)
    }
  }, [canPrompt, canUseNativePrompt, platform.platformKind, promptInstall])

  const handleRegenClick = useCallback(() => {
    trackUmamiEvent('rayd8_express_landing_regen_clicked', {
      authenticated,
      platform: platform.platformKind,
    })

    navigate('/subscription?plan=regen&source=rayd8-express')
  }, [authenticated, navigate, platform.platformKind])

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
            New RAYD8 Express PWA
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Install RAYD8 on your home screen and come back in one tap.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200/82 sm:text-lg">
            RAYD8 Express gives members a lightweight app-style launcher for daily sessions,
            dashboard access, and REGEN upgrades without searching for the site again.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {BENEFITS.map((benefit) => (
              <span
                className="rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-xs uppercase tracking-[0.18em] text-white/72"
                key={benefit}
              >
                {benefit}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <MarketingButton onClick={() => void handlePrimaryClick()}>
              {primaryLabel}
            </MarketingButton>
            <MarketingButton onClick={handleRegenClick} variant="ghost">
              Experience REGEN
            </MarketingButton>
          </div>

          <div className="mt-7 rounded-[1.4rem] border border-white/10 bg-black/18 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/58">
              Available on
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-200/80">
              {PLATFORMS.map((device) => (
                <span className="rounded-full bg-white/[0.06] px-3 py-1" key={device}>
                  {device}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-300/70">
              Detected for {platform.deviceLabel}: {copy.installMode}. {copy.cue}.
            </p>
          </div>
        </div>

        <ExpressDeviceMockup reducedEffects={reducedEffects} standalone={standalone} />
      </div>

      {instructionsOpen ? (
        <InstallStepsPanel
          canUseNativePrompt={canUseNativePrompt}
          cta={copy.cta}
          fallbackMessage={copy.fallbackMessage}
          onInstall={() => void handleInstallPromptClick()}
          onClose={() => setInstructionsOpen(false)}
          platformTitle={copy.platformTitle}
          steps={copy.steps}
        />
      ) : null}
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
              {standalone ? 'Running standalone' : 'Add to Home Screen'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InstallStepsPanel({
  canUseNativePrompt,
  cta,
  fallbackMessage,
  onInstall,
  onClose,
  platformTitle,
  steps,
}: {
  canUseNativePrompt: boolean
  cta: string
  fallbackMessage: string
  onInstall: () => void
  onClose: () => void
  platformTitle: string
  steps: string[]
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl">
        <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-200/60">
          RAYD8 Express
        </p>
        <h3 className="mt-3 text-2xl font-semibold">{platformTitle}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          RAYD8 Express installs from your browser, not an app store download. Use the browser
          install control below when available, or follow the steps for your device.
        </p>
        {canUseNativePrompt ? (
          <button
            className="mt-5 w-full rounded-2xl bg-[linear-gradient(135deg,rgba(16,185,129,0.95),rgba(59,130,246,0.92))] px-4 py-3 text-sm font-medium text-white shadow-[0_16px_45px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5"
            onClick={onInstall}
            type="button"
          >
            {cta}
          </button>
        ) : (
          <div className="mt-5 rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.06] p-3 text-sm leading-6 text-cyan-50/82">
            {fallbackMessage}
          </div>
        )}
        <ol className="mt-5 grid gap-3">
          {steps.map((step, index) => (
            <li
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-200"
              key={step}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-300/18 text-xs font-semibold text-emerald-100">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <button
          className="mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
          onClick={onClose}
          type="button"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
