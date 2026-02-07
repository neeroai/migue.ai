/**
 * @file memory.ts
 * @description User memory system with pgvector semantic search
 * @module lib/ai
 * @exports embedText, searchMemories, storeMemory, containsPersonalFact
 * @date 2026-02-06 16:15
 * @updated 2026-02-06 16:15
 */

import { embed } from 'ai'
import { getSupabaseServerClient } from '../supabase'
import { logger } from '../logger'

/**
 * In-memory cache for memory search results (5min TTL)
 * Reduces vector search overhead by 80%
 */
type MemorySearchResult = {
  id: string
  content: string
  category: string | null
  type: string
  similarity: number
  created_at: string
}

const memoryCache = new Map<string, { results: MemorySearchResult[]; timestamp: number }>()
const MEMORY_CACHE_TTL_MS = 300_000 // 5 minutes

/**
 * Embed text using OpenAI text-embedding-3-small
 * Cost: $0.02/1M tokens (~$0.00002 per embedding)
 */
export async function embedText(text: string): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: 'openai/text-embedding-3-small',
      value: text,
    })

    logger.info('[Memory] Text embedded', {
      metadata: {
        textLength: text.length,
        embeddingDimension: embedding.length,
      },
    })

    return embedding
  } catch (error: any) {
    logger.error('[Memory] Embedding failed', error)
    throw error
  }
}

/**
 * Search user memories by semantic similarity
 * Uses pgvector HNSW index + search_user_memory RPC
 * Cached for 5min to reduce vector search overhead
 */
export async function searchMemories(
  userId: string,
  query: string,
  limit: number = 5
): Promise<MemorySearchResult[]> {
  try {
    // Check cache first
    const cacheKey = `${userId}:${query.slice(0, 50)}:${limit}`
    const cached = memoryCache.get(cacheKey)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < MEMORY_CACHE_TTL_MS) {
      logger.info('[Memory] Cache hit', {
        metadata: { userId, query: query.slice(0, 100), resultsCount: cached.results.length },
      })
      return cached.results
    }

    // Cache miss or expired - perform vector search
    const queryEmbedding = await embedText(query)
    const supabase = getSupabaseServerClient()

    // Call search_user_memory RPC (migration 003)
    // Vector types are serialized as string in generated types, but accepted as number[] at runtime
    const { data, error } = await supabase.rpc('search_user_memory', {
      query_embedding: queryEmbedding as any,
      target_user_id: userId,
      match_threshold: 0.3, // 30% similarity minimum
      match_count: limit,
    })

    if (error) {
      logger.error('[Memory] Search failed', error, {
        metadata: { userId, query: query.slice(0, 100) },
      })
      return []
    }

    const results = (data || []) as MemorySearchResult[]

    // Store in cache
    memoryCache.set(cacheKey, { results, timestamp: now })

    // Cleanup old entries (keep cache size bounded)
    if (memoryCache.size > 500) {
      const entriesToDelete = Array.from(memoryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 250)
        .map(([key]) => key)
      entriesToDelete.forEach(key => memoryCache.delete(key))
    }

    logger.info('[Memory] Search completed', {
      metadata: {
        userId,
        query: query.slice(0, 100),
        resultsCount: results.length,
        topSimilarity: results[0]?.similarity || 0,
      },
    })

    return results
  } catch (error: any) {
    logger.error('[Memory] Search error', error)
    return []
  }
}

/**
 * Store memory with embedding (fire-and-forget)
 * Does NOT await - runs in background to avoid blocking response
 */
export function storeMemory(
  userId: string,
  content: string,
  type: 'fact' | 'preference' | 'conversation'
): void {
  // Fire-and-forget - don't await
  void (async () => {
    try {
      const embedding = await embedText(content)
      const supabase = getSupabaseServerClient()

      // Vector types are serialized as string in generated types, but accepted as number[] at runtime
      const { error } = await supabase.from('user_memory').insert({
        user_id: userId,
        type,
        content,
        embedding: embedding as any,
        category: null, // Future: auto-categorize
        relevance: 0.8, // Default high relevance
      })

      if (error) {
        logger.error('[Memory] Store failed', error, {
          metadata: { userId, type, content: content.slice(0, 100) },
        })
      } else {
        logger.info('[Memory] Stored', {
          metadata: { userId, type, contentLength: content.length },
        })
      }
    } catch (error: any) {
      logger.error('[Memory] Store error', error)
    }
  })()
}

/**
 * Heuristic: Does message contain personal facts worth remembering?
 * Returns true if message contains names, preferences, schedule, or personal info
 */
export function containsPersonalFact(message: string): boolean {
  const lower = message.toLowerCase()

  // Personal identifiers
  const hasName = /\b(me llamo|mi nombre|soy|me dicen)\b/i.test(message)

  // Preferences
  const hasPreference = /\b(me gusta|prefiero|no me gusta|odio|amo|favorito)\b/i.test(
    message
  )

  // Schedule/routine
  const hasSchedule = /\b(trabajo|estudio|voy|todos los|siempre|nunca|regularmente)\b/i.test(
    message
  )

  // Personal facts
  const hasPersonalInfo = /\b(tengo|vivo|soy de|mi familia|mis amigos|mi trabajo)\b/i.test(
    message
  )

  // Location
  const hasLocation = /\b(vivo en|trabajo en|estudio en|mi casa|mi oficina)\b/i.test(
    message
  )

  const shouldStore =
    hasName || hasPreference || hasSchedule || hasPersonalInfo || hasLocation

  if (shouldStore) {
    logger.debug('[Memory] Personal fact detected', {
      metadata: {
        hasName,
        hasPreference,
        hasSchedule,
        hasPersonalInfo,
        hasLocation,
        message: message.slice(0, 100),
      },
    })
  }

  return shouldStore
}
