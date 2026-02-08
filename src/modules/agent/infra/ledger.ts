/**
 * @file Agent Event Ledger
 * @description Persists webhook events into durable queue table (agent_events).
 */

import { getSupabaseServerClient } from '@/src/shared/infra/db/supabase'
import { logger } from '@/src/shared/observability/logger'
import type { NormalizedMessage } from '@/src/modules/webhook/domain/message-normalization'

export interface EnqueueAgentEventInput {
  requestId: string
  userId: string
  conversationId: string
  normalized: NormalizedMessage
}

function buildIdempotencyKey(normalized: NormalizedMessage, conversationId: string): string {
  if (normalized.waMessageId && normalized.waMessageId.trim().length > 0) {
    return normalized.waMessageId.trim()
  }

  return `${conversationId}:${normalized.from}:${normalized.type}:${normalized.timestamp}`
}

function buildPayload(normalized: NormalizedMessage): Record<string, unknown> {
  return {
    from: normalized.from,
    type: normalized.type,
    content: normalized.content,
    mediaUrl: normalized.mediaUrl,
    waMessageId: normalized.waMessageId,
    timestamp: normalized.timestamp,
    raw: normalized.raw,
  }
}

export async function enqueueAgentEvent(input: EnqueueAgentEventInput): Promise<string | null> {
  const startTime = Date.now()
  const idempotencyKey = buildIdempotencyKey(input.normalized, input.conversationId)
  const payload = buildPayload(input.normalized)

  const supabase = getSupabaseServerClient() as any
  const eventRow = {
    conversation_id: input.conversationId,
    user_id: input.userId,
    source: 'whatsapp_webhook',
    input_type: input.normalized.type,
    payload,
    idempotency_key: idempotencyKey,
  }

  const { data, error } = await supabase
    .from('agent_events')
    .insert(eventRow)
    .select('id')
    .single()

  if (error) {
    const isDuplicate = error.code === '23505'

    if (isDuplicate) {
      logger.info('[AgentLedger] Duplicate event ignored', {
        requestId: input.requestId,
        userId: input.userId,
        conversationId: input.conversationId,
        metadata: {
          idempotencyKey,
        },
      })
      return null
    }

    logger.error('[AgentLedger] Failed to enqueue event', error, {
      requestId: input.requestId,
      userId: input.userId,
      conversationId: input.conversationId,
      metadata: {
        idempotencyKey,
        inputType: input.normalized.type,
      },
    })
    throw error
  }

  logger.performance('AgentLedger enqueueAgentEvent', Date.now() - startTime, {
    requestId: input.requestId,
    userId: input.userId,
    conversationId: input.conversationId,
    metadata: {
      eventId: data?.id,
      inputType: input.normalized.type,
    },
  })

  return data?.id ?? null
}

export const _testOnly = {
  buildIdempotencyKey,
  buildPayload,
}
