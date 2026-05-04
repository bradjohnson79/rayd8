import { useEffect, useState } from 'react'

interface PlayerPerformanceNoticeProps {
  playbackState: string
  smoothPlaybackMode: boolean
  sourceUrl: string | null
}

export function PlayerPerformanceNotice({
  playbackState,
  smoothPlaybackMode,
  sourceUrl,
}: PlayerPerformanceNoticeProps) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') {
      return
    }

    setEnabled(
      window.localStorage.getItem('rayd8-player-debug') === 'true' ||
        window.location.search.includes('rayd8PlayerDebug=true'),
    )
  }, [])

  if (!enabled) {
    return null
  }

  return (
    <div className="pointer-events-none absolute right-4 top-28 z-50 max-w-xs rounded-2xl border border-emerald-200/20 bg-black/72 px-4 py-3 text-xs leading-5 text-emerald-50 shadow-[0_14px_42px_rgba(0,0,0,0.35)]">
      <p className="font-semibold uppercase tracking-[0.24em] text-emerald-200/70">Player debug</p>
      <p className="mt-2">Status: {playbackState}</p>
      <p>Layer: primary only</p>
      <p>Smooth: {smoothPlaybackMode ? 'on' : 'off'}</p>
      <p className="truncate">Source: {sourceUrl ? 'loaded' : 'none'}</p>
    </div>
  )
}
