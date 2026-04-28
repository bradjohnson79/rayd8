import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'
import {
  useEffect,
  useState,
  type ReactNode
} from 'react'
import { Link } from 'react-router-dom'
import type { Experience } from '../../app/types'
import {
  normalizePlaybackPlan,
  type PlaybackPlan,
  type PlaybackPlanInput,
} from '../../lib/resolvePlaybackAsset'
import {
  formatRuntimeClock,
  formatRuntimeLimit,
  formatUsagePercent,
} from '../../lib/formatUsageRuntime'
import { getMe } from '../../services/me'
import {
  getPlaybackAccess,
  type ExperienceAccessSummary,
} from '../../services/player'
import { getUsage, type UsageResponse } from '../../services/usage'
import { useAuthToken } from '../dashboard/useAuthToken'
import { useAuthUser } from '../dashboard/useAuthUser'
import { useSession } from '../session/SessionProvider'

interface Rayd8DashboardProps {
  forcedPlan?: PlaybackPlanInput
}

type SectionTone = 'amrita' | 'expansion' | 'premium' | 'regen'
const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
const DASHBOARD_EXPERIENCES: Experience[] = ['expansion', 'premium', 'regen']

export function Rayd8Dashboard({
  forcedPlan = null,
}: Rayd8DashboardProps) {
  const user = useAuthUser()
  const effectivePlan = normalizePlaybackPlan(forcedPlan ?? user.plan)
  const isPreviewMode = forcedPlan !== null

  return (
    <MemberDashboardLaunchpad
      effectivePlan={effectivePlan}
      isPreviewMode={isPreviewMode}
    />
  )
}

function MemberDashboardLaunchpad({
  effectivePlan,
  isPreviewMode = false,
}: {
  effectivePlan: PlaybackPlan
  isPreviewMode?: boolean
}) {
  const getAuthToken = useAuthToken()
  const user = useAuthUser()
  const { experienceAccess, startSession, updateExperienceAccess } = useSession()
  const [checkingExperience, setCheckingExperience] = useState<Experience | null>(null)
  const [experiencePrompts, setExperiencePrompts] = useState<Partial<Record<Experience, string>>>({})
  const [usageSnapshot, setUsageSnapshot] = useState<UsageResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    async function hydrateAccess() {
      try {
        const token = await getAuthToken()

        if (!token) {
          return
        }

        const response = await getMe(token)

        if (!cancelled) {
          updateExperienceAccess(response.access.expansion)
          updateExperienceAccess(response.access.premium)
          updateExperienceAccess(response.access.regen)
          setUsageSnapshot({
            access: response.access,
            plan: response.user?.plan ?? effectivePlan,
            usage: response.usage,
          })
        }
      } finally {
        if (!cancelled) {
          setCheckingExperience(null)
        }
      }
    }

    setCheckingExperience('premium')
    void hydrateAccess()

    return () => {
      cancelled = true
    }
  }, [effectivePlan, getAuthToken, updateExperienceAccess])

  useEffect(() => {
    if (isPreviewMode) {
      return
    }

    let cancelled = false

    const hydrateUsage = async () => {
      const token = await getAuthToken()

      if (!token || cancelled) {
        return
      }

      try {
        const response = await getUsage(token)

        if (cancelled) {
          return
        }

        updateExperienceAccess(response.access.expansion)
        updateExperienceAccess(response.access.premium)
        updateExperienceAccess(response.access.regen)
        setUsageSnapshot(response)
      } catch {
        // Keep polling best-effort so the dashboard can continue rendering existing data.
      }
    }

    void hydrateUsage()
    const intervalId = window.setInterval(() => {
      void hydrateUsage()
    }, 15_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [getAuthToken, isPreviewMode, updateExperienceAccess])

  useEffect(() => {
    setCheckingExperience(null)
    setExperiencePrompts({})
  }, [effectivePlan])

  const expansionAccess = experienceAccess.expansion ?? usageSnapshot?.access.expansion ?? null
  const premiumAccess = experienceAccess.premium ?? usageSnapshot?.access.premium ?? null
  const regenAccess = experienceAccess.regen ?? usageSnapshot?.access.regen ?? null
  const previewPremiumAllowed = effectivePlan === 'regen'
  const previewRegenAllowed = effectivePlan === 'regen'
  const expansionAllowed = isPreviewMode ? true : Boolean(expansionAccess?.allowed ?? true)
  const premiumAllowed = isPreviewMode ? previewPremiumAllowed : Boolean(premiumAccess?.allowed)
  const regenAllowed = isPreviewMode ? previewRegenAllowed : Boolean(regenAccess?.allowed)
  const premiumTrialAvailable =
    effectivePlan === 'free' &&
    (isPreviewMode ? true : (premiumAccess?.remainingSeconds ?? 3600) >= 30)
  const regenTrialAvailable =
    effectivePlan === 'free' &&
    (isPreviewMode ? true : (regenAccess?.remainingSeconds ?? 3600) >= 30)
  const expansionCtaLabel =
    checkingExperience === 'expansion' && !expansionAccess
      ? 'Checking access...'
      : expansionAllowed
        ? 'Start Session'
        : 'Upgrade to REGEN'
  const premiumCtaLabel =
    checkingExperience === 'premium' && !premiumAccess
      ? 'Checking access...'
      : premiumTrialAvailable
        ? 'Try Premium (1 hour)'
        : premiumAllowed
          ? 'Start Session'
          : 'Upgrade to REGEN'
  const regenCtaLabel =
    checkingExperience === 'regen' && !regenAccess
      ? 'Checking access...'
      : regenTrialAvailable
        ? 'Try REGEN (1 hour)'
        : regenAllowed
        ? 'Start Session'
        : 'Upgrade to REGEN'
  const sessionStartOptions = isPreviewMode && user.role === 'admin' ? { source: 'admin' as const } : undefined

  return (
    <div
      className="relative h-full overflow-y-auto overscroll-y-auto"
      id="member-dashboard-scroll"
    >
      <MemberAccountCluster effectivePlan={effectivePlan} user={user} />
      {!isPreviewMode && usageSnapshot ? (
        <div className="relative z-20 mx-auto max-w-7xl px-4 pt-24 sm:px-6 sm:pt-28 lg:px-8">
          <DashboardUsageSummary access={usageSnapshot.access} plan={usageSnapshot.plan} />
        </div>
      ) : null}
      {DASHBOARD_EXPERIENCES.map((experience) => {
        if (experience === 'expansion') {
          return (
            <ExpansionSection
              access={expansionAccess}
              ctaLabel={expansionCtaLabel}
              disabled={isPreviewMode ? false : checkingExperience === 'expansion' && !expansionAccess}
              key={experience}
              prompt={experiencePrompts.expansion ?? null}
              onClick={async () => {
                setCheckingExperience('expansion')
                setExperiencePrompts((currentValue) => ({
                  ...currentValue,
                  expansion: undefined,
                }))

                try {
                  const token = await getAuthToken()

                  if (!token) {
                    setExperiencePrompts((currentValue) => ({
                      ...currentValue,
                      expansion: 'Sign in before launching Expansion.',
                    }))
                    return
                  }

                  const response = await getPlaybackAccess('expansion', token)
                  updateExperienceAccess(response.access)

                  if (!response.access.allowed) {
                    setExperiencePrompts((currentValue) => ({
                      ...currentValue,
                      expansion:
                        effectivePlan === 'free'
                          ? 'You have used your Expansion preview time. Upgrade to continue.'
                          : 'Expansion access could not be verified right now.',
                    }))
                    return
                  }

                  startSession('expansion', sessionStartOptions)
                } catch (error) {
                  setExperiencePrompts((currentValue) => ({
                    ...currentValue,
                    expansion:
                      error instanceof Error ? error.message : 'Expansion access could not be verified right now.',
                  }))
                } finally {
                  setCheckingExperience(null)
                }
              }}
            />
          )
        }

        if (experience === 'premium') {
          return (
            <PremiumSection
              access={premiumAccess}
              ctaLabel={premiumCtaLabel}
              effectivePlan={effectivePlan}
              isChecking={isPreviewMode ? false : checkingExperience === 'premium' && !premiumAccess}
              key={experience}
              prompt={experiencePrompts.premium ?? null}
              trialAvailable={premiumTrialAvailable}
              onClick={async () => {
                setCheckingExperience('premium')
                setExperiencePrompts((currentValue) => ({
                  ...currentValue,
                  premium: undefined,
                }))

                try {
                  const token = await getAuthToken()

                  if (!token) {
                    setExperiencePrompts((currentValue) => ({
                      ...currentValue,
                      premium: 'Sign in before launching Premium.',
                    }))
                    return
                  }

                  const response = await getPlaybackAccess('premium', token)
                  updateExperienceAccess(response.access)

                  if (isPreviewMode && !previewPremiumAllowed && !premiumTrialAvailable) {
                    setExperiencePrompts((currentValue) => ({
                      ...currentValue,
                      premium: 'This preview plan does not unlock Premium. Upgrade to continue.',
                    }))
                    return
                  }

                  if (!response.access.allowed && !premiumTrialAvailable) {
                    setExperiencePrompts((currentValue) => ({
                      ...currentValue,
                      premium: 'Your Premium allowance is unavailable for this plan. Upgrade to continue.',
                    }))
                    return
                  }

                  startSession('premium', sessionStartOptions)
                } catch (error) {
                  setExperiencePrompts((currentValue) => ({
                    ...currentValue,
                    premium:
                      error instanceof Error
                        ? error.message
                        : 'Premium access could not be verified right now.',
                  }))
                } finally {
                  setCheckingExperience(null)
                }
              }}
            />
          )
        }

        return (
          <RegenSection
            access={regenAccess}
            ctaLabel={regenCtaLabel}
            effectivePlan={effectivePlan}
            isChecking={isPreviewMode ? false : checkingExperience === 'regen' && !regenAccess}
            key={experience}
            prompt={experiencePrompts.regen ?? null}
            trialAvailable={regenTrialAvailable}
            onClick={async () => {
              setCheckingExperience('regen')
              setExperiencePrompts((currentValue) => ({
                ...currentValue,
                regen: undefined,
              }))

              try {
                const token = await getAuthToken()

                if (!token) {
                  setExperiencePrompts((currentValue) => ({
                    ...currentValue,
                    regen: 'Sign in before launching REGEN.',
                  }))
                  return
                }

                const response = await getPlaybackAccess('regen', token)
                updateExperienceAccess(response.access)

                if (isPreviewMode && !previewRegenAllowed && !regenTrialAvailable) {
                  setExperiencePrompts((currentValue) => ({
                    ...currentValue,
                    regen: 'This preview plan does not unlock REGEN. Upgrade to continue.',
                  }))
                  return
                }

                if (!response.access.allowed && !regenTrialAvailable) {
                  setExperiencePrompts((currentValue) => ({
                    ...currentValue,
                    regen: 'Your REGEN allowance is unavailable for this plan. Upgrade to continue.',
                  }))
                  return
                }

                startSession('regen', sessionStartOptions)
              } catch (error) {
                setExperiencePrompts((currentValue) => ({
                  ...currentValue,
                  regen:
                    error instanceof Error ? error.message : 'REGEN access could not be verified right now.',
                }))
              } finally {
                setCheckingExperience(null)
              }
            }}
          />
        )
      })}
      <AmritaComingSoonSection />
    </div>
  )
}

function AmritaComingSoonSection() {
  return (
    <ExperienceSection
      bodyPrimary="AMRITA is the next RAYD8 environment in development, designed as a more elevated immersive field with a distinct visual atmosphere and deeper long-form session focus."
      ctaLabel="Coming late May 2026"
      ctaTone="disabled"
      id="amrita"
      onClick={() => {}}
      showcaseSubtitle="RAYD8 AMRITA"
      showcaseTitle="AMRITA Preview"
      tags={['Coming Soon', 'Cosmic Aurora', 'Member Preview']}
      title="AMRITA"
      tone="amrita"
    />
  )
}

function MemberAccountCluster({
  effectivePlan,
  user,
}: {
  effectivePlan: PlaybackPlan
  user: ReturnType<typeof useAuthUser>
}) {
  const planLabel = effectivePlan === 'free' ? 'FREE TRIAL' : effectivePlan.toUpperCase()

  return (
    <div className="absolute right-4 top-4 z-30 flex items-center gap-3 pointer-events-auto sm:right-6 sm:top-6">
      <div className="hidden rounded-[1.4rem] bg-[rgba(5,7,12,0.42)] px-4 py-3 text-right shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-2xl sm:block">
        <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-200/60">RAYD8® USER ACCOUNT</p>
        <p className="mt-2 text-sm font-medium text-white">{user.email}</p>
        <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
          {planLabel} {user.role === 'admin' ? '• admin' : ''}
        </p>
      </div>

      {user.role === 'admin' ? (
        <Link
          className="hidden rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl transition hover:bg-emerald-300/20 md:inline-flex"
          to="/admin"
        >
          Admin console
        </Link>
      ) : null}

      {clerkEnabled ? (
        <div className="flex items-center gap-2">
          <Show when="signed-in">
            <div className="rounded-full bg-[rgba(5,7,12,0.42)] p-1 shadow-[0_8px_30px_rgba(0,0,0,0.16)] backdrop-blur-2xl">
              <UserButton />
            </div>
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl transition hover:bg-emerald-300/20"
                type="button"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl transition hover:bg-white/10"
                type="button"
              >
                Sign up
              </button>
            </SignUpButton>
          </Show>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-amber-100">
          Demo mode
        </div>
      )}
    </div>
  )
}

function ExpansionSection({
  access,
  ctaLabel,
  disabled = false,
  onClick,
  prompt,
}: {
  access: ExperienceAccessSummary | null
  ctaLabel: string
  disabled?: boolean
  onClick: () => Promise<void>
  prompt: string | null
}) {
  const sectionNote = prompt
    ? prompt
    : access?.limitSeconds
      ? 'Free Trial members can explore Expansion for up to 33 hours.'
      : null

  return (
    <ExperienceSection
      bodyPrimary="RAYD8®: Expansion works with Scalar waves & negative ion frequencies to generate relaxation and cellular charge."
      bodySecondary="Light version of RAYD8® technology. Long term usage encourages aligning to deeper brainwave states: alpha, theta, and delta frequencies."
      ctaLabel={ctaLabel}
      ctaTone={access?.allowed ?? true ? 'active' : 'secondary'}
      disabled={disabled}
      id="expansion"
      imageAlt="RAYD8® Expansion display"
      imageSrc="/rayd8-expansion.png"
      onClick={() => void onClick()}
      sectionNote={sectionNote}
      sectionNoteTone={prompt ? 'warning' : 'muted'}
      showcaseSubtitle="Illuminated resonance field"
      showcaseTitle="Expansion Display"
      tags={['Light Version', 'Shared Audio', 'Fullscreen']}
      title="RAYD8® Expansion"
      tone="expansion"
    />
  )
}

function PremiumSection({
  access,
  ctaLabel,
  effectivePlan,
  isChecking,
  onClick,
  prompt,
  trialAvailable,
}: {
  access: ExperienceAccessSummary | null
  ctaLabel: string
  effectivePlan: PlaybackPlan
  isChecking: boolean
  onClick: () => Promise<void>
  prompt: string | null
  trialAvailable: boolean
}) {
  const sectionNote = prompt
    ? prompt
    : effectivePlan === 'free'
      ? 'Free Trial members can sample Premium for one hour.'
      : null

  return (
    <ExperienceSection
      bodyPrimary="RAYD8®: Premium utilizes scalar waves, 15-color ray rejuvenating frequencies, negative ion rejuvenation, schumann resonance, prana rejuvenation."
      bodySecondary="Long term usage of RAYD8®: Premium encourages deeper sleep states, purifying environmental energies, cellular rejuvenation & aligning to deeper brainwave states: alpha, theta, and delta frequencies."
      ctaLabel={ctaLabel}
      ctaTone={access?.allowed || trialAvailable ? 'active' : 'secondary'}
      disabled={isChecking}
      id="premium"
      imageAlt="RAYD8® Premium display"
      imageSrc="/rayd8-premium.png"
      onClick={() => void onClick()}
      sectionNote={sectionNote}
      sectionNoteTone={prompt ? 'warning' : 'muted'}
      showcaseSubtitle="Richer tonal depth"
      showcaseTitle="Premium Display"
      tags={['15-Color-Array', 'Shared Audio', 'Fullscreen']}
      title="RAYD8® Premium"
      tone="premium"
    />
  )
}

function RegenSection({
  access,
  ctaLabel,
  effectivePlan,
  isChecking,
  onClick,
  prompt,
  trialAvailable,
}: {
  access: ExperienceAccessSummary | null
  ctaLabel: string
  effectivePlan: PlaybackPlan
  isChecking: boolean
  onClick: () => Promise<void>
  prompt: string | null
  trialAvailable: boolean
}) {
  const sectionNote = prompt
    ? prompt
    : effectivePlan === 'free'
      ? 'Free Trial members can sample REGEN for one hour.'
      : null

  return (
    <ExperienceSection
      bodyPrimary="RAYD8®: REGEN utilizes scalar waves, 15-color ray rejuvenating frequencies, blood circulation improvement, alkaline improvement, benefic astrological balancing, full body optimization."
      bodySecondary="Long term usage of RAYD8®: REGEN operates best with a double-screen mirroring setup for greater amplification. Also improves blood circulation, cellular rejuvenation, releasing stagnancy from cells, purifying environmental energies, removes stagnant bodily blockages, aligns deeper brainwave states."
      ctaLabel={ctaLabel}
      ctaTone={access?.allowed || trialAvailable ? 'active' : 'secondary'}
      disabled={isChecking}
      id="regen"
      imageAlt="RAYD8® REGEN display"
      imageSrc="/rayd8-regen.png"
      onClick={() => void onClick()}
      sectionNote={sectionNote}
      sectionNoteTone={prompt ? 'warning' : 'muted'}
      showcaseSubtitle="Focused green spectral field"
      showcaseTitle="REGEN Display"
      tags={['Full Spectrum Array', 'Shared Audio', 'Fullscreen']}
      title="RAYD8® REGEN"
      tone="regen"
    />
  )
}

function ExperienceSection({
  bodyPrimary,
  bodySecondary = '',
  ctaLabel,
  ctaTone,
  disabled = false,
  id,
  imageAlt,
  imageSrc,
  onClick,
  sectionNote,
  sectionNoteTone = 'muted',
  showcaseSubtitle,
  showcaseTitle,
  tags,
  title,
  tone,
}: {
  bodyPrimary: string
  bodySecondary?: string
  ctaLabel: string
  ctaTone: 'active' | 'disabled' | 'secondary'
  disabled?: boolean
  id: string
  imageAlt?: string
  imageSrc?: string
  onClick: () => void
  sectionNote?: string | null
  sectionNoteTone?: 'muted' | 'warning'
  showcaseSubtitle: string
  showcaseTitle: string
  tags: string[]
  title: string
  tone: SectionTone
}) {
  return (
    <SectionLayout
      background={<SectionBackground tone={tone} />}
      id={id}
    >
      <div className="max-w-7xl mx-auto w-full px-6 sm:px-8 lg:px-12">
        <div className="mb-10 flex items-center justify-between gap-6">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl xl:text-[3.5rem]">
            {title}
          </h1>
          <SectionCtaButton
            disabled={disabled}
            label={ctaLabel}
            onClick={onClick}
            tone={ctaTone}
          />
        </div>

        <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,720px)_minmax(0,520px)] lg:gap-16">
          <ExperienceShowcase
            imageAlt={imageAlt}
            imageSrc={imageSrc}
            subtitle={showcaseSubtitle}
            title={showcaseTitle}
            tone={tone}
          />
          <ExperienceBody
            primary={bodyPrimary}
            secondary={bodySecondary}
            tags={tags}
            tone={sectionNoteTone}
            note={sectionNote}
          />
        </div>
      </div>
    </SectionLayout>
  )
}

function SectionCtaButton({
  disabled = false,
  label,
  onClick,
  tone,
}: {
  disabled?: boolean
  label: string
  onClick: () => void
  tone: 'active' | 'disabled' | 'secondary'
}) {
  const toneClasses =
    tone === 'disabled'
      ? 'bg-white/10 text-white/50 cursor-not-allowed'
      : tone === 'secondary'
        ? 'bg-white/10 text-white hover:bg-white/16 hover:shadow-[0_0_24px_rgba(255,255,255,0.08)]'
        : 'bg-emerald-500/90 text-white hover:bg-emerald-400 hover:shadow-[0_0_28px_rgba(16,185,129,0.28)]'

  return (
    <button
      className={[
        'shrink-0 rounded-full px-6 py-3 text-sm font-medium transition-all duration-300',
        disabled && tone !== 'disabled' ? 'cursor-wait opacity-70' : '',
        toneClasses,
      ].join(' ')}
      disabled={disabled || tone === 'disabled'}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function ExperienceBody({
  note,
  primary,
  secondary = '',
  tags,
  tone,
}: {
  note?: string | null
  primary: string
  secondary?: string
  tags: string[]
  tone: 'muted' | 'warning'
}) {
  const hasSecondary = secondary.trim().length > 0

  return (
    <div className="flex max-w-[520px] flex-col gap-8">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <FeatureTag key={tag}>{tag}</FeatureTag>
        ))}
      </div>

      <div className="border-t border-white/10 pt-6">
        <p className="text-base leading-8 text-white/82">{primary}</p>
      </div>

      {hasSecondary || note ? (
        <div className="border-t border-white/10 pt-6">
          {hasSecondary ? (
            <p className="text-base leading-8 text-white/72">{secondary}</p>
          ) : null}
          {note ? (
            <p
              className={[
                hasSecondary ? 'mt-4' : '',
                'text-sm leading-6',
                tone === 'warning' ? 'text-amber-100' : 'text-white/58',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {note}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SectionLayout({
  background,
  children,
  id,
}: {
  background: ReactNode
  children: ReactNode
  id: string
}) {
  return (
    <section className="relative min-h-screen overflow-hidden transition-opacity duration-500" id={id}>
      <div className="absolute inset-0">{background}</div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/22 to-black/38" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/14 via-transparent to-black/42" />
      <div className="relative z-10 flex min-h-screen items-center pb-20 pt-28 lg:pt-32">
        {children}
      </div>
    </section>
  )
}

function SectionBackground({ tone }: { tone: SectionTone }) {
  const toneClasses: Record<SectionTone, string> = {
    amrita:
      'bg-[radial-gradient(circle_at_18%_24%,rgba(34,211,238,0.22),transparent_26%),radial-gradient(circle_at_74%_20%,rgba(168,85,247,0.26),transparent_28%),radial-gradient(circle_at_62%_72%,rgba(16,185,129,0.18),transparent_30%),linear-gradient(180deg,#02040a_0%,#090d1b_48%,#05070d_100%)]',
    expansion:
      'bg-[radial-gradient(circle_at_72%_22%,rgba(59,130,246,0.34),transparent_26%),radial-gradient(circle_at_18%_78%,rgba(14,165,233,0.18),transparent_34%),linear-gradient(180deg,#03060b_0%,#09101a_100%)]',
    premium:
      'bg-[radial-gradient(circle_at_70%_20%,rgba(124,58,237,0.38),transparent_26%),radial-gradient(circle_at_24%_78%,rgba(168,85,247,0.22),transparent_36%),linear-gradient(180deg,#03040a_0%,#11081b_100%)]',
    regen:
      'bg-[radial-gradient(circle_at_72%_22%,rgba(34,197,94,0.36),transparent_26%),radial-gradient(circle_at_22%_78%,rgba(16,185,129,0.2),transparent_36%),linear-gradient(180deg,#020604_0%,#07120b_100%)]',
  }

  return (
    <div className="absolute inset-0">
      <div className={`absolute inset-0 ${toneClasses[tone]}`} />
      <div className="absolute -right-20 top-[18%] h-80 w-80 rounded-full bg-white/10 blur-[150px]" />
      <div className="absolute left-[8%] top-[62%] h-64 w-64 rounded-full bg-white/6 blur-[150px]" />
      <div className="absolute bottom-0 left-0 h-40 w-full bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  )
}

function ExperienceShowcase({
  imageAlt,
  imageSrc,
  subtitle,
  title,
  tone,
}: {
  imageAlt?: string
  imageSrc?: string
  subtitle: string
  title: string
  tone: Exclude<SectionTone, never>
}) {
  const toneGlowClasses: Record<SectionTone, string> = {
    amrita:
      'before:bg-[radial-gradient(circle_at_50%_50%,rgba(129,140,248,0.42),transparent_62%)] after:border-cyan-200/30',
    expansion:
      'before:bg-[radial-gradient(circle_at_50%_50%,rgba(96,165,250,0.54),transparent_62%)] after:border-sky-200/35',
    premium:
      'before:bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.5),transparent_62%)] after:border-violet-200/35',
    regen:
      'before:bg-[radial-gradient(circle_at_50%_50%,rgba(74,222,128,0.5),transparent_62%)] after:border-emerald-200/35',
  }

  return (
    <div className="relative w-full max-w-[720px]">
      <div
        className={[
          'relative aspect-video overflow-hidden rounded-2xl bg-black/16 shadow-[0_0_40px_rgba(0,0,0,0.6)] ring-1 ring-white/10',
          'before:pointer-events-none before:absolute before:-inset-10 before:opacity-100 before:blur-3xl',
          'after:pointer-events-none after:absolute after:inset-[1px] after:rounded-[15px] after:border',
          toneGlowClasses[tone],
        ].join(' ')}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-white/5" />
        {imageSrc ? (
          <img
            alt={imageAlt ?? title}
            className="relative z-10 h-full w-full object-cover"
            src={imageSrc}
          />
        ) : tone === 'amrita' ? (
          <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_25%,rgba(34,211,238,0.18),transparent_22%),radial-gradient(circle_at_72%_28%,rgba(168,85,247,0.22),transparent_26%),radial-gradient(circle_at_50%_78%,rgba(16,185,129,0.18),transparent_28%),linear-gradient(135deg,rgba(6,10,20,0.96),rgba(10,20,36,0.92))]">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)] opacity-80" />
            <div className="absolute left-[12%] top-[20%] h-28 w-28 rounded-full bg-cyan-300/15 blur-3xl" />
            <div className="absolute right-[10%] top-[18%] h-32 w-32 rounded-full bg-violet-300/18 blur-3xl" />
            <div className="absolute bottom-[14%] left-[30%] h-24 w-36 rounded-full bg-emerald-300/14 blur-3xl" />
            <div className="relative z-10 rounded-[1.6rem] border border-white/12 bg-white/[0.04] px-8 py-10 text-center shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">
              <p className="text-[11px] uppercase tracking-[0.34em] text-cyan-100/65">Coming late May 2026</p>
              <p className="mt-5 text-3xl font-semibold tracking-[0.24em] text-white sm:text-4xl">
                RAYD8 AMRITA
              </p>
            </div>
          </div>
        ) : (
          <div className="relative z-10 h-full w-full bg-gradient-to-br from-white/10 via-transparent to-white/5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_22%,rgba(255,255,255,0.16),transparent_18%),radial-gradient(circle_at_72%_38%,rgba(255,255,255,0.08),transparent_26%)]" />
            <div className="absolute left-[8%] top-[18%] h-24 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-[14%] right-[10%] h-28 w-56 rounded-full bg-white/8 blur-3xl" />
            <div className="absolute inset-x-[14%] bottom-[16%] h-px bg-white/20" />
            <div className="absolute inset-x-[18%] top-[34%] h-px bg-white/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/26 via-transparent to-transparent" />
        <div className="absolute left-5 top-5 z-20 text-[10px] uppercase tracking-[0.32em] text-white/58">
          {title}
        </div>
        <div className="absolute bottom-5 left-5 z-20 max-w-[14rem] text-sm text-white/82">
          {subtitle}
        </div>
      </div>
    </div>
  )
}

function FeatureTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/70 backdrop-blur-sm">
      {children}
    </span>
  )
}

function DashboardUsageSummary({
  access,
  plan,
}: {
  access: UsageResponse['access']
  plan: UsageResponse['plan']
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-[rgba(5,7,12,0.68)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:p-5">
      <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-200/60">Usage Summary</p>
      {plan === 'free' ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(['expansion', 'premium', 'regen'] as const).map((experience) => {
            const summary = access[experience]

            return (
              <div
                className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-3"
                key={experience}
              >
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">
                  {experience === 'regen' ? 'REGEN' : experience}
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {formatRuntimeClock(summary.usedSeconds)} / {formatRuntimeLimit(summary.limitSeconds)}
                </p>
                <p className="mt-1 text-xs text-white/55">{formatUsagePercent(summary.usagePercent)}</p>
                <p className="mt-1 text-xs text-white/55">
                  {summary.isBlocked
                    ? 'Preview used'
                    : `${formatRuntimeClock(summary.remainingSeconds)} remaining`}
                </p>
              </div>
            )
          })}
        </div>
      ) : plan === 'regen' ? (
        <div className="mt-4 rounded-[1.2rem] border border-emerald-300/10 bg-emerald-300/[0.04] px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-100/65">
                REGEN Monthly Pool
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatRuntimeClock(access.regen.usedSeconds)} / {formatRuntimeLimit(access.regen.limitSeconds)}
              </p>
            </div>
            <p className="text-sm text-white/60">
              {access.regen.isBlocked
                ? 'Monthly limit reached'
                : `${formatRuntimeClock(access.regen.remainingSeconds)} remaining this cycle`}
            </p>
          </div>
          <p className="mt-3 text-xs text-emerald-100/65">{formatUsagePercent(access.regen.usagePercent)}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(52,211,153,0.85),rgba(16,185,129,1))]"
              style={{ width: `${Math.min(100, access.regen.usagePercent ?? 0)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
