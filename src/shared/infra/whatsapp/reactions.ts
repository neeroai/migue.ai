import { sendWhatsAppRequest } from './http';

export async function sendReaction(to: string, messageId: string, emoji: string) {
  const result = await sendWhatsAppRequest({
    messaging_product: 'whatsapp',
    to,
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: emoji || '',
    },
  });
  return result?.messages?.[0]?.id ?? null;
}

export async function removeReaction(to: string, messageId: string) {
  return sendReaction(to, messageId, '');
}

export const reactWithCheck = (to: string, messageId: string) => sendReaction(to, messageId, '✅');
export const reactWithThinking = (to: string, messageId: string) => sendReaction(to, messageId, '🤔');
export const reactWithWarning = (to: string, messageId: string) => sendReaction(to, messageId, '⚠️');
