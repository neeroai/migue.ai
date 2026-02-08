import { describe, expect, it, jest, afterEach } from '@jest/globals'
import * as conversationUtils from '../../src/modules/conversation/application/utils'
import * as memoryDomain from '../../src/modules/ai/domain/memory'
import * as metrics from '../../src/shared/observability/metrics'
import { buildAgentContext } from '../../src/modules/ai/application/agent-context-builder'

afterEach(() => {
  jest.restoreAllMocks()
})

describe('agent context builder', () => {
  it('builds history + semantic memory + profile context', async () => {
    jest.spyOn(conversationUtils, 'getConversationHistory').mockResolvedValue([
      { id: '1', direction: 'inbound', type: 'text', content: 'hola', timestamp: '2026-01-01T00:00:00Z' },
    ])
    jest.spyOn(conversationUtils, 'trimHistoryByChars').mockImplementation((history: any) => history)
    jest.spyOn(conversationUtils, 'historyToModelMessages').mockReturnValue([{ role: 'user', content: 'hola' }] as any)

    jest.spyOn(memoryDomain, 'getMemoryProfile').mockResolvedValue({
      user_id: 'u1',
      display_name: 'Polo',
      tone_preference: 'informal',
      language_preference: 'es',
      timezone: 'America/Bogota',
      goals: {},
      constraints: {},
      updated_at: '2026-01-01T00:00:00Z',
    } as any)
    jest.spyOn(memoryDomain, 'buildMemoryProfileSummary').mockReturnValue('te llamas Polo, prefieres tono informal')
    jest.spyOn(memoryDomain, 'searchMemories').mockResolvedValue([
      { content: 'Trabajas en remoto', type: 'fact', similarity: 0.8 } as any,
    ])

    const emitSpy = jest.spyOn(metrics, 'emitSlaMetric').mockImplementation(() => {})

    const context = await buildAgentContext({
      conversationId: 'c1',
      userId: 'u1',
      userMessage: 'que sabes de mi',
      pathway: 'tool_intent',
    })

    expect(context.modelHistory.length).toBe(1)
    expect(context.memoryContext).toContain('USER MEMORY')
    expect(context.memoryContext).toContain('USER PROFILE')
    expect(context.profileSummary).toContain('Polo')
    expect(context.hasAnyContext).toBe(true)
    expect(emitSpy).toHaveBeenCalled()
  })

  it('skips semantic retrieval for text_fast_path by policy', async () => {
    jest.spyOn(conversationUtils, 'getConversationHistory').mockResolvedValue([] as any)
    jest.spyOn(conversationUtils, 'trimHistoryByChars').mockImplementation((history: any) => history)
    jest.spyOn(conversationUtils, 'historyToModelMessages').mockReturnValue([] as any)
    jest.spyOn(memoryDomain, 'getMemoryProfile').mockResolvedValue(null as any)
    const searchSpy = jest.spyOn(memoryDomain, 'searchMemories').mockResolvedValue([] as any)
    jest.spyOn(metrics, 'emitSlaMetric').mockImplementation(() => {})

    const context = await buildAgentContext({
      conversationId: 'c1',
      userId: 'u1',
      userMessage: 'hola',
      pathway: 'text_fast_path',
    })

    expect(searchSpy).not.toHaveBeenCalled()
    expect(Array.isArray(context.modelHistory)).toBe(true)
  })
})
