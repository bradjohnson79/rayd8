export const FIBONACCI_FORWARD = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144] as const
export const FIBONACCI_REVERSE = [89, 55, 34, 21, 13, 8, 5, 3, 2, 1, 1] as const

const FORWARD_SUM = FIBONACCI_FORWARD.reduce((sum, value) => sum + value, 0)
const REVERSE_SUM = FIBONACCI_REVERSE.reduce((sum, value) => sum + value, 0)

export const FIBONACCI_CYCLE_SECONDS = FORWARD_SUM * 2 + REVERSE_SUM * 2

export interface FibonacciPass {
  duration: number
  direction: 'down' | 'up'
  start: number
}

let cachedSchedule: FibonacciPass[] | null = null

export function fibonacciSchedule(): FibonacciPass[] {
  if (cachedSchedule) {
    return cachedSchedule
  }

  const schedule: FibonacciPass[] = []
  let start = 0

  for (const duration of [...FIBONACCI_FORWARD, ...FIBONACCI_REVERSE]) {
    for (const direction of ['down', 'up'] as const) {
      schedule.push({ duration, direction, start })
      start += duration
    }
  }

  cachedSchedule = schedule
  return schedule
}

export function locateFibonacciPass(elapsedSeconds: number) {
  const cycle = FIBONACCI_CYCLE_SECONDS
  const wrapped = ((elapsedSeconds % cycle) + cycle) % cycle
  const schedule = fibonacciSchedule()

  for (let index = 0; index < schedule.length; index += 1) {
    const pass = schedule[index]!
    const end = pass.start + pass.duration
    if (wrapped >= pass.start && wrapped < end) {
      return {
        index,
        duration: pass.duration,
        direction: pass.direction,
        start: pass.start,
        progress: (wrapped - pass.start) / pass.duration,
      }
    }
  }

  const first = schedule[0]!
  return {
    index: 0,
    duration: first.duration,
    direction: first.direction,
    start: 0,
    progress: 0,
  }
}

/** Progress 0 is fully off the entry edge. Progress 1 is fully off the exit edge. */
export function fibonacciFieldTop(input: {
  progress: number
  direction: 'down' | 'up'
  viewportHeight: number
  fieldHeight: number
}) {
  const travel = input.viewportHeight + input.fieldHeight
  if (input.direction === 'down') {
    return -input.fieldHeight + input.progress * travel
  }

  return input.viewportHeight - input.progress * travel
}
