import { describe, expect, it } from '@jest/globals'
import { composeSoulSystemPrompt } from '../../src/modules/ai/application/soul-composer'

describe('soul composer', () => {
  it('injects locale directive when city confidence is high', () => {
    const prompt = composeSoulSystemPrompt({
      pathway: 'default',
      userMessage: 'hola',
      useShortPrompt: true,
      memoryContext: '',
      recallQuestion: false,
      profileSummary: 'te llamas Ana',
      localeStyle: {
        city: 'medellin',
        confidence: 0.83,
        variant: 'paisa_cercano',
        emojiPolicy: 'natural',
      },
      nowIsoUtc: '2026-02-13T00:00:00.000Z',
      nowBogotaText: '13/02/2026, 19:00:00',
    })

    expect(prompt).toContain('señales de Medellín')
    expect(prompt).toContain('te llamas Ana')
  })

  it('adds memory contract when recall question is true', () => {
    const prompt = composeSoulSystemPrompt({
      pathway: 'default',
      userMessage: 'que recuerdas de mi',
      useShortPrompt: false,
      memoryContext: '# USER MEMORY\n- prefieres respuestas breves',
      recallQuestion: true,
      profileSummary: '',
      localeStyle: {
        city: 'unknown',
        confidence: 0.2,
        variant: 'base',
        emojiPolicy: 'natural',
      },
      nowIsoUtc: '2026-02-13T00:00:00.000Z',
      nowBogotaText: '13/02/2026, 19:00:00',
    })

    expect(prompt).toContain('# MEMORY CONTRACT')
    expect(prompt).toContain('prefieres respuestas breves')
  })
})
