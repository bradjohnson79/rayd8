import { useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'

async function cropToWebp(imageSrc: string, pixels: Area) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('Face image failed to load.'))
    element.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Face crop is unavailable.')
  }
  context.drawImage(image, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, 512, 512)
  return canvas.toDataURL('image/webp', 0.9)
}

export function FaceStudio({
  avatar,
  onAvatar,
  onFace,
}: {
  avatar: 'male' | 'female'
  onAvatar: (avatar: 'male' | 'female') => void
  onFace: (dataUrl: string | null) => void
}) {
  const [source, setSource] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [pixels, setPixels] = useState<Area | null>(null)

  useEffect(() => {
    return () => {
      if (source?.startsWith('blob:')) {
        URL.revokeObjectURL(source)
      }
    }
  }, [source])

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['male', 'female'] as const).map((choice) => (
          <button
            className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${avatar === choice ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
            key={choice}
            onClick={() => onAvatar(choice)}
            type="button"
          >
            {choice}
          </button>
        ))}
      </div>
      <label className="block text-xs text-white/70">
        Face image
        <input
          accept="image/jpeg,image/png,image/webp"
          className="mt-1 block text-xs"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) {
              return
            }
            setSource(URL.createObjectURL(file))
          }}
          type="file"
        />
      </label>
      {source ? (
        <div className="relative h-48 overflow-hidden rounded-2xl bg-black">
          <Cropper
            aspect={1}
            crop={crop}
            image={source}
            onCropChange={setCrop}
            onCropComplete={(_area, croppedPixels) => setPixels(croppedPixels)}
            onZoomChange={setZoom}
            zoom={zoom}
          />
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          className="rounded-full bg-white/15 px-3 py-1 text-xs text-white"
          onClick={() => {
            if (!source || !pixels) {
              return
            }
            void cropToWebp(source, pixels).then(onFace)
          }}
          type="button"
        >
          Confirm face
        </button>
        <button
          className="rounded-full bg-white/10 px-3 py-1 text-xs text-white"
          onClick={() => onFace(null)}
          type="button"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
