import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

interface AppRouteErrorBoundaryProps {
  scope?: 'admin' | 'member' | 'public'
}

function getScopeCopy(scope: AppRouteErrorBoundaryProps['scope']) {
  if (scope === 'admin') {
    return {
      eyebrow: 'RAYD8® Admin Recovery',
      homeHref: '/admin',
      homeLabel: 'Open Admin',
      secondaryHref: '/dashboard',
      secondaryLabel: 'Open Dashboard',
    }
  }

  if (scope === 'member') {
    return {
      eyebrow: 'RAYD8® Session Recovery',
      homeHref: '/dashboard',
      homeLabel: 'Open Dashboard',
      secondaryHref: '/',
      secondaryLabel: 'Go Home',
    }
  }

  return {
    eyebrow: 'RAYD8® Recovery',
    homeHref: '/',
    homeLabel: 'Go Home',
    secondaryHref: '/dashboard',
    secondaryLabel: 'Open Dashboard',
  }
}

function normalizeRouteError(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return {
      details: error.data,
      status: `${error.status} ${error.statusText}`.trim(),
      title: 'This route could not be rendered.',
    }
  }

  if (error instanceof Error) {
    return {
      details: error.stack,
      status: 'Application error',
      title: error.message || 'Something unexpected interrupted this screen.',
    }
  }

  return {
    details: typeof error === 'string' ? error : null,
    status: 'Unexpected error',
    title: 'Something unexpected interrupted this screen.',
  }
}

export function AppRouteErrorBoundary({
  scope = 'public',
}: AppRouteErrorBoundaryProps) {
  const error = useRouteError()
  const copy = getScopeCopy(scope)
  const normalizedError = normalizeRouteError(error)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.14),transparent_26%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.14),transparent_26%),linear-gradient(180deg,#04070a_0%,#071017_100%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-4xl items-center">
        <div className="w-full rounded-[2.2rem] border border-white/10 bg-[rgba(6,10,14,0.72)] p-8 shadow-[0_24px_100px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-10">
          <p className="text-[11px] uppercase tracking-[0.38em] text-emerald-200/72">{copy.eyebrow}</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {normalizedError.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
            {normalizedError.status}. Reload this screen or move to a stable route while the underlying issue is fixed.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(16,185,129,0.95),rgba(59,130,246,0.92))] px-6 py-3 text-sm font-medium text-white shadow-[0_18px_55px_rgba(15,118,110,0.28)] transition hover:-translate-y-0.5"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload
            </button>
            <a
              className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.05] px-6 py-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
              href={copy.homeHref}
            >
              {copy.homeLabel}
            </a>
            <a
              className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.05] px-6 py-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
              href={copy.secondaryHref}
            >
              {copy.secondaryLabel}
            </a>
          </div>

          {normalizedError.details ? (
            <details className="mt-8 rounded-[1.6rem] border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
              <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.3em] text-white/62">
                Technical details
              </summary>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-300">
                {typeof normalizedError.details === 'string'
                  ? normalizedError.details
                  : JSON.stringify(normalizedError.details, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  )
}
