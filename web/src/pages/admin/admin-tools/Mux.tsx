import { useEffect, useState } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { AdminStatCard } from '../../../components/AdminStatCard'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import {
  createAdminMuxUpload,
  getAdminMuxAssets,
  getAdminMuxPlaybackToken,
  getAdminMuxStats,
  type AdminMuxAsset,
  type AdminMuxStats,
} from '../../../services/admin'

const emptyStats: AdminMuxStats = {
  configured: false,
  environment_key: null,
  total_assets: 0,
  ready_assets: 0,
  processing_assets: 0,
  total_duration_seconds: 0,
}

export function AdminMuxPage() {
  const getAuthToken = useAuthToken()
  const [assets, setAssets] = useState<AdminMuxAsset[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [playbackUrls, setPlaybackUrls] = useState<Record<string, string>>({})
  const [stats, setStats] = useState<AdminMuxStats>(emptyStats)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadMuxData() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for Mux admin data.')
        }

        const [assetResponse, statsResponse] = await Promise.all([
          getAdminMuxAssets(token),
          getAdminMuxStats(token),
        ])

        if (!cancelled) {
          setAssets(assetResponse.assets)
          setStats(statsResponse.stats)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load Mux data.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadMuxData()

    return () => {
      cancelled = true
    }
  }, [getAuthToken])

  async function handleCreateUpload() {
    setUploadMessage('Creating a signed upload URL...')

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for upload creation.')
      }

      const response = await createAdminMuxUpload(token, 'RAYD8® admin upload')
      setUploadMessage(
        response.upload.upload_url
          ? `Upload ${response.upload.upload_id} created.`
          : 'Mux returned an upload without a usable URL.',
      )
    } catch (nextError) {
      setUploadMessage(
        nextError instanceof Error ? nextError.message : 'Unable to create a Mux upload.',
      )
    }
  }

  async function handleGeneratePlayback(assetId: string) {
    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for playback token creation.')
      }

      const response = await getAdminMuxPlaybackToken(assetId, token)
      setPlaybackUrls((current) => ({
        ...current,
        [assetId]: response.playback.signed_url,
      }))
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Unable to create playback token.',
      )
    }
  }

  return (
    <AdminPageShell
      aside={
        <button
          className="w-full rounded-2xl bg-violet-300/20 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-300/30"
          onClick={() => void handleCreateUpload()}
          type="button"
        >
          Create direct upload
        </button>
      }
      description="Mux administration stays server-only. Assets, stats, uploads, and playback tokens all flow through the backend so the frontend never touches raw provider credentials."
      eyebrow="Admin tools"
      title="Mux"
    >
      {error ? (
        <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {uploadMessage ? (
        <div className="rounded-[1.75rem] border border-violet-300/20 bg-violet-300/10 p-5 text-sm text-violet-50">
          {uploadMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          detail={loading ? 'Loading asset totals...' : 'Assets visible from the current Mux environment.'}
          label="Total assets"
          value={stats.total_assets}
        />
        <AdminStatCard
          detail={loading ? 'Loading ready assets...' : 'Assets currently in ready state.'}
          label="Ready assets"
          value={stats.ready_assets}
        />
        <AdminStatCard
          detail={loading ? 'Loading processing assets...' : 'Assets still processing or awaiting readiness.'}
          label="Processing assets"
          value={stats.processing_assets}
        />
        <AdminStatCard
          detail={
            loading
              ? 'Loading duration totals...'
              : `Mux environment: ${stats.environment_key ?? 'not configured'}`
          }
          label="Duration seconds"
          value={stats.total_duration_seconds}
        />
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-5 text-sm text-slate-400 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            Loading Mux assets...
          </div>
        ) : assets.length ? (
          assets.map((asset) => (
            <article
              className="rounded-[1.75rem] border border-white/12 bg-white/[0.05] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
              key={asset.asset_id}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{asset.title}</h2>
                  <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                    Asset {asset.asset_id}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">
                  {asset.status}
                </span>
              </div>

              <dl className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                <div className="rounded-2xl bg-white/[0.05] px-4 py-3 backdrop-blur-xl">
                  <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Playback ID</dt>
                  <dd className="mt-2 break-all text-slate-100">{asset.playback_id ?? 'None'}</dd>
                </div>
                <div className="rounded-2xl bg-white/[0.05] px-4 py-3 backdrop-blur-xl">
                  <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Duration</dt>
                  <dd className="mt-2 text-slate-100">{asset.duration_seconds}s</dd>
                </div>
                <div className="rounded-2xl bg-white/[0.05] px-4 py-3 backdrop-blur-xl">
                  <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</dt>
                  <dd className="mt-2 text-slate-100">{asset.status}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
                <button
                  className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 backdrop-blur-xl"
                  onClick={() => void handleGeneratePlayback(asset.asset_id)}
                  type="button"
                >
                  Generate signed playback URL
                </button>

                {playbackUrls[asset.asset_id] ? (
                  <div className="rounded-2xl border border-violet-300/15 bg-violet-300/10 px-4 py-3 text-xs leading-6 text-violet-50">
                    {playbackUrls[asset.asset_id]}
                  </div>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-5 text-sm text-slate-400 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            No Mux assets available yet.
          </div>
        )}
      </div>
    </AdminPageShell>
  )
}
