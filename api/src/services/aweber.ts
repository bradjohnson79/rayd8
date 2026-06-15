import { env } from '../env.js'

export type AweberSubscriberSource =
  | 'amrita'
  | 'free_trial'
  | 'legacy_import'
  | 'premium'
  | 'regen'

export type AweberSyncStatus = 'created' | 'skipped' | 'updated'

export interface AweberSyncInput {
  email: string
  name?: string | null
  source: AweberSubscriberSource
}

export interface AweberSyncResult {
  email: string
  reason?: string
  status: AweberSyncStatus
  tag?: string
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

// TODO: When plan-change sync is added, call this service from subscription
// transitions so Aweber tags stay current for free -> REGEN -> AMRITA journeys.
const sourceTags: Record<AweberSubscriberSource, string> = {
  amrita: 'AMRITA',
  free_trial: 'Free Trial',
  legacy_import: 'Legacy Import',
  premium: 'Premium',
  regen: 'REGEN',
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
  tag: string
}) {
  await aweberRequest(`${input.listUrl}/subscribers`, input.accessToken, {
    body: JSON.stringify({
      email: input.email,
      name: input.name ?? input.email,
      tags: [input.tag],
    }),
    method: 'POST',
  })
}

async function updateAweberSubscriber(input: {
  accessToken: string
  subscriber: AweberSubscriberEntry
  tag: string
}) {
  if (!input.subscriber.self_link) {
    throw new Error('Aweber subscriber lookup did not include a self link.')
  }

  await aweberRequest(input.subscriber.self_link, input.accessToken, {
    body: JSON.stringify({
      tags: [input.tag],
    }),
    method: 'PATCH',
  })
}

export function getAweberTagForSource(source: AweberSubscriberSource) {
  return sourceTags[source]
}

export async function syncSubscriberToAweber(input: AweberSyncInput): Promise<AweberSyncResult> {
  const config = getAweberConfig()
  const tag = getAweberTagForSource(input.source)

  if (!config) {
    return {
      email: input.email,
      reason: isAweberEnabled() ? 'missing_aweber_config' : 'aweber_sync_disabled',
      status: 'skipped',
      tag,
    }
  }

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
      tag,
    })

    return {
      email: input.email,
      status: 'updated',
      tag,
    }
  }

  await createAweberSubscriber({
    accessToken,
    email: input.email,
    listUrl,
    name: input.name,
    tag,
  })

  return {
    email: input.email,
    status: 'created',
    tag,
  }
}
