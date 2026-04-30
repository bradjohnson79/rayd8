import { useMemo, useState } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import {
  applyAdminSeoChanges,
  optimizeAdminSeo,
  type SeoMetadataPayload,
  type SeoOptimizationSuggestion,
} from '../../../services/admin'
import { getSeoMetadata } from '../../../services/seo'

function FieldDiff({
  label,
  nextValue,
  previousValue,
}: {
  label: string
  nextValue: string
  previousValue: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-xs uppercase tracking-[0.24em] text-rose-200/75">OLD</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{previousValue || 'Not set'}</p>
      <p className="mt-4 text-xs uppercase tracking-[0.24em] text-emerald-200/75">NEW</p>
      <p className="mt-2 text-sm leading-6 text-white">{nextValue || 'Not set'}</p>
    </div>
  )
}

export function AdminSeoOptimizationPreviewPage() {
  const getAuthToken = useAuthToken()
  const [beforeByPath, setBeforeByPath] = useState<Record<string, SeoMetadataPayload>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<SeoOptimizationSuggestion[]>([])
  const [summary, setSummary] = useState('')

  const selectedSuggestions = useMemo(
    () => suggestions.filter((suggestion) => selectedPaths.includes(suggestion.path)),
    [selectedPaths, suggestions],
  )

  async function handleRunOptimize() {
    setLoading(true)
    setError(null)
    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for SEO optimization.')
      }

      const response = await optimizeAdminSeo({ fullSite: true }, token)
      const beforeEntries = await Promise.all(
        response.actions.map(async (action) => [action.path, await getSeoMetadata(action.path)] as const),
      )

      setBeforeByPath(Object.fromEntries(beforeEntries))
      setSuggestions(response.actions)
      setSelectedPaths(response.actions.map((action) => action.path))
      setSummary(response.summary)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to generate SEO suggestions.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApplySelected() {
    setLoading(true)
    setError(null)
    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for SEO apply.')
      }

      const response = await applyAdminSeoChanges({ changes: selectedSuggestions }, token)
      setStatusMessage(
        response.report
          ? `Applied ${response.actions.length} changes and generated report ${response.report.id}.`
          : `Applied ${response.actions.length} changes.${response.reportError ? ` ${response.reportError}` : ''}`,
      )
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to apply SEO changes.')
    } finally {
      setLoading(false)
    }
  }

  function togglePath(path: string) {
    setSelectedPaths((currentValue) =>
      currentValue.includes(path)
        ? currentValue.filter((entry) => entry !== path)
        : [...currentValue, path],
    )
  }

  return (
    <section className="space-y-6">
      <AdminPageShell
        aside={
          <div className="flex flex-col gap-2">
            <button
              className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
              disabled={loading}
              onClick={() => void handleRunOptimize()}
              type="button"
            >
              {loading ? 'Working...' : 'Run Optimization'}
            </button>
            <button
              className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
              disabled={loading || selectedSuggestions.length === 0}
              onClick={() => void handleApplySelected()}
              type="button"
            >
              Approve Selected
            </button>
          </div>
        }
        description="Generate structured GPT metadata suggestions, inspect diffs, and apply only the approved routes."
        eyebrow="SEO & Growth Engine"
        title="Optimization Preview"
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

        {summary ? (
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 text-sm leading-7 text-slate-200">
            {summary}
          </div>
        ) : null}

        <section className="grid gap-4">
          {suggestions.length === 0 ? (
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
              Run optimization to generate metadata changes and review diffs before applying them.
            </div>
          ) : (
            suggestions.map((suggestion) => {
              const previous = beforeByPath[suggestion.path]

              return (
                <article
                  className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl"
                  key={suggestion.path}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">
                        {suggestion.routeType} · Priority {suggestion.priority}
                      </p>
                      <h2 className="mt-3 text-2xl font-semibold text-white">{suggestion.path}</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-300">{suggestion.reason}</p>
                    </div>
                    <label className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white">
                      <input
                        checked={selectedPaths.includes(suggestion.path)}
                        onChange={() => togglePath(suggestion.path)}
                        type="checkbox"
                      />
                      Approve
                    </label>
                  </div>

                  <div className="mt-6 grid gap-4 xl:grid-cols-2">
                    <FieldDiff
                      label="Title"
                      nextValue={suggestion.title}
                      previousValue={previous?.title ?? ''}
                    />
                    <FieldDiff
                      label="Description"
                      nextValue={suggestion.description}
                      previousValue={previous?.description ?? ''}
                    />
                    <FieldDiff
                      label="Canonical"
                      nextValue={suggestion.canonicalUrl ?? 'Not set'}
                      previousValue={previous?.canonicalUrl ?? 'Not set'}
                    />
                    <FieldDiff
                      label="Robots"
                      nextValue={`${suggestion.index ? 'index' : 'noindex'}, ${suggestion.follow ? 'follow' : 'nofollow'}`}
                      previousValue={`${previous?.index ? 'index' : 'noindex'}, ${previous?.follow ? 'follow' : 'nofollow'}`}
                    />
                    <FieldDiff
                      label="OG Title"
                      nextValue={suggestion.og.title ?? ''}
                      previousValue={previous?.og.title ?? ''}
                    />
                    <FieldDiff
                      label="OG Description"
                      nextValue={suggestion.og.description ?? ''}
                      previousValue={previous?.og.description ?? ''}
                    />
                  </div>
                </article>
              )
            })
          )}
        </section>
      </AdminPageShell>
    </section>
  )
}
