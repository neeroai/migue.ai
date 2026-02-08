import { describe, it, expect } from '@jest/globals'
import { _testOnly } from '../../src/modules/agent/infra/ledger'
import type { NormalizedMessage } from '../../src/modules/webhook/domain/message-normalization'

function makeNormalized(overrides: Partial<NormalizedMessage> = {}): NormalizedMessage {
  return {
    from: '+573001112233',
    type: 'text',
    content: 'hola',
    mediaUrl: null,
    waMessageId: 'wamid.test.123',
    conversationId: undefined,
    timestamp: Date.now(),
    raw: {
      id: 'wamid.test.123',
      from: '573001112233',
      timestamp: `${Math.floor(Date.now() / 1000)}`,
      type: 'text',
      text: { body: 'hola' },
    } as any,
    ...overrides,
  }
}

describe('agent ledger utils', () => {
  it('builds idempotency key from wa message id when available', () => {
    const msg = makeNormalized({ waMessageId: 'wamid.custom' })
    const key = _testOnly.buildIdempotencyKey(msg, 'conv-1')
    expect(key).toBe('wamid.custom')
  })

  it('falls back to synthetic key when wa message id is empty', () => {
    const msg = makeNormalized({ waMessageId: '' as any, type: 'image' })
    const key = _testOnly.buildIdempotencyKey(msg, 'conv-abc')
    expect(key).toContain('conv-abc')
    expect(key).toContain('+573001112233')
    expect(key).toContain('image')
  })

  it('builds payload with expected normalized fields', () => {
    const msg = makeNormalized({ content: 'prueba', mediaUrl: 'media-1' })
    const payload = _testOnly.buildPayload(msg)

    expect(payload['from']).toBe('+573001112233')
    expect(payload['type']).toBe('text')
    expect(payload['content']).toBe('prueba')
    expect(payload['mediaUrl']).toBe('media-1')
    expect(payload['waMessageId']).toBe('wamid.test.123')
    expect(payload['raw']).toBeDefined()
  })
})
