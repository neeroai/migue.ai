import { describe, expect, it } from '@jest/globals'
import { executeGovernedTool, evaluateToolPolicy, TOOL_CATALOG } from '../../src/modules/ai/application/tool-governance'

describe('tool governance policy', () => {
  it('catalog is versioned and includes required defaults', () => {
    expect(TOOL_CATALOG.web_search.schemaVersion).toBe('v1')
    expect(TOOL_CATALOG.web_search.timeoutMs).toBe(6000)
    expect(TOOL_CATALOG.send_whatsapp_message.riskLevel).toBe('high')
  })

  it('requires confirmation for medium risk tools on rich_input', () => {
    const result = evaluateToolPolicy('create_reminder', {
      userId: 'u1',
      pathway: 'rich_input',
    })
    expect(result.decision).toBe('confirm')
  })

  it('denies outbound messaging when destination is not allowlisted', () => {
    const result = evaluateToolPolicy('send_whatsapp_message', {
      userId: 'u1',
      pathway: 'tool_intent',
      explicitConsent: true,
      allowlistedRecipient: false,
    })
    expect(result.decision).toBe('deny')
  })

  it('does not execute side effect when policy blocks tool', async () => {
    let executed = false
    const output = await executeGovernedTool({
      toolName: 'track_expense',
      context: { userId: 'u1', pathway: 'rich_input' },
      input: { amount: 100 },
      execute: async () => {
        executed = true
        return 'ok'
      },
    })

    expect(output.status).toBe('blocked')
    expect(executed).toBe(false)
  })

  it('returns timeout error fallback when tool exceeds timeout', async () => {
    const output = await executeGovernedTool({
      toolName: 'memory_query',
      context: { userId: 'u1', pathway: 'tool_intent' },
      input: { q: 'hola' },
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 2100))
        return 'late'
      },
    })

    expect(output.status).toBe('error')
  })
})
