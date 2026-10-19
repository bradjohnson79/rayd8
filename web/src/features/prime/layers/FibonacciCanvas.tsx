import { useEffect, useRef } from 'react'
import { fibonacciFieldTop, locateFibonacciPass } from '../../../../../api/src/modules/prime/core/fibonacci.ts'
import { spectralColorAt } from '../../../../../api/src/modules/prime/core/palette.ts'
import type { PrimePrescription } from '../../../../../api/src/modules/prime/core/prescription.ts'

export function FibonacciCanvas({
  elapsedMs,
  prescription,
  reducedMotion,
}: {
  elapsedMs: number
  prescription: PrimePrescription
  reducedMotion: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const flow = prescription.fibonacciFlow

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !flow.enabled) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, rect.width, rect.height)
    const pass = locateFibonacciPass(elapsedMs / 1000)
    const fieldHeight = rect.height
    const top = reducedMotion
      ? rect.height * 0.15
      : fibonacciFieldTop({
          progress: pass.progress,
          direction: pass.direction,
          viewportHeight: rect.height,
          fieldHeight,
        })
    canvas.dataset.fieldTop = String(Math.round(top))
    canvas.dataset.fieldHeight = String(Math.round(fieldHeight))
    canvas.dataset.viewportHeight = String(Math.round(rect.height))
    canvas.dataset.direction = pass.direction
    canvas.dataset.progress = pass.progress.toFixed(4)
    if (fieldRef.current) {
      fieldRef.current.style.top = `${top}px`
      fieldRef.current.style.height = `${fieldHeight}px`
    }
    const [minSize, maxSize] = flow.particleSizeRange

    for (let index = 0; index < flow.particleDensity; index += 1) {
      const column = (index * 97) % 100
      const row = (index * 53) % 100
      const x = (column / 100) * rect.width + ((index % 5) - 2) * 4
      const y = top + (row / 100) * fieldHeight
      const size = minSize + ((index * 17) % 100) / 100 * (maxSize - minSize)
      const color = spectralColorAt({
        palette: flow.palette,
        index,
        elapsedMs,
        transitionMs: 5000,
        layerSalt: 3,
        reducedMotion,
      })
      context.beginPath()
      context.arc(x, y, size, 0, Math.PI * 2)
      context.strokeStyle = color.css
      context.globalAlpha = flow.opacity
      context.lineWidth = 1.5
      context.stroke()
    }
    context.globalAlpha = 1
  }, [elapsedMs, flow, reducedMotion])

  if (!flow.enabled) {
    return null
  }

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" data-testid="prime-fibonacci-canvas" />
      <div
        data-testid="prime-fibonacci-field"
        className="pointer-events-none absolute left-0 w-full"
        ref={fieldRef}
      />
    </>
  )
}
