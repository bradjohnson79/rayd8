import {
  createDefaultPrescription,
  DEFAULT_FACE_FRAMES,
  type PrimePrescription,
} from '../../../../api/src/modules/prime/core/prescription.ts'

const STORAGE_KEY = 'rayd8.prime.faceFrames.v1'

export type StoredFaceFrame = { left: number; top: number; size: number }

function validFrame(value: unknown): value is StoredFaceFrame {
  if (!value || typeof value !== 'object') {
    return false
  }
  const frame = value as StoredFaceFrame
  return (
    [frame.left, frame.top, frame.size].every((entry) => typeof entry === 'number' && Number.isFinite(entry)) &&
    frame.left >= 0 &&
    frame.left <= 80 &&
    frame.top >= 0 &&
    frame.top <= 80 &&
    frame.size >= 6 &&
    frame.size <= 40
  )
}

export function readStoredFaceFrames(): Partial<Record<'male' | 'female', StoredFaceFrame>> {
  if (typeof localStorage === 'undefined') {
    return {}
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    return {
      ...(validFrame(parsed.male) ? { male: parsed.male } : {}),
      ...(validFrame(parsed.female) ? { female: parsed.female } : {}),
    }
  } catch {
    return {}
  }
}

export function writeStoredFaceFrames(frames: Partial<Record<'male' | 'female', StoredFaceFrame>>) {
  const next = { ...readStoredFaceFrames(), ...frames }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

function sameFrame(left: StoredFaceFrame, right: StoredFaceFrame) {
  return left.left === right.left && left.top === right.top && left.size === right.size
}

function chooseFrame(avatar: 'male' | 'female', prescriptionFrame: StoredFaceFrame, stored?: StoredFaceFrame) {
  if (!stored) {
    return prescriptionFrame
  }
  if (sameFrame(prescriptionFrame, DEFAULT_FACE_FRAMES[avatar]) && !sameFrame(stored, DEFAULT_FACE_FRAMES[avatar])) {
    return stored
  }
  return prescriptionFrame
}

export function withStoredFaceFrames(prescription: PrimePrescription): PrimePrescription {
  const stored = readStoredFaceFrames()
  if (!stored.male && !stored.female) {
    return prescription
  }
  return {
    ...prescription,
    homunculus: {
      ...prescription.homunculus,
      faces: {
        male: { ...prescription.homunculus.faces.male, frame: chooseFrame('male', prescription.homunculus.faces.male.frame, stored.male) },
        female: {
          ...prescription.homunculus.faces.female,
          frame: chooseFrame('female', prescription.homunculus.faces.female.frame, stored.female),
        },
      },
    },
  }
}

export function prescriptionWithStoredFrames(): PrimePrescription {
  return withStoredFaceFrames(createDefaultPrescription())
}
