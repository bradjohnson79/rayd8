export interface HexCell {
  q: number
  r: number
  x: number
  y: number
}

export const DEFAULT_HEX_WIDTH = 64

export function hexNeighborSpacing(size: number) {
  return size * Math.sqrt(3)
}

export function hexRadiusFromWidth(width: number) {
  return width / Math.sqrt(3)
}

export function responsiveHexWidth(prescribedWidth: number, viewportWidth: number) {
  const fitted = viewportWidth / 3
  return Math.min(prescribedWidth, Math.max(40, fitted))
}

export function hexCenter(q: number, r: number, size: number) {
  return {
    x: size * Math.sqrt(3) * (q + r / 2),
    y: size * 1.5 * r,
  }
}

export function hexVertices(centerX: number, centerY: number, radius: number) {
  const vertices: Array<{ x: number; y: number }> = []

  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 180) * (60 * index - 30)
    vertices.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    })
  }

  return vertices
}

export function pointInHex(x: number, y: number, centerX: number, centerY: number, radius: number) {
  const dx = Math.abs(x - centerX)
  const dy = Math.abs(y - centerY)
  const halfWidth = (radius * Math.sqrt(3)) / 2
  return dx <= halfWidth && dy <= radius && dy <= radius - dx / Math.sqrt(3)
}

export function buildHexLattice(width: number, height: number, size: number, maxCells = 1000): HexCell[] {
  const safeSize = Math.max(16, size)
  const columnStep = hexNeighborSpacing(safeSize)
  const halfWidth = columnStep / 2
  const offsetX = columnStep * 0.32
  const offsetY = safeSize * 0.48
  const maxQ = Math.ceil(width / columnStep) + 4
  const maxR = Math.ceil(height / (safeSize * 1.5)) + 3
  const cells: HexCell[] = []

  for (let r = -3; r <= maxR; r += 1) {
    const qStart = -6 - Math.ceil(Math.abs(r) / 2)
    for (let q = qStart; q <= maxQ; q += 1) {
      const base = hexCenter(q, r, safeSize)
      const x = base.x + offsetX
      const y = base.y + offsetY
      if (x + halfWidth < 0 || y + safeSize < 0 || x - halfWidth > width || y - safeSize > height) {
        continue
      }
      cells.push({ q, r, x, y })
      if (cells.length >= maxCells) {
        return cells
      }
    }
  }

  return cells
}

export function glyphFit(imageWidth: number, imageHeight: number, radius: number) {
  const hexWidth = radius * Math.sqrt(3)
  const fullWidthBand = radius
  const maxWidth = hexWidth * 0.9
  const maxHeight = fullWidthBand * 0.92
  const scale = Math.min(maxWidth / Math.max(1, imageWidth), maxHeight / Math.max(1, imageHeight))
  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
  }
}
