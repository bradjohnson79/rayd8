import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

type ImmersiveViewportSurface = 'fill' | 'fixed'

interface ImmersiveViewportProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  portal?: boolean
  shellClassName?: string
  stageClassName?: string
  surface?: ImmersiveViewportSurface
  onShellRef?: (node: HTMLDivElement | null) => void
}

const stageStyle: CSSProperties = {
  aspectRatio: '16 / 9',
  height: 'min(100dvh, 100cqh, calc(100vw * 9 / 16), calc(100cqw * 9 / 16))',
  width: 'min(100vw, 100cqw, calc(100dvh * 16 / 9), calc(100cqh * 16 / 9))',
}

export function ImmersiveViewport({
  children,
  className,
  portal = false,
  shellClassName = '',
  stageClassName = '',
  style,
  surface = 'fixed',
  onShellRef,
  ...shellProps
}: ImmersiveViewportProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [layoutRevision, setLayoutRevision] = useState(0)

  const setShellElement = useCallback(
    (node: HTMLDivElement | null) => {
      shellRef.current = node
      onShellRef?.(node)
    },
    [onShellRef],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    let frameId: number | null = null
    const recomputeViewport = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        setLayoutRevision((currentValue) => currentValue + 1)
      })
    }

    window.addEventListener('orientationchange', recomputeViewport)
    window.addEventListener('resize', recomputeViewport)

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }

      window.removeEventListener('orientationchange', recomputeViewport)
      window.removeEventListener('resize', recomputeViewport)
    }
  }, [])

  const shellStyle = useMemo(
    () => ({
      ...style,
      containerType: 'size',
      '--rayd8-immersive-viewport-revision': String(layoutRevision),
    }) as CSSProperties,
    [layoutRevision, style],
  )
  const surfaceClassName =
    surface === 'fixed' ? 'fixed inset-0 h-[100dvh] w-screen' : 'absolute inset-0 h-full w-full'
  const shell = (
    <div
      {...shellProps}
      className={[
        surfaceClassName,
        'flex items-center justify-center overflow-hidden bg-black',
        shellClassName,
        className ?? '',
      ].join(' ')}
      ref={setShellElement}
      style={shellStyle}
    >
      <div
        className={[
          'relative max-h-full max-w-full overflow-hidden bg-black',
          stageClassName,
        ].join(' ')}
        style={stageStyle}
      >
        {children}
      </div>
    </div>
  )

  if (!portal) {
    return shell
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(shell, document.body)
}
