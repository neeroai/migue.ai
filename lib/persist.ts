import { getSupabaseServerClient } from './supabase'
import type { NormalizedMessage } from './message-normalization'
import { logger } from './logger'

/**
 * Valid WhatsApp Cloud API v23.0 message types matching PostgreSQL enum
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 * Last verified: 2025-10-07
 */
const VALID_MSG_TYPES = [
  'text', 'image', 'audio', 'sticker', 'video', 'document', 'location',
  'interactive', 'button', 'reaction', 'order', 'contacts', 'system', 'unknown'
] as const;

type ValidMsgType = typeof VALID_MSG_TYPES[number];

export async function upsertUserByPhone(phoneNumber: string) {
  const startTime = Date.now()

  logger.debug('[DB] Upserting user', {
    metadata: { phoneNumber: phoneNumber.slice(0, 8) + '***' }, // Partial for privacy
  })

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('users')
    .upsert({ phone_number: phoneNumber }, { onConflict: 'phone_number' })
    .select('id')
    .single()

  if (error) {
    logger.error('[DB] Upsert user failed', error)
    throw error
  }

  logger.performance('DB upsertUserByPhone', Date.now() - startTime, {
    metadata: { userId: data.id },
  })

  return data.id as string
}

export async function getOrCreateConversation(userId: string, waConversationId?: string | undefined) {
  const supabase = getSupabaseServerClient()

  // First, try to find by WA conversation ID if provided
  if (waConversationId) {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('wa_conversation_id', waConversationId)
      .limit(1)
      .maybeSingle()
    if (data?.id) return data.id as string
  }

  // Then, check for any active conversation for this user
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (existingConv?.id) return existingConv.id as string

  // No existing conversation found, create new one
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, wa_conversation_id: waConversationId ?? null, status: 'active' })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function insertInboundMessage(conversationId: string, msg: NormalizedMessage): Promise<{ inserted: boolean }> {
  const startTime = Date.now()

  logger.debug('[DB] Inserting inbound message', {
    conversationId,
    metadata: { type: msg.type, waMessageId: msg.waMessageId },
  })

  const supabase = getSupabaseServerClient()

  // Type-safe validation with fallback to 'unknown'
  const messageType: ValidMsgType = VALID_MSG_TYPES.includes(msg.type as any)
    ? (msg.type as ValidMsgType)
    : 'unknown';

  // Log if we're falling back to unknown (helps identify new WhatsApp types)
  if (messageType === 'unknown' && msg.type !== 'unknown') {
    logger.warn('[DB] Unknown message type detected, using fallback', {
      conversationId,
      metadata: {
        originalType: msg.type,
        fallbackType: 'unknown',
        waMessageId: msg.waMessageId,
      },
    });
  }

  const payload = {
    conversation_id: conversationId,
    direction: 'inbound' as const,
    type: messageType,
    content: msg.content,
    media_url: msg.mediaUrl,
    wa_message_id: msg.waMessageId ?? null,
    timestamp: new Date(msg.timestamp).toISOString(),
  }

  // Use select() to detect if row was actually inserted
  // ON CONFLICT (wa_message_id) DO NOTHING will return empty data array for duplicates
  const { data, error } = await supabase
    .from('messages_v2')
    .insert(payload)
    .select('id')

  if (error) {
    // Enhanced error logging with classification
    const isDuplicate = error.code === '23505'; // PostgreSQL unique violation
    const isEnumViolation = error.code === '22P02'; // Invalid enum value
    const isConstraintViolation = error.code === '23514'; // Check constraint

    const errorType = isDuplicate
      ? 'duplicate'
      : isEnumViolation
      ? 'invalid_type'
      : isConstraintViolation
      ? 'constraint_violation'
      : 'critical';

    logger.error(`[DB] Insert inbound message failed (${errorType})`, error, {
      conversationId,
      metadata: {
        errorType,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        messageType: msg.type, // Original type from WhatsApp
        validatedType: messageType, // Type after validation
        payload: {
          ...payload,
          wa_message_id: payload.wa_message_id?.slice(0, 20) + '...', // Truncate for privacy
        },
      },
    })

    // Enhance error with classification for upstream handling
    const enhancedError = new Error(error.message);
    (enhancedError as any).code = error.code;
    (enhancedError as any).isDuplicate = isDuplicate;
    (enhancedError as any).originalError = error;
    throw enhancedError
  }

  const inserted = data && data.length > 0

  logger.performance('DB insertInboundMessage', Date.now() - startTime, {
    conversationId,
    metadata: { inserted, waMessageId: msg.waMessageId },
  })

  return { inserted }
}

export async function insertOutboundMessage(
  conversationId: string,
  content: string,
  waMessageId?: string
) {
  const supabase = getSupabaseServerClient()
  const payload = {
    conversation_id: conversationId,
    direction: 'outbound' as const,
    type: 'text' as const,
    content,
    media_url: null,
    wa_message_id: waMessageId ?? null,
    timestamp: new Date().toISOString(),
  }
  const { error } = await supabase.from('messages_v2').insert(payload)
  if (error) throw error
}

export async function updateInboundMessageByWaId(
  waMessageId: string,
  updates: { content?: string | null; mediaUrl?: string | null }
) {
  if (!waMessageId) {
    throw new Error('waMessageId is required to update message')
  }
  const changes: Record<string, string | null> = {}
  if (Object.prototype.hasOwnProperty.call(updates, 'content')) {
    changes.content = updates.content ?? null
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'mediaUrl')) {
    changes.media_url = updates.mediaUrl ?? null
  }
  if (Object.keys(changes).length === 0) {
    return
  }
  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('messages_v2')
    .update(changes)
    .eq('wa_message_id', waMessageId)
  if (error) throw error
}
