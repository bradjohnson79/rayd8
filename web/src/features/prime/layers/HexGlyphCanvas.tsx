import { useEffect, useRef, useState } from 'react'
import { buildHexLattice, glyphFit, hexNeighborSpacing, hexRadiusFromWidth, hexVertices, responsiveHexWidth } from '../../../../../api/src/modules/prime/core/hex.ts'
import { spectralColorAt } from '../../../../../api/src/modules/prime/core/palette.ts'
import type { PrimePrescription } from '../../../../../api/src/modules/prime/core/prescription.ts'
import { AMRITA_GLYPH_FILES, amritaGlyphUrl } from '../amritaGlyphs'

export function HexGlyphCanvas({
  elapsedMs,
  prescription,
  reducedMotion,
}: {
  elapsedMs: number
  prescription: PrimePrescription
  reducedMotion: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const images = useRef<HTMLImageElement[]>([])
  const [loaded, setLoaded] = useState(0)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect()
      setViewport({ width: Math.round(rect.width), height: Math.round(rect.height) })
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let pending = AMRITA_GLYPH_FILES.length
    images.current = AMRITA_GLYPH_FILES.map((file) => {
      const image = new Image()
      const finish = () => {
        pending -= 1
        if (pending <= 0) {
          setLoaded(AMRITA_GLYPH_FILES.length)
        }
      }
      image.onload = finish
      image.onerror = finish
      image.src = amritaGlyphUrl(file)
      return image
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !prescription.hexGrid.enabled) {
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
    const hexWidth = responsiveHexWidth(prescription.hexGrid.tileSize, rect.width)
    const radius = hexRadiusFromWidth(hexWidth)
    const cells = buildHexLattice(rect.width, rect.height, radius)
    const { hexGrid } = prescription
    canvas.dataset.hexWidth = hexWidth.toFixed(1)
    canvas.dataset.neighborSpacing = hexNeighborSpacing(radius).toFixed(2)
    canvas.dataset.glyphCount = String(AMRITA_GLYPH_FILES.length)
    if (cells.length >= 2) {
      const distance = Math.hypot(cells[1]!.x - cells[0]!.x, cells[1]!.y - cells[0]!.y)
      canvas.dataset.neighborDistance = distance.toFixed(2)
    }
    const boundary = spectralColorAt({
      palette: hexGrid.spectralPalette,
      index: 0,
      elapsedMs,
      transitionMs: hexGrid.colorTransitionSpeed,
      layerSalt: 0,
      reducedMotion,
    })
    canvas.dataset.boundaryColor = boundary.css

    cells.forEach((cell, index) => {
      const color = spectralColorAt({
        palette: hexGrid.spectralPalette,
        index,
        elapsedMs,
        transitionMs: hexGrid.colorTransitionSpeed,
        layerSalt: 0,
        reducedMotion,
      })
      const vertices = hexVertices(cell.x, cell.y, radius)
      context.beginPath()
      vertices.forEach((vertex, vertexIndex) => {
        if (vertexIndex === 0) {
          context.moveTo(vertex.x, vertex.y)
        } else {
          context.lineTo(vertex.x, vertex.y)
        }
      })
      context.closePath()
      context.globalAlpha = hexGrid.boundaryOpacity
      context.strokeStyle = color.css
      context.lineWidth = hexGrid.outlineWidth ?? 1.25
      context.lineJoin = 'miter'
      context.shadowColor = color.css
      context.shadowBlur = reducedMotion ? 0 : Math.min(hexGrid.boundaryGlow, 4)
      context.stroke()
      context.shadowBlur = 0
      context.globalAlpha = hexGrid.glyphOpacity ?? 0.92

      const image = images.current[index % images.current.length]
      if (!image || !image.complete || image.naturalWidth <= 0 || (hexGrid.glyphOpacity ?? 0.92) <= 0) {
        return
      }
      const fitted = glyphFit(image.naturalWidth, image.naturalHeight, radius)
      context.drawImage(image, cell.x - fitted.width / 2, cell.y - fitted.height / 2, fitted.width, fitted.height)
    })
    context.globalAlpha = 1
  }, [elapsedMs, loaded, prescription, reducedMotion, viewport])

  if (!prescription.hexGrid.enabled) {
    return null
  }

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" data-testid="prime-hex" />
}
