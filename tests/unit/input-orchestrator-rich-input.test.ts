import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import type { NormalizedMessage } from '../../src/modules/webhook/domain/message-normalization'

const mockSendWhatsAppText = jest.fn(async () => 'wamid.out')
const mockProcessDocumentMessage = jest.fn(async () => undefined)

jest.mock('../../src/modules/webhook/application/input-router', () => ({
  classifyInput: () => ({
    inputClass: 'RICH_INPUT',
    reason: 'test',
  }),
}))

jest.mock('../../src/modules/ai/application/processing', () => ({
  processAudioMessage: jest.fn(async () => undefined),
  processDocumentMessage: (...args: unknown[]) => mockProcessDocumentMessage(...args),
}))

jest.mock('../../src/shared/infra/whatsapp', () => ({
  sendWhatsAppText: (...args: unknown[]) => mockSendWhatsAppText(...args),
  reactWithWarning: jest.fn(async () => undefined),
}))

import { processInputByClass } from '../../src/modules/webhook/application/input-orchestrator'

function buildNormalized(overrides: Partial<NormalizedMessage> = {}): NormalizedMessage {
  return {
    from: '+573001112233',
    type: 'image',
    content: null,
    mediaUrl: 'media-123',
    waMessageId: 'wamid.test',
    timestamp: Date.now(),
    raw: { type: 'image' } as any,
    ...overrides,
  }
}

describe('input orchestrator rich input messaging', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not send progress placeholder texts for rich input', async () => {
    await processInputByClass({
      requestId: 'req-1',
      conversationId: 'conv-1',
      userId: 'user-1',
      normalized: buildNormalized(),
    })

    expect(mockProcessDocumentMessage).toHaveBeenCalledTimes(1)
    const calls = mockSendWhatsAppText.mock.calls.map((call) => String(call[1] ?? ''))
    expect(calls.some((text) => text.includes('Recibí tu archivo'))).toBe(false)
    expect(calls.some((text) => text.includes('está tardando más de lo normal'))).toBe(false)
  })
})
