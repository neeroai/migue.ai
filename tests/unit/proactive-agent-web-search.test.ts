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

  it('uses object tool result as fallback text when provider returns no assistant text', async () => {
    process.env.WEB_SEARCH_ENABLED = 'true'
    mockGenerateText.mockResolvedValueOnce({
      text: '   ',
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      finishReason: 'tool-calls',
      steps: [
        {
          toolCalls: [{ toolName: 'web_search' }],
          toolResults: [
            {
              output: {
                summary: 'Programación preliminar: desfiles centrales viernes y sábado.',
              },
            },
          ],
        },
      ],
      providerMetadata: {
        gateway: {
          model: 'google/gemini-2.5-flash-lite',
        },
      },
    })

    const response = await respond('busca en internet la programacion de los carnavales', 'u1', [])
    expect(response.text).toContain('Programación preliminar')
  })

  it('supports AI SDK v6 tool result shape using output field', async () => {
    process.env.WEB_SEARCH_ENABLED = 'true'
    mockGenerateText.mockResolvedValueOnce({
      text: ' ',
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      finishReason: 'tool-calls',
      steps: [
        {
          toolCalls: [{ toolName: 'web_search' }],
          toolResults: [
            {
              output: {
                results: [
                  {
                    title: 'Carnaval de Barranquilla',
                    url: 'https://example.com/carnaval',
                    snippet: 'Hoy hay desfile de la Batalla de Flores a las 11:00.',
                  },
                ],
              },
            },
          ],
        },
      ],
      providerMetadata: {
        gateway: {
          model: 'google/gemini-2.5-flash-lite',
        },
      },
    })

    const response = await respond('busca la programación de hoy en barranquilla', 'u1', [])
    expect(response.text.toLowerCase()).toContain('batalla de flores')
  })

  it('retries web search context when user confirms with "si" after failed search', async () => {
    process.env.WEB_SEARCH_ENABLED = 'true'
    mockGenerateText.mockResolvedValueOnce({
      text: '   ',
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      finishReason: 'tool-calls',
      steps: [{ toolCalls: [{ toolName: 'web_search' }], toolResults: [] }],
      providerMetadata: {
        gateway: { model: 'google/gemini-2.5-flash-lite' },
      },
    })

    const history: any[] = [
      { role: 'user', content: 'busca la programación de hoy en barranquilla de eventos del carnaval' },
      {
        role: 'assistant',
        content: 'Hice la búsqueda, pero no pude extraer resultados útiles. ¿Quieres que lo intente de nuevo con otro enfoque?',
      },
    ]

    const response = await respond('si', 'u1', history as any)
    const params = mockGenerateText.mock.calls[0]?.[0] as any
    const lastUserContent = params.messages[params.messages.length - 1]?.content as string

    expect(params.model).toBe('google/gemini-2.5-flash-lite')
    expect(lastUserContent).toContain('reintentar la búsqueda web previa')
    expect(lastUserContent).toContain('barranquilla')
    expect(response.text).toContain('Hice la búsqueda')
  })
})
