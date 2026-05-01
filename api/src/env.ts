import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { z } from 'zod'

const currentDir = dirname(fileURLToPath(import.meta.url))

dotenv.config({
  path: resolve(currentDir, '../../.env'),
})

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  APP_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_JWT_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PREMIUM_PRICE_ID: z.string().optional(),
  STRIPE_REGEN_PRICE_ID: z.string().optional(),
  MUX_TOKEN_ID: z.string().optional(),
  MUX_TOKEN_SECRET: z.string().optional(),
  MUX_SIGNING_KEY_ID: z.string().optional(),
  MUX_SIGNING_KEY_PRIVATE: z.string().optional(),
  MUX_ENV_KEY: z.string().optional(),
  UMAMI_API_KEY: z.string().optional(),
  UMAMI_BASE_URL: z.string().optional(),
  UMAMI_WEBSITE_ID: z.string().optional(),
  OPEN_AI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  CONTACT_FROM_EMAIL: z.string().email().optional(),
  SOURCE_OF_TRUTH_ADMIN_EMAILS: z.string().optional(),
})

export const env = envSchema.parse(process.env)
