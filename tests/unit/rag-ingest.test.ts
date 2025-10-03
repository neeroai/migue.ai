import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ingestDocument } from '../../lib/rag'
import * as embeddingsModule from '../../lib/rag/embeddings'
import * as chunkModule from '../../lib/rag/chunk'

jest.mock('../../lib/rag/embeddings', () => ({
  generateEmbedding: jest.fn(),
  storeEmbedding: jest.fn(),
}))

jest.mock('../../lib/rag/chunk', () => ({
  chunkText: jest.fn(),
}))

describe('ingestDocument', () => {
  beforeEach(() => {
    ;(chunkModule.chunkText as jest.Mock).mockReturnValue(['chunk1', 'chunk2'])
    ;(embeddingsModule.generateEmbedding as jest.Mock).mockResolvedValue([0.1, 0.2])
    ;(embeddingsModule.storeEmbedding as jest.Mock).mockResolvedValue(undefined)
  })

  it('chunks, embeds, and stores each piece', async () => {
    const count = await ingestDocument('user-1', 'doc-1', 'texto')

    expect(chunkModule.chunkText).toHaveBeenCalledWith('texto')
    expect(embeddingsModule.generateEmbedding).toHaveBeenCalledTimes(2)
    expect(embeddingsModule.storeEmbedding).toHaveBeenCalledTimes(2)
    expect(count).toBe(2)
  })
})
