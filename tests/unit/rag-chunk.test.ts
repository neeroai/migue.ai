import { describe, it, expect } from '@jest/globals'
import { normalizeText, chunkText } from '../../lib/rag/chunk'

describe('RAG chunk utilities', () => {
  it('normalizes whitespace', () => {
    const input = 'Hola\n\n mundo\t\tare you there?'
    expect(normalizeText(input)).toBe('Hola mundo are you there?')
  })

  it('returns single chunk when below max', () => {
    const text = 'a'.repeat(100)
    const chunks = chunkText(text, { maxChars: 150 })
    expect(chunks).toEqual([text])
  })

  it('splits text with overlap', () => {
    const text = 'abcdefghij'
    const chunks = chunkText(text, { maxChars: 4, overlap: 2 })
    expect(chunks).toEqual(['abcd', 'cdef', 'efgh', 'ghij'])
  })
})
