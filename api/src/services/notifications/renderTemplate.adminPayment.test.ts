import { describe, expect, it } from 'vitest'
import { renderNotificationTemplate } from './renderTemplate.js'

const BASE_ADMIN_PAYMENT = {
  amount: 99,
  currency: 'usd',
  entityId: 'in_test',
  paymentId: 'in_test',
  plan: 'regen' as const,
}

describe('admin.payment.received email subject', () => {
  it('uses customer name when present', () => {
    const { subject } = renderNotificationTemplate('admin.payment.received', {
      ...BASE_ADMIN_PAYMENT,
      userEmail: 'jane@example.com',
      userName: 'John Smith',
    })
    expect(subject).toBe('NICE! YOU JUST GOT AN ORDER: RAYD8 Paid Subscription - John Smith')
  })

  it('falls back to email before Stripe customer name', () => {
    const { subject } = renderNotificationTemplate('admin.payment.received', {
      ...BASE_ADMIN_PAYMENT,
      stripeCustomerName: 'Stripe Nameson',
      userEmail: 'john@email.com',
    })
    expect(subject).toBe('NICE! YOU JUST GOT AN ORDER: RAYD8 Paid Subscription - john@email.com')
  })

  it('uses Stripe customer name when name and email missing', () => {
    const { subject } = renderNotificationTemplate('admin.payment.received', {
      ...BASE_ADMIN_PAYMENT,
      stripeCustomerName: 'Billing Name',
    })
    expect(subject).toBe('NICE! YOU JUST GOT AN ORDER: RAYD8 Paid Subscription - Billing Name')
  })

  it('uses New Customer when all identifiers missing', () => {
    const { subject } = renderNotificationTemplate('admin.payment.received', {
      ...BASE_ADMIN_PAYMENT,
    })
    expect(subject).toBe('NICE! YOU JUST GOT AN ORDER: RAYD8 Paid Subscription - New Customer')
  })
})
