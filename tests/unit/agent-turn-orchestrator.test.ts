import { describe, expect, it, jest, beforeEach } from '@jest/globals'

let mockRespond = jest.fn()

jest.mock('../../src/modules/ai/application/agent-context-builder', () => ({
  __esModule: true,
  buildAgentContext: jest.fn(),
}))

jest.mock('../../src/modules/ai/application/proactive-agent', () => ({
  __esModule: true,
  createProactiveAgent: () => ({
    respond: (...args: unknown[]) => mockRespond(...args),
  }),
}))

import { buildAgentContext } from '../../src/modules/ai/application/agent-context-builder'
import { executeAgentTurn } from '../../src/modules/ai/application/agent-turn-orchestrator'

beforeEach(() => {
  mockRespond = jest.fn()
  jest.clearAllMocks()
})

describe('agent turn orchestrator', () => {
  it('enables tools by default when legacy routing is disabled', async () => {
    delete process.env.LEGACY_ROUTING_ENABLED

    ;(buildAgentContext as jest.Mock).mockResolvedValue({
      modelHistory: [{ role: 'user', content: 'hola' }],
      memoryContext: '',
      profileSummary: '',
      hasAnyContext: true,
    })

    mockRespond.mockResolvedValue({
      text: 'Respuesta final',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      cost: { input: 0.001, output: 0.001, total: 0.002 },
      finishReason: 'stop',
      toolCalls: 0,
    })

    await executeAgentTurn({
      conversationId: 'c1',
      userId: 'u1',
      userMessage: 'hola',
      messageId: 'w1',
      pathway: 'text_fast_path',
    })

    expect(mockRespond).toHaveBeenCalledWith(
      'hola',
      'u1',
      expect.any(Array),
      expect.objectContaining({
        toolPolicy: { toolsEnabled: true, explicitConsent: false },
      })
    )
  })

  it('disables tools in legacy mode without explicit tool intent', async () => {
    process.env.LEGACY_ROUTING_ENABLED = 'true'

    ;(buildAgentContext as jest.Mock).mockResolvedValue({
      modelHistory: [{ role: 'user', content: 'hola' }],
      memoryContext: '',
      profileSummary: '',
      hasAnyContext: true,
    })

    mockRespond.mockResolvedValue({
      text: 'Respuesta final',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      cost: { input: 0.001, output: 0.001, total: 0.002 },
      finishReason: 'stop',
      toolCalls: 0,
    })

    await executeAgentTurn({
      conversationId: 'c1',
      userId: 'u1',
      userMessage: 'hola',
      messageId: 'w1',
      pathway: 'text_fast_path',
    })

    expect(mockRespond).toHaveBeenCalledWith(
      'hola',
      'u1',
      expect.any(Array),
      expect.objectContaining({
        toolPolicy: { toolsEnabled: false, explicitConsent: false },
      })
    )
  })

  it('propagates explicit tool consent to tool policy context', async () => {
    delete process.env.LEGACY_ROUTING_ENABLED

    ;(buildAgentContext as jest.Mock).mockResolvedValue({
      modelHistory: [{ role: 'user', content: 'hola' }],
      memoryContext: '',
      profileSummary: '',
      hasAnyContext: true,
    })

    mockRespond.mockResolvedValue({
      text: 'Respuesta final',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      cost: { input: 0.001, output: 0.001, total: 0.002 },
      finishReason: 'stop',
      toolCalls: 0,
    })

    await executeAgentTurn({
      conversationId: 'c1',
      userId: 'u1',
      userMessage: 'hola',
      messageId: 'w1',
      pathway: 'rich_input',
      explicitToolConsent: true,
    })

    expect(mockRespond).toHaveBeenCalledWith(
      'hola',
      'u1',
      expect.any(Array),
      expect.objectContaining({
        toolPolicy: { toolsEnabled: true, explicitConsent: true },
      })
    )
  })

  it('executes context + proactive agent and returns normalized response', async () => {
    delete process.env.LEGACY_ROUTING_ENABLED
    ;(buildAgentContext as jest.Mock).mockResolvedValue({
      modelHistory: [{ role: 'user', content: 'hola' }],
      memoryContext: '',
      profileSummary: '',
      hasAnyContext: true,
    })

    mockRespond.mockResolvedValue({
      text: 'Respuesta final',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      cost: { input: 0.001, output: 0.001, total: 0.002 },
      finishReason: 'stop',
      toolCalls: 0,
    })

    const result = await executeAgentTurn({
      conversationId: 'c1',
      userId: 'u1',
      userMessage: 'hola',
      messageId: 'w1',
      pathway: 'text_fast_path',
    })

    expect(result.responseText).toBe('Respuesta final')
    expect(result.raw.toolCalls).toBe(0)
  })

  it('falls back to human confirmation text on empty tool response', async () => {
    delete process.env.LEGACY_ROUTING_ENABLED
    ;(buildAgentContext as jest.Mock).mockResolvedValue({
      modelHistory: [],
      memoryContext: '',
      profileSummary: '',
      hasAnyContext: false,
    })

    mockRespond.mockResolvedValue({
      text: '   ',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      cost: { input: 0.001, output: 0.001, total: 0.002 },
      finishReason: 'tool-calls',
      toolCalls: 1,
    })

    const result = await executeAgentTurn({
      conversationId: 'c1',
      userId: 'u1',
      userMessage: 'avisame',
      messageId: 'w1',
      pathway: 'tool_intent',
    })

    expect(result.responseText).toContain('ya quedó')
    expect(result.raw.toolCalls).toBe(1)
  })
})
