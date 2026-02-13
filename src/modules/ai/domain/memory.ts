/**
 * @file memory.ts
 * @description User memory system with pgvector semantic search
 * @module lib/ai
 * @exports embedText, searchMemories, storeMemory, containsPersonalFact
 * @date 2026-02-06 16:15
 * @updated 2026-02-06 16:15
 */

import { embed } from 'ai'
import { getSupabaseServerClient } from '../../../shared/infra/db/supabase'
import { logger } from '../../../shared/observability/logger'

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

export type MemoryProfile = {
  user_id: string
  display_name: string | null
  tone_preference: string | null
  language_preference: string | null
  timezone: string | null
  goals: Record<string, unknown>
  constraints: Record<string, unknown>
  updated_at: string
}

type SoulSignals = {
  city?: string
  cityConfidence?: number
  styleVariant?: string
}

const memoryCache = new Map<string, { results: MemorySearchResult[]; timestamp: number }>()
const profileCache = new Map<string, { profile: MemoryProfile | null; timestamp: number }>()
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
  limit: number = 5,
  threshold: number = 0.3
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
      match_threshold: threshold,
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
 * Reads persistent user profile from memory_profile table.
 * Cached for 5min to reduce DB lookups in fast pathways.
 */
export async function getMemoryProfile(userId: string): Promise<MemoryProfile | null> {
  try {
    const now = Date.now()
    const cached = profileCache.get(userId)
    if (cached && (now - cached.timestamp) < MEMORY_CACHE_TTL_MS) {
      return cached.profile
    }

    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase
      .from('memory_profile' as any)
      .select('user_id, display_name, tone_preference, language_preference, timezone, goals, constraints, updated_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      logger.error('[MemoryProfile] Read failed', error, { metadata: { userId } })
      return null
    }

    const profile = (data as MemoryProfile | null) ?? null
    profileCache.set(userId, { profile, timestamp: now })
    return profile
  } catch (error: any) {
    logger.error('[MemoryProfile] Read error', error, { metadata: { userId } })
    return null
  }
}

/**
 * Upserts stable user preferences into memory_profile.
 */
export async function upsertMemoryProfile(
  userId: string,
  updates: Partial<Omit<MemoryProfile, 'user_id' | 'updated_at'>>
): Promise<void> {
  try {
    if (Object.keys(updates).length === 0) return

    const supabase = getSupabaseServerClient()
    const payload = {
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('memory_profile' as any)
      .upsert(payload, { onConflict: 'user_id' })

    if (error) {
      logger.error('[MemoryProfile] Upsert failed', error, { metadata: { userId } })
      return
    }

    profileCache.delete(userId)
  } catch (error: any) {
    logger.error('[MemoryProfile] Upsert error', error, { metadata: { userId } })
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

/**
 * Merges SOUL learning signals into memory_profile.goals.soul_v1.
 * Keeps existing goals keys and prior soul fields.
 */
export async function upsertSoulSignals(userId: string, signals: SoulSignals): Promise<void> {
  try {
    const profile = await getMemoryProfile(userId)
    const currentGoals = asRecord(profile?.goals)
    const currentSoul = asRecord(currentGoals.soul_v1)

    const mergedSoul: Record<string, unknown> = {
      ...currentSoul,
      ...(signals.city ? { last_detected_city: signals.city } : {}),
      ...(typeof signals.cityConfidence === 'number'
        ? { city_confidence: Number(signals.cityConfidence.toFixed(2)) }
        : {}),
      ...(signals.styleVariant ? { style_variant: signals.styleVariant } : {}),
      updated_at: new Date().toISOString(),
    }

    await upsertMemoryProfile(userId, {
      goals: {
        ...currentGoals,
        soul_v1: mergedSoul,
      },
    })
  } catch (error: any) {
    logger.error('[MemoryProfile] upsertSoulSignals error', error, {
      metadata: { userId },
    })
  }
}

/**
 * Extract stable profile updates from explicit user preferences.
 */
export function extractProfileUpdates(message: string): Partial<Omit<MemoryProfile, 'user_id' | 'updated_at'>> {
  const updates: Partial<Omit<MemoryProfile, 'user_id' | 'updated_at'>> = {}
  const normalized = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const nameMatch = message.match(/\b(?:me llamo|mi nombre es)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ ]{2,40})/i)
  if (nameMatch?.[1]) {
    updates.display_name = nameMatch[1].trim()
  }

  if (/\b(hablame de usted|tratame de usted|se formal)\b/i.test(normalized)) {
    updates.tone_preference = 'formal'
  } else if (/\b(hablame de tu|tuteame|se informal)\b/i.test(normalized)) {
    updates.tone_preference = 'informal'
  }

  if (/\b(hablame en ingles|en ingles por favor)\b/i.test(normalized)) {
    updates.language_preference = 'en'
  } else if (/\b(hablame en espanol|en espanol por favor)\b/i.test(normalized)) {
    updates.language_preference = 'es'
  }

  const tzMatch = message.match(/\b(?:mi zona horaria es|timezone)\s+([A-Za-z_\/+-]{3,64})/i)
  if (tzMatch?.[1]) {
    updates.timezone = tzMatch[1].trim()
  }

  return updates
}

export function buildMemoryProfileSummary(profile: MemoryProfile | null): string {
  if (!profile) return ''

  const parts: string[] = []
  if (profile.display_name) parts.push(`te llamas ${profile.display_name}`)
  if (profile.language_preference === 'en') parts.push('prefieres hablar en inglés')
  if (profile.language_preference === 'es') parts.push('prefieres hablar en español')
  if (profile.tone_preference) parts.push(`prefieres tono ${profile.tone_preference}`)
  if (profile.timezone) parts.push(`tu zona horaria es ${profile.timezone}`)
  const soulSignals = asRecord(asRecord(profile.goals).soul_v1)
  if (typeof soulSignals.last_detected_city === 'string') {
    parts.push(`sueles estar en ${soulSignals.last_detected_city}`)
  }
  if (typeof soulSignals.style_variant === 'string') {
    parts.push(`te funciona estilo ${soulSignals.style_variant}`)
  }
  return parts.join(', ')
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
