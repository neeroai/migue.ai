/**
 * @file WhatsApp Message Normalization
 * @description Converts WhatsApp webhook messages to normalized format and persists to database with type-safe validation
 * @module lib/message-normalization
 * @exports NormalizedMessage, InteractiveReply, whatsAppMessageToNormalized, extractInteractiveReply, persistNormalizedMessage
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 * @date 2026-02-07 19:00
 * @updated 2026-02-07 19:00
 */

import type { WhatsAppMessage, InteractiveContent } from '../types/schemas'
import { InteractiveContentSchema } from '../types/schemas'
import {
  upsertUserByPhone,
  getOrCreateConversation,
  insertInboundMessage,
} from './persist'
import { logger } from './logger'

export interface NormalizedMessage {
  from: string;
  type: string;
  content: string | null;
  mediaUrl: string | null;
  waMessageId: string;
  conversationId: string | undefined;
  timestamp: number;
  raw: WhatsAppMessage;
}

export interface InteractiveReply {
  id: string;
  title: string;
  description?: string | undefined;
}

/**
 * Converts WhatsApp webhook message to normalized format with type-specific content extraction
 * Supports text, image, audio, video, document, sticker, reaction, order, interactive types
 *
 * @param message - Validated WhatsApp message from webhook
 * @returns Normalized message with content, mediaUrl, timestamp
 *
 * @example
 * ```ts
 * const normalized = whatsAppMessageToNormalized(webhookMsg);
 * // normalized: { from: '+57...', type: 'text', content: 'Hello', ... }
 * ```
 */
export function whatsAppMessageToNormalized(message: WhatsAppMessage): NormalizedMessage {
  logger.debug('[normalize] Converting WhatsApp message', {
    metadata: {
      messageId: message.id,
      type: message.type,
      from: message.from,
    },
  })

  const type = message.type;
  const from = message.from;
  const timestamp = Number(message.timestamp) * 1000;
  let content: string | null = null;
  let mediaUrl: string | null = null;

  // Extract content based on message type
  if (type === 'text' && message.text) {
    content = message.text.body;
  } else if (type === 'image' && message.image) {
    mediaUrl = message.image.id;
    content = message.image.caption ?? null;
  } else if (type === 'audio' && message.audio) {
    // NOTE: WhatsApp sends voice messages as type='audio', not type='voice'
    // The audio.voice property distinguishes voice recordings from audio files
    mediaUrl = message.audio.id;
  } else if (type === 'sticker' && message.sticker) {
    mediaUrl = message.sticker.id;
  } else if (type === 'document' && message.document) {
    mediaUrl = message.document.id;
    content = message.document.caption ?? null;
  } else if (type === 'video' && message.video) {
    mediaUrl = message.video.id;
    content = message.video.caption ?? null;
  } else if (type === 'reaction' && message.reaction) {
    // Store reaction as JSON: { emoji, message_id }
    content = JSON.stringify({
      emoji: message.reaction.emoji,
      message_id: message.reaction.message_id,
    });
  } else if (type === 'order' && message.order) {
    // Store order details as JSON
    content = JSON.stringify(message.order);
  } else if (type === 'interactive' && message.interactive) {
    // Validate interactive message with Zod schema
    const result = InteractiveContentSchema.safeParse(message.interactive)
    if (result.success) {
      const interactive = result.data
      if (interactive.type === 'button_reply') {
        content = interactive.button_reply.id
      } else if (interactive.type === 'list_reply') {
        content = interactive.list_reply.id
      }
    }
  }

  const normalized = {
    from,
    type,
    content,
    mediaUrl,
    waMessageId: message.id,
    conversationId: undefined, // Will be set later from metadata
    timestamp,
    raw: message,
  };

  logger.debug('[normalize] Normalized result', {
    metadata: {
      type: normalized.type,
      hasContent: !!normalized.content,
      hasMedia: !!normalized.mediaUrl,
    },
  })

  return normalized
}

/**
 * Extracts interactive reply details (button_reply or list_reply) with Zod validation
 *
 * @param raw - Unvalidated interactive content from WhatsApp
 * @returns Reply with id, title, description or null if validation fails
 *
 * @example
 * ```ts
 * const reply = extractInteractiveReply(message.interactive);
 * if (reply) {
 *   console.log(reply.id); // 'btn_confirm'
 * }
 * ```
 */
export function extractInteractiveReply(raw: unknown): InteractiveReply | null {
  // Validate with Zod schema
  const result = InteractiveContentSchema.safeParse(raw)
  if (!result.success) return null

  const interactive = result.data
  if (interactive.type === 'button_reply') {
    return {
      id: interactive.button_reply.id,
      title: interactive.button_reply.title,
      description: undefined,
    }
  }

  if (interactive.type === 'list_reply') {
    return {
      id: interactive.list_reply.id,
      title: interactive.list_reply.title,
      description: interactive.list_reply.description,
    }
  }

  return null
}

/**
 * Persists normalized message to database with user/conversation upsert and duplicate detection
 *
 * @param normalized - Normalized message with 'from' field required
 * @returns {userId, conversationId, wasInserted} or null if 'from' missing
 *
 * @example
 * ```ts
 * const result = await persistNormalizedMessage(normalized);
 * if (result?.wasInserted) {
 *   console.log('New message stored');
 * } else {
 *   console.log('Duplicate message skipped');
 * }
 * ```
 */
export async function persistNormalizedMessage(normalized: NormalizedMessage) {
  if (!normalized?.from) return null

  const userId = await upsertUserByPhone(normalized.from)
  const conversationId = await getOrCreateConversation(userId, normalized.conversationId)
  const { inserted } = await insertInboundMessage(conversationId, normalized)

  return { userId, conversationId, wasInserted: inserted }
}
