import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const planEnum = pgEnum('plan', ['free', 'premium', 'regen', 'amrita'])
export const roleEnum = pgEnum('role', ['member', 'admin'])
export const planTypeEnum = pgEnum('plan_type', ['single', 'multi'])
export const experienceEnum = pgEnum('experience', ['expansion', 'premium', 'regen'])
export const usagePeriodTypeEnum = pgEnum('usage_period_type', ['lifetime', 'billing_cycle'])
export const amplifierModeEnum = pgEnum('amplifier_mode', ['off', '5x', '10x', '20x'])
export const speedModeEnum = pgEnum('speed_mode', [
  'standard',
  'fast',
  'superFast',
  'slow',
  'superSlow',
])

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    role: roleEnum('role').notNull().default('member'),
    plan: planEnum('plan').notNull().default('free'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)],
)

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id').notNull(),
    status: text('status').notNull(),
    plan: planEnum('plan').notNull(),
    planType: planTypeEnum('plan_type').notNull().default('single'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('subscriptions_customer_idx').on(table.stripeCustomerId),
    uniqueIndex('subscriptions_subscription_idx').on(table.stripeSubscriptionId),
  ],
)

export const userSettings = pgTable(
  'user_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    amplifierMode: amplifierModeEnum('amplifier_mode').notNull().default('off'),
    blueLightEnabled: boolean('blue_light_enabled').notNull().default(false),
    circadianEnabled: boolean('circadian_enabled').notNull().default(false),
    lastSpeedMode: speedModeEnum('last_speed_mode').notNull().default('standard'),
  },
  (table) => [uniqueIndex('user_settings_user_idx').on(table.userId)],
)

export const stripeEvents = pgTable(
  'stripe_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stripeEventId: text('stripe_event_id').notNull(),
    type: text('type').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('stripe_events_event_id_idx').on(table.stripeEventId)],
)

export const stripeCheckoutSessions = pgTable(
  'stripe_checkout_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    stripeSessionId: text('stripe_session_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('stripe_checkout_sessions_session_id_idx').on(table.stripeSessionId)],
)

export const usageSessions = pgTable('usage_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  experience: experienceEnum('experience').notNull().default('expansion'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  secondsWatched: integer('seconds_watched').notNull().default(0),
  minutesWatched: integer('minutes_watched').notNull().default(0),
})

export const usagePeriods = pgTable(
  'usage_periods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    periodType: usagePeriodTypeEnum('period_type').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    expansionSeconds: integer('expansion_seconds').notNull().default(0),
    premiumSeconds: integer('premium_seconds').notNull().default(0),
    regenSeconds: integer('regen_seconds').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('usage_periods_user_period_idx').on(table.userId, table.periodType, table.periodStart),
  ],
)

export const userDevices = pgTable(
  'user_devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    deviceId: text('device_id').notNull(),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_devices_device_id_idx').on(table.deviceId)],
)

export const activeSessions = pgTable('active_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  deviceId: text('device_id').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true }).notNull().defaultNow(),
})

export const contactMessages = pgTable('contact_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('new'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
