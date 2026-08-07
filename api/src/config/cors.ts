import { env } from '../env.js'

export const CORRELATION_ID_HEADER = 'x-rayd8-correlation-id'

const allowedCorsOrigins = Array.from(
  new Set([
    env.APP_URL.trim(),
    'https://rayd8.app',
    'https://www.rayd8.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]),
)

/**
 * Single source of truth for CORS. Shared between the production server and
 * the reliability test harness so the authenticated status matrix exercises
 * the exact production CORS contract.
 */
export function buildCorsOptions(): {
  allowedHeaders: string[]
  credentials: boolean
  methods: string[]
  origin: string[]
} {
  return {
    allowedHeaders: ['Content-Type', 'Authorization', CORRELATION_ID_HEADER],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: allowedCorsOrigins,
  }
}

export { allowedCorsOrigins }
