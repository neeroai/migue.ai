import { getSupabaseServerClient } from './supabase'
import { getCurrentHour, COLOMBIA_TZ, BUSINESS_HOURS } from './messaging-windows'

export type FollowUpCategory = 'schedule_confirm' | 'document_status' | 'reminder_check' | 'window_maintenance' | 'custom'

const DEFAULT_DELAY_MINUTES = 60

/**
 * Adjust scheduled time to fall within business hours (7am-8pm Bogotá)
 * If scheduled time is outside business hours, move to next available time
 */
function adjustToBusinessHours(scheduledFor: Date): Date {
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: COLOMBIA_TZ,
      hour: 'numeric',
      hour12: false,
    }).format(scheduledFor)
  )

  // If within business hours, return as-is
  if (hour >= BUSINESS_HOURS.start && hour < BUSINESS_HOURS.end) {
    return scheduledFor
  }

  // If too early (before 7am), move to 7am same day
  if (hour < BUSINESS_HOURS.start) {
    const adjusted = new Date(scheduledFor)
    // Set to 12pm UTC (7am Bogotá)
    adjusted.setUTCHours(12, 0, 0, 0)
    return adjusted
  }

  // If too late (8pm or later), move to 7am next day
  const adjusted = new Date(scheduledFor)
  adjusted.setUTCDate(adjusted.getUTCDate() + 1)
  adjusted.setUTCHours(12, 0, 0, 0) // 12pm UTC = 7am Bogotá
  return adjusted
}

export async function scheduleFollowUp(params: {
  userId: string
  conversationId: string
  category: FollowUpCategory
  payload?: Record<string, unknown>
  delayMinutes?: number
  respectBusinessHours?: boolean // Default: true for proactive categories
}) {
  const supabase = getSupabaseServerClient()
  const delay = params.delayMinutes ?? DEFAULT_DELAY_MINUTES
  let scheduledFor = new Date(Date.now() + delay * 60_000)

  // Respect business hours for proactive messages (default true)
  const shouldRespectHours = params.respectBusinessHours ??
    (params.category === 'window_maintenance' || params.category === 'custom')

  if (shouldRespectHours) {
    scheduledFor = adjustToBusinessHours(scheduledFor)
  }

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
    scheduled_for: scheduledFor.toISOString(),
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
