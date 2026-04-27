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
