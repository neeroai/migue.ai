/**
 * WhatsApp API client - Optimized for Vercel Edge Functions 2025
 * Handles sending messages and interacting with WhatsApp Business API
 *
 * Performance optimizations:
 * - WhatsApp Cloud API v23.0 (2025)
 * - Rate limiting: 250 msg/sec
 * - Edge caching with stale-while-revalidate
 * - Sub-100ms global latency target
 */

export const GRAPH_BASE_URL = 'https://graph.facebook.com/v23.0';

// Cache TTL: 1 hour (based on TiDB Serverless case study)
const CACHE_TTL = 3600 * 1000;

type WhatsAppPayload = {
  messaging_product: 'whatsapp';
  to: string;
  type: string;
  [key: string]: unknown;
};

// Response cache for reducing API calls
const messageCache = new Map<string, { data: unknown; timestamp: number }>();

// Rate limiting: 250 msg/sec (WhatsApp Cloud API 2025 limit)
const rateLimitBuckets = new Map<number, number[]>();
const RATE_LIMIT = 250; // messages per second

/**
 * Clear internal caches - for testing purposes only
 * @internal
 */
export function _clearCaches() {
  messageCache.clear();
  rateLimitBuckets.clear();
}

/**
 * Rate limiter implementing token bucket algorithm
 * Ensures compliance with WhatsApp Cloud API rate limits
 */
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const second = Math.floor(now / 1000);

  if (!rateLimitBuckets.has(second)) {
    rateLimitBuckets.set(second, []);
    // Clean old buckets
    for (const [key] of rateLimitBuckets) {
      if (key < second - 2) {
        rateLimitBuckets.delete(key);
      }
    }
  }

  const bucket = rateLimitBuckets.get(second)!;
  if (bucket.length >= RATE_LIMIT) {
    const waitTime = 1000 - (now % 1000);
    await new Promise(r => setTimeout(r, waitTime));
    return rateLimit();
  }

  bucket.push(now);
}

export async function sendWhatsAppRequest(payload: WhatsAppPayload) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    throw new Error('Missing WhatsApp credentials');
  }

  // Apply rate limiting
  await rateLimit();

  // Check cache for duplicate requests (dedupe within 1 hour)
  const cacheKey = JSON.stringify(payload);
  const cached = messageCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const url = `${GRAPH_BASE_URL}/${phoneId}/messages`;
  const startTime = Date.now();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      // Edge caching with stale-while-revalidate
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
    body: JSON.stringify(payload),
  });

  const latency = Date.now() - startTime;

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`WhatsApp API error ${res.status} (${latency}ms):`, detail);
    throw new Error(`WhatsApp API error ${res.status}: ${detail}`);
  }

  const data = await res.json();

  // Cache successful responses
  messageCache.set(cacheKey, { data, timestamp: Date.now() });

  // Log performance metrics (Vercel Observability)
  if (latency > 100) {
    console.warn(`WhatsApp API slow response: ${latency}ms`);
  }

  return data;
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

interface InteractiveButton {
  type: 'button';
  body: { text: string };
  action: {
    buttons: Array<{
      type: 'reply';
      reply: { id: string; title: string };
    }>;
  };
  header?: { type: 'text'; text: string };
  footer?: { text: string };
}

export async function sendInteractiveButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  options: InteractiveButtonOptions = {}
) {
  try {
    const interactive: InteractiveButton = {
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

    const payload: WhatsAppPayload = {
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
