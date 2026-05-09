import type { LandingAmbientProfile } from './landingAmbientProfile'

/** When omitted on BackgroundSystem: balanced if reducedEffects, else cinematic (dashboard/legal defaults). */
export function resolveAmbientProfile(
  ambientProfile: LandingAmbientProfile | null | undefined,
  reducedEffects: boolean,
): LandingAmbientProfile {
  if (ambientProfile != null) {
    return ambientProfile
  }
  return reducedEffects ? 'balanced' : 'cinematic'
}
