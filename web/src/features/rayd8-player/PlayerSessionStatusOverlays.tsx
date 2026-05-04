import { memo, type MouseEvent as ReactMouseEvent } from 'react'

interface UsageWarningState {
  description: string
  title: string
}

interface PreloadOverlayProps {
  preloadPercent: number
}

interface InteractionRequiredOverlayProps {
  onResume: () => void
}

interface UsageWarningOverlayProps {
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
          Preparing session
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Buffering the playback engine for a smoother start.
        </p>
        <p className="mt-3 text-2xl font-semibold text-white">{preloadPercent}%</p>
      </div>
    </div>
  )
})

export const InteractionRequiredOverlay = memo(function InteractionRequiredOverlay({
  onResume,
}: InteractionRequiredOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-6 text-center"
      onClick={onResume}
    >
      <div
        className="max-w-md rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        onClick={(event: ReactMouseEvent<HTMLDivElement>) => {
          event.stopPropagation()
        }}
      >
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">
          Session focus needed
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-white">Continue the active session</h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Playback paused until you confirm the session is still active. Tap or click anywhere, or
          use the resume button below, to continue instantly.
        </p>
        <button
          className="mt-6 w-full rounded-2xl bg-emerald-300/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-300/30"
          onClick={onResume}
          type="button"
        >
          Resume Session
        </button>
      </div>
    </div>
  )
})

export const UsageWarningOverlay = memo(function UsageWarningOverlay({
  smallScreenViewport,
  usageWarningState,
}: UsageWarningOverlayProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4"
      style={{ top: `calc(env(safe-area-inset-top) + ${smallScreenViewport ? 72 : 80}px)` }}
    >
      <div className="max-w-lg rounded-[1.35rem] border border-amber-200/20 bg-slate-950/88 px-4 py-3 text-center shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <p className="text-[10px] uppercase tracking-[0.32em] text-amber-100/70">Usage warning</p>
        <p className="mt-2 text-sm font-medium text-white">{usageWarningState.title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">{usageWarningState.description}</p>
      </div>
    </div>
  )
})
