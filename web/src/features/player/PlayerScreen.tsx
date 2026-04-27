import { useNavigate } from 'react-router-dom'
import type { PlanTier } from '../../app/types'
import { ConfirmModal } from '../../components/ConfirmModal'
import { AmplifierControl } from './AmplifierControl'
import { AudioLayer } from './AudioLayer'
import { CloseButton } from './CloseButton'
import { Gearbox } from './Gearbox'
import { OverlayLayer } from './OverlayLayer'
import { usePlayerState } from './usePlayerState'
import { VideoLayer } from './VideoLayer'

interface PlayerScreenProps {
  plan: PlanTier
}

export function PlayerScreen({ plan }: PlayerScreenProps) {
  const navigate = useNavigate()
  const { actions, audioRef, state, videoRef } = usePlayerState(plan)

  return (
    <>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,0.8fr)]">
        <div className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Player</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Controlled playback</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                One video layer, one audio layer, one overlay system. Speed changes reset playback
                and replay from zero.
              </p>
            </div>

            <CloseButton onClick={() => actions.setExitModalOpen(true)} />
          </div>

          <div className="relative aspect-[16/11] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl">
            <VideoLayer
              errorMessage={state.videoError}
              onError={actions.setVideoError}
              videoRef={videoRef}
            />
            <AudioLayer audioRef={audioRef} onError={actions.setAudioError} />
            <OverlayLayer
              amplifierMode={state.amplifierMode}
              blueLightEnabled={state.blueLightEnabled}
              circadianEnabled={state.circadianEnabled}
            />

            {!state.audioUnlocked ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-6 text-center">
                <div className="max-w-md rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 backdrop-blur-xl">
                  <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">
                    Start playback
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">
                    Tap once to unlock audio and video
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Mobile browsers require a first interaction before audio can play. After that,
                    switching speeds remains seamless.
                  </p>
                  <button
                    className="mt-6 w-full rounded-2xl bg-emerald-300/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-300/30"
                    onClick={() => void actions.unlockPlayback()}
                    type="button"
                  >
                    Start session
                  </button>
                </div>
              </div>
            ) : null}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-5">
              <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/60">Plan</p>
                <p className="mt-2 text-sm font-medium text-white">{state.plan.toUpperCase()}</p>
              </div>

              {state.audioError ? (
                <div className="pointer-events-auto rounded-2xl border border-amber-300/20 bg-slate-950/90 px-4 py-3 text-xs leading-5 text-amber-100">
                  {state.audioError}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Gearbox
            blueLightEnabled={state.blueLightEnabled}
            circadianEnabled={state.circadianEnabled}
            onSelectSpeed={(speedMode) => void actions.setSpeedMode(speedMode)}
            onToggleBlueLight={actions.toggleBlueLight}
            onToggleCircadian={actions.toggleCircadian}
            speedMode={state.lastSpeedMode}
          />

          <section className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Amplifier</p>
            <h3 className="mt-3 text-xl font-semibold text-white">Single active border mode</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Border emphasis stays isolated from the gearbox and uses one active mode at a time.
            </p>

            <div className="mt-5">
              <AmplifierControl
                amplifierMenuOpen={state.amplifierMenuOpen}
                amplifierMode={state.amplifierMode}
                onSelect={actions.setAmplifierMode}
                onToggleMenu={actions.setAmplifierMenuOpen}
              />
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Status</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>Playback unlock: {state.audioUnlocked ? 'ready' : 'waiting for first tap'}</p>
              <p>Current speed: {state.lastSpeedMode}</p>
              <p>Amplifier: {state.amplifierMode}</p>
              <p>Blue light filter: {state.blueLightEnabled ? 'on' : 'off'}</p>
              <p>Circadian mode: {state.circadianEnabled ? 'on' : 'off'}</p>
            </div>
          </section>
        </div>
      </section>

      <ConfirmModal
        description="Stay keeps playback active. Leave returns you to the instructions page."
        onPrimary={() => actions.setExitModalOpen(false)}
        onSecondary={() => navigate('/instructions')}
        open={state.exitModalOpen}
        primaryLabel="Stay"
        secondaryLabel="Leave"
        title="Leave the playback environment?"
      />
    </>
  )
}
