import type { ReactNode } from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  description: string
  primaryLabel: string
  secondaryLabel: string
  onPrimary: () => void
  onSecondary: () => void
  footer?: ReactNode
}

export function ConfirmModal({
  open,
  title,
  description,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  footer,
}: ConfirmModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">
          Confirm
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
            onClick={onSecondary}
            type="button"
          >
            {secondaryLabel}
          </button>
          <button
            autoFocus
            className="rounded-2xl bg-emerald-300/20 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-300/30"
            onClick={onPrimary}
            type="button"
          >
            {primaryLabel}
          </button>
        </div>

        {footer ? <div className="mt-4 text-xs text-slate-400">{footer}</div> : null}
      </div>
    </div>
  )
}
