import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
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
export const seoRouteTypeEnum = pgEnum('seo_route_type', ['landing', 'conversion', 'support'])
export const seoActionTypeEnum = pgEnum('seo_action_type', ['apply', 'rollback'])
export const seoReportStatusEnum = pgEnum('seo_report_status', ['pending', 'complete', 'failed'])
export const cancellationReasonEnum = pgEnum('cancellation_reason', [
  'too_expensive',
  'not_using_enough',
  'technical_issues',
  'didnt_see_results',
  'found_alternative',
  'other',
])
export const affiliateCommissionStatusEnum = pgEnum('affiliate_commission_status', [
  'pending',
  'approved',
  'paid',
])
export const affiliateTrackingResultEnum = pgEnum('affiliate_tracking_result', [
  'success',
  'warning',
  'error',
])

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    referralCode: text('referral_code').notNull(),
    referredByUserId: text('referred_by_user_id').references((): AnyPgColumn => users.id),
    role: roleEnum('role').notNull().default('member'),
    plan: planEnum('plan').notNull().default('free'),
    trialStartedAt: timestamp('trial_started_at', { withTimezone: true }),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    trialHoursUsed: doublePrecision('trial_hours_used').notNull().default(0),
    trialNotificationsSent: jsonb('trial_notifications_sent').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    uniqueIndex('users_referral_code_idx').on(table.referralCode),
    index('users_referred_by_user_id_idx').on(table.referredByUserId),
  ],
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
    hasSeenRayd8GuideAt: timestamp('has_seen_rayd8_guide_at', { withTimezone: true }),
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

export const referralSessions = pgTable(
  'referral_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    referralCode: text('referral_code').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('referral_sessions_referral_code_idx').on(table.referralCode),
    index('referral_sessions_created_at_idx').on(table.createdAt),
  ],
)

export const affiliateCommissions = pgTable(
  'affiliate_commissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    affiliateUserId: text('affiliate_user_id')
      .notNull()
      .references(() => users.id),
    referredUserId: text('referred_user_id')
      .notNull()
      .references(() => users.id),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    amountUsd: integer('amount_usd').notNull().default(600),
    status: affiliateCommissionStatusEnum('status').notNull().default('pending'),
    source: text('source').notNull().default('stripe_invoice'),
    eventId: text('event_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('affiliate_commissions_subscription_idx').on(table.stripeSubscriptionId),
    uniqueIndex('affiliate_commissions_affiliate_referred_idx').on(
      table.affiliateUserId,
      table.referredUserId,
    ),
    index('affiliate_commissions_affiliate_user_idx').on(table.affiliateUserId),
    index('affiliate_commissions_referred_user_idx').on(table.referredUserId),
    index('affiliate_commissions_status_idx').on(table.status),
    index('affiliate_commissions_created_at_idx').on(table.createdAt),
  ],
)

export const affiliateTrackingEvents = pgTable(
  'affiliate_tracking_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventType: text('event_type').notNull(),
    result: affiliateTrackingResultEnum('result').notNull().default('success'),
    referralCode: text('referral_code'),
    affiliateUserId: text('affiliate_user_id').references(() => users.id),
    referredUserId: text('referred_user_id').references(() => users.id),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripeInvoiceId: text('stripe_invoice_id'),
    stripeEventId: text('stripe_event_id'),
    hasReferralMetadata: boolean('has_referral_metadata'),
    commissionCreated: boolean('commission_created'),
    message: text('message').notNull().default(''),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('affiliate_tracking_events_type_idx').on(table.eventType),
    index('affiliate_tracking_events_result_idx').on(table.result),
    index('affiliate_tracking_events_created_at_idx').on(table.createdAt),
    index('affiliate_tracking_events_subscription_idx').on(table.stripeSubscriptionId),
    index('affiliate_tracking_events_referral_code_idx').on(table.referralCode),
  ],
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

export const seoRouteMetadata = pgTable(
  'seo_route_metadata',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    path: text('path').notNull(),
    routeType: seoRouteTypeEnum('route_type').notNull().default('landing'),
    priority: integer('priority').notNull().default(50),
    title: text('title').notNull().default(''),
    description: text('description').notNull().default(''),
    keywords: jsonb('keywords').$type<string[]>().notNull().default([]),
    openGraph: jsonb('open_graph')
      .$type<{
        description?: string
        image?: string
        title?: string
        type?: string
        url?: string
      }>()
      .notNull()
      .default({}),
    index: boolean('index').notNull().default(true),
    follow: boolean('follow').notNull().default(true),
    canonicalUrl: text('canonical_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('seo_route_metadata_path_idx').on(table.path),
    index('seo_route_metadata_route_type_idx').on(table.routeType),
    index('seo_route_metadata_priority_idx').on(table.priority),
  ],
)

export const seoActions = pgTable(
  'seo_actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pageUrl: text('page_url').notNull(),
    actionType: seoActionTypeEnum('action_type').notNull(),
    beforeSnapshot: jsonb('before_snapshot').$type<Record<string, unknown>>().notNull().default({}),
    afterSnapshot: jsonb('after_snapshot').$type<Record<string, unknown>>().notNull().default({}),
    reasoning: text('reasoning').notNull().default(''),
    initiatedBy: text('initiated_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('seo_actions_page_url_idx').on(table.pageUrl),
    index('seo_actions_action_type_idx').on(table.actionType),
    index('seo_actions_created_at_idx').on(table.createdAt),
  ],
)

export const seoReports = pgTable(
  'seo_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    status: seoReportStatusEnum('status').notNull().default('pending'),
    summary: text('summary').notNull().default(''),
    fullReportJson: jsonb('full_report_json').$type<Record<string, unknown>>().notNull().default({}),
    relatedActionIds: jsonb('related_action_ids').$type<string[]>().notNull().default([]),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('seo_reports_status_idx').on(table.status),
    index('seo_reports_created_at_idx').on(table.createdAt),
  ],
)

export const seoAudits = pgTable(
  'seo_audits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    targetScope: text('target_scope').notNull().default('full_site'),
    score: integer('score').notNull().default(0),
    paths: jsonb('paths').$type<string[]>().notNull().default([]),
    issues: jsonb('issues').$type<Record<string, unknown>>().notNull().default({}),
    initiatedBy: text('initiated_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('seo_audits_created_at_idx').on(table.createdAt),
    index('seo_audits_score_idx').on(table.score),
  ],
)
