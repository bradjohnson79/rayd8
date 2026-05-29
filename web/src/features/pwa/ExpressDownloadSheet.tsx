import type { ExpressDownloadSheetCopy } from './expressInstallCopy'

export function ExpressDownloadSheet({
  copy,
  onClose,
}: {
  copy: ExpressDownloadSheetCopy
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/62 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-sm sm:items-center">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.20),transparent_34%),radial-gradient(circle_at_82%_16%,rgba(59,130,246,0.18),transparent_34%),rgba(5,8,14,0.94)] p-5 text-center text-white shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-100/60 to-transparent" />
        <p className="text-[10px] uppercase tracking-[0.34em] text-emerald-200/65">RAYD8 Express</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{copy.title}</h2>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-200/82">{copy.body}</p>
        {copy.actionHint ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white">
            {copy.actionHint}
          </div>
        ) : null}
        <button
          className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_45px_rgba(255,255,255,0.14)] transition hover:-translate-y-0.5 hover:bg-emerald-50"
          onClick={onClose}
          type="button"
        >
          Got It
        </button>
      </div>
    </div>
  )
}

export function ExpressInstallSuccessToast({ visible }: { visible: boolean }) {
  if (!visible) {
    return null
  }

  return (
    <div className="fixed inset-x-4 top-[calc(1rem+env(safe-area-inset-top))] z-[60] flex justify-center">
      <div className="rounded-full border border-emerald-100/20 bg-slate-950/86 px-4 py-2 text-sm font-medium text-emerald-50 shadow-[0_16px_54px_rgba(16,185,129,0.24)] backdrop-blur-2xl">
        RAYD8 Express Installed ✓
      </div>
    </div>
  )
}
