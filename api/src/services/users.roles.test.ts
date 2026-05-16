import { describe, expect, it } from 'vitest'
import { resolveUserRoleFromSources } from './users.js'

describe('resolveUserRoleFromSources', () => {
  it('preserves an existing database admin role as source of truth', () => {
    expect(
      resolveUserRoleFromSources({
        clerkRole: 'member',
        email: 'support@rayd8.app',
        existingRole: 'admin',
        sourceOfTruthAdminEmails: new Set(),
      }),
    ).toBe('admin')
  })

  it('promotes configured source-of-truth admin emails', () => {
    expect(
      resolveUserRoleFromSources({
        clerkRole: 'member',
        email: 'support@rayd8.app',
        existingRole: 'member',
        sourceOfTruthAdminEmails: new Set(['support@rayd8.app']),
      }),
    ).toBe('admin')
  })

  it('uses Clerk metadata when there is no existing database role', () => {
    expect(
      resolveUserRoleFromSources({
        clerkRole: 'admin',
        email: 'support@rayd8.app',
        sourceOfTruthAdminEmails: new Set(),
      }),
    ).toBe('admin')
  })
})
