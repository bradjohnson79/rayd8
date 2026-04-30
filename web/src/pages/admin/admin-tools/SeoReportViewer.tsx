import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import {
  downloadAdminSeoReportPdf,
  getAdminSeoReport,
  rollbackAdminSeoAction,
  type SeoReportRecord,
} from '../../../services/admin'

export function AdminSeoReportViewerPage() {
  const { id = '' } = useParams()
  const getAuthToken = useAuthToken()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<SeoReportRecord | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for SEO report.')
        }

        const response = await getAdminSeoReport(id, token)

        if (!cancelled) {
          setReport(response.report)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load SEO report.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (id) {
      void loadReport()
    }

    return () => {
      cancelled = true
    }
  }, [getAuthToken, id])

  async function handleDownload() {
    if (!report) {
      return
    }

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for PDF download.')
      }

      const blob = await downloadAdminSeoReportPdf(report.id, token)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `rayd8-seo-report-${report.id}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to download SEO report.')
    }
  }

  async function handleRollback(actionId: string) {
    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for rollback.')
      }

      const response = await rollbackAdminSeoAction(actionId, token)
      setStatusMessage(
        response.report
          ? `Rollback applied and report ${response.report.id} generated.`
          : `Rollback applied.${response.reportError ? ` ${response.reportError}` : ''}`,
      )
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to rollback SEO action.')
    }
  }

  return (
    <section className="space-y-6">
      <AdminPageShell
        aside={
          report ? (
            <button
              className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              onClick={() => void handleDownload()}
              type="button"
            >
              Download PDF
            </button>
          ) : null
        }
        description="Review the generated SEO confirmation report, compare before and after metadata, and trigger rollback on any applied action."
        eyebrow="SEO & Growth Engine"
        title="SEO Report Viewer"
      >
        {error ? (
          <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {statusMessage ? (
          <div className="rounded-[1.75rem] border border-emerald-300/20 bg-emerald-300/10 p-5 text-sm text-emerald-50">
            {statusMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
            Loading report...
          </div>
        ) : null}

        {report ? (
          <>
            <section className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
              <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">Summary</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{report.summary}</h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                <p>{report.fullReportJson.summary}</p>
                <p>
                  <strong className="text-white">Reasoning:</strong> {report.fullReportJson.reasoning}
                </p>
                <p>
                  <strong className="text-white">Impact:</strong> {report.fullReportJson.impact}
                </p>
                <p>
                  <strong className="text-white">Keyword alignment:</strong>{' '}
                  {report.fullReportJson.keywordAlignment}
                </p>
                <p>
                  <strong className="text-white">Confidence:</strong> {report.fullReportJson.confidence}
                </p>
              </div>
            </section>

            <section className="grid gap-4">
              {report.fullReportJson.actions.map((action, index) => (
                <article
                  className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl"
                  key={`${action.page}-${index}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">Action</p>
                      <h2 className="mt-3 text-2xl font-semibold text-white">{action.page}</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-300">{action.reason}</p>
                    </div>
                    {report.relatedActionIds[index] ? (
                      <button
                        className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                        onClick={() => void handleRollback(report.relatedActionIds[index])}
                        type="button"
                      >
                        Rollback
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-6 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-xs uppercase tracking-[0.24em] text-rose-200/75">Before</p>
                      <p className="mt-3 text-sm text-white">{action.before.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{action.before.description}</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/75">After</p>
                      <p className="mt-3 text-sm text-white">{action.after.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{action.after.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </>
        ) : null}
      </AdminPageShell>
    </section>
  )
}
