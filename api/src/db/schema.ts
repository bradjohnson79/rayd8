import {
  boolean,
  index,
  integer,
  jsonb,
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
export const notificationRecipientTypeEnum = pgEnum('notification_recipient_type', ['user', 'admin'])
export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'sent',
  'failed',
  'skipped_duplicate',
  'dry_run',
])
export const cancellationReasonEnum = pgEnum('cancellation_reason', [
  'too_expensive',
  'not_using_enough',
  'technical_issues',
  'didnt_see_results',
  'found_alternative',
  'other',
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
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('subscriptions_customer_idx').on(table.stripeCustomerId),
    uniqueIndex('subscriptions_subscription_idx').on(table.stripeSubscriptionId),
  ],
)

export const subscriptionCancellationFeedback = pgTable(
  'subscription_cancellation_feedback',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    stripeSubscriptionId: text('stripe_subscription_id')
      .notNull()
      .references(() => subscriptions.stripeSubscriptionId),
    reasons: jsonb('reasons')
      .$type<Array<'too_expensive' | 'not_using_enough' | 'technical_issues' | 'didnt_see_results' | 'found_alternative' | 'other'>>()
      .notNull()
      .default([]),
    customMessage: text('custom_message'),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('subscription_cancellation_feedback_user_idx').on(table.userId),
    index('subscription_cancellation_feedback_subscription_idx').on(table.stripeSubscriptionId),
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

export const archivedAdminOrders = pgTable(
  'archived_admin_orders',
  {
    stripeSubscriptionId: text('stripe_subscription_id')
      .primaryKey()
      .references(() => subscriptions.stripeSubscriptionId),
    archivedAt: timestamp('archived_at', { withTimezone: true }).notNull().defaultNow(),
    archivedBy: text('archived_by'),
  },
  (table) => [index('archived_admin_orders_archived_at_idx').on(table.archivedAt)],
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

export const notificationSettings = pgTable('notification_settings', {
  id: text('id').primaryKey(),
  enabledEvents: jsonb('enabled_events')
    .$type<Record<string, boolean>>()
    .notNull()
    .default({}),
  adminRecipientsOverride: jsonb('admin_recipients_override')
    .$type<string[]>()
    .notNull()
    .default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const notificationsLog = pgTable(
  'notifications_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    event: text('event').notNull(),
    entityId: text('entity_id').notNull(),
    userId: text('user_id').references(() => users.id),
    recipient: text('recipient').notNull(),
    type: notificationRecipientTypeEnum('type').notNull(),
    status: notificationStatusEnum('status').notNull().default('pending'),
    error: text('error'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_log_event_idx').on(table.event),
    index('notifications_log_entity_id_idx').on(table.entityId),
    index('notifications_log_status_idx').on(table.status),
    index('notifications_log_event_entity_recipient_idx').on(
      table.event,
      table.entityId,
      table.recipient,
      table.type,
    ),
  ],
)
