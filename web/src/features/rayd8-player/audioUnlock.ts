export const AUDIO_UNLOCK_PROMPT = 'Tap or press any key to continue the audio layer.'

export function isAudioUnlockPrompt(error: string | null) {
  return error === AUDIO_UNLOCK_PROMPT
}
