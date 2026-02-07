import type { WhatsAppMessage } from '@/types/schemas';
import { InteractiveContentSchema } from '@/types/schemas';
import { upsertUserByPhone, getOrCreateConversation, insertInboundMessage } from '../../../shared/infra/db/persist';
import { logger } from '../../../shared/observability/logger';

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

export function whatsAppMessageToNormalized(message: WhatsAppMessage): NormalizedMessage {
  logger.debug('[normalize] Converting WhatsApp message', {
    metadata: {
      messageId: message.id,
      type: message.type,
      from: message.from,
    },
  });

  const type = message.type;
  const from = message.from;
  const timestamp = Number(message.timestamp) * 1000;
  let content: string | null = null;
  let mediaUrl: string | null = null;

  if (type === 'text' && message.text) {
    content = message.text.body;
  } else if (type === 'image' && message.image) {
    mediaUrl = message.image.id;
    content = message.image.caption ?? null;
  } else if (type === 'audio' && message.audio) {
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
    content = JSON.stringify({
      emoji: message.reaction.emoji,
      message_id: message.reaction.message_id,
    });
  } else if (type === 'order' && message.order) {
    content = JSON.stringify(message.order);
  } else if (type === 'interactive' && message.interactive) {
    const result = InteractiveContentSchema.safeParse(message.interactive);
    if (result.success) {
      const interactive = result.data;
      if (interactive.type === 'button_reply') {
        content = interactive.button_reply.id;
      } else if (interactive.type === 'list_reply') {
        content = interactive.list_reply.id;
      }
    }
  }

  const normalized = {
    from,
    type,
    content,
    mediaUrl,
    waMessageId: message.id,
    conversationId: undefined,
    timestamp,
    raw: message,
  };

  logger.debug('[normalize] Normalized result', {
    metadata: {
      type: normalized.type,
      hasContent: !!normalized.content,
      hasMedia: !!normalized.mediaUrl,
    },
  });

  return normalized;
}

export function extractInteractiveReply(raw: unknown): InteractiveReply | null {
  const result = InteractiveContentSchema.safeParse(raw);
  if (!result.success) return null;

  const interactive = result.data;
  if (interactive.type === 'button_reply') {
    return {
      id: interactive.button_reply.id,
      title: interactive.button_reply.title,
      description: undefined,
    };
  }

  if (interactive.type === 'list_reply') {
    return {
      id: interactive.list_reply.id,
      title: interactive.list_reply.title,
      description: interactive.list_reply.description,
    };
  }

  return null;
}

export async function persistNormalizedMessage(normalized: NormalizedMessage) {
  if (!normalized?.from) return null;

  const userId = await upsertUserByPhone(normalized.from);
  const conversationId = await getOrCreateConversation(userId, normalized.conversationId);
  const { inserted } = await insertInboundMessage(conversationId, normalized);

  return { userId, conversationId, wasInserted: inserted };
}
