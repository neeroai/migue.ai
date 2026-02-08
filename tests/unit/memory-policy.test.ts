import { describe, expect, it } from '@jest/globals'
import {
  isMemoryRecallQuestion,
  resolveMemoryReadPolicy,
  sanitizeMemoryContractResponse,
  shouldWriteMemory,
} from '../../src/modules/ai/application/memory-policy'

describe('memory policy', () => {
  it('uses lightweight policy for text_fast_path', () => {
    const policy = resolveMemoryReadPolicy('text_fast_path')
    expect(policy.historyLimit).toBe(8)
    expect(policy.semanticEnabled).toBe(false)
    expect(policy.includeProfile).toBe(true)
  })

  it('uses semantic retrieval for tool_intent', () => {
    const policy = resolveMemoryReadPolicy('tool_intent')
    expect(policy.historyLimit).toBe(12)
    expect(policy.semanticEnabled).toBe(true)
    expect(policy.semanticTopK).toBe(3)
  })

  it('detects memory recall questions in spanish', () => {
    expect(isMemoryRecallQuestion('que sabes de mi?')).toBe(true)
    expect(isMemoryRecallQuestion('que mensajes te he enviado antes')).toBe(true)
    expect(isMemoryRecallQuestion('recuérdame comprar pan')).toBe(false)
  })

  it('writes memory for facts/tools but not ephemeral acknowledgements', () => {
    expect(shouldWriteMemory('ok', true, 0)).toBe(false)
    expect(shouldWriteMemory('me llamo polo', true, 0)).toBe(true)
    expect(shouldWriteMemory('haz un recordatorio mañana', false, 1)).toBe(true)
  })

  it('replaces invalid no-history response only when context exists', () => {
    const replaced = sanitizeMemoryContractResponse(
      'No tengo acceso a los mensajes anteriores.',
      true,
      'Lo que sé de ti: prefieres hablar en español.'
    )
    expect(replaced.toLowerCase()).toContain('sí tengo contexto')

    const untouched = sanitizeMemoryContractResponse(
      'No tengo acceso a los mensajes anteriores.',
      false,
      ''
    )
    expect(untouched).toBe('No tengo acceso a los mensajes anteriores.')
  })
})
