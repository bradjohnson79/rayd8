import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import { downloadAdminSeoReportPdf, getAdminSeoReports, type SeoReportRecord } from '../../../services/admin'

export function AdminSeoReportsPage() {
  const getAuthToken = useAuthToken()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<SeoReportRecord[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadReports() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for SEO reports.')
        }

        const response = await getAdminSeoReports(token)

        if (!cancelled) {
          setReports(response.reports)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load SEO reports.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadReports()

    return () => {
      cancelled = true
    }
  }, [getAuthToken])

  async function handleDownload(reportId: string) {
    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for PDF download.')
      }

      const blob = await downloadAdminSeoReportPdf(reportId, token)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `rayd8-seo-report-${reportId}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to download PDF.')
    }
  }

  return (
    <section className="space-y-6">
      <AdminPageShell
        description="Review stored SEO reports, inspect action history, and export confirmation PDFs."
        eyebrow="SEO & Growth Engine"
        title="SEO Reports"
      >
        {error ? (
          <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4">
          {reports.length === 0 && !loading ? (
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
              No SEO reports have been generated yet.
            </div>
          ) : (
            reports.map((report) => (
              <article
                className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl"
                key={report.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">
                      {new Date(report.createdAt).toLocaleString()}
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">{report.summary}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      Actions linked: {report.relatedActionIds.length}
                      {report.error ? ` · ${report.error}` : ''}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/75">
                    {report.status}
                  </span>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                    to={`/admin/seo/reports/${report.id}`}
                  >
                    View Report
                  </Link>
                  <button
                    className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                    onClick={() => void handleDownload(report.id)}
                    type="button"
                  >
                    Download PDF
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </AdminPageShell>
    </section>
  )
}
