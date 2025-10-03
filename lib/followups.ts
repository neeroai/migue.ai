import { getSupabaseServerClient } from './supabase'

export type FollowUpCategory = 'schedule_confirm' | 'document_status' | 'reminder_check' | 'custom'

const DEFAULT_DELAY_MINUTES = 60

export async function scheduleFollowUp(params: {
  userId: string
  conversationId: string
  category: FollowUpCategory
  payload?: Record<string, unknown>
  delayMinutes?: number
}) {
  const supabase = getSupabaseServerClient()
  const delay = params.delayMinutes ?? DEFAULT_DELAY_MINUTES
  const scheduledFor = new Date(Date.now() + delay * 60_000).toISOString()
  await supabase
    .from('follow_up_jobs')
    .delete()
    .eq('conversation_id', params.conversationId)
    .eq('category', params.category)
    .eq('status', 'pending')
  const { error } = await supabase.from('follow_up_jobs').insert({
    user_id: params.userId,
    conversation_id: params.conversationId,
    category: params.category,
    scheduled_for: scheduledFor,
    payload: params.payload ?? null,
  })
  if (error) throw error
}

export async function fetchDueFollowUps(limit = 10) {
  const supabase = getSupabaseServerClient()
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('follow_up_jobs')
    .select('id, user_id, conversation_id, category, payload')
    .eq('status', 'pending')
    .lte('scheduled_for', nowIso)
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function markFollowUpStatus(id: string, status: 'sent' | 'failed' | 'cancelled') {
  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('follow_up_jobs')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}
