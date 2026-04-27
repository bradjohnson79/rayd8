import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PlanTier } from '../../app/types'
import { MEDIA_SOURCES } from './mediaSources'
import type {
  AmplifierMode,
  PersistedPlayerSettings,
  PlayerState,
  SpeedMode,
} from './playerTypes'

const STORAGE_KEY = 'rayd8-player-settings'

const defaultPersistedSettings: PersistedPlayerSettings = {
  amplifierMode: 'off',
  blueLightEnabled: false,
  circadianEnabled: false,
  lastSpeedMode: 'standard',
}

function readPersistedSettings(): PersistedPlayerSettings {
  if (typeof window === 'undefined') {
    return defaultPersistedSettings
  }

  const rawSettings = window.localStorage.getItem(STORAGE_KEY)

  if (!rawSettings) {
    return defaultPersistedSettings
  }

  try {
    const parsed = JSON.parse(rawSettings) as Partial<PersistedPlayerSettings>

    return {
      amplifierMode:
        parsed.amplifierMode === '5x' ||
        parsed.amplifierMode === '10x' ||
        parsed.amplifierMode === '20x'
          ? parsed.amplifierMode
          : 'off',
      blueLightEnabled: Boolean(parsed.blueLightEnabled),
      circadianEnabled: Boolean(parsed.circadianEnabled),
      lastSpeedMode:
        parsed.lastSpeedMode === 'fast' ||
        parsed.lastSpeedMode === 'superFast' ||
        parsed.lastSpeedMode === 'slow' ||
        parsed.lastSpeedMode === 'superSlow'
          ? parsed.lastSpeedMode
          : 'standard',
    }
  } catch {
    return defaultPersistedSettings
  }
}

function persistSettings(settings: PersistedPlayerSettings) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

function toLegacyMediaPlan(plan: PlanTier) {
  return plan === 'amrita' ? 'premium' : plan
}

async function resetAndPlay(
  media: HTMLMediaElement | null,
  src: string,
  shouldPlay: boolean,
  muted = false,
) {
  if (!media) {
    return
  }

  media.pause()
  media.src = src
  media.load()
  media.currentTime = 0

  if (muted && media instanceof HTMLVideoElement) {
    media.muted = true
  }

  if (!shouldPlay) {
    return
  }

  try {
    await media.play()
  } catch {
    // Playback on mobile can fail until the first user activation.
  }
}

async function resumePlayback(media: HTMLMediaElement | null) {
  if (!media) {
    return
  }

  try {
    await media.play()
  } catch {
    // Ignore autoplay errors until the user taps to unlock.
  }
}

export function usePlayerState(plan: PlanTier) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState<Omit<PlayerState, 'plan'>>(() => ({
    audioUnlocked: false,
    amplifierMenuOpen: false,
    exitModalOpen: false,
    videoError: null,
    audioError: null,
    ...readPersistedSettings(),
  }))
  const playbackStateRef = useRef({
    audioUnlocked: state.audioUnlocked,
    lastSpeedMode: state.lastSpeedMode,
  })

  const persistedState = useMemo<PersistedPlayerSettings>(
    () => ({
      amplifierMode: state.amplifierMode,
      blueLightEnabled: state.blueLightEnabled,
      circadianEnabled: state.circadianEnabled,
      lastSpeedMode: state.lastSpeedMode,
    }),
    [
      state.amplifierMode,
      state.blueLightEnabled,
      state.circadianEnabled,
      state.lastSpeedMode,
    ],
  )

  const applyCurrentSources = useCallback(
    async (speedMode: SpeedMode, shouldPlay: boolean) => {
      const nextSources = MEDIA_SOURCES[toLegacyMediaPlan(plan)][speedMode]

      await resetAndPlay(videoRef.current, nextSources.video, shouldPlay, true)
      await resetAndPlay(audioRef.current, nextSources.audio, shouldPlay)
    },
    [plan],
  )

  useEffect(() => {
    persistSettings(persistedState)
  }, [persistedState])

  useEffect(() => {
    playbackStateRef.current = {
      audioUnlocked: state.audioUnlocked,
      lastSpeedMode: state.lastSpeedMode,
    }
  }, [state.audioUnlocked, state.lastSpeedMode])

  useEffect(() => {
    void applyCurrentSources(
      playbackStateRef.current.lastSpeedMode,
      playbackStateRef.current.audioUnlocked,
    )
  }, [applyCurrentSources])

  const setSpeedMode = useCallback(
    async (speedMode: SpeedMode) => {
      setState((currentState) => ({
        ...currentState,
        lastSpeedMode: speedMode,
        videoError: null,
        audioError: null,
      }))

      await applyCurrentSources(speedMode, state.audioUnlocked)
    },
    [applyCurrentSources, state.audioUnlocked],
  )

  const unlockPlayback = useCallback(async () => {
    setState((currentState) => ({
      ...currentState,
      audioUnlocked: true,
      videoError: null,
      audioError: null,
    }))

    if (!videoRef.current?.src || !audioRef.current?.src) {
      await applyCurrentSources(state.lastSpeedMode, true)
      return
    }

    await resumePlayback(videoRef.current)
    await resumePlayback(audioRef.current)
  }, [applyCurrentSources, state.lastSpeedMode])

  const setAmplifierMode = useCallback((amplifierMode: AmplifierMode) => {
    setState((currentState) => ({
      ...currentState,
      amplifierMode,
      amplifierMenuOpen: false,
    }))
  }, [])

  const toggleBlueLight = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      blueLightEnabled: !currentState.blueLightEnabled,
    }))
  }, [])

  const toggleCircadian = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      circadianEnabled: !currentState.circadianEnabled,
    }))
  }, [])

  const setAmplifierMenuOpen = useCallback((open: boolean) => {
    setState((currentState) => ({ ...currentState, amplifierMenuOpen: open }))
  }, [])

  const setExitModalOpen = useCallback((open: boolean) => {
    setState((currentState) => ({ ...currentState, exitModalOpen: open }))
  }, [])

  const setVideoError = useCallback((message: string | null) => {
    setState((currentState) => ({ ...currentState, videoError: message }))
  }, [])

  const setAudioError = useCallback((message: string | null) => {
    setState((currentState) => ({ ...currentState, audioError: message }))
  }, [])

  return {
    audioRef,
    state: {
      ...state,
      plan,
    },
    videoRef,
    actions: {
      setAmplifierMenuOpen,
      setAmplifierMode,
      setAudioError,
      setExitModalOpen,
      setSpeedMode,
      setVideoError,
      toggleBlueLight,
      toggleCircadian,
      unlockPlayback,
    },
  }
}
