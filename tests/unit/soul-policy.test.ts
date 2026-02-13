import { describe, expect, it } from '@jest/globals'
import { enforceEmojiLimit, rewriteRoboticFallback } from '../../src/modules/ai/application/soul-policy'

describe('soul policy', () => {
  it('caps emojis to configured limit', () => {
    const text = 'Listo 😄🔥✅👍'
    const capped = enforceEmojiLimit(text, 2)
    const emojiCount = (capped.match(/\p{Extended_Pictographic}/gu) ?? []).length
    expect(emojiCount).toBeLessThanOrEqual(2)
  })

  it('rewrites robotic phrases into human alternatives', () => {
    const rewritten = rewriteRoboticFallback('Estoy aqui para ayudarte. En que te puedo ayudar hoy?')
    expect(rewritten.toLowerCase()).not.toContain('estoy aqui para ayudarte')
    expect(rewritten.toLowerCase()).toContain('qué necesitas ahora mismo')
  })
})
