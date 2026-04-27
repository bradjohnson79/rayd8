import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react'

interface DeferredRenderProps extends PropsWithChildren {
  fallback: ReactNode
  rootMargin?: string
}

export function DeferredRender({
  children,
  fallback,
  rootMargin = '320px 0px',
}: DeferredRenderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (shouldRender) {
      return
    }

    const element = containerRef.current
    if (!element) {
      setShouldRender(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return
        }

        setShouldRender(true)
        observer.disconnect()
      },
      { rootMargin },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [rootMargin, shouldRender])

  return <div ref={containerRef}>{shouldRender ? children : fallback}</div>
}
