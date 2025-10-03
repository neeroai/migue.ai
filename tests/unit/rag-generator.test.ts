import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { generateResponse } from '../../lib/response'
import { chatCompletion, streamChatCompletion } from '../../lib/openai'
import { retrieveContext } from '../../lib/rag/use-rag'

jest.mock('../../lib/openai', () => ({
  chatCompletion: jest.fn(),
  streamChatCompletion: jest.fn(),
}))

jest.mock('../../lib/rag/use-rag', () => ({
  retrieveContext: jest.fn(),
}))

describe('generateResponse analyze_document', () => {
  beforeEach(() => {
    ;(chatCompletion as jest.Mock).mockResolvedValue('Respuesta fallback')
    ;(streamChatCompletion as jest.Mock).mockResolvedValue('Respuesta final')
    ;(retrieveContext as jest.Mock).mockResolvedValue([
      { content: 'Fragmento importante', chunkIndex: 0, score: 0.9 },
    ])
  })

  it('injects RAG context when available', async () => {
    const response = await generateResponse({
      intent: 'analyze_document',
      userMessage: '¿Qué dice el documento?',
      userId: 'user-1',
    })

    expect(retrieveContext).toHaveBeenCalledWith({
      userId: 'user-1',
      documentId: undefined,
      query: '¿Qué dice el documento?',
      topK: 5,
    })
    expect(streamChatCompletion).toHaveBeenCalled()
    expect(response).toBe('Respuesta final')
  })
})
