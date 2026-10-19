export type FoundryJobStatus = 'pending' | 'running' | 'paused' | 'cancelled' | 'failed' | 'completed'

export interface FoundryJob {
  id: string
  idempotencyKey: string
  sigilCode: string
  operation: 'generate' | 'regenerate'
  status: FoundryJobStatus
  attempts: number
  lastError: string | null
}

export function foundryJobKey(sigilCode: string, revision: number, operation: 'generate' | 'regenerate', nonce = 0) {
  return `${sigilCode}:${revision}:${operation}:${nonce}`
}

export function claimJob(job: FoundryJob): FoundryJob {
  if (job.status !== 'pending') {
    return job
  }

  return { ...job, status: 'running', attempts: job.attempts + 1 }
}

export function completeJob(job: FoundryJob): FoundryJob {
  if (job.status !== 'running') {
    return job
  }

  return { ...job, status: 'completed', lastError: null }
}

export function failJob(job: FoundryJob, error: string): FoundryJob {
  if (job.status !== 'running') {
    return job
  }

  return { ...job, status: 'failed', lastError: error }
}

export function pausePending(jobs: FoundryJob[]) {
  return jobs.map((job) => (job.status === 'pending' ? { ...job, status: 'paused' as const } : job))
}

export function resumePaused(jobs: FoundryJob[]) {
  return jobs.map((job) => (job.status === 'paused' ? { ...job, status: 'pending' as const } : job))
}

export function cancelPending(jobs: FoundryJob[]) {
  return jobs.map((job) =>
    job.status === 'pending' || job.status === 'paused' ? { ...job, status: 'cancelled' as const } : job,
  )
}

export function retryFailed(jobs: FoundryJob[]) {
  return jobs.map((job) =>
    job.status === 'failed' ? { ...job, status: 'pending' as const, lastError: null } : job,
  )
}

export function enqueueIdempotent(jobs: FoundryJob[], next: FoundryJob) {
  const existing = jobs.find((job) => job.idempotencyKey === next.idempotencyKey)
  if (existing && existing.status !== 'failed' && existing.status !== 'cancelled') {
    return jobs
  }

  return [...jobs.filter((job) => job.idempotencyKey !== next.idempotencyKey), next]
}
