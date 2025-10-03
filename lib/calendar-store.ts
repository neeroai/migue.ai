import { getSupabaseServerClient } from './supabase'

export type CalendarProvider = 'google'

export type CalendarCredentialRecord = {
  id: string
  user_id: string
  provider: CalendarProvider
  refresh_token: string
  access_token: string | null
  access_token_expires_at: string | null
  scope: string[] | null
}

export type CalendarEventRecordInput = {
  userId: string
  provider: CalendarProvider
  externalId: string
  summary: string
  description?: string | null
  startTime: string
  endTime: string
  meetingUrl?: string | null
  metadata?: Record<string, unknown> | null
}

export async function fetchCalendarCredential(
  userId: string,
  provider: CalendarProvider = 'google'
): Promise<CalendarCredentialRecord | null> {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('calendar_credentials')
    .select('id, user_id, provider, refresh_token, access_token, access_token_expires_at, scope')
    .eq('user_id', userId)
    .eq('provider', provider)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as CalendarCredentialRecord) ?? null
}

export async function updateAccessToken(
  credentialId: string,
  accessToken: string,
  expiresAt: string,
  scope?: string[] | null
): Promise<void> {
  const supabase = getSupabaseServerClient()
  const payload: Record<string, unknown> = {
    access_token: accessToken,
    access_token_expires_at: expiresAt,
  }
  if (scope) payload.scope = scope
  const { error } = await supabase
    .from('calendar_credentials')
    .update(payload)
    .eq('id', credentialId)
  if (error) throw error
}

export async function recordCalendarEvent(input: CalendarEventRecordInput): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { error } = await supabase.from('calendar_events').upsert(
    {
      user_id: input.userId,
      provider: input.provider,
      external_id: input.externalId,
      summary: input.summary,
      description: input.description ?? null,
      start_time: input.startTime,
      end_time: input.endTime,
      meeting_url: input.meetingUrl ?? null,
      metadata: (input.metadata ?? null) as never,
    },
    { onConflict: 'user_id,provider,external_id' }
  )
  if (error) throw error
}
