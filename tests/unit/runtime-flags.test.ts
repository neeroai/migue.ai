import { describe, expect, it } from '@jest/globals'
import { _testOnly, isLegacyRoutingEnabled } from '../../src/modules/ai/application/runtime-flags'

describe('runtime flags', () => {
  it('parses boolean env values', () => {
    expect(_testOnly.parseBoolEnv(undefined)).toBe(false)
    expect(_testOnly.parseBoolEnv('true')).toBe(true)
    expect(_testOnly.parseBoolEnv('1')).toBe(true)
    expect(_testOnly.parseBoolEnv('yes')).toBe(true)
    expect(_testOnly.parseBoolEnv('false')).toBe(false)
  })

  it('reads LEGACY_ROUTING_ENABLED from env', () => {
    const prev = process.env.LEGACY_ROUTING_ENABLED

    process.env.LEGACY_ROUTING_ENABLED = 'true'
    expect(isLegacyRoutingEnabled()).toBe(true)

    process.env.LEGACY_ROUTING_ENABLED = 'false'
    expect(isLegacyRoutingEnabled()).toBe(false)

    if (prev === undefined) delete process.env.LEGACY_ROUTING_ENABLED
    else process.env.LEGACY_ROUTING_ENABLED = prev
  })
})
