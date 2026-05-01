interface GuideModalProps {
  isClosing?: boolean
  isSubmitting?: boolean
  mode: 'first_time' | 'manual'
  onClose?: () => void
  onPrimary: () => void
}

const guideImageSrc = '/assets/rayd8-guide.png'

export function GuideModal({
  isClosing = false,
  isSubmitting = false,
  mode,
  onClose,
  onPrimary,
}: GuideModalProps) {
  const isManual = mode === 'manual'

  return (
    <div
      aria-modal="true"
      className={[
        'fixed inset-0 z-[10000] flex items-center justify-center bg-black/78 p-4 transition-opacity duration-200 sm:p-6',
        isClosing ? 'opacity-0' : 'opacity-100',
      ].join(' ')}
      role="dialog"
    >
      <div className="relative flex max-h-[min(92vh,58rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(5,10,14,0.96)] shadow-[0_24px_90px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        {isManual ? (
          <button
            aria-label="Close guide"
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white transition hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        ) : null}

        <div className="overflow-y-auto">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
            <div className="bg-black/35 p-4 sm:p-6">
              <img
                alt="RAYD8 experience guide"
                className="h-auto w-full rounded-[1.5rem] border border-white/10 object-contain"
                decoding="async"
                loading="eager"
                src={guideImageSrc}
              />
            </div>

            <div className="flex flex-col justify-between p-6 sm:p-8">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">
                  {isManual ? 'RAYD8 guide' : 'Before you begin'}
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-white">
                  {isManual ? 'RAYD8 Experience Guide' : 'Prepare for your RAYD8 session'}
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {isManual
                    ? 'Revisit the guide at any time without interrupting the current session.'
                    : 'Review the experience guide before the session begins. Playback will start only after you confirm you are ready.'}
                </p>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  className="w-full rounded-2xl bg-[linear-gradient(135deg,rgba(16,185,129,0.95),rgba(59,130,246,0.92))] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting}
                  onClick={onPrimary}
                  type="button"
                >
                  {isSubmitting ? 'Starting...' : isManual ? 'Close' : 'Begin RAYD8 Session'}
                </button>

                {isManual ? (
                  <button
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.1]"
                    onClick={onClose}
                    type="button"
                  >
                    Keep Watching
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
