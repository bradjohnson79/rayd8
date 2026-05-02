import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuthToken } from '../features/dashboard/useAuthToken'
import { getReferralSummary, type ReferralSummary } from '../services/referrals'
import { trackUmamiEvent } from '../services/umami'

function formatUsdCents(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value / 100)
}

function formatDateShort(value: string | null) {
  if (!value) {
    return 'Not available yet'
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface AccordionProps {
  children: ReactNode
  title: string
}

function Accordion({ children, title }: AccordionProps) {
  const [open, setOpen] = useState(false)

  return (
    <section className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
      <button
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/60">Affiliate tools</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
        </div>
        <span className="text-sm font-medium text-slate-300">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open ? <div className="border-t border-white/8 px-5 py-5 sm:px-6">{children}</div> : null}
    </section>
  )
}

interface CopyBlockProps {
  copied: boolean
  label: string
  onCopy: () => Promise<void> | void
  text: string
}

function CopyBlock({ copied, label, onCopy, text }: CopyBlockProps) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
        </div>
        <button
          className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.08] sm:w-auto"
          onClick={() => void onCopy()}
          type="button"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <pre className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-200 [font-family:inherit]">
        {text}
      </pre>
    </article>
  )
}

interface PromoAsset {
  alt: string
  label: string
  path: string
}

export function AffiliatePage() {
  const getAuthToken = useAuthToken()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAsset, setSelectedAsset] = useState<PromoAsset | null>(null)
  const [summary, setSummary] = useState<ReferralSummary | null>(null)
  const hasTrackedDashboardViewRef = useRef(false)
  const hasTrackedPayoutInfoRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for affiliate summary.')
        }

        const response = await getReferralSummary(token)

        if (!cancelled) {
          setSummary(response.summary)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load affiliate data.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSummary()

    return () => {
      cancelled = true
    }
  }, [getAuthToken])

  useEffect(() => {
    if (hasTrackedDashboardViewRef.current) {
      return
    }

    trackUmamiEvent('affiliate_dashboard_view', { scope: 'member' })
    hasTrackedDashboardViewRef.current = true
  }, [])

  useEffect(() => {
    if (!summary || hasTrackedPayoutInfoRef.current) {
      return
    }

    trackUmamiEvent('affiliate_payout_info_view', {
      payoutEligible: summary.payoutEligible,
      pendingBalanceUsd: summary.pendingBalanceUsd,
    })
    hasTrackedPayoutInfoRef.current = true
  }, [summary])

  const statCards = useMemo(() => {
    if (!summary) {
      return []
    }

    return [
      { label: 'Total referrals', value: String(summary.referralCount) },
      { label: 'Total earned', value: formatUsdCents(summary.totalEarnedUsd) },
      { label: 'Approved', value: formatUsdCents(summary.approvedAmountUsd) },
      { label: 'Pending', value: formatUsdCents(summary.pendingAmountUsd) },
      { label: 'Paid', value: formatUsdCents(summary.paidAmountUsd) },
    ]
  }, [summary])

  const promotionBlurbs = useMemo(() => {
    const referralLink = summary?.referralLink ?? '{REFERRAL_LINK}'

    return [
      {
        key: 'blurb-short',
        label: 'Quick blurb: Short social post',
        text: `Discover RAYD8 — a next-level digital wellness system designed to support your body's natural regeneration through advanced light and frequency technology.

Try it here:
${referralLink}`,
      },
      {
        key: 'blurb-medium',
        label: 'Quick blurb: Email or post',
        text: `I've been exploring RAYD8, a digital wellness system that uses scalar-based light and frequency technology to support relaxation and cellular charge.

They've just launched their new platform with multiple experience levels and features like night mode, circadian rhythm alignment, and amplification settings.

You can try the free trial here:
${referralLink}`,
      },
      {
        key: 'blurb-long',
        label: 'Quick blurb: Newsletter or video description',
        text: `RAYD8 is a next-level digital wellness platform designed to support the body's natural regenerative state through advanced light and frequency technology.

The system includes multiple modes (Expansion, Premium, and REGEN), along with features like amplification borders, circadian rhythm tuning, night mode, and anti-blue light filtering.

A free trial is available, and the full REGEN experience offers extended access for deeper sessions.

Explore it here:
${referralLink}`,
      },
    ]
  }, [summary?.referralLink])

  const promoAssets = useMemo<PromoAsset[]>(
    () => [
      {
        alt: 'RAYD8 affiliate promo 16 by 9',
        label: 'Promo asset 16:9',
        path: '/affiliate/RAYD8-Affiliate-Promo-1.png',
      },
      {
        alt: 'RAYD8 affiliate promo square',
        label: 'Promo asset 1:1',
        path: '/affiliate/RAYD8-Affiliate-Promo-1-Square.png',
      },
    ],
    [],
  )
  const payoutStatusMessage = useMemo(() => {
    if (!summary) {
      return null
    }

    if (summary.payoutEligible) {
      return `You are eligible for the next payout.`
    }

    return `You need ${formatUsdCents(summary.amountUntilPayoutThresholdUsd)} more to reach the payout threshold.`
  }, [summary])

  async function handleCopy(key: string, text: string) {
    if (!text || text.includes('{REFERRAL_LINK}')) {
      return
    }

    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current))
    }, 1600)
  }

  return (
    <>
      <section className="h-full overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(59,130,246,0.08),rgba(88,28,135,0.12))] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Payout Information</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Know when your affiliate earnings get paid.</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-2 text-sm leading-7 text-slate-300">
              <p>Minimum payout threshold is {formatUsdCents(summary?.payoutThresholdUsd ?? 5000)} USD.</p>
              <p>Earnings are calculated monthly.</p>
              <p>Cutoff is the last day of each month.</p>
              <p>Payments are sent within the first week of the next month.</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Payout status</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {loading ? 'Loading payout status...' : payoutStatusMessage}
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p>Pending balance: {formatUsdCents(summary?.pendingBalanceUsd ?? 0)}</p>
                <p>Next payout date: {formatDateShort(summary?.nextPayoutDate ?? null)}</p>
                <p>Last payout date: {formatDateShort(summary?.lastPayoutDate ?? null)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Affiliate</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Share your link. Get paid.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            Earn $6.00 USD for every successful REGEN signup using your link.
          </p>

          {error ? (
            <div className="mt-6 rounded-[1.5rem] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="mt-6 rounded-[1.75rem] border border-white/12 bg-black/20 p-4 sm:p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Referral link</p>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1 rounded-[1.25rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-100">
                {loading ? 'Loading your link...' : summary?.referralLink ?? 'No referral link available yet.'}
              </div>
              <button
                className="inline-flex w-full items-center justify-center rounded-full border border-emerald-100/40 bg-[linear-gradient(135deg,rgba(167,243,208,0.96),rgba(52,211,153,0.9))] px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(16,185,129,0.22)] transition hover:brightness-105 lg:w-auto"
                disabled={loading || !summary?.referralLink}
                onClick={() => void handleCopy('referral-link', summary?.referralLink ?? '')}
                type="button"
              >
                {copiedKey === 'referral-link' ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {loading
            ? Array.from({ length: 5 }, (_, index) => (
                <div
                  className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400"
                  key={index}
                >
                  Loading...
                </div>
              ))
            : statCards.map((card) => (
                <article
                  className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
                  key={card.label}
                >
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-500">{card.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
                </article>
              ))}
        </div>
          <Accordion title="Promotion Toolkit">
            <div className="space-y-8">
              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Quick Copy Blurbs</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Use these ready-made messages as a starting point, then personalize them if you want.
                  </p>
                </div>

                <div className="space-y-4">
                  {promotionBlurbs.map((blurb) => (
                    <CopyBlock
                      copied={copiedKey === blurb.key}
                      key={blurb.key}
                      label={blurb.label}
                      onCopy={() => handleCopy(blurb.key, blurb.text)}
                      text={blurb.text}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Promo Assets</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Click a thumbnail to enlarge it, then download the version you want to share.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {promoAssets.map((asset) => (
                    <button
                      className="group overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20 text-left shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition hover:border-emerald-200/25"
                      key={asset.path}
                      onClick={() => setSelectedAsset(asset)}
                      type="button"
                    >
                      <img
                        alt={asset.alt}
                        className="h-40 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        src={asset.path}
                      />
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-sm font-medium text-white">{asset.label}</span>
                        <span className="text-xs uppercase tracking-[0.22em] text-emerald-200/70">
                          Click to enlarge
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 sm:p-5">
                <h3 className="text-lg font-semibold text-white">Tips for Best Results</h3>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                  <li>Keep your message simple and curious.</li>
                  <li>Share your personal experience if possible.</li>
                  <li>Use video or screen recordings when you can.</li>
                  <li>Avoid over-explaining. Let people explore.</li>
                </ul>
              </section>
            </div>
          </Accordion>
        </div>
      </section>

      {selectedAsset ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 px-4 py-6 backdrop-blur-sm sm:px-6">
          <div className="w-full max-w-5xl rounded-[1.8rem] border border-white/12 bg-[rgb(8,12,20)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-emerald-200/60">Promo asset</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{selectedAsset.label}</h3>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  className="inline-flex items-center justify-center rounded-full border border-emerald-100/40 bg-[linear-gradient(135deg,rgba(167,243,208,0.96),rgba(52,211,153,0.9))] px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(16,185,129,0.22)] transition hover:brightness-105"
                  download
                  href={selectedAsset.path}
                >
                  Download
                </a>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                  onClick={() => setSelectedAsset(null)}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/30">
              <img
                alt={selectedAsset.alt}
                className="max-h-[75vh] w-full object-contain"
                src={selectedAsset.path}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
