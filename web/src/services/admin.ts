import { apiRequest } from './api'

export interface AdminOverview {
  totalUsers: number
  activeSubscribers: number
  currentStreamingSessions: number
  totalMinutesWatchedToday: number
  totalMinutesWatchedPast30Days: number
  averageVideoWatchTime: number
}

export interface AdminStripeRecord {
  clerk_user_id: string
  email: string
  stripe_customer_id: string
  stripe_subscription_id: string
  status: string
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  plan_type: 'single' | 'multi'
  created_at: string
  current_period_end: string | null
}

export interface AdminMuxAsset {
  asset_id: string
  playback_id: string | null
  duration_seconds: number
  status: string
  title: string
}

export interface AdminMuxStats {
  configured: boolean
  environment_key: string | null
  total_assets: number
  ready_assets: number
  processing_assets: number
  total_duration_seconds: number
}

export interface AdminUserRecord {
  id: string
  email: string
  role: 'member' | 'admin'
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  created_at: string
  subscription_status: string
  device_count: number
  active_session_count: number
}

export interface ContactMessageRecord {
  id: string
  user_id: string
  email: string
  subject: string
  message: string
  status: string
  created_at: string
}

export interface AdminNotificationEventInfo {
  event: string
  label: string
  recipientType: 'user' | 'admin'
  configurable: boolean
  enabled: boolean
}

export interface AdminNotificationSettings {
  adminRecipientsOverride: string[]
  effectiveAdminRecipients: string[]
  enabledEvents: Record<string, boolean>
}

export interface AdminNotificationEventsResponse {
  events: AdminNotificationEventInfo[]
  sample_payloads: Record<string, Record<string, unknown>>
  settings: AdminNotificationSettings
}

export interface AdminNotificationActivityRecord {
  id: string
  event: string
  entity_id: string
  recipient: string
  type: 'user' | 'admin'
  status: string
  error: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
  user_id: string | null
  payload: Record<string, unknown>
}

export interface AdminNotificationPreviewResponse {
  preview: {
    event: string
    html: string
    payload: Record<string, unknown>
    recipients: string[]
    subject: string
  }
}

export interface AdminNotificationTestResponse {
  result: {
    delivered: number
    recipients: string[]
    skipped: number
    subject?: string
    success: boolean
  }
}

export interface AdminNotificationRetryResponse {
  result: {
    results: Array<{ id: string; skipped?: boolean; success: boolean }>
    total: number
  }
}

export async function getAdminOverview(token: string) {
  return apiRequest<{ overview: AdminOverview }>('/api/admin/users/overview', undefined, token)
}

export async function getAdminUsers(token: string) {
  return apiRequest<{ users: AdminUserRecord[] }>('/api/admin/users', undefined, token)
}

export async function getAdminOrders(token: string) {
  return apiRequest<{ orders: AdminStripeRecord[] }>(
    '/api/admin/stripe/orders',
    undefined,
    token,
  )
}

export async function getAdminSubscribers(token: string) {
  return apiRequest<{ subscribers: AdminStripeRecord[] }>(
    '/api/admin/stripe/subscribers',
    undefined,
    token,
  )
}

export async function getAdminMuxAssets(token: string) {
  return apiRequest<{ assets: AdminMuxAsset[] }>('/api/admin/mux/assets', undefined, token)
}

export async function getAdminMuxStats(token: string) {
  return apiRequest<{ stats: AdminMuxStats }>('/api/admin/mux/stats', undefined, token)
}

export async function createAdminMuxUpload(token: string, title?: string) {
  return apiRequest<{
    upload: {
      upload_id: string
      upload_url: string | null
      status: string
    }
  }>(
    '/api/admin/mux/upload',
    {
      method: 'POST',
      body: JSON.stringify({ title }),
    },
    token,
  )
}

export async function getAdminMuxPlaybackToken(assetId: string, token: string) {
  return apiRequest<{
    playback: {
      asset_id: string
      playback_id: string
      expires_in_minutes: number
      signed_url: string
      token: string
    }
  }>(`/api/admin/mux/playback-token?assetId=${encodeURIComponent(assetId)}`, undefined, token)
}

export async function getAdminMessages(token: string) {
  return apiRequest<{ messages: ContactMessageRecord[] }>('/api/admin/messages', undefined, token)
}

export async function getAdminNotificationEvents(token: string) {
  return apiRequest<AdminNotificationEventsResponse>('/api/admin/notifications/events', undefined, token)
}

export async function getAdminNotificationActivity(token: string) {
  return apiRequest<{ activity: AdminNotificationActivityRecord[] }>(
    '/api/admin/notifications/activity',
    undefined,
    token,
  )
}

export async function previewAdminNotification(
  payload: {
    event: string
    payload?: Record<string, unknown>
    recipientOverride?: string[]
  },
  token: string,
) {
  return apiRequest<AdminNotificationPreviewResponse>(
    '/api/admin/notifications/preview',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function sendAdminNotificationTest(
  payload: {
    event: string
    messageOverride?: string
    payload?: Record<string, unknown>
    recipientOverride?: string[]
  },
  token: string,
) {
  return apiRequest<AdminNotificationTestResponse>(
    '/api/admin/notifications/test',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function retryAdminNotifications(payload: { ids?: string[] }, token: string) {
  return apiRequest<AdminNotificationRetryResponse>(
    '/api/admin/notifications/retry',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function updateAdminNotificationSettings(
  payload: {
    adminRecipientsOverride?: string[]
    enabledEvents?: Record<string, boolean>
  },
  token: string,
) {
  return apiRequest<{ settings: AdminNotificationSettings }>(
    '/api/admin/notifications/settings',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function createContactMessage(
  payload: { email: string; message: string; name: string },
  token: string,
) {
  return apiRequest<{
    delivery_email: string
    emailDelivered: boolean
    message: ContactMessageRecord | null
    ok: true
  }>(
    '/api/contact',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}
