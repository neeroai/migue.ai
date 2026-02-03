/**
 * Conversation Utilities
 * Consolidated from context.ts, conversation-actions.ts, and actions.ts
 */

import { getSupabaseServerClient } from './supabase'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { ModelMessage } from 'ai'

export type ChatMessage = ChatCompletionMessageParam

type SupabaseClient = ReturnType<typeof getSupabaseServerClient>

// ============================================================================
// Types
// ============================================================================

export type ConversationMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  type: string
  content: string | null
  timestamp: string
}

export type RecordedAction = {
  id: string
  actionId: string
  actionType: string
  metadata?: Record<string, unknown> | null
}

export type ActionDefinition = {
  id: string
  title: string
  description?: string
  category: 'schedule' | 'reminder' | 'other'
  directResponse?: string
  replacementMessage?: string
}

// ============================================================================
// Conversation History
// ============================================================================

/**
 * Get last N messages from a conversation, ordered chronologically (oldest first).
 * Useful for building context for AI models.
 */
export async function getConversationHistory(
  conversationId: string,
  limit = 10,
  supabase: SupabaseClient = getSupabaseServerClient()
): Promise<ConversationMessage[]> {
  const { data, error } = await supabase
    .from('messages_v2')
    .select('id, direction, type, content, timestamp')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) throw error
  if (!data) return []

  // Reverse to get chronological order (oldest first)
  return data.reverse() as ConversationMessage[]
}

/**
 * Convert conversation history to ChatMessage format for AI models (OpenAI SDK).
 * Maps inbound messages to 'user' and outbound to 'assistant'.
 */
export function historyToChatMessages(
  history: ConversationMessage[]
): ChatMessage[] {
  return history
    .filter((msg) => msg.content) // only messages with text content
    .map((msg) => ({
      role: msg.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
      content: msg.content!,
    }))
}

/**
 * Convert conversation history to ModelMessage format for Vercel AI SDK.
 * Maps inbound messages to 'user' and outbound to 'assistant'.
 */
export function historyToModelMessages(
  history: ConversationMessage[]
): ModelMessage[] {
  return history
    .filter((msg) => msg.content) // only messages with text content
    .map((msg) => ({
      role: msg.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
      content: msg.content!,
    }))
}

// ============================================================================
// Conversation Actions
// ============================================================================

/**
 * Record a conversation action in the database
 * Note: conversation_actions table must exist in database
 */
export async function recordConversationAction(params: {
  conversationId: string
  userId: string
  actionId: string
  actionType: string
  payload?: Record<string, unknown> | null
}) {
  const supabase = getSupabaseServerClient()

  // @ts-expect-error - conversation_actions table not yet in production (migration pending)
  const { error } = await supabase.from('conversation_actions').insert({
    conversation_id: params.conversationId,
    user_id: params.userId,
    action_type: params.actionType,
    payload: {
      action_id: params.actionId,
      ...(params.payload ?? {}),
    },
  })
  if (error) throw error
}

// ============================================================================
// Action Definitions
// ============================================================================

const ACTION_PREFIX = 'action:'

const ACTIONS: Record<string, ActionDefinition> = {
  'action:schedule_confirm': {
    id: 'action:schedule_confirm',
    title: 'Confirmar',
    category: 'schedule',
    directResponse: '¡Perfecto! La cita queda confirmada.',
  },
  'action:schedule_reschedule': {
    id: 'action:schedule_reschedule',
    title: 'Reprogramar',
    category: 'schedule',
    replacementMessage: 'Necesito reprogramar la cita.',
  },
  'action:schedule_cancel': {
    id: 'action:schedule_cancel',
    title: 'Cancelar',
    category: 'schedule',
    replacementMessage: 'Cancela la cita, por favor.',
  },
  'action:reminder_view': {
    id: 'action:reminder_view',
    title: 'Ver recordatorios',
    category: 'reminder',
    replacementMessage: 'Muéstrame mis recordatorios.',
  },
  'action:reminder_edit': {
    id: 'action:reminder_edit',
    title: 'Editar recordatorio',
    category: 'reminder',
    replacementMessage: 'Quiero editar el recordatorio.',
  },
  'action:reminder_cancel': {
    id: 'action:reminder_cancel',
    title: 'Cancelar recordatorio',
    category: 'reminder',
    replacementMessage: 'Cancela el recordatorio, por favor.',
  },
}

export function buildActionId(key: string): string {
  return key.startsWith(ACTION_PREFIX) ? key : `${ACTION_PREFIX}${key}`
}

export function getActionDefinition(actionId: string | null | undefined): ActionDefinition | null {
  if (!actionId) return null
  return ACTIONS[actionId] ?? null
}

export function getScheduleButtons(): ActionDefinition[] {
  return [
    ACTIONS['action:schedule_confirm']!,
    ACTIONS['action:schedule_reschedule']!,
    ACTIONS['action:schedule_cancel']!,
  ]
}

export function getReminderOptions(): ActionDefinition[] {
  return [
    ACTIONS['action:reminder_view']!,
    ACTIONS['action:reminder_edit']!,
    ACTIONS['action:reminder_cancel']!,
  ]
}
