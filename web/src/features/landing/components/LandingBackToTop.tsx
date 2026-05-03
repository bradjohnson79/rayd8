import { memo, useCallback } from 'react'
import { MarketingButton } from './MarketingButton'

export const LandingBackToTop = memo(function LandingBackToTop({
  className = '',
}: {
  className?: string
}) {
  const handleClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

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
