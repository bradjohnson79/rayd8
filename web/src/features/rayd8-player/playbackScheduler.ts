export class PlaybackScheduler {
  private readonly intervals = new Map<string, number>()
  private readonly timeouts = new Map<string, number>()
  private readonly frames = new Map<string, number>()

  clear(name: string) {
    const timeoutId = this.timeouts.get(name)

    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
      this.timeouts.delete(name)
    }

    const intervalId = this.intervals.get(name)

    if (intervalId !== undefined) {
      window.clearInterval(intervalId)
      this.intervals.delete(name)
    }

    const frameId = this.frames.get(name)

    if (frameId !== undefined) {
      window.cancelAnimationFrame(frameId)
      this.frames.delete(name)
    }
  }

  clearAll() {
    Array.from(this.timeouts.keys()).forEach((name) => this.clear(name))
    Array.from(this.intervals.keys()).forEach((name) => this.clear(name))
    Array.from(this.frames.keys()).forEach((name) => this.clear(name))
  }

  setInterval(name: string, callback: () => void, delay: number) {
    this.clear(name)
    const intervalId = window.setInterval(callback, delay)
    this.intervals.set(name, intervalId)
    return intervalId
  }

  setTimeout(name: string, callback: () => void, delay: number) {
    this.clear(name)
    const timeoutId = window.setTimeout(() => {
      this.timeouts.delete(name)
      callback()
    }, delay)
    this.timeouts.set(name, timeoutId)
    return timeoutId
  }

  requestAnimationFrame(name: string, callback: () => void) {
    if (this.frames.has(name)) {
      return this.frames.get(name) ?? null
    }

    const frameId = window.requestAnimationFrame(() => {
      this.frames.delete(name)
      callback()
    })
    this.frames.set(name, frameId)
    return frameId
  }
}
