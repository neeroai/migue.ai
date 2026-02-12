import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockGenerateText = jest.fn()
const mockPerplexitySearch = jest.fn(() => ({ __tool: 'web_search' }))
const mockTrackUsage = jest.fn()

jest.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  tool: (definition: unknown) => definition,
  gateway: {
    tools: {
      perplexitySearch: (...args: unknown[]) => mockPerplexitySearch(...args),
    },
  },
}))

jest.mock('../../src/modules/ai/domain/cost-tracker', () => ({
  getBudgetStatus: () => ({ dailyRemaining: 1 }),
  trackUsage: (...args: unknown[]) => mockTrackUsage(...args),
}))

jest.mock('../../src/modules/ai/domain/memory', () => ({
  containsPersonalFact: () => false,
  storeMemory: jest.fn(),
  extractProfileUpdates: () => ({}),
  upsertMemoryProfile: jest.fn(),
}))

import { respond } from '../../src/modules/ai/application/proactive-agent'
import { isWebSearchEnabled } from '../../src/modules/ai/application/runtime-flags'

describe('proactive-agent web search routing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGenerateText.mockResolvedValue({
      text: 'Listo.',
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      finishReason: 'stop',
      steps: [],
      providerMetadata: {
        gateway: {
          model: 'google/gemini-2.5-flash-lite',
        },
      },
    })
  })

  it('prefers gemini and exposes web_search when WEB_SEARCH_ENABLED=true', async () => {
    process.env.WEB_SEARCH_ENABLED = 'true'
    expect(isWebSearchEnabled()).toBe(true)

    await respond('busca noticias de ia hoy', 'u1', [])

    const params = mockGenerateText.mock.calls[0]?.[0] as any
    expect(params.model).toBe('google/gemini-2.5-flash-lite')
    expect(params.tools).toBeDefined()
    expect(Object.keys(params.tools)).toContain('web_search')
    expect(mockPerplexitySearch).toHaveBeenCalledTimes(1)
  })

  it('does not expose web_search when WEB_SEARCH_ENABLED=false', async () => {
    process.env.WEB_SEARCH_ENABLED = 'false'

    await respond('busca noticias de ia hoy', 'u1', [])

    const params = mockGenerateText.mock.calls[0]?.[0] as any
    expect(params.tools?.web_search).toBeUndefined()
    expect(mockPerplexitySearch).not.toHaveBeenCalled()
  })
})
