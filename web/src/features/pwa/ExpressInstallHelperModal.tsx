import type { ExpressAppleInstallGuide } from './expressInstallCopy'
import type { InstallFlowKind } from './getInstallFlow'

interface ExpressInstallHelperModalProps {
  guide: ExpressAppleInstallGuide | null
  flow: InstallFlowKind
  onClose: () => void
  onDownload: () => void
  status?: 'dismissed' | 'unavailable' | null
}

export function ExpressInstallHelperModal({
  flow,
  guide,
  onClose,
  onDownload,
  status = null,
}: ExpressInstallHelperModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/62 px-4 py-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-sm">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.20),transparent_34%),radial-gradient(circle_at_82%_16%,rgba(59,130,246,0.18),transparent_34%),rgba(5,8,14,0.94)] p-5 text-center text-white shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-100/60 to-transparent" />
        <button
          aria-label="Close download dialog"
          className="absolute right-4 top-4 rounded-full border border-white/10 px-2.5 py-1 text-sm text-white/68 transition hover:bg-white/10 hover:text-white"
          onClick={onClose}
          type="button"
        >
          ×
        </button>

        {flow === 'androidDesktop' || flow === 'fallback' ? (
          <>
            <p className="text-[10px] uppercase tracking-[0.34em] text-emerald-200/65">
              RAYD8 Express
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">Download RAYD8 Express</h2>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-7 text-slate-200/88">
              Install RAYD8 Express directly from this window.
            </p>
          </>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.34em] text-emerald-200/65">
              RAYD8 Express
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">Download RAYD8 Express</h2>

            {guide?.kind === 'ios' ? (
              <div className="mt-5 space-y-2 text-sm leading-7 text-slate-200/88">
                <p>Tap Download Express, then choose:</p>
                <p className="text-base font-semibold text-white">Share</p>
                <p className="text-base font-semibold text-white">Add to Home Screen</p>
              </div>
            ) : null}

            {guide?.kind === 'mac' ? (
              <div className="mt-5 space-y-2 text-sm leading-7 text-slate-200/88">
                <p>Tap Download Express, then choose:</p>
                <p className="text-base font-semibold text-white">Add to Dock</p>
              </div>
            ) : null}

            {guide?.kind === 'both' ? (
              <div className="mt-5 space-y-4 text-left text-sm leading-7 text-slate-200/88">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/65">
                    iPhone / iPad
                  </p>
                  <p className="mt-2">
                    Tap <span className="font-semibold text-white">Download Express</span>, then
                    choose <span className="font-semibold text-white">Share</span> and{' '}
                    <span className="font-semibold text-white">Add to Home Screen</span>.
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/65">Mac</p>
                  <p className="mt-2">
                    Tap <span className="font-semibold text-white">Download Express</span>, then
                    choose <span className="font-semibold text-white">Add to Dock</span>.
                  </p>
                </div>
              </div>
            ) : null}
          </>
        )}

        {status ? (
          <p className="mx-auto mt-4 max-w-xs text-xs leading-5 text-amber-100/82">
            {status === 'dismissed'
              ? 'Download was paused. Tap Download Express again when you are ready.'
              : 'Direct download is not available in this browser window.'}
          </p>
        ) : null}

        <button
          className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_45px_rgba(255,255,255,0.14)] transition hover:-translate-y-0.5 hover:bg-emerald-50"
          onClick={onDownload}
          type="button"
        >
          Download Express
        </button>
      </div>
    </div>
  )
}
