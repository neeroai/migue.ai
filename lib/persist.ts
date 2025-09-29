import { getSupabaseServerClient } from './supabase'

export type NormalizedMessage = {
  from?: string
  type?: string
  content: string | null
  mediaUrl: string | null
  waMessageId?: string
  conversationId?: string
  timestamp: number
  raw: unknown
}

export async function upsertUserByPhone(phoneNumber: string) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('users')
    .upsert({ phone_number: phoneNumber }, { onConflict: 'phone_number' })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function getOrCreateConversation(userId: string, waConversationId?: string | undefined) {
  const supabase = getSupabaseServerClient()
  if (waConversationId) {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('wa_conversation_id', waConversationId)
      .limit(1)
      .maybeSingle()
    if (data?.id) return data.id as string
  }
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, wa_conversation_id: waConversationId ?? null, status: 'active' })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function insertInboundMessage(conversationId: string, msg: NormalizedMessage) {
  const supabase = getSupabaseServerClient()
  const payload = {
    conversation_id: conversationId,
    direction: 'inbound',
    type: msg.type ?? 'text',
    content: msg.content,
    media_url: msg.mediaUrl,
    wa_message_id: msg.waMessageId ?? null,
    timestamp: new Date(msg.timestamp).toISOString(),
  }
  const { error } = await supabase.from('messages').insert(payload)
  if (error) throw error
}
