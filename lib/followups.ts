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
  // @ts-ignore - follow_up_jobs table exists but types not yet regenerated
  await (supabase.from('follow_up_jobs') as any)
    .delete()
    .eq('conversation_id', params.conversationId)
    .eq('category', params.category)
    .eq('status', 'pending')
  // @ts-ignore - follow_up_jobs table exists but types not yet regenerated
  const { error } = await (supabase.from('follow_up_jobs') as any).insert({
    user_id: params.userId,
    conversation_id: params.conversationId,
    category: params.category,
    scheduled_for: scheduledFor,
    payload: (params.payload ?? null) as never,
  })
  if (error) throw error
}

export async function fetchDueFollowUps(limit = 10): Promise<Array<{
  id: string;
  user_id: string;
  conversation_id: string;
  category: string;
  payload: Record<string, unknown> | null;
}>> {
  const supabase = getSupabaseServerClient()
  const nowIso = new Date().toISOString()
  // @ts-ignore - follow_up_jobs table exists but types not yet regenerated
  const { data, error } = await (supabase.from('follow_up_jobs') as any)
    .select('id, user_id, conversation_id, category, payload')
    .eq('status', 'pending')
    .lte('scheduled_for', nowIso)
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function markFollowUpStatus(id: string, status: 'sent' | 'failed' | 'cancelled') {
  const supabase = getSupabaseServerClient()
  // @ts-ignore - follow_up_jobs table exists but types not yet regenerated
  const { error } = await (supabase.from('follow_up_jobs') as any)
    .update({ status })
    .eq('id', id)
  if (error) throw error
}
