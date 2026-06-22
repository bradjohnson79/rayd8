import { memo } from 'react'

interface UsageWarningState {
  description: string
  title: string
}

interface PreloadOverlayProps {
  preloadPercent: number
}

interface PlaybackHealthFallbackOverlayProps {
  onReloadSession: () => void
  onReturnHome: () => void
  onTryAgain: () => void
}

interface UsageWarningOverlayProps {
  onDismiss: () => void
  smallScreenViewport: boolean
  usageWarningState: UsageWarningState
}

export const PreloadOverlay = memo(function PreloadOverlay({
  preloadPercent,
}: PreloadOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/42 p-6 text-center">
      <div className="max-w-sm rounded-[2rem] border border-white/10 bg-slate-950/84 px-6 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-emerald-300" />
        <p className="mt-4 text-[10px] uppercase tracking-[0.32em] text-emerald-200/60">
          Preparing your RAYD8 session
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Loading the secure stream, attaching the video source, and buffering for a smoother start.
        </p>
        <p className="mt-3 text-2xl font-semibold text-white">{preloadPercent}%</p>
      </div>
    </div>
  )
})

export const PlaybackHealthFallbackOverlay = memo(function PlaybackHealthFallbackOverlay({
  onReloadSession,
  onReturnHome,
  onTryAgain,
}: PlaybackHealthFallbackOverlayProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/78 p-6 text-center">
      <div className="max-w-sm rounded-[2rem] border border-white/12 bg-slate-950/92 p-6 text-white shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/70">
          Session startup
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-white">
          Trouble Starting Your Session
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          We're having trouble initializing your session.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            className="rounded-2xl bg-[linear-gradient(135deg,rgba(16,185,129,0.95),rgba(59,130,246,0.92))] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
            onClick={onTryAgain}
            type="button"
          >
            Try Again
          </button>
          <button
            className="rounded-2xl border border-emerald-200/20 bg-emerald-300/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-300/15"
            onClick={onReloadSession}
            type="button"
          >
            Reload Session
          </button>
          <button
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/5"
            onClick={onReturnHome}
            type="button"
          >
            Return Home
          </button>
        </div>
      </div>
    </div>
  )
})

export const UsageWarningOverlay = memo(function UsageWarningOverlay({
  onDismiss,
  smallScreenViewport,
  usageWarningState,
}: UsageWarningOverlayProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4"
      style={{ top: `calc(env(safe-area-inset-top) + ${smallScreenViewport ? 72 : 80}px)` }}
    >
      <div className="usage-warning-enter pointer-events-auto relative max-w-lg rounded-[1.35rem] border border-amber-200/20 bg-slate-950/88 px-8 py-4 text-center shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <button
          aria-label="Dismiss usage warning"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          onClick={onDismiss}
          type="button"
        >
          ✕
        </button>
        <p className="text-[10px] uppercase tracking-[0.32em] text-amber-100/70">Usage warning</p>
        <p className="mt-2 text-sm font-medium text-white">{usageWarningState.title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">{usageWarningState.description}</p>
      </div>
    </div>
  )
})
