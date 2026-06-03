import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAssetAllowedForExperience } from '../config/rayd8Expansion.js'
import {
  getMuxPlaybackToken,
  isMuxPlaybackSigningConfigured,
} from '../services/admin/muxAdmin.js'
import {
  type ExperienceAccessSummary,
  type Experience,
} from '../services/player/accessPolicy.js'
import { maybeDispatchStreamLimitReached } from '../services/notifications/streamLimitNotifications.js'
import {
  getTrialStatusForUser,
  type TrialBlockReason,
} from '../services/player/trialStatus.js'
import { getExperienceAccessForUser } from '../services/player/usageSummary.js'
import {
  endUsageSession,
  heartbeatUsageSession,
  startUsageSession,
} from '../services/player/usageTracking.js'

const experienceSchema = z.enum(['expansion', 'premium', 'regen'])

const playbackTokenQuerySchema = z.object({
  assetId: z.string().min(1),
  experience: experienceSchema,
})

const playbackAccessQuerySchema = z.object({
  experience: experienceSchema,
})

const sessionStartSchema = z.object({
  experience: experienceSchema,
})

const sessionHeartbeatSchema = z.object({
  sessionId: z.string().uuid(),
})

function getBlockedExperienceMessage(access: ExperienceAccessSummary) {
  if (access.blockReason === 'free_expansion_limit_reached') {
    return 'You have reached the preview limit for this experience. Upgrade to unlock unlimited access.'
  }

  if (access.blockReason === 'free_premium_limit_reached') {
    return 'You have reached the preview limit for this experience. Upgrade to unlock unlimited access.'
  }

  if (access.blockReason === 'free_regen_limit_reached') {
    return 'You have reached the preview limit for this experience. Upgrade to unlock unlimited access.'
  }

  if (access.blockReason === 'regen_total_limit_reached') {
    return "You've reached your monthly watch limit."
  }

  if (access.blockReason === 'plan_upgrade_required') {
    return 'This experience is not available on the current plan.'
  }

  return access.experience === 'regen'
    ? 'REGEN playback access is not available for the current plan or remaining allowance.'
    : 'Playback access has reached the current allowance for this plan.'
}

function getTrialAccessError(reason: TrialBlockReason) {
  if (reason === 'TRIAL_EXPIRED') {
    return {
      code: reason,
      error: 'Your 30-day free trial has ended. Upgrade to continue accessing RAYD8 sessions.',
    }
  }

  return {
    code: reason,
    error: 'You have used all 35 trial hours included with your free trial. Upgrade to continue using RAYD8.',
  }
}

function getBlockedExperienceError(access: ExperienceAccessSummary) {
  return {
    code: access.blockReason ?? 'PLAYBACK_ACCESS_BLOCKED',
    error: getBlockedExperienceMessage(access),
  }
}

function getAuthRequiredError() {
  return {
    code: 'AUTH_REQUIRED',
    error: 'AUTH_REQUIRED',
  }
}

async function getExperienceAccess(input: {
  experience: Experience
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  role: 'member' | 'admin'
  userId: string
}) {
  return getExperienceAccessForUser({
    experience: input.experience,
    plan: input.plan,
    role: input.role,
    userId: input.userId,
  })
}

async function assertTrialAccess(input: {
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  role: 'member' | 'admin'
  userId: string
}) {
  return getTrialStatusForUser(input)
}

export const playerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/player/playback-token', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send(getAuthRequiredError())
    }

    const trialStatus = await assertTrialAccess({
      plan: request.auth.plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    if (!trialStatus.allowed && trialStatus.reason) {
      return reply.code(403).send(getTrialAccessError(trialStatus.reason))
    }

    const { assetId, experience } = playbackTokenQuerySchema.parse(request.query)

    if (!isAssetAllowedForExperience(assetId, experience)) {
      return reply.code(403).send({
        error: 'This asset is not available for the requested RAYD8 experience.',
      })
    }

    const access = await getExperienceAccess({
      experience,
      plan: request.auth.plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    if (!access.allowed) {
      return reply.code(403).send(getBlockedExperienceError(access))
    }

    if (!isMuxPlaybackSigningConfigured()) {
      return reply.code(503).send({
        error:
          'Mux playback signing is not configured on the server. Add MUX_SIGNING_KEY_ID and MUX_SIGNING_KEY_PRIVATE.',
      })
    }

    const playback = await getMuxPlaybackToken(assetId)

    if (!playback) {
      return reply.code(404).send({
        error: 'Playback token could not be created for this asset.',
      })
    }

    return { playback }
  })

  app.get('/v1/player/access', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send(getAuthRequiredError())
    }

    const trialStatus = await assertTrialAccess({
      plan: request.auth.plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    if (!trialStatus.allowed && trialStatus.reason) {
      return reply.code(403).send(getTrialAccessError(trialStatus.reason))
    }

    const { experience } = playbackAccessQuerySchema.parse(request.query)
    const access = await getExperienceAccess({
      experience,
      plan: request.auth.plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    await maybeDispatchStreamLimitReached({
      access,
      plan: request.auth.plan,
      userId: request.auth.userId,
    })

    return { access }
  })

  app.post('/v1/player/session/start', async (request, reply) => {
    if (!request.auth?.userId) {
      console.log('SESSION START DEBUG:', {
        hasUser: false,
        hoursUsed: undefined,
        trialEndsAt: undefined,
        trialExpired: undefined,
        userId: undefined,
      })

      return reply.code(401).send(getAuthRequiredError())
    }

    const trialStatus = await assertTrialAccess({
      plan: request.auth.plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })
    const trialExpired = trialStatus.reason === 'TRIAL_EXPIRED'
    const hoursExceeded = trialStatus.reason === 'HOURS_EXCEEDED'

    console.log('SESSION START DEBUG:', {
      hasUser: true,
      hoursExceeded,
      hoursUsed: trialStatus.trial_hours_used,
      trialEndsAt: trialStatus.trial_ends_at,
      trialExpired,
      userId: request.auth.userId,
    })

    if (!trialStatus.allowed && trialStatus.reason) {
      return reply.code(403).send(getTrialAccessError(trialStatus.reason))
    }

    const { experience } = sessionStartSchema.parse(request.body)
    const access = await getExperienceAccess({
      experience,
      plan: request.auth.plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    if (!access.allowed) {
      await maybeDispatchStreamLimitReached({
        access,
        plan: request.auth.plan,
        userId: request.auth.userId,
      })
      return reply.code(403).send(getBlockedExperienceError(access))
    }

    const session = await startUsageSession({
      experience,
      plan: request.auth.plan,
      sessionId: randomUUID(),
      userId: request.auth.userId,
    })

    return { access, session }
  })

  app.post('/v1/player/session/heartbeat', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send(getAuthRequiredError())
    }

    const { sessionId } = sessionHeartbeatSchema.parse(request.body)
    const trialStatus = await assertTrialAccess({
      plan: request.auth.plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    if (!trialStatus.allowed && trialStatus.reason) {
      return reply.code(403).send(getTrialAccessError(trialStatus.reason))
    }

    const session = await heartbeatUsageSession({
      plan: request.auth.plan,
      sessionId,
      userId: request.auth.userId,
    })

    if (!session) {
      return reply.code(404).send({ error: 'Tracked playback session not found.' })
    }

    const access = await getExperienceAccess({
      experience: session.experience,
      plan: request.auth.plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    await maybeDispatchStreamLimitReached({
      access,
      plan: request.auth.plan,
      userId: request.auth.userId,
    })

    return {
      access: {
        ...access,
        state: !access.allowed ? 'soft_denied' : access.state,
      },
      session,
    }
  })

  app.post('/v1/player/session/end', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send(getAuthRequiredError())
    }

    const { sessionId } = sessionHeartbeatSchema.parse(request.body)
    const trialStatus = await assertTrialAccess({
      plan: request.auth.plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })
    const session = await endUsageSession({
      plan: request.auth.plan,
      sessionId,
      trackUsage: trialStatus.allowed,
      userId: request.auth.userId,
    })

    if (!session) {
      return reply.code(404).send({ error: 'Tracked playback session not found.' })
    }

    const access = await getExperienceAccess({
      experience: session.experience,
      plan: request.auth.plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    await maybeDispatchStreamLimitReached({
      access,
      plan: request.auth.plan,
      userId: request.auth.userId,
    })

    return { access, session }
  })
}
