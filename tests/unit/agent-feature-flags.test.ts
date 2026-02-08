import { describe, it, expect } from '@jest/globals'
import { _testOnly, isAgentEventLedgerEnabled } from '../../src/modules/agent/application/feature-flags'

describe('agent feature flags', () => {
  it('parses boolean env values correctly', () => {
    expect(_testOnly.parseBoolEnv(undefined)).toBe(false)
    expect(_testOnly.parseBoolEnv('')).toBe(false)
    expect(_testOnly.parseBoolEnv('true')).toBe(true)
    expect(_testOnly.parseBoolEnv('TRUE')).toBe(true)
    expect(_testOnly.parseBoolEnv('1')).toBe(true)
    expect(_testOnly.parseBoolEnv('yes')).toBe(true)
    expect(_testOnly.parseBoolEnv('on')).toBe(true)
    expect(_testOnly.parseBoolEnv('false')).toBe(false)
    expect(_testOnly.parseBoolEnv('0')).toBe(false)
  })

  it('reads AGENT_EVENT_LEDGER_ENABLED from process env', () => {
    const prev = process.env.AGENT_EVENT_LEDGER_ENABLED

    process.env.AGENT_EVENT_LEDGER_ENABLED = 'true'
    expect(isAgentEventLedgerEnabled()).toBe(true)

    process.env.AGENT_EVENT_LEDGER_ENABLED = 'false'
    expect(isAgentEventLedgerEnabled()).toBe(false)

    if (prev === undefined) {
      delete process.env.AGENT_EVENT_LEDGER_ENABLED
    } else {
      process.env.AGENT_EVENT_LEDGER_ENABLED = prev
    }
  })
})
