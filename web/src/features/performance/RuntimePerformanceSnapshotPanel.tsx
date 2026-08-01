import { useEffect, useState } from 'react'
import { getAdaptivePerformanceManager } from './adaptivePerformanceManager'
import type { EffectivePerformanceProfile } from './adaptivePerformanceTypes'
import {
  getRuntimeResourceSnapshot,
  installRuntimeProbe,
  type RuntimeResourceSnapshot,
} from './runtimeResourceRegistry'
import { listRuntimeControllers } from './runtimeControllers'
import { readVisualPerformanceMode } from './visualPerformancePreference'

interface RuntimePerformanceSnapshotPanelProps {
  enabled: boolean
}

function formatBytes(value: number | null) {
  if (value == null) {
    return 'n/a'
  }
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function RuntimePerformanceSnapshotPanel({
  enabled,
}: RuntimePerformanceSnapshotPanelProps) {
  const [open, setOpen] = useState(false)
  const [snapshot, setSnapshot] = useState<RuntimeResourceSnapshot | null>(null)
  const [adaptive, setAdaptive] = useState<EffectivePerformanceProfile | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }
    installRuntimeProbe()
  }, [enabled])

  useEffect(() => {
    if (!enabled || !open) {
      return
    }

    const tick = () => {
      const next = getRuntimeResourceSnapshot()
      next.performanceMode = readVisualPerformanceMode()
      setSnapshot(next)
      setAdaptive(getAdaptivePerformanceManager()?.getProfile() ?? null)
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [enabled, open])

  if (!enabled) {
    return null
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2">
      <button
        className="pointer-events-auto rounded-full border border-white/15 bg-black/70 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white shadow-lg backdrop-blur-md"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Perf Snapshot
      </button>

      {open && snapshot ? (
        <div className="pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/12 bg-[rgba(5,8,12,0.92)] p-4 text-xs text-slate-200 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-200/70">
            Performance Snapshot
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
            <div className="col-span-2">
              <dt className="text-slate-500">Selected Mode</dt>
              <dd className="font-medium text-white">
                {adaptive?.mode ?? snapshot.performanceMode ?? 'automatic'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Effective Tier</dt>
              <dd className="font-medium text-white">{adaptive?.effectiveTier ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Activity State</dt>
              <dd className="font-medium text-white">{adaptive?.activityState ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Target FPS</dt>
              <dd className="font-medium text-white">{adaptive?.targetFps ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Render Scale</dt>
              <dd className="font-medium text-white">{adaptive?.renderScale ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">DPR Cap</dt>
              <dd className="font-medium text-white">
                {adaptive?.maxDevicePixelRatio ?? 'n/a'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Hidden</dt>
              <dd className="font-medium text-white">{document.hidden ? 'yes' : 'no'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Hamsa Contexts</dt>
              <dd className="font-medium text-white">{snapshot.hamsaContexts}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Amrita Loops</dt>
              <dd className="font-medium text-white">{snapshot.amritaLoops}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Video Players</dt>
              <dd className="font-medium text-white">{snapshot.videoPlayers}</dd>
            </div>
            <div>
              <dt className="text-slate-500">HLS Instances</dt>
              <dd className="font-medium text-white">{snapshot.hlsInstances}</dd>
            </div>
            <div>
              <dt className="text-slate-500">RAF Loops</dt>
              <dd className="font-medium text-white">{snapshot.rafLoops}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Timers</dt>
              <dd className="font-medium text-white">{snapshot.timers}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Heap Used</dt>
              <dd className="font-medium text-white">{formatBytes(snapshot.heapUsedBytes)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Last Tier Change</dt>
              <dd className="font-medium text-white">
                {adaptive?.lastTierChangeAt
                  ? new Date(adaptive.lastTierChangeAt).toLocaleTimeString()
                  : 'none'}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Reason</dt>
              <dd className="font-medium text-white">{adaptive?.reason ?? 'n/a'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Last Cleanup</dt>
              <dd className="font-medium text-white">
                {snapshot.lastCleanup
                  ? `${snapshot.lastCleanup.reason} @ ${new Date(snapshot.lastCleanup.at).toLocaleTimeString()}`
                  : 'none'}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Controllers:{' '}
            {listRuntimeControllers()
              .map((item) => item.id)
              .join(', ') || 'none'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
