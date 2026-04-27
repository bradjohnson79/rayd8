import { apiRequest } from './api'

interface PublicContactPayload {
  company?: string
  email: string
  message: string
  name: string
}

export function createPublicContactMessage(payload: PublicContactPayload) {
  return apiRequest<{
    delivery_email: string
    emailDelivered: boolean
    ok: true
  }>('/api/contact/public', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
