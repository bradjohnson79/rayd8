import { env } from '../env.js'

export type AweberSubscriberSource =
  | 'amrita'
  | 'free_trial'
  | 'legacy_import'
  | 'premium'
  | 'regen'

export type AweberSyncPlan = 'amrita' | 'free' | 'regen'
export type AweberSyncStatus = 'already_exists' | 'failed' | 'skipped' | 'synced'

export interface AweberSyncInput {
  email: string
  name?: string | null
  source: AweberSubscriberSource
}

export interface AweberUserSyncInput {
  email: string
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  plan: AweberSyncPlan
  userId?: string | null
}

export type AweberSyncResult = {
  email?: string
  plan?: AweberSyncPlan
  reason?: string
  status: AweberSyncStatus
  tags?: string[]
}

interface AweberTokenResponse {
  access_token?: string
}

interface AweberSubscriberEntry {
  id?: string
  self_link?: string
}

interface AweberFindResponse {
  entries?: AweberSubscriberEntry[]
}

const AWEBER_AUTH_URL = 'https://auth.aweber.com/oauth2/token'
const AWEBER_API_BASE_URL = 'https://api.aweber.com/1.0'
export const PLAN_TAGS = ['plan-free', 'plan-regen', 'plan-amrita'] as const

const planTags: Record<AweberSyncPlan, string[]> = {
  amrita: ['rayd8', 'paid-member', 'amrita', 'plan-amrita', 'highest-tier'],
  free: ['rayd8', 'free-account', 'free-trial', 'plan-free'],
  regen: ['rayd8', 'paid-member', 'regen', 'plan-regen'],
}

function isAweberEnabled() {
  return env.AWEBER_SYNC_ENABLED === 'true'
}

function getAweberConfig() {
  if (!isAweberEnabled()) {
    return null
  }

  const requiredValues = [
    env.AWEBER_CLIENT_ID,
    env.AWEBER_CLIENT_SECRET,
    env.AWEBER_REFRESH_TOKEN,
    env.AWEBER_ACCOUNT_ID,
    env.AWEBER_LIST_ID,
  ]

  if (requiredValues.some((value) => !value)) {
    return null
  }

  return {
    accountId: env.AWEBER_ACCOUNT_ID as string,
    clientId: env.AWEBER_CLIENT_ID as string,
    clientSecret: env.AWEBER_CLIENT_SECRET as string,
    listId: env.AWEBER_LIST_ID as string,
    refreshToken: env.AWEBER_REFRESH_TOKEN as string,
  }
}

function getListUrl(config: NonNullable<ReturnType<typeof getAweberConfig>>) {
  return `${AWEBER_API_BASE_URL}/accounts/${encodeURIComponent(config.accountId)}/lists/${encodeURIComponent(config.listId)}`
}

async function refreshAweberAccessToken(config: NonNullable<ReturnType<typeof getAweberConfig>>) {
  const response = await fetch(AWEBER_AUTH_URL, {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Aweber token refresh failed with ${response.status}.`)
  }

  const payload = (await response.json()) as AweberTokenResponse

  if (!payload.access_token) {
    throw new Error('Aweber token refresh did not return an access token.')
  }

  return payload.access_token
}

async function aweberRequest<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`Aweber request failed with ${response.status}.`)
  }

  if (response.status === 204) {
    return {} as T
  }

  return (await response.json()) as T
}

async function findAweberSubscriber(input: {
  accessToken: string
  email: string
  listUrl: string
}) {
  const url = `${input.listUrl}/subscribers?ws.op=find&email=${encodeURIComponent(input.email)}`
  const payload = await aweberRequest<AweberFindResponse>(url, input.accessToken)
  return payload.entries?.[0] ?? null
}

async function createAweberSubscriber(input: {
  accessToken: string
  email: string
  listUrl: string
  name?: string | null
  tags: string[]
}) {
  await aweberRequest(`${input.listUrl}/subscribers`, input.accessToken, {
    body: JSON.stringify({
      email: input.email,
      name: input.name ?? input.email,
      tags: input.tags,
    }),
    method: 'POST',
  })
}

async function updateAweberSubscriber(input: {
  accessToken: string
  subscriber: AweberSubscriberEntry
  tags: string[]
}) {
  if (!input.subscriber.self_link) {
    throw new Error('Aweber subscriber lookup did not include a self link.')
  }

  // Aweber tag removal is intentionally not attempted here. Additive tags are
  // safe and idempotent; removing stale plan tags needs verified API semantics
  // so we do not accidentally remove unrelated marketing tags or subscriber state.
  await aweberRequest(input.subscriber.self_link, input.accessToken, {
    body: JSON.stringify({
      tags: input.tags,
    }),
    method: 'PATCH',
  })
}

export function getAweberTagForSource(source: AweberSubscriberSource) {
  switch (source) {
    case 'amrita':
      return 'plan-amrita'
    case 'free_trial':
      return 'plan-free'
    case 'regen':
      return 'plan-regen'
    default:
      return source
  }
}

export function getAweberTagsForPlan(plan: AweberSyncPlan) {
  return planTags[plan]
}

function getDisplayName(input: AweberUserSyncInput) {
  if (input.name?.trim()) {
    return input.name.trim()
  }

  const name = [input.firstName, input.lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ')

  return name || input.email
}

function sourceToPlan(source: AweberSubscriberSource): AweberSyncPlan | null {
  switch (source) {
    case 'amrita':
      return 'amrita'
    case 'free_trial':
      return 'free'
    case 'regen':
      return 'regen'
    default:
      return null
  }
}

export async function syncUserToAweber(input: AweberUserSyncInput): Promise<AweberSyncResult> {
  const config = getAweberConfig()
  const tags = getAweberTagsForPlan(input.plan)

  if (!config) {
    return {
      email: input.email,
      reason: isAweberEnabled() ? 'missing_aweber_config' : 'aweber_sync_disabled',
      status: 'skipped',
      plan: input.plan,
      tags,
    }
  }

  try {
    const accessToken = await refreshAweberAccessToken(config)
    const listUrl = getListUrl(config)
    const existingSubscriber = await findAweberSubscriber({
      accessToken,
      email: input.email,
      listUrl,
    })

    if (existingSubscriber) {
      await updateAweberSubscriber({
        accessToken,
        subscriber: existingSubscriber,
        tags,
      })

      return {
        email: input.email,
        plan: input.plan,
        status: 'already_exists',
        tags,
      }
    }

    await createAweberSubscriber({
      accessToken,
      email: input.email,
      listUrl,
      name: getDisplayName(input),
      tags,
    })

    return {
      email: input.email,
      plan: input.plan,
      status: 'synced',
      tags,
    }
  } catch (error) {
    return {
      email: input.email,
      plan: input.plan,
      reason: error instanceof Error ? error.message : 'Aweber sync failed.',
      status: 'failed',
      tags,
    }
  }
}

export async function safeSyncUserToAweber(input: AweberUserSyncInput): Promise<AweberSyncResult> {
  try {
    const result = await syncUserToAweber(input)

    if (result.status === 'failed') {
      console.error('[aweber] user sync failed', {
        email: input.email,
        plan: input.plan,
        reason: result.reason,
        userId: input.userId ?? null,
      })
    }

    return result
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Aweber sync failed.'

    console.error('[aweber] user sync failed', {
      email: input.email,
      plan: input.plan,
      reason,
      userId: input.userId ?? null,
    })

    return {
      email: input.email,
      plan: input.plan,
      reason,
      status: 'failed',
      tags: getAweberTagsForPlan(input.plan),
    }
  }
}

export async function syncSubscriberToAweber(input: AweberSyncInput): Promise<AweberSyncResult> {
  const plan = sourceToPlan(input.source)

  if (!plan) {
    return {
      email: input.email,
      reason: 'unsupported_aweber_source',
      status: 'skipped',
    }
  }

  return syncUserToAweber({
    email: input.email,
    name: input.name,
    plan,
  })
}
