import { getSupabaseServerClient } from './supabase'

export type RecordedAction = {
  id: string
  actionId: string
  actionType: string
  metadata?: Record<string, unknown> | null
}

export async function recordConversationAction(params: {
  conversationId: string
  userId: string
  actionId: string
  actionType: string
  payload?: Record<string, unknown> | null
}) {
  const supabase = getSupabaseServerClient()
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
