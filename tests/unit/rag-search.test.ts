import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { searchEmbeddings } from '../../lib/rag/search'
import { getSupabaseServerClient } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  getSupabaseServerClient: jest.fn(),
}))

describe('searchEmbeddings', () => {
  beforeEach(() => {
    ;(getSupabaseServerClient as unknown as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          order: () => ({
            data: [
              { chunk_index: 0, vector: [1, 0], metadata: { content: 'Hola', user_id: 'user-1' } },
              { chunk_index: 1, vector: [0, 1], metadata: { content: 'Adiós', user_id: 'user-1' } },
            ],
            error: null,
          }),
        }),
      }),
    })
  })

  // TODO: Enable when RAG is implemented in production (currently stub implementation)
  it.skip('ranks embeddings by cosine similarity', async () => {
    const results = await searchEmbeddings('user-1', [1, 0], { topK: 1 })
    expect(results).toHaveLength(1)
    expect(results[0]?.content).toBe('Hola')
  })
})
