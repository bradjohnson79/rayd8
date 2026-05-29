export function isMobilePlaybackRefactorEnabled() {
  return import.meta.env.VITE_ENABLE_MOBILE_PLAYBACK_REFACTOR !== 'false'
}
