import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sendAuthRequired } from '../http/errors.js'
import {
  attachReferralToUser,
  createReferralSession,
  getReferralSummaryForUser,
  normalizeReferralCode,
} from '../services/referrals.js'
import { syncUserFromClerk } from '../services/users.js'

const referralCodeSchema = z.object({
  referralCode: z.string().trim().min(1).max(32),
})

export const referralRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/referrals/session', async (request) => {
    const { referralCode } = referralCodeSchema.parse(request.body)
    const forwardedFor = request.headers['x-forwarded-for']
    const ipAddress =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]?.trim() ?? null
        : request.ip ?? null
    const userAgent =
      typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null

    await createReferralSession({
      ip: ipAddress,
      referralCode,
      userAgent,
    })

    return {
      captured: true,
      referralCode: normalizeReferralCode(referralCode),
    }
  })

  app.post('/v1/referrals/attach', async (request, reply) => {
    if (!request.auth?.userId) {
      return sendAuthRequired(reply)
    }

    const { referralCode } = referralCodeSchema.parse(request.body)
    await syncUserFromClerk(request.auth.userId)
    const result = await attachReferralToUser({
      referralCode,
      userId: request.auth.userId,
    })

    return {
      ...result,
      referralCode: normalizeReferralCode(referralCode),
    }
  })

  app.get('/v1/referrals/me', async (request, reply) => {
    if (!request.auth?.userId) {
      return sendAuthRequired(reply)
    }

    await syncUserFromClerk(request.auth.userId)

    return {
      summary: await getReferralSummaryForUser(request.auth.userId),
    }
  })
}
