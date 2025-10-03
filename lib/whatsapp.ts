/**
 * WhatsApp API client
 * Handles sending messages and interacting with WhatsApp Business API
 */

export const GRAPH_BASE_URL = 'https://graph.facebook.com/v19.0';

type WhatsAppPayload = {
  messaging_product: 'whatsapp';
  to: string;
  type: string;
  [key: string]: unknown;
};

export async function sendWhatsAppRequest(payload: WhatsAppPayload) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    throw new Error('Missing WhatsApp credentials');
  }
  const url = `${GRAPH_BASE_URL}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`WhatsApp API error ${res.status}: ${detail}`);
  }
  return res.json();
}

export async function sendWhatsAppText(to: string, body: string) {
  const result = await sendWhatsAppRequest({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  });
  return result?.messages?.[0]?.id ?? null;
}

export interface InteractiveButtonOptions {
  header?: string;
  footer?: string;
  replyToMessageId?: string;
}

export async function sendInteractiveButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  options: InteractiveButtonOptions = {}
) {
  try {
    const interactive: any = {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map((button) => ({
          type: 'reply',
          reply: { id: button.id, title: button.title },
        })),
      },
    };

    // Add optional header
    if (options.header) {
      interactive.header = {
        type: 'text',
        text: options.header,
      };
    }

    // Add optional footer
    if (options.footer) {
      interactive.footer = {
        text: options.footer,
      };
    }

    const payload: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive,
    };

    // Add reply-to context if provided
    if (options.replyToMessageId) {
      payload.context = {
        message_id: options.replyToMessageId,
      };
    }

    const result = await sendWhatsAppRequest(payload);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error sending interactive buttons:', error);
    return null;
  }
}

export async function sendInteractiveList(
  to: string,
  body: string,
  buttonLabel: string,
  rows: Array<{ id: string; title: string; description?: string }>,
  sectionTitle = 'Opciones'
) {
  try {
    const result = await sendWhatsAppRequest({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body },
        action: {
          button: buttonLabel,
          sections: [
            {
              title: sectionTitle,
              rows: rows.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description,
              })),
            },
          ],
        },
      },
    });
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error sending interactive list:', error);
    return null;
  }
}

export async function markAsReadWithTyping(to: string, messageId: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    throw new Error('Missing WhatsApp credentials');
  }
  const url = `${GRAPH_BASE_URL}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: {
        type: 'text',
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`WhatsApp API error ${res.status}: ${detail}`);
  }
  return res.json();
}

export function createTypingManager(to: string, messageId: string) {
  let active = false;
  let timeoutId: NodeJS.Timeout | null = null;

  return {
    async start() {
      if (active) return;
      try {
        await markAsReadWithTyping(to, messageId);
        active = true;
      } catch (err: any) {
        console.error('Typing indicator error:', err?.message);
      }
    },
    async stop() {
      // No-op: typing indicator auto-dismisses after 25s or when message is sent
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    async startWithDuration(durationSeconds: number) {
      const duration = Math.min(durationSeconds, 25); // WhatsApp max is 25s

      if (!active) {
        try {
          await markAsReadWithTyping(to, messageId);
          active = true;
        } catch (err: any) {
          console.error('Typing indicator error:', err?.message);
          return;
        }
      }

      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        active = false;
        timeoutId = null;
      }, duration * 1000);
    },
    isActive() {
      return active;
    },
  };
}

/**
 * Mark a message as read (without typing indicator)
 */
export async function markAsRead(messageId: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    throw new Error('Missing WhatsApp credentials');
  }
  const url = `${GRAPH_BASE_URL}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`WhatsApp API error ${res.status}: ${detail}`);
  }
  return res.json();
}

/**
 * Send emoji reaction to a message
 * @param to - Recipient phone number
 * @param messageId - WhatsApp message ID to react to
 * @param emoji - Single emoji character (e.g., '👍', '❤️', '🔥')
 */
export async function sendReaction(
  to: string,
  messageId: string,
  emoji: string
) {
  const result = await sendWhatsAppRequest({
    messaging_product: 'whatsapp',
    to,
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: emoji || '', // Empty string removes reaction
    },
  });
  return result?.messages?.[0]?.id ?? null;
}

/**
 * Remove a previously sent reaction
 */
export async function removeReaction(to: string, messageId: string) {
  return sendReaction(to, messageId, '');
}

// Convenience reaction methods for common emojis
export const reactWithCheck = (to: string, messageId: string) =>
  sendReaction(to, messageId, '✅');

export const reactWithThinking = (to: string, messageId: string) =>
  sendReaction(to, messageId, '🤔');

export const reactWithLike = (to: string, messageId: string) =>
  sendReaction(to, messageId, '👍');

export const reactWithLove = (to: string, messageId: string) =>
  sendReaction(to, messageId, '❤️');

export const reactWithFire = (to: string, messageId: string) =>
  sendReaction(to, messageId, '🔥');

export const reactWithClap = (to: string, messageId: string) =>
  sendReaction(to, messageId, '👏');

export const reactWithSad = (to: string, messageId: string) =>
  sendReaction(to, messageId, '😢');

export const reactWithWarning = (to: string, messageId: string) =>
  sendReaction(to, messageId, '⚠️');

export const reactWithParty = (to: string, messageId: string) =>
  sendReaction(to, messageId, '🎉');

export const reactWithPray = (to: string, messageId: string) =>
  sendReaction(to, messageId, '🙏');
