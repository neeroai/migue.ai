import { describe, it, expect } from '@jest/globals'
import { classifyInput } from '../../src/modules/webhook/application/input-router'
import type { NormalizedMessage } from '../../src/modules/webhook/domain/message-normalization'

function normalized(overrides: Partial<NormalizedMessage>): NormalizedMessage {
  return {
    from: '+573001112233',
    type: 'text',
    content: 'hola',
    mediaUrl: null,
    waMessageId: 'wamid.test',
    conversationId: undefined,
    timestamp: Date.now(),
    raw: {
      id: 'wamid.test',
      from: '573001112233',
      timestamp: `${Math.floor(Date.now() / 1000)}`,
      type: 'text',
      text: { body: 'hola' },
    } as any,
    ...overrides,
  }
}

describe('Input Router', () => {
  it('classifies plain text as TEXT_SIMPLE', () => {
    const result = classifyInput(normalized({ content: 'hola, como vas?' }))
    expect(result.inputClass).toBe('TEXT_SIMPLE')
  })

  it('classifies tool intent text as TEXT_TOOL_INTENT', () => {
    const result = classifyInput(normalized({ content: 'recuérdame pagar la luz mañana' }))
    expect(result.inputClass).toBe('TEXT_TOOL_INTENT')
  })

  it('classifies audio as RICH_INPUT', () => {
    const result = classifyInput(normalized({ type: 'audio', content: null, mediaUrl: 'media-id' }))
    expect(result.inputClass).toBe('RICH_INPUT')
  })

  it('classifies sticker as STICKER_STANDBY', () => {
    const result = classifyInput(normalized({ type: 'sticker', content: null, mediaUrl: 'sticker-id' }))
    expect(result.inputClass).toBe('STICKER_STANDBY')
  })

  it('classifies video as UNSUPPORTED', () => {
    const result = classifyInput(normalized({ type: 'video', content: null, mediaUrl: 'video-id' }))
    expect(result.inputClass).toBe('UNSUPPORTED')
  })
})
