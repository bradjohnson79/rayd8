import { useEffect, useLayoutEffect, useState } from 'react'
import { outlinePx } from '../../../../../api/src/modules/prime/core/amplification.ts'
import { playlistIndex, slotOpacity } from '../../../../../api/src/modules/prime/core/rotation.ts'
import { renderPilotSigil } from '../../../../../api/src/modules/prime/core/catalog.ts'
import { renderContouredSigil } from '../../../../../api/src/modules/prime/core/svg.ts'
import type { PrimePrescription } from '../../../../../api/src/modules/prime/core/prescription.ts'

const FRAME_CLASS: Record<keyof PrimePrescription['playlists'], string> = {
  mental: 'left-[4%] top-[3%]',
  causal: 'right-[4%] top-[3%]',
  physical: 'left-[4%] bottom-[9%]',
  emotional: 'right-[4%] bottom-[9%]',
}

const FRAME_LABEL: Record<keyof PrimePrescription['playlists'], string> = {
  mental: 'Mental',
  causal: 'Causal',
  physical: 'Physical',
  emotional: 'Emotional',
}

type Domain = keyof PrimePrescription['playlists']
type Corner = 'tl' | 'tr' | 'bl' | 'br'

const FACE_LINK: Record<Domain, { from: Corner; to: Corner }> = {
  mental: { from: 'br', to: 'tl' },
  causal: { from: 'bl', to: 'tr' },
  physical: { from: 'tr', to: 'bl' },
  emotional: { from: 'tl', to: 'br' },
}

function cornerPoint(rect: DOMRect, stage: DOMRect, corner: Corner) {
  const x = corner === 'tl' || corner === 'bl' ? rect.left : rect.right
  const y = corner === 'tl' || corner === 'tr' ? rect.top : rect.bottom
  return { x: x - stage.left, y: y - stage.top }
}

function svgUrl(code: string, domain: 'physical' | 'emotional' | 'mental' | 'causal', amplification: number) {
  const rendered = renderPilotSigil({
    publicCode: code,
    name: code,
    domain,
    category: 'session',
    description: 'Session sigil',
    assumptionStatement: 'I am established in this assumption.',
    primaryKeywords: ['assumption'],
    secondaryKeywords: [],
    semanticTags: [],
    synonyms: [],
    relatedCodes: [],
    status: 'published',
  })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderContouredSigil(rendered.svg, outlinePx(amplification)))}`
}

export function AssumptionFrames({
  elapsedMs,
  faceFrame,
  prescription,
}: {
  elapsedMs: number
  faceFrame: PrimePrescription['homunculus']['faces']['male']['frame']
  prescription: PrimePrescription
}) {
  return (
    <>
      <FaceLinks faceFrame={faceFrame} />
      {(Object.keys(FRAME_CLASS) as Array<keyof PrimePrescription['playlists']>).map((channel) => {
        const playlist = prescription.playlists[channel]
        const item = playlist[playlistIndex(elapsedMs, prescription.rotationSeconds, playlist.length)]
        return (
          <Frame
            amplification={item?.amplification ?? 1}
            code={item?.sigilCode ?? null}
            domain={channel}
            key={channel}
            label={FRAME_LABEL[channel]}
            opacity={item ? slotOpacity(elapsedMs, prescription.rotationSeconds) : 1}
            placement={FRAME_CLASS[channel]}
          />
        )
      })}
    </>
  )
}

function Frame({
  amplification,
  code,
  domain,
  label,
  opacity,
  placement,
}: {
  amplification: number
  code: string | null
  domain: keyof PrimePrescription['playlists']
  label: string
  opacity: number
  placement: string
}) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    setUrl(code ? svgUrl(code, domain, amplification) : '')
  }, [amplification, code, domain])

  return (
    <figure
      className={`pointer-events-none absolute z-20 w-[11%] ${placement}`}
      data-sigil={code ?? ''}
      data-testid={`prime-frame-${domain}`}
    >
      <figcaption className="mb-[0.35cqw] text-center text-[1.05cqw] uppercase tracking-[0.22em] text-white">
        {label}
      </figcaption>
      <div
        className="relative aspect-square overflow-hidden rounded-sm border border-white/80 bg-[rgba(7,11,16,0.5)] p-[10%] shadow-[0_0_14px_rgba(214,226,255,0.4)]"
        data-testid={`prime-frame-panel-${domain}`}
      >
        {url ? (
          <img alt="" className="h-full w-full bg-transparent object-contain" src={url} style={{ opacity }} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-center text-[1cqw] uppercase tracking-[0.16em] text-white/70">
            Empty
          </span>
        )}
      </div>
    </figure>
  )
}

function FaceLinks({ faceFrame }: { faceFrame: PrimePrescription['homunculus']['faces']['male']['frame'] }) {
  const [lines, setLines] = useState<Array<{ domain: Domain; x1: number; y1: number; x2: number; y2: number }>>([])

  useLayoutEffect(() => {
    const stage = document.querySelector('[data-testid="prime-stage"]')
    if (!(stage instanceof HTMLElement)) {
      return
    }

    function measure() {
      const bounds = stage instanceof HTMLElement ? stage.getBoundingClientRect() : null
      const face = document.querySelector('[data-testid="prime-face-receptacle"]')
      if (!bounds || !(face instanceof HTMLElement) || bounds.width === 0) {
        return
      }
      const faceBox = face.getBoundingClientRect()
      const next = (Object.keys(FACE_LINK) as Domain[]).flatMap((domain) => {
        const panel = document.querySelector(`[data-testid="prime-frame-panel-${domain}"]`)
        if (!(panel instanceof HTMLElement)) {
          return []
        }
        const link = FACE_LINK[domain]
        const start = cornerPoint(panel.getBoundingClientRect(), bounds, link.from)
        const end = cornerPoint(faceBox, bounds, link.to)
        return [{ domain, x1: start.x, y1: start.y, x2: end.x, y2: end.y }]
      })
      setLines(next)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    const face = document.querySelector('[data-testid="prime-face-receptacle"]')
    if (face instanceof HTMLElement) {
      observer.observe(face)
    }
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [faceFrame.left, faceFrame.top, faceFrame.size])

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[16] h-full w-full" data-testid="prime-face-links">
      {lines.map((line) => (
        <line
          data-testid={`prime-face-link-${line.domain}`}
          key={line.domain}
          stroke="rgba(244,247,251,0.9)"
          strokeLinecap="round"
          strokeWidth="1.25"
          x1={line.x1}
          x2={line.x2}
          y1={line.y1}
          y2={line.y2}
        />
      ))}
    </svg>
  )
}
