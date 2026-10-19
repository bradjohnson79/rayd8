import { useRef, type PointerEvent } from 'react'
import { rgbCss, type SpectralId } from '../../../../../api/src/modules/prime/core/palette.ts'
import { faceFrameHeight, type PrimePrescription } from '../../../../../api/src/modules/prime/core/prescription.ts'

type FaceFrame = PrimePrescription['homunculus']['faces']['male']['frame']

function roundTenth(value: number) {
  return Math.round(value * 10) / 10
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function HomunculusStage({
  avatar,
  faceUrl,
  scale,
  offsetX,
  offsetY,
  frame,
  placing = false,
  onFrame,
}: {
  avatar: 'male' | 'female'
  faceUrl: string | null
  scale: number
  offsetX: number
  offsetY: number
  frame: FaceFrame
  placing?: boolean
  onFrame?: (frame: FaceFrame) => void
}) {
  const frameRef = useRef(frame)
  const onFrameRef = useRef(onFrame)
  frameRef.current = frame
  onFrameRef.current = onFrame
  const drag = useRef<null | {
    mode: 'move' | 'resize'
    x: number
    y: number
    frame: FaceFrame
    width: number
    height: number
  }>(null)
  const height = faceFrameHeight(frame.size)

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!placing) {
      return
    }
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!bounds) {
      return
    }
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Drag still follows pointermove events on the frame when capture is unavailable.
    }
    const resize = event.target instanceof HTMLElement && event.target.dataset.resize === 'true'
    drag.current = {
      mode: resize ? 'resize' : 'move',
      x: event.clientX,
      y: event.clientY,
      frame: frameRef.current,
      width: bounds.width,
      height: bounds.height,
    }
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current
    const update = onFrameRef.current
    if (!active || !update) {
      return
    }
    const dx = ((event.clientX - active.x) / active.width) * 100
    const dy = ((event.clientY - active.y) / active.height) * 100
    if (active.mode === 'move') {
      const boxHeight = faceFrameHeight(active.frame.size)
      update({
        left: clamp(roundTenth(active.frame.left + dx), 0, 100 - active.frame.size),
        top: clamp(roundTenth(active.frame.top + dy), 0, 100 - boxHeight),
        size: active.frame.size,
      })
      return
    }
    const size = clamp(roundTenth(active.frame.size + dx), 6, 40)
    const boxHeight = faceFrameHeight(size)
    update({
      left: clamp(active.frame.left, 0, 100 - size),
      top: clamp(active.frame.top, 0, 100 - boxHeight),
      size,
    })
  }

  return (
    <div
      className={`pointer-events-none absolute inset-x-[24%] bottom-[24%] top-[28%] flex items-center justify-center ${placing ? 'z-[28]' : 'z-10'}`}
    >
      <div className="relative aspect-[9/16] h-full">
        <img
          alt=""
          className="h-full w-full object-contain"
          src={avatar === 'female' ? '/prime/avatars/female.png' : '/prime/avatars/male.png'}
        />
        <div
          className={
            placing
              ? 'pointer-events-auto absolute cursor-move touch-none border-2 border-cyan-100 bg-cyan-100/15 shadow-[0_0_0_1px_rgba(0,0,0,0.65)]'
              : 'absolute overflow-hidden rounded-[46%]'
          }
          data-testid="prime-face-receptacle"
          aria-label={placing ? `${avatar} face frame` : undefined}
          role={placing ? 'button' : undefined}
          tabIndex={placing ? 0 : undefined}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={() => {
            drag.current = null
          }}
          style={{ left: `${frame.left}%`, top: `${frame.top}%`, width: `${frame.size}%`, height: `${height}%` }}
        >
          {faceUrl ? (
            <img
              alt=""
              className="h-full w-full object-cover"
              data-testid="prime-face-image"
              src={faceUrl}
              style={{ transform: `translate(${offsetX}%, ${offsetY}%) scale(${scale})` }}
            />
          ) : null}
          {placing ? (
            <>
              <span className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-white" />
              <span className="pointer-events-none absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-white" />
              <span className="pointer-events-none absolute left-1 top-1 text-[10px] uppercase tracking-[0.14em] text-white">
                {avatar}
              </span>
              <span
                className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-black bg-white"
                data-resize="true"
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function ChargingBorder({
  elapsedMs,
  prescription,
}: {
  elapsedMs: number
  prescription: PrimePrescription
}) {
  if (!prescription.border.enabled) {
    return null
  }
  const pulse = prescription.border.mode === 'dynamic' ? 0.45 + (Math.sin(elapsedMs / 700) + 1) * 0.2 : 0.75
  const color = rgbCss(prescription.border.color as SpectralId)
  return (
    <div
      className="pointer-events-none absolute inset-3 z-30 rounded-[2rem] border"
      style={{ borderColor: color, boxShadow: `inset 0 0 18px ${color}`, opacity: Math.min(pulse, 0.55) }}
    />
  )
}

export function PerimeterGlyphs({ prescription }: { prescription: PrimePrescription }) {
  if (!prescription.perimeter.enabled) {
    return null
  }
  const marks = ['Sample Sun', 'Sample Life Path', 'Sample Name Number', 'Fixture']
  return (
    <div className="pointer-events-none absolute inset-[7%] z-[6]">
      {marks.map((mark, index) => (
        <span
          className="absolute text-[10px] uppercase tracking-[0.18em] text-amber-100/80"
          key={mark}
          style={{
            left: index % 2 === 0 ? '4%' : '78%',
            top: index < 2 ? '18%' : '72%',
          }}
        >
          {mark}
        </span>
      ))}
      <p className="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-[10px] text-white/50">
        {prescription.perimeter.sampleLabel}
      </p>
    </div>
  )
}

export function AuroraLayer({ enabled, reducedMotion }: { enabled: boolean; reducedMotion: boolean }) {
  if (!enabled) {
    return <div className="absolute inset-0 bg-[#070b10]" />
  }
  return (
    <div className="absolute inset-0 bg-[#070b10]">
      <div
        className={`absolute -left-[10%] top-[-20%] h-[70%] w-[70%] rounded-full bg-emerald-500/20 blur-3xl ${reducedMotion ? '' : 'animate-pulse'}`}
      />
      <div className="absolute right-[-10%] bottom-[-10%] h-[60%] w-[60%] rounded-full bg-indigo-500/20 blur-3xl" />
    </div>
  )
}
