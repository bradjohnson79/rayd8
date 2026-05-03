import { memo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MarketingButton } from './MarketingButton'

export const LandingBackToTop = memo(function LandingBackToTop({
  className = '',
}: {
  className?: string
}) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleClick = useCallback(() => {
    // Strip hash so LandingPage hash scroll retries don't fight scroll-to-top, and the
    // browser won't re-anchor to a section fragment after scrolling.
    if (location.hash) {
      navigate(
        { pathname: location.pathname, search: location.search, hash: '' },
        { replace: true },
      )
    }

    const scrollDocumentTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    }

    // After navigate(), let React flush + hash effect cleanup run before scrolling.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollDocumentTop)
    })
  }, [location.hash, location.pathname, location.search, navigate])

  return (
    <div className={`flex justify-center ${className}`.trim()}>
      <MarketingButton
        className="gap-2 px-5 py-2.5 text-xs sm:text-sm"
        onClick={handleClick}
        type="button"
        variant="ghost"
      >
        <svg
          aria-hidden
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
        Back to top
      </MarketingButton>
    </div>
  )
})
