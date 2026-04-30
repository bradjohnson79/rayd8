import { useEffect, useState } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import {
  getAdminSeoAudits,
  runAdminSeoAudit,
  type SeoAuditIssue,
  type SeoAuditResult,
} from '../../../services/admin'

function IssueGroup({
  issues,
  label,
}: {
  issues: SeoAuditIssue[]
  label: string
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{label}</h3>
        <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{issues.length}</span>
      </div>
      <div className="mt-4 grid gap-3">
        {issues.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-400">
            No issues in this group.
          </div>
        ) : (
          issues.map((issue, index) => (
            <div
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200"
              key={`${issue.code}-${index}`}
            >
              <p className="font-medium text-white">{issue.message}</p>
              {issue.currentValue ? (
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                  Current: {issue.currentValue}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export function AdminSeoAuditResultsPage() {
  const getAuthToken = useAuthToken()
  const [audits, setAudits] = useState<SeoAuditResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadAudits() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for SEO audits.')
        }

        const response = await getAdminSeoAudits(token)

        if (!cancelled) {
          setAudits(response.audits)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load SEO audits.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAudits()

    return () => {
      cancelled = true
    }
  }, [getAuthToken])

  async function handleRunAudit() {
    setRunning(true)
    setError(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for SEO audit.')
      }

      const response = await runAdminSeoAudit({ fullSite: true }, token)
      setAudits((currentValue) => [response.audit, ...currentValue])
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to run SEO audit.')
    } finally {
      setRunning(false)
    }
  }

  const latestAudit = audits[0] ?? null

  return (
    <section className="space-y-6">
      <AdminPageShell
        aside={
          <button
            className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
            disabled={running}
            onClick={() => void handleRunAudit()}
            type="button"
          >
            {running ? 'Running Audit...' : 'Run Audit'}
          </button>
        }
        description="Inspect crawl results grouped by severity before running metadata optimization suggestions."
        eyebrow="SEO & Growth Engine"
        title="Audit Results"
      >
        {error ? (
          <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {!latestAudit && !loading ? (
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
            No audit has been run yet. Start by running a full-site audit.
          </div>
        ) : null}

        {latestAudit ? (
          <>
            <section className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
              <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">Latest audit</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Current SEO posture</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">SEO score</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{latestAudit.score}</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Critical</p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {latestAudit.issuesBySeverity.critical.length}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Improve</p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {latestAudit.issuesBySeverity.improve.length}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Pages</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{latestAudit.pages.length}</p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <IssueGroup issues={latestAudit.issuesBySeverity.critical} label="Critical" />
              <IssueGroup issues={latestAudit.issuesBySeverity.improve} label="Improve" />
              <IssueGroup issues={latestAudit.issuesBySeverity.good} label="Good" />
            </section>

            <section className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
              <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">Page results</p>
              <div className="mt-6 grid gap-4">
                {latestAudit.pages.map((page) => (
                  <article
                    className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5"
                    key={page.path}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{page.path}</h3>
                        <p className="mt-2 text-sm text-slate-300">{page.title || 'Untitled page'}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/75">
                        Score {page.score}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-slate-300">
                      <p>H1: {page.h1 ?? 'Missing'}</p>
                      <p>H2: {page.h2 ?? 'Missing'}</p>
                      <p>Description: {page.description || 'Missing'}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </AdminPageShell>
    </section>
  )
}
