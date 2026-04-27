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
    return "You've used your Expansion preview time. Upgrade to continue full access."
  }

  if (access.blockReason === 'free_premium_limit_reached') {
    return "You've used your Premium preview time. Upgrade to continue full access."
  }

  if (access.blockReason === 'free_regen_limit_reached') {
    return "You've used your REGEN preview time. Upgrade to continue full access."
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

export const playerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/player/playback-token', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: 'Authentication required.' })
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
      return reply.code(403).send({
        error: getBlockedExperienceMessage(access),
      })
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
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    const { experience } = playbackAccessQuerySchema.parse(request.query)
    const access = await getExperienceAccess({
      experience,
      plan: request.auth.plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    return { access }
  })

  app.post('/v1/player/session/start', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    const { experience } = sessionStartSchema.parse(request.body)
    const access = await getExperienceAccess({
      experience,
      plan: request.auth.plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    if (!access.allowed) {
      return reply.code(403).send({
        error: getBlockedExperienceMessage(access),
      })
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
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    const { sessionId } = sessionHeartbeatSchema.parse(request.body)
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
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    const { sessionId } = sessionHeartbeatSchema.parse(request.body)
    const session = await endUsageSession({
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

    return { access, session }
  })
}
