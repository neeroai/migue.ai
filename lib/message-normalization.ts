/**
 * WhatsApp message normalization utilities
 * Converts WhatsApp webhook messages to normalized format
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
 * Convert validated WhatsApp message to normalized format
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
    mediaUrl = message.audio.id;
  } else if (type === 'voice' && message.voice) {
    mediaUrl = message.voice.id;
  } else if (type === 'document' && message.document) {
    mediaUrl = message.document.id;
    content = message.document.caption ?? null;
  } else if (type === 'video' && message.video) {
    mediaUrl = message.video.id;
    content = message.video.caption ?? null;
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
 * Extract interactive reply details from message
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
 * Persist normalized message to database
 * Returns userId, conversationId, and wasInserted flag (false if duplicate)
 */
export async function persistNormalizedMessage(normalized: NormalizedMessage) {
  if (!normalized?.from) return null

  const userId = await upsertUserByPhone(normalized.from)
  const conversationId = await getOrCreateConversation(userId, normalized.conversationId)
  const { inserted } = await insertInboundMessage(conversationId, normalized)

  return { userId, conversationId, wasInserted: inserted }
}
