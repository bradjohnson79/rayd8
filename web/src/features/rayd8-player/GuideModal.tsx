import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { acquireBodyScrollLock } from './bodyScrollLock'

interface GuideModalProps {
  isClosing?: boolean
  isSubmitting?: boolean
  mode: 'first_time' | 'manual'
  onClose?: () => void
  onPrimary: () => void
}

const guideImagePngSrc = '/assets/rayd8-guide.png'
const guideImageWebpSrc = '/assets/rayd8-guide.webp'

export function GuideModal({
  isClosing = false,
  isSubmitting = false,
  mode,
  onClose,
  onPrimary,
}: GuideModalProps) {
  const isManual = mode === 'manual'

  useEffect(() => {
    return acquireBodyScrollLock()
  }, [])

  return createPortal(
    <div
      aria-modal="true"
      className={[
        'fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/85 px-4 py-5 backdrop-blur-sm transition-opacity duration-200 sm:px-6 lg:px-10',
        isClosing ? 'opacity-0' : 'opacity-100',
      ].join(' ')}
      role="dialog"
    >
      <div
        className={[
          'relative mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] items-center justify-center transition-transform duration-200 sm:min-h-[calc(100svh-3rem)]',
          isClosing ? 'scale-[0.98]' : 'scale-100',
        ].join(' ')}
      >
        {isManual ? (
          <button
            aria-label="Close guide"
            className="absolute right-0 top-0 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white shadow-[0_12px_36px_rgba(0,0,0,0.35)] transition hover:bg-white/10 sm:right-2 sm:top-2"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        ) : null}

        <div className="grid w-full items-center gap-6 py-10 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] lg:gap-12 lg:py-0 xl:gap-14">
          <div className="flex min-w-0 justify-center">
            <picture>
              <source srcSet={guideImageWebpSrc} type="image/webp" />
              <img
                alt="RAYD8 experience guide"
                className="max-h-[58svh] w-full rounded-[1.25rem] border border-white/10 object-contain shadow-[0_24px_90px_rgba(0,0,0,0.55)] sm:max-h-[60svh] lg:h-auto lg:max-h-[80vh] lg:w-auto lg:max-w-[min(62vw,900px)] lg:rounded-[1.75rem]"
                decoding="async"
                loading="eager"
                src={guideImagePngSrc}
              />
            </picture>
          </div>

          <div className="mx-auto flex w-full max-w-xl flex-col items-center rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-7 lg:mx-0 lg:items-start lg:bg-transparent lg:p-0 lg:text-left lg:shadow-none lg:backdrop-blur-0">
            <p className="text-[0.68rem] uppercase tracking-[0.34em] text-emerald-200/70">
              {isManual ? 'RAYD8 guide' : 'Before you begin'}
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              {isManual ? 'RAYD8 Experience Guide' : 'Prepare for your RAYD8 Session'}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-200/85 sm:text-base">
              {isManual
                ? 'Revisit the full guide at any time without interrupting the current session.'
                : 'Review the experience guide before the session begins. Playback will start only after you confirm you are ready.'}
            </p>

            <div className="mt-7 flex w-full flex-col items-center gap-3 sm:mt-8 lg:items-start">
              <button
                className="w-full rounded-2xl bg-[linear-gradient(135deg,rgba(16,185,129,0.95),rgba(59,130,246,0.94))] px-7 py-4 text-base font-semibold text-white shadow-[0_18px_55px_rgba(16,185,129,0.26)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_65px_rgba(59,130,246,0.28)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-72"
                disabled={isSubmitting}
                onClick={onPrimary}
                type="button"
              >
                {isSubmitting ? 'Starting...' : isManual ? 'Close Guide' : 'Begin RAYD8 Session'}
              </button>

              {isManual ? (
                <button
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-7 py-3.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.12] sm:w-auto sm:min-w-72"
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
    </div>,
    document.body,
  )
}
