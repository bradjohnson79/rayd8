import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { AdminStatCard } from '../../../components/AdminStatCard'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import { getAdminSeoOverview, type SeoOverviewResponse } from '../../../services/admin'

const emptyOverview: SeoOverviewResponse = {
  latestAudit: null,
  managedRoutes: 0,
  recentReports: [],
  seoScore: 0,
}

export function AdminSeoOverviewPage() {
  const getAuthToken = useAuthToken()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<SeoOverviewResponse>(emptyOverview)

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for SEO overview.')
        }

        const response = await getAdminSeoOverview(token)

        if (!cancelled) {
          setOverview(response)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load SEO overview.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOverview()

    return () => {
      cancelled = true
    }
  }, [getAuthToken])

  return (
    <section className="space-y-6">
      <AdminPageShell
        aside={
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Quick actions</p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <Link
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 font-medium text-white transition hover:bg-white/10"
                to="/admin/seo/audits"
              >
                Run Audit
              </Link>
              <Link
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 font-medium text-white transition hover:bg-white/10"
                to="/admin/seo/preview"
              >
                Optimize Site
              </Link>
              <Link
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 font-medium text-white transition hover:bg-white/10"
                to="/admin/seo/reports"
              >
                View Reports
              </Link>
            </div>
          </div>
        }
        description="Run SEO audits, review AI optimization suggestions, approve runtime metadata changes, and export structured RAYD8 growth reports."
        eyebrow="SEO & Growth Engine"
        title="SEO & Growth"
      >
        {error ? (
          <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            detail={loading ? 'Loading current optimization score...' : 'Latest persisted audit score.'}
            label="SEO Score"
            value={overview.seoScore}
          />
          <AdminStatCard
            detail={loading ? 'Loading managed routes...' : 'Tracked public routes in the SEO manifest.'}
            label="Managed Routes"
            value={overview.managedRoutes}
          />
          <AdminStatCard
            detail={loading ? 'Loading reports...' : 'Stored SEO reports ready for review and export.'}
            label="Recent Reports"
            value={overview.recentReports.length}
          />
          <AdminStatCard
            detail={
              loading
                ? 'Loading audit coverage...'
                : overview.latestAudit
                  ? `Last audit: ${new Date(overview.latestAudit.createdAt).toLocaleString()}`
                  : 'No audit recorded yet.'
            }
            label="Audit Status"
            value={overview.latestAudit ? 'Ready' : 'Pending'}
          />
        </section>

        <section className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">Recent reports</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Latest generated SEO reports</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Reports summarize approved SEO actions, reasoning, keyword alignment, and expected impact.
              </p>
            </div>
            <Link
              className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              to="/admin/seo/reports"
            >
              Open Reports
            </Link>
          </div>

          <div className="mt-6 grid gap-3">
            {overview.recentReports.length === 0 ? (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-400">
                No SEO reports have been created yet.
              </div>
            ) : (
              overview.recentReports.map((report) => (
                <Link
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 transition hover:bg-white/[0.08]"
                  key={report.id}
                  to={`/admin/seo/reports/${report.id}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{report.summary}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                        {new Date(report.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/75">
                      {report.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </AdminPageShell>
    </section>
  )
}
