import { getSupabaseServerClient } from './supabase'
import type { ChatMessage } from './openai'

export type ConversationMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  type: string
  content: string | null
  timestamp: string
}

/**
 * Get last N messages from a conversation, ordered chronologically (oldest first).
 * Useful for building context for GPT-4o.
 */
export async function getConversationHistory(
  conversationId: string,
  limit = 10
): Promise<ConversationMessage[]> {
  const supabase = getSupabaseServerClient()
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
 * Convert conversation history to ChatMessage format for OpenAI.
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
