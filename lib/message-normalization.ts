/**
 * WhatsApp message normalization utilities
 * Converts WhatsApp webhook messages to normalized format
 */

import type { WhatsAppMessage } from '../types/schemas';
import {
  upsertUserByPhone,
  getOrCreateConversation,
  insertInboundMessage,
} from './persist';

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
  } else if (type === 'interactive' && (message as any).interactive) {
    const interactive: any = (message as any).interactive;
    if (interactive?.type === 'button_reply' && interactive.button_reply) {
      content = interactive.button_reply.id ?? interactive.button_reply.title ?? null;
    } else if (interactive?.type === 'list_reply' && interactive.list_reply) {
      content = interactive.list_reply.id ?? interactive.list_reply.title ?? null;
    }
  }

  return {
    from,
    type,
    content,
    mediaUrl,
    waMessageId: message.id,
    conversationId: undefined, // Will be set later from metadata
    timestamp,
    raw: message,
  };
}

/**
 * Extract interactive reply details from message
 */
export function extractInteractiveReply(raw: unknown): InteractiveReply | null {
  const interactive = (raw as any)?.interactive;
  if (!interactive) return null;

  if (interactive.type === 'button_reply' && interactive.button_reply) {
    return {
      id: interactive.button_reply.id as string,
      title: interactive.button_reply.title as string,
      description: undefined,
    };
  }

  if (interactive.type === 'list_reply' && interactive.list_reply) {
    return {
      id: interactive.list_reply.id as string,
      title: interactive.list_reply.title as string,
      description: interactive.list_reply.description as string | undefined,
    };
  }

  return null;
}

/**
 * Persist normalized message to database
 */
export async function persistNormalizedMessage(normalized: NormalizedMessage) {
  if (!normalized?.from) return null;

  const userId = await upsertUserByPhone(normalized.from);
  const conversationId = await getOrCreateConversation(userId, normalized.conversationId);
  await insertInboundMessage(conversationId, normalized as any);

  return { userId, conversationId };
}
