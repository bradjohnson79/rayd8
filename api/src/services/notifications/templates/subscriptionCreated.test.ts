import { describe, expect, it } from 'vitest'
import { renderSubscriptionCreatedTemplate } from './subscriptionCreated.js'

describe('subscription confirmed email', () => {
  it('writes billing dates as text and does not leave ISO timestamps for mail clients to link', () => {
    const { html, subject } = renderSubscriptionCreatedTemplate({
      currentPeriodEnd: '2026-11-21T21:01:59.000Z',
      currentPeriodStart: '2026-10-21T21:01:59.000Z',
      entityId: 'sub_test',
      plan: 'amrita',
      subscriptionId: 'sub_test',
      userEmail: 'member@example.test',
    })

    expect(subject).toBe('Your RAYD8 AMRITA subscription is active')
    expect(html).toContain('October 21, 2026')
    expect(html).toContain('November 21, 2026')
    expect(html).not.toContain('2026-10-21T21:01:59.000Z')
    expect(html).not.toContain('2026-11-21T21:01:59.000Z')
    expect(html).toContain('date=no')
    expect(html).toContain('color: #ffffff !important')
    expect(html).toContain('text-decoration: none !important')
  })
})
