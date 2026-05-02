import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import {
  downloadAdminAffiliateCsv,
  getAdminAffiliateCommissions,
  getAdminAffiliateSummary,
  getAdminTopAffiliates,
  markAdminAffiliateCommissionsPaid,
  type AdminAffiliateCommissionRecord,
  type AdminAffiliateSummaryResponse,
  type AdminAffiliateTopRecord,
  type AffiliateCommissionStatus,
} from '../../../services/admin'
import { trackUmamiEvent } from '../../../services/umami'

function formatUsdCents(value: number) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency',
  }).format(value / 100)
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not paid'
}

function formatDateShort(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getLeaderboardBadge(status: AdminAffiliateTopRecord['status']) {
  if (status === 'top_performer') {
    return {
      className: 'border-emerald-200/30 bg-emerald-300/12 text-emerald-100',
      label: 'Top Performer',
    }
  }

  if (status === 'rising') {
    return {
      className: 'border-violet-300/25 bg-violet-300/12 text-violet-100',
      label: 'Rising',
    }
  }

  return {
    className: 'border-white/10 bg-white/[0.05] text-slate-100',
    label: 'Active',
  }
}

function getTrackingHealthBadge(status: AdminAffiliateSummaryResponse['tracking']['health']['status']) {
  if (status === 'green') {
    return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
  }

  if (status === 'yellow') {
    return 'border-amber-300/25 bg-amber-300/10 text-amber-100'
  }

  return 'border-rose-300/25 bg-rose-300/10 text-rose-100'
}

function getVerificationResultBadge(
  result: AdminAffiliateSummaryResponse['tracking']['lastVerifiedAffiliateFlow']['result'],
) {
  if (result === 'success') {
    return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
  }

  if (result === 'warning') {
    return 'border-amber-300/25 bg-amber-300/10 text-amber-100'
  }

  return 'border-rose-300/25 bg-rose-300/10 text-rose-100'
}

type FilterStatus = 'all' | AffiliateCommissionStatus

const statusOptions: FilterStatus[] = ['all', 'approved', 'paid', 'pending']

export function AdminAffiliatesPage() {
  const getAuthToken = useAuthToken()
  const [commissions, setCommissions] = useState<AdminAffiliateCommissionRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [summary, setSummary] = useState<AdminAffiliateSummaryResponse | null>(null)
  const [topAffiliates, setTopAffiliates] = useState<AdminAffiliateTopRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const hasTrackedViewRef = useRef(false)
  const [filters, setFilters] = useState<{
    endAt: string
    startAt: string
    status: FilterStatus
  }>({
    endAt: '',
    startAt: '',
    status: 'all',
  })

  useEffect(() => {
    let cancelled = false

    async function loadAffiliateData() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for affiliate admin data.')
        }

        const [summaryResponse, topResponse, commissionsResponse] = await Promise.all([
          getAdminAffiliateSummary(token),
          getAdminTopAffiliates(token),
          getAdminAffiliateCommissions(token, filters),
        ])

        if (!cancelled) {
          setSummary(summaryResponse)
          setTopAffiliates(topResponse.affiliates)
          setCommissions(commissionsResponse.commissions)
          setSelectedIds((currentSelection) =>
            currentSelection.filter((commissionId) =>
              commissionsResponse.commissions.some((commission) => commission.id === commissionId),
            ),
          )
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load affiliate admin data.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAffiliateData()

    return () => {
      cancelled = true
    }
  }, [filters, getAuthToken])

  useEffect(() => {
    if (hasTrackedViewRef.current) {
      return
    }

    trackUmamiEvent('affiliate_dashboard_view', { scope: 'admin' })
    hasTrackedViewRef.current = true
  }, [])

  const selectedPayoutAmount = useMemo(
    () =>
      commissions
        .filter((commission) => selectedIds.includes(commission.id) && commission.status !== 'paid')
        .reduce((total, commission) => total + commission.amountUsd, 0),
    [commissions, selectedIds],
  )

  const selectableOpenCommissions = useMemo(
    () => commissions.filter((commission) => commission.status !== 'paid'),
    [commissions],
  )

  function toggleSelection(commissionId: string) {
    setSelectedIds((currentSelection) =>
      currentSelection.includes(commissionId)
        ? currentSelection.filter((id) => id !== commissionId)
        : [...currentSelection, commissionId],
    )
  }

  async function handleMarkPaid() {
    if (selectedIds.length === 0) {
      return
    }

    setMarkingPaid(true)
    setError(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for payout update.')
      }

      const response = await markAdminAffiliateCommissionsPaid(selectedIds, token)
      setCommissions(response.commissions)
      setSelectedIds([])
      setSummary((currentSummary) =>
        currentSummary
          ? {
              ...currentSummary,
              cards: {
                ...currentSummary.cards,
                totalCommissionsOwedUsd: Math.max(
                  currentSummary.cards.totalCommissionsOwedUsd - response.totalPayoutAmountUsd,
                  0,
                ),
                totalPaidOutUsd: currentSummary.cards.totalPaidOutUsd + response.totalPayoutAmountUsd,
              },
            }
          : currentSummary,
      )
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to mark commissions as paid.')
    } finally {
      setMarkingPaid(false)
    }
  }

  async function handleExportCsv() {
    setExporting(true)
    setError(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for CSV export.')
      }

      const blob = await downloadAdminAffiliateCsv(token, filters)
      const blobUrl = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = 'affiliate-commissions.csv'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to export affiliate CSV.')
    } finally {
      setExporting(false)
    }
  }

  const summaryCards = [
    {
      label: 'Total Affiliate Revenue Generated',
      value: formatUsdCents(summary?.cards.totalAffiliateRevenueGeneratedUsd ?? 0),
    },
    {
      label: 'Total Commissions Owed (Pending)',
      value: formatUsdCents(summary?.cards.totalCommissionsOwedUsd ?? 0),
    },
    {
      label: 'Total Paid Out (All Time)',
      value: formatUsdCents(summary?.cards.totalPaidOutUsd ?? 0),
    },
    {
      label: 'Next Payout Date',
      value: summary?.cards.nextPayoutDate ? formatDateShort(summary.cards.nextPayoutDate) : '...',
    },
  ]
  const payoutIsSoon = (summary?.payoutSchedule.daysUntilNextPayout ?? 999) < 7
  const trackingCards = [
    {
      eyebrow: 'Tracking Health',
      value: summary?.tracking.health.label ?? '...',
      detail: summary?.tracking.health.message ?? 'Checking affiliate instrumentation...',
      toneClassName: getTrackingHealthBadge(summary?.tracking.health.status ?? 'yellow'),
    },
    {
      eyebrow: 'Stripe Sync Integrity',
      value: `${summary?.tracking.stripeSyncIntegrity.metadataCoverageRate ?? 0}%`,
      detail: `${summary?.tracking.stripeSyncIntegrity.attributedPayments ?? 0} attributed of ${summary?.tracking.stripeSyncIntegrity.totalTrackedPayments ?? 0} tracked payments. Commission creation rate: ${summary?.tracking.stripeSyncIntegrity.commissionCreationRate ?? 0}%.`,
      toneClassName: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
    },
    {
      eyebrow: 'Last Verified Affiliate Flow',
      value: summary?.tracking.lastVerifiedAffiliateFlow.verifiedAt
        ? formatDate(summary.tracking.lastVerifiedAffiliateFlow.verifiedAt)
        : 'Not verified yet',
      detail: summary?.tracking.lastVerifiedAffiliateFlow.message ?? 'No validation run has been recorded yet.',
      toneClassName: getVerificationResultBadge(
        summary?.tracking.lastVerifiedAffiliateFlow.result ?? 'warning',
      ),
    },
  ]

  return (
    <AdminPageShell
      description="Track affiliate performance, review commission payout status, and export commission history without leaving the admin console."
      eyebrow="Admin tools"
      title="Affiliates"
      aside={
        <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.28em] text-violet-200/60">Payout preview</p>
          <p className="text-3xl font-semibold text-white">{formatUsdCents(selectedPayoutAmount)}</p>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
            {selectedIds.length} selected commission{selectedIds.length === 1 ? '' : 's'}
          </p>
          <button
            className="inline-flex w-full items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedIds.length === 0 || markingPaid}
            onClick={() => void handleMarkPaid()}
            type="button"
          >
            {markingPaid ? 'Marking paid...' : 'Mark Selected Paid'}
          </button>
          <button
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={exporting}
            onClick={() => void handleExportCsv()}
            type="button"
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      }
    >
      {error ? (
        <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            className="rounded-[1.6rem] border border-white/12 bg-white/[0.045] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
            key={card.label}
          >
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? '...' : card.value}</p>
          </div>
        ))}
      </div>

      <div
        className={[
          'rounded-[1.75rem] border p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl',
          payoutIsSoon
            ? 'border-emerald-200/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(88,28,135,0.18))] shadow-[0_20px_65px_rgba(16,185,129,0.12)]'
            : 'border-white/12 bg-white/[0.045]',
        ].join(' ')}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-violet-200/60">Affiliate payout schedule</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Affiliate Payout Schedule</h2>
            <div className="mt-4 space-y-2 text-sm leading-7 text-slate-300">
              <p>Minimum payout threshold: {formatUsdCents(summary?.payoutSchedule.minimumPayoutThresholdUsd ?? 5000)} USD</p>
              <p>Cutoff date: {summary?.payoutSchedule.cutoffDate ? formatDateShort(summary.payoutSchedule.cutoffDate) : '...'}</p>
              <p>Payout window: {summary?.payoutSchedule.payoutWindowLabel ?? 'First week of the following month'}</p>
            </div>
          </div>

          <div
            className={[
              'rounded-[1.5rem] border px-5 py-4 text-center lg:min-w-[15rem]',
              payoutIsSoon
                ? 'border-emerald-200/28 bg-emerald-300/10 shadow-[0_0_32px_rgba(16,185,129,0.12)]'
                : 'border-white/10 bg-black/20',
            ].join(' ')}
          >
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Countdown</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {summary?.payoutSchedule.daysUntilNextPayout ?? '...'}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Next payout in {summary?.payoutSchedule.daysUntilNextPayout ?? '...'} days
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {trackingCards.map((card) => (
          <div
            className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
            key={card.eyebrow}
          >
            <div
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] ${card.toneClassName}`}
            >
              {card.eyebrow}
            </div>
            <p className="mt-4 text-2xl font-semibold text-white">{loading ? '...' : card.value}</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{card.detail}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Filters</h2>
            <p className="mt-1 text-sm text-slate-400">Filter commission activity by date range and status.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-slate-300">
              <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">Start</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-violet-300/40"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    startAt: event.target.value,
                  }))
                }
                type="date"
                value={filters.startAt}
              />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">End</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-violet-300/40"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    endAt: event.target.value,
                  }))
                }
                type="date"
                value={filters.endAt}
              />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">Status</span>
              <select
                className="w-full rounded-2xl border border-white/10 bg-[rgb(10,14,20)] px-4 py-3 text-white outline-none transition focus:border-violet-300/40"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as FilterStatus,
                  }))
                }
                value={filters.status}
              >
                {statusOptions.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption === 'all' ? 'All statuses' : statusOption}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,1.3fr]">
        <section className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Top 10 Affiliate Leaderboard</h2>
              <p className="mt-1 text-sm text-slate-400">Sorted by total earnings to spotlight your strongest promoters.</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase tracking-[0.22em] text-slate-500">
                <tr>
                  <th className="pb-3">Rank</th>
                  <th className="pb-3">Affiliate</th>
                  <th className="pb-3">Total referrals</th>
                  <th className="pb-3">Total earned</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="py-4 text-slate-400" colSpan={5}>
                      Loading affiliate leaderboard...
                    </td>
                  </tr>
                ) : topAffiliates.length ? (
                  topAffiliates.map((affiliate) => {
                    const badge = getLeaderboardBadge(affiliate.status)

                    return (
                      <tr className="border-t border-white/8" key={affiliate.id}>
                        <td className="py-4 pr-4 text-lg font-semibold text-white">#{affiliate.rank}</td>
                        <td className="py-4 pr-4">
                          <div className="font-medium text-white">{affiliate.maskedEmail}</div>
                          <div className="text-xs text-slate-500">
                            Paid: {formatUsdCents(affiliate.totalPaidUsd)}
                          </div>
                        </td>
                        <td className="py-4 pr-4">{affiliate.totalReferrals}</td>
                        <td className="py-4 pr-4">{formatUsdCents(affiliate.totalEarnedUsd)}</td>
                        <td className="py-4">
                          <span
                            className={[
                              'inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em]',
                              badge.className,
                            ].join(' ')}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td className="py-4 text-slate-400" colSpan={5}>
                      No affiliate leaderboard entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Commissions</h2>
              <p className="mt-1 text-sm text-slate-400">
                Select pending or approved rows to mark them paid in a batch.
              </p>
            </div>
            {selectableOpenCommissions.length ? (
              <button
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-white/[0.08]"
                onClick={() =>
                  setSelectedIds((currentSelection) =>
                    currentSelection.length === selectableOpenCommissions.length
                      ? []
                      : selectableOpenCommissions.map((commission) => commission.id),
                  )
                }
                type="button"
              >
                {selectedIds.length === selectableOpenCommissions.length ? 'Clear selection' : 'Select open'}
              </button>
            ) : null}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase tracking-[0.22em] text-slate-500">
                <tr>
                  <th className="pb-3">Select</th>
                  <th className="pb-3">Affiliate</th>
                  <th className="pb-3">Referred user</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Created</th>
                  <th className="pb-3">Paid</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="py-4 text-slate-400" colSpan={7}>
                      Loading commission records...
                    </td>
                  </tr>
                ) : commissions.length ? (
                  commissions.map((commission) => {
                    const selectable = commission.status !== 'paid'

                    return (
                      <tr className="border-t border-white/8" key={commission.id}>
                        <td className="py-4 pr-4">
                          <input
                            checked={selectedIds.includes(commission.id)}
                            className="h-4 w-4 rounded border-white/20 bg-transparent"
                            disabled={!selectable}
                            onChange={() => toggleSelection(commission.id)}
                            type="checkbox"
                          />
                        </td>
                        <td className="py-4 pr-4">
                          <div className="font-medium text-white">{commission.affiliateEmail}</div>
                          <div className="text-xs text-slate-500">{commission.affiliateUserId}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="font-medium text-white">{commission.referredEmail}</div>
                          <div className="text-xs text-slate-500">{commission.referredUserId}</div>
                        </td>
                        <td className="py-4 pr-4">{formatUsdCents(commission.amountUsd)}</td>
                        <td className="py-4 pr-4 uppercase">{commission.status}</td>
                        <td className="py-4 pr-4">{formatDate(commission.createdAt)}</td>
                        <td className="py-4">{formatDate(commission.paidAt)}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td className="py-4 text-slate-400" colSpan={7}>
                      No commission rows match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminPageShell>
  )
}
