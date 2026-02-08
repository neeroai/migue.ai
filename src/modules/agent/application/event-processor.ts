/**
 * @file Agent Event Processor
 * @description Minimal worker logic to drain queued agent_events and create run ledger entries.
 */

import { getSupabaseServerClient } from '@/src/shared/infra/db/supabase'
import { logger } from '@/src/shared/observability/logger'
import { classifyInput } from '@/src/modules/webhook/application/input-router'
import type { NormalizedMessage } from '@/src/modules/webhook/domain/message-normalization'

type AgentEventRow = {
  id: string
  conversation_id: string
  user_id: string
  input_type: string
  payload: Record<string, unknown>
  attempt_count: number
}

export interface ProcessPendingAgentEventsInput {
  requestId: string
  limit?: number
}

export interface ProcessPendingAgentEventsResult {
  scanned: number
  claimed: number
  completed: number
  failed: number
  skipped: number
}

function buildNormalizedFromEvent(event: AgentEventRow): NormalizedMessage {
  const payload = event.payload || {}

  const timestampRaw = payload['timestamp']
  const timestamp = typeof timestampRaw === 'number' ? timestampRaw : Date.now()

  return {
    from: typeof payload['from'] === 'string' ? payload['from'] : '',
    type: typeof payload['type'] === 'string' ? payload['type'] : event.input_type,
    content: typeof payload['content'] === 'string' ? payload['content'] : null,
    mediaUrl: typeof payload['mediaUrl'] === 'string' ? payload['mediaUrl'] : null,
    waMessageId: typeof payload['waMessageId'] === 'string' ? payload['waMessageId'] : '',
    conversationId: event.conversation_id,
    timestamp,
    raw: (payload['raw'] as any) ?? ({ type: event.input_type } as any),
  }
}

function computeRetryAvailableAt(attemptCount: number): string {
  const delaySeconds = Math.min(300, Math.max(30, attemptCount * 30))
  return new Date(Date.now() + delaySeconds * 1000).toISOString()
}

async function createRunForEvent(event: AgentEventRow, inputClass: string): Promise<string> {
  const supabase = getSupabaseServerClient() as any

  const { data, error } = await supabase
    .from('agent_runs')
    .insert({
      event_id: event.id,
      conversation_id: event.conversation_id,
      user_id: event.user_id,
      status: 'running',
      input_class: inputClass,
      graph_version: 'v1',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

async function addStep(runId: string, node: string, status: 'started' | 'ok' | 'error' | 'skipped', inputSnapshot?: unknown, outputSnapshot?: unknown, latencyMs?: number): Promise<void> {
  const supabase = getSupabaseServerClient() as any

  const { error } = await supabase.from('agent_steps').insert({
    run_id: runId,
    node,
    status,
    input_snapshot: inputSnapshot ?? null,
    output_snapshot: outputSnapshot ?? null,
    latency_ms: latencyMs ?? null,
  })

  if (error) throw error
}

async function markRunCompleted(runId: string): Promise<void> {
  const supabase = getSupabaseServerClient() as any

  const { error } = await supabase
    .from('agent_runs')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', runId)

  if (error) throw error
}

async function markRunFailed(runId: string, reason: string): Promise<void> {
  const supabase = getSupabaseServerClient() as any

  const { error } = await supabase
    .from('agent_runs')
    .update({ status: 'failed', ended_at: new Date().toISOString(), failure_reason: reason.slice(0, 500) })
    .eq('id', runId)

  if (error) throw error
}

async function claimEvent(event: AgentEventRow): Promise<AgentEventRow | null> {
  const supabase = getSupabaseServerClient() as any

  const { data, error } = await supabase
    .from('agent_events')
    .update({
      status: 'processing',
      attempt_count: event.attempt_count + 1,
    })
    .eq('id', event.id)
    .eq('status', 'pending')
    .select('id, conversation_id, user_id, input_type, payload, attempt_count')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return data as AgentEventRow
}

async function markEventDone(eventId: string): Promise<void> {
  const supabase = getSupabaseServerClient() as any
  const { error } = await supabase.from('agent_events').update({ status: 'done' }).eq('id', eventId)
  if (error) throw error
}

async function markEventRetryOrFailed(event: AgentEventRow, reason: string): Promise<void> {
  const supabase = getSupabaseServerClient() as any
  const attempts = event.attempt_count

  if (attempts >= 3) {
    const { error } = await supabase
      .from('agent_events')
      .update({ status: 'failed' })
      .eq('id', event.id)
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('agent_events')
    .update({
      status: 'pending',
      available_at: computeRetryAvailableAt(attempts),
      payload: {
        ...event.payload,
        last_error: reason.slice(0, 500),
      },
    })
    .eq('id', event.id)

  if (error) throw error
}

async function processSingleEvent(requestId: string, event: AgentEventRow): Promise<'completed' | 'failed' | 'skipped'> {
  const claimed = await claimEvent(event)
  if (!claimed) return 'skipped'

  const normalized = buildNormalizedFromEvent(claimed)
  const start = Date.now()

  let runId: string | null = null

  try {
    const route = classifyInput(normalized)

    runId = await createRunForEvent(claimed, route.inputClass)

    await addStep(runId, 'ingest', 'ok', { eventId: claimed.id }, { inputType: claimed.input_type })
    await addStep(
      runId,
      'classify',
      'ok',
      { type: normalized.type, content: normalized.content },
      { inputClass: route.inputClass, reason: route.reason },
      Date.now() - start
    )

    await markRunCompleted(runId)
    await markEventDone(claimed.id)

    logger.info('[AgentProcessor] Event processed', {
      requestId,
      userId: claimed.user_id,
      conversationId: claimed.conversation_id,
      metadata: {
        eventId: claimed.id,
        runId,
        inputClass: route.inputClass,
      },
    })

    return 'completed'
  } catch (error: any) {
    const message = error?.message ?? 'agent event processing error'

    if (runId) {
      try {
        await addStep(runId, 'failure', 'error', null, { reason: message }, Date.now() - start)
        await markRunFailed(runId, message)
      } catch (runError: any) {
        logger.error('[AgentProcessor] Failed to persist run failure state', runError, {
          requestId,
          userId: claimed.user_id,
          conversationId: claimed.conversation_id,
          metadata: { eventId: claimed.id, runId },
        })
      }
    }

    await markEventRetryOrFailed(claimed, message)

    logger.error('[AgentProcessor] Event processing failed', error instanceof Error ? error : new Error(message), {
      requestId,
      userId: claimed.user_id,
      conversationId: claimed.conversation_id,
      metadata: {
        eventId: claimed.id,
        attempts: claimed.attempt_count,
      },
    })

    return 'failed'
  }
}

export async function processPendingAgentEvents(input: ProcessPendingAgentEventsInput): Promise<ProcessPendingAgentEventsResult> {
  const limit = Math.min(50, Math.max(1, input.limit ?? 10))
  const supabase = getSupabaseServerClient() as any

  const { data, error } = await supabase
    .from('agent_events')
    .select('id, conversation_id, user_id, input_type, payload, attempt_count')
    .eq('status', 'pending')
    .lte('available_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  const events = (data ?? []) as AgentEventRow[]
  const result: ProcessPendingAgentEventsResult = {
    scanned: events.length,
    claimed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  }

  for (const event of events) {
    const status = await processSingleEvent(input.requestId, event)
    if (status === 'completed') {
      result.claimed += 1
      result.completed += 1
    } else if (status === 'failed') {
      result.claimed += 1
      result.failed += 1
    } else {
      result.skipped += 1
    }
  }

  return result
}
