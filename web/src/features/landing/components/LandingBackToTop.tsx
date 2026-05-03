import { memo, useCallback, type MouseEvent } from 'react'
import { MarketingButton } from './MarketingButton'

export const LandingBackToTop = memo(function LandingBackToTop({
  className = '',
}: {
  className?: string
}) {
  const blurActiveElement = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  const handleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur()
    blurActiveElement()

    const scrollToAbsoluteTop = () => {
      blurActiveElement()
      const root = document.documentElement
      const previousRootScrollBehavior = root.style.scrollBehavior
      const previousBodyScrollBehavior = document.body.style.scrollBehavior

      root.style.scrollBehavior = 'auto'
      document.body.style.scrollBehavior = 'auto'

      const header = document.querySelector('header')
      header?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' })
      window.scrollTo(0, 0)
      const scrollRoots = [
        document.scrollingElement,
        document.documentElement,
        document.body,
        ...Array.from(document.querySelectorAll<HTMLElement>('*')).filter(
          (element) =>
            element.scrollTop > 0 ||
            element.scrollLeft > 0 ||
            element.scrollHeight > element.clientHeight ||
            element.scrollWidth > element.clientWidth,
        ),
      ]

      for (const scrollRoot of scrollRoots) {
        if (!scrollRoot) {
          continue
        }

        scrollRoot.scrollTop = 0
        scrollRoot.scrollLeft = 0
      }

      window.requestAnimationFrame(() => {
        root.style.scrollBehavior = previousRootScrollBehavior
        document.body.style.scrollBehavior = previousBodyScrollBehavior
      })
    }

    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        document.title,
        `${window.location.pathname}${window.location.search}`,
      )
    }

    scrollToAbsoluteTop()

    // Enforce the final position after native fragment scrolling or focus restoration
    // has had a chance to run.
    for (const delayMs of [0, 75, 175, 350, 700]) {
      window.setTimeout(() => scrollToAbsoluteTop(), delayMs)
    }
  }, [])

  return (
    <div className={`flex justify-center ${className}`.trim()}>
      <MarketingButton
        className="gap-2 px-5 py-2.5 text-xs sm:text-sm"
        onClick={handleClick}
        onMouseDown={(event) => event.preventDefault()}
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
