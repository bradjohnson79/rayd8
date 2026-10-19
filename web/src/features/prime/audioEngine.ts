import {
  bassShelfDb,
  clampUnit,
  CYMATIC_GAIN_MAX,
  formulaFrequencies,
  MUSIC_GAIN_MAX,
  resolveSpatialMode,
  type OutputProfile,
} from '../../../../api/src/modules/prime/core/audio.ts'
import type { PrimePrescription } from '../../../../api/src/modules/prime/core/prescription.ts'

export class PrimeSpatialAudioEngine {
  private context: AudioContext | null = null
  private oscillators: OscillatorNode[] = []
  private musicElement: HTMLAudioElement | null = null
  private musicSource: MediaElementAudioSourceNode | null = null
  spatialMode: 'hrtf' | 'stereo' = 'stereo'
  private musicTime = 0
  private musicShouldContinue = false
  lastResumeError: string | null = null
  contextsOpened = 0
  musicElementsAttached = 0

  get musicPaused() {
    return this.musicElement ? this.musicElement.paused : null
  }

  get state(): AudioContextState | 'closed' {
    return this.context?.state ?? 'closed'
  }

  start(prescription: PrimePrescription) {
    if (this.context && this.context.state !== 'closed') {
      return
    }
    this.stop()
    const context = new AudioContext()
    this.contextsOpened += 1
    this.context = context
    const audio = prescription.audio
    const master = context.createGain()
    master.gain.value = 0.8
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.knee.value = 12
    compressor.ratio.value = 4
    compressor.connect(master)
    master.connect(context.destination)

    const shelf = context.createBiquadFilter()
    shelf.type = 'lowshelf'
    shelf.frequency.value = 80
    shelf.gain.value = bassShelfDb(audio.outputProfile) * audio.bassResonance
    shelf.connect(compressor)

    const cymaticGain = context.createGain()
    cymaticGain.gain.value = clampUnit(audio.cymaticGain, CYMATIC_GAIN_MAX)
    cymaticGain.connect(shelf)

    const hrtfAvailable = typeof context.createPanner === 'function'
    this.spatialMode = resolveSpatialMode(audio.outputProfile, audio.spatialMode, hrtfAvailable)
    const formula = formulaFrequencies(audio.frequencyFormula)
    const frequencies = [formula.bass, formula.fundamental, ...formula.harmonics]

    if (audio.audioMode !== 'music') {
      frequencies.forEach((frequency, index) => {
        const oscillator = context.createOscillator()
        oscillator.type = index === 0 ? 'sine' : 'triangle'
        oscillator.frequency.value = Math.max(40, frequency)
        const voice = context.createGain()
        voice.gain.value = index === 0 ? 0.8 : 0.35
        const panner = this.createPanner(context, audio.outputProfile, index, audio.harmonicPositioning)
        oscillator.connect(voice)
        voice.connect(panner)
        panner.connect(cymaticGain)
        oscillator.start()
        this.oscillators.push(oscillator)
      })
    }

    if (context.state === 'suspended') {
      void context.resume()
    }
  }

  attachMusic(element: HTMLAudioElement, prescription: PrimePrescription) {
    if (!this.context) {
      return 'element' as const
    }
    const gain = this.context.createGain()
    gain.gain.value = clampUnit(prescription.audio.musicGain, MUSIC_GAIN_MAX)
    try {
      element.crossOrigin = 'anonymous'
      this.musicSource = this.context.createMediaElementSource(element)
      this.musicSource.connect(gain)
      gain.connect(this.context.destination)
      this.musicElement = element
      this.musicElementsAttached += 1
      this.musicShouldContinue = false
      return 'graph' as const
    } catch {
      element.volume = clampUnit(prescription.audio.musicGain, MUSIC_GAIN_MAX)
      this.musicElement = element
      this.musicElementsAttached += 1
      this.musicShouldContinue = false
      return 'element' as const
    }
  }

  async suspend() {
    if (this.musicElement && !this.musicElement.paused) {
      this.musicTime = this.musicElement.currentTime
      this.musicShouldContinue = true
      this.musicElement.pause()
    }
    if (this.context && this.context.state === 'running') {
      await this.context.suspend()
    }
  }

  async resumePlayback() {
    this.lastResumeError = null
    if (!this.context) {
      this.lastResumeError = 'Audio context is closed.'
      return false
    }
    try {
      if (this.context.state === 'suspended') {
        await this.context.resume()
      }
    } catch (error) {
      this.lastResumeError = error instanceof Error ? error.message : 'Audio resume failed.'
      return false
    }
    if (this.musicElement && this.musicShouldContinue) {
      this.musicElement.currentTime = this.musicTime
      try {
        await this.musicElement.play()
      } catch (error) {
        this.lastResumeError = error instanceof Error ? error.message : 'Music resume failed.'
        return false
      }
    }
    return this.context.state === 'running'
  }

  stop() {
    for (const oscillator of this.oscillators) {
      try {
        oscillator.stop()
      } catch {
        // already stopped
      }
      oscillator.disconnect()
    }
    this.oscillators = []
    this.musicSource?.disconnect()
    this.musicSource = null
    if (this.musicElement) {
      this.musicElement.pause()
      this.musicElement.src = ''
    }
    this.musicElement = null
    if (this.context) {
      void this.context.close()
      this.context = null
    }
  }

  private createPanner(
    context: AudioContext,
    profile: OutputProfile,
    index: number,
    positioning: number,
  ) {
    if (this.spatialMode === 'hrtf') {
      const panner = context.createPanner()
      panner.panningModel = 'HRTF'
      panner.positionX.value = (index - 1) * positioning
      return panner
    }

    const panner = context.createStereoPanner()
    const width = profile === 'tv-soundbar' || profile === 'mobile-builtin' ? 0.35 : 0.8
    panner.pan.value = (index - 1) * positioning * width
    return panner
  }
}
