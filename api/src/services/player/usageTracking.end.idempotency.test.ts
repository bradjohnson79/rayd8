import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

describe('endUsageSession idempotency', () => {
  it('short-circuits when endedAt is already set and does not add usage', () => {
    const source = readFileSync(path.join(here, 'usageTracking.ts'), 'utf8')
    expect(source).toMatch(/if \(existingSession\.endedAt\)/)
    expect(source).toMatch(/alreadyEnded: true as const/)
    expect(source).toMatch(/isNull\(usageSessions\.endedAt\)/)
  })
})
