/**
 * @file Database Persistence Layer
 * @description Supabase CRUD operations for users, conversations, and messages with error handling and performance logging
 * @module lib/persist
 * @exports upsertUserByPhone, getOrCreateConversation, insertInboundMessage, insertOutboundMessage, updateInboundMessageByWaId
 * @see https://supabase.com/docs/reference/javascript/introduction
 * @date 2026-02-07 18:30
 * @updated 2026-02-07 18:30
 */

import { getSupabaseServerClient } from './supabase'
import type { NormalizedMessage } from '@/src/modules/webhook/domain/message-normalization'
import { logger } from '../../observability/logger'
import { invalidateConversationCache } from '@/src/modules/conversation/application/utils'

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

/**
 * Creates user if not exists or retrieves existing user by phone number (idempotent operation)
 *
 * @param phoneNumber - E.164 format required (e.g., +573001234567), logged with truncation for privacy
 * @returns User ID (UUID)
 * @throws {Error} Database error if upsert fails
 *
 * @example
 * ```ts
 * const userId = await upsertUserByPhone('+573001234567');
 * // userId: '123e4567-e89b-12d3-a456-426614174000'
 * ```
 */
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

/**
 * Finds existing conversation or creates new one with priority lookup (WA ID → active status → create)
 *
 * @param userId - User UUID to associate conversation with
 * @param waConversationId - Optional WhatsApp conversation ID for deduplication
 * @returns Conversation ID (UUID)
 * @throws {Error} Database error if insert fails
 *
 * @example
 * ```ts
 * // With WA conversation ID (preferred for deduplication)
 * const convId = await getOrCreateConversation(userId, 'wamid.xxx');
 *
 * // Without WA ID (finds active or creates new)
 * const convId = await getOrCreateConversation(userId);
 * ```
 */
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

/**
 * Inserts WhatsApp inbound message with deduplication, type validation fallback, and enhanced error classification
 *
 * @param conversationId - Conversation UUID
 * @param msg - Normalized WhatsApp message (type validated against enum, fallback to 'unknown')
 * @returns {inserted: true} if new row created, {inserted: false} if duplicate detected
 * @throws {Error} Enhanced with isDuplicate, isRLSError flags for upstream handling
 *
 * @example
 * ```ts
 * const result = await insertInboundMessage(convId, normalizedMsg);
 * if (result.inserted) {
 *   console.log('New message stored');
 * } else {
 *   console.log('Duplicate message skipped');
 * }
 * ```
 */
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
    const isRLSError = error.code === '42501'; // RLS permission denied

    const errorType = isDuplicate
      ? 'duplicate'
      : isEnumViolation
      ? 'invalid_type'
      : isConstraintViolation
      ? 'constraint_violation'
      : isRLSError
      ? 'rls_denied'
      : 'critical';

    // Special handling for RLS errors (critical configuration issue)
    if (isRLSError) {
      logger.error('[DB] RLS POLICY DENIED WRITE - Check service role key configuration!', error, {
        conversationId,
        metadata: {
          errorType: 'rls_denied',
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint || 'Verify SUPABASE_KEY is service_role (not anon key)',
          diagnostics: {
            issue: 'Row Level Security policy is blocking database write',
            possibleCauses: [
              'SUPABASE_KEY environment variable is anon key instead of service_role key',
              'Missing service role bypass policy in database',
              'Migration 010_add_service_role_policies.sql not applied',
            ],
            fix: 'Apply migration 010_add_service_role_policies.sql and verify SUPABASE_KEY',
          },
          payload: {
            ...payload,
            wa_message_id: payload.wa_message_id?.slice(0, 20) + '...', // Truncate for privacy
          },
        },
      })
    } else {
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
    }

    // Enhance error with classification for upstream handling
    const enhancedError = new Error(error.message);
    (enhancedError as any).code = error.code;
    (enhancedError as any).isDuplicate = isDuplicate;
    (enhancedError as any).isRLSError = isRLSError;
    (enhancedError as any).originalError = error;
    throw enhancedError
  }

  const inserted = data && data.length > 0

  logger.performance('DB insertInboundMessage', Date.now() - startTime, {
    conversationId,
    metadata: { inserted, waMessageId: msg.waMessageId },
  })

  if (inserted) {
    invalidateConversationCache(conversationId)
  }

  return { inserted }
}

/**
 * Inserts outbound message (always type 'text', no media support yet)
 *
 * @param conversationId - Conversation UUID
 * @param content - Message text content
 * @param waMessageId - Optional WhatsApp message ID for tracking
 * @throws {Error} Database error if insert fails
 *
 * @example
 * ```ts
 * await insertOutboundMessage(convId, 'Hello!', 'wamid.xxx');
 * ```
 */
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
  invalidateConversationCache(conversationId)
}

/**
 * Updates existing inbound message by WhatsApp message ID (partial update pattern)
 *
 * @param waMessageId - WhatsApp message ID (required, throws if empty)
 * @param updates - Partial updates (only provided fields updated, null allowed)
 * @throws {Error} If waMessageId empty or database update fails
 *
 * @example
 * ```ts
 * // Update only content
 * await updateInboundMessageByWaId('wamid.xxx', { content: 'Updated text' });
 *
 * // Update only media URL
 * await updateInboundMessageByWaId('wamid.xxx', { mediaUrl: 'https://...' });
 * ```
 */
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
