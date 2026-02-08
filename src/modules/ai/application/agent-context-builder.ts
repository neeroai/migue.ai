import type { ModelMessage } from 'ai'
import {
  getConversationHistory,
  historyToModelMessages,
  trimHistoryByChars,
} from '../../conversation/application/utils'
import { resolveMemoryReadPolicy, type TextPathway } from './memory-policy'
import { emitSlaMetric, SLA_METRICS } from '../../../shared/observability/metrics'
import { logger } from '../../../shared/observability/logger'
import { getMemoryProfile, searchMemories, buildMemoryProfileSummary } from '../domain/memory'

const HISTORY_CHAR_BUDGET = 4000

export type AgentContextSnapshot = {
  modelHistory: ModelMessage[]
  memoryContext: string
  profileSummary: string
  hasAnyContext: boolean
}

type BuildAgentContextParams = {
  conversationId: string
  userId: string
  userMessage: string
  pathway: TextPathway
  requestId?: string
}

export async function buildAgentContext(
  params: BuildAgentContextParams
): Promise<AgentContextSnapshot> {
  const readPolicy = resolveMemoryReadPolicy(params.pathway)
  const memoryReadStart = Date.now()

  const history = await getConversationHistory(params.conversationId, readPolicy.historyLimit)
  const trimmedHistory = trimHistoryByChars(history, HISTORY_CHAR_BUDGET)
  const modelHistory = historyToModelMessages(trimmedHistory) ?? []

  let memoryContext = ''
  let profileSummary = ''
  let memoryHit = 0
  let profileHit = 0

  const profile = readPolicy.includeProfile ? await getMemoryProfile(params.userId) : null
  profileSummary = buildMemoryProfileSummary(profile)
  if (profile) {
    profileHit = 1
    memoryContext += `\n\n# USER PROFILE (stable preferences):\n- ${profileSummary || 'perfil disponible sin detalles estructurados'}\n`
  }

  if (readPolicy.semanticEnabled && readPolicy.semanticTopK > 0) {
    const memories = (await searchMemories(
      params.userId,
      params.userMessage,
      readPolicy.semanticTopK,
      readPolicy.semanticThreshold
    )) ?? []
    if (memories.length > 0) {
      memoryHit = 1
      memoryContext = `\n\n# USER MEMORY (things you remember about this user):\n${memories
        .map(memory => `- ${memory.content} (${memory.type})`)
        .join('\n')}\n${memoryContext}`

      logger.info('[AgentContext] Memories injected', {
        ...(params.requestId ? { requestId: params.requestId } : {}),
        userId: params.userId,
        conversationId: params.conversationId,
        metadata: {
          pathway: params.pathway,
          memoriesCount: memories.length,
          topSimilarity: memories[0]?.similarity || 0,
        },
      })
    }
  } else {
    logger.info('[AgentContext] Semantic retrieval skipped by read policy', {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      userId: params.userId,
      conversationId: params.conversationId,
      metadata: { pathway: params.pathway },
    })
  }

  emitSlaMetric(SLA_METRICS.MEMORY_READ_MS, {
    conversationId: params.conversationId,
    userId: params.userId,
    value: Date.now() - memoryReadStart,
    messageType: 'text',
    pathway: params.pathway,
  })
  emitSlaMetric(SLA_METRICS.MEMORY_HIT_RATIO, {
    conversationId: params.conversationId,
    userId: params.userId,
    value: memoryHit,
    messageType: 'text',
    pathway: params.pathway,
  })
  emitSlaMetric(SLA_METRICS.PROFILE_HIT_RATIO, {
    conversationId: params.conversationId,
    userId: params.userId,
    value: profileHit,
    messageType: 'text',
    pathway: params.pathway,
  })

  return {
    modelHistory,
    memoryContext,
    profileSummary,
    hasAnyContext: modelHistory.length > 0 || profileHit > 0 || memoryHit > 0,
  }
}
