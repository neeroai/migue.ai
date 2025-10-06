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

import type {
  CTAButtonOptions,
  LocationRequestOptions,
  CallPermissionOptions,
  LocationData,
} from '../types/whatsapp';

export const GRAPH_BASE_URL = 'https://graph.facebook.com/v23.0';

type WhatsAppPayload = {
  messaging_product: 'whatsapp';
  to: string;
  type: string;
  [key: string]: unknown;
};

// Rate limiting: 250 msg/sec (WhatsApp Cloud API 2025 limit)
const rateLimitBuckets = new Map<number, number[]>();
const RATE_LIMIT = 250; // messages per second

/**
 * Clear internal caches - for testing purposes only
 * @internal
 */
export function _clearCaches() {
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

  const url = `${GRAPH_BASE_URL}/${phoneId}/messages`;
  const startTime = Date.now();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
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

  // Log performance metrics (Vercel Observability)
  if (latency > 100) {
    console.warn(`WhatsApp API slow response: ${latency}ms`);
  }

  return data;
}

/**
 * Send WhatsApp request with retry logic and exponential backoff
 * Retries on transient errors (5xx), gives up on client errors (4xx)
 *
 * @param payload - WhatsApp message payload
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns API response data
 */
export async function sendWhatsAppRequestWithRetry(
  payload: WhatsAppPayload,
  maxRetries = 3
): Promise<unknown> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await sendWhatsAppRequest(payload);
    } catch (error: unknown) {
      const isLastAttempt = attempt === maxRetries - 1;

      // Extract status code from error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusMatch = errorMessage.match(/WhatsApp API error (\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1]!, 10) : 0;

      // Don't retry client errors (4xx)
      if (status >= 400 && status < 500) {
        console.error(`Client error ${status}, not retrying`);
        throw error;
      }

      // On last attempt, throw the error
      if (isLastAttempt) {
        console.error(`Max retries (${maxRetries}) reached, giving up`);
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = 1000 * Math.pow(2, attempt);
      console.warn(`Retry ${attempt + 1}/${maxRetries} after ${delayMs}ms delay`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // This should never be reached due to throw in loop
  throw new Error('Unexpected retry loop exit');
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
  // Validate button count (WhatsApp API v23.0 limit: max 3 buttons)
  if (buttons.length === 0) {
    throw new Error('At least 1 button required');
  }
  if (buttons.length > 3) {
    console.error('Interactive buttons limited to 3 options. Use sendInteractiveList for 4+ options.');
    throw new Error('Maximum 3 buttons allowed. Use interactive list for more options.');
  }

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
  // Validate row count (WhatsApp API v23.0 limit: max 10 rows per section)
  if (rows.length === 0) {
    throw new Error('At least 1 row required');
  }
  if (rows.length > 10) {
    console.error('Interactive lists limited to 10 rows per section. Use WhatsApp Flows for complex forms.');
    throw new Error('Maximum 10 rows allowed per section. Use WhatsApp Flows for more options.');
  }

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

// =============================
// v23.0 Interactive Features
// =============================

/**
 * Send a Call-to-Action (CTA) button with URL (v23.0)
 * @param to - Phone number in WhatsApp format
 * @param bodyText - Main message text
 * @param buttonText - Button label (max 20 characters)
 * @param url - URL to open when button is tapped
 * @param options - Optional header, footer, and reply-to message ID
 * @returns Message ID or null on error
 */
export async function sendCTAButton(
  to: string,
  bodyText: string,
  buttonText: string,
  url: string,
  options?: CTAButtonOptions
): Promise<string | null> {
  try {
    // Validate button text length
    if (buttonText.length > 20) {
      console.error('CTA button text exceeds 20 characters');
      return null;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      console.error('Invalid URL format for CTA button');
      return null;
    }

    const payload: WhatsAppPayload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: bodyText },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: buttonText,
            url,
          },
        },
        ...(options?.header && {
          header: { type: 'text', text: options.header },
        }),
        ...(options?.footer && {
          footer: { text: options.footer },
        }),
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId },
      }),
    };

    const result = await sendWhatsAppRequest(payload);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error sending CTA button:', error);
    return null;
  }
}

/**
 * Request user's location with permission (v23.0)
 * @param to - Phone number in WhatsApp format
 * @param bodyText - Message explaining why location is needed
 * @param options - Optional footer and reply-to message ID
 * @returns Message ID or null on error
 */
export async function requestLocation(
  to: string,
  bodyText: string,
  options?: LocationRequestOptions
): Promise<string | null> {
  try {
    const payload: WhatsAppPayload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: { text: bodyText },
        action: {
          name: 'send_location',
        },
        ...(options?.footer && {
          footer: { text: options.footer },
        }),
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId },
      }),
    };

    const result = await sendWhatsAppRequest(payload);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error requesting location:', error);
    return null;
  }
}

/**
 * Send a location to user (v23.0)
 * @param to - Phone number in WhatsApp format
 * @param location - Location data (latitude, longitude, name, address)
 * @returns Message ID or null on error
 */
export async function sendLocation(
  to: string,
  location: LocationData
): Promise<string | null> {
  try {
    const result = await sendWhatsAppRequest({
      messaging_product: 'whatsapp',
      to,
      type: 'location',
      location,
    });
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error sending location:', error);
    return null;
  }
}

/**
 * Request permission to call user (v23.0)
 * @param to - Phone number in WhatsApp format
 * @param bodyText - Message explaining why call is needed
 * @param options - Optional footer and reply-to message ID
 * @returns Message ID or null on error
 */
export async function requestCallPermission(
  to: string,
  bodyText: string,
  options?: CallPermissionOptions
): Promise<string | null> {
  try {
    const payload: WhatsAppPayload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'call_permission_request',
        body: { text: bodyText },
        action: {
          name: 'request_call_permission',
        },
        ...(options?.footer && {
          footer: { text: options.footer },
        }),
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId },
      }),
    };

    const result = await sendWhatsAppRequest(payload);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error requesting call permission:', error);
    return null;
  }
}

/**
 * Block a phone number (v23.0 Block API)
 * @param phoneNumber - Phone number to block
 * @returns Success boolean
 */
export async function blockPhoneNumber(phoneNumber: string): Promise<boolean> {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) {
      throw new Error('Missing WhatsApp credentials');
    }

    const url = `${GRAPH_BASE_URL}/${phoneId}/block`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        phone_number: phoneNumber,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`WhatsApp Block API error ${res.status}:`, detail);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error blocking phone number:', error);
    return false;
  }
}

/**
 * Unblock a phone number (v23.0 Block API)
 * @param phoneNumber - Phone number to unblock
 * @returns Success boolean
 */
export async function unblockPhoneNumber(phoneNumber: string): Promise<boolean> {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) {
      throw new Error('Missing WhatsApp credentials');
    }

    const url = `${GRAPH_BASE_URL}/${phoneId}/block/${encodeURIComponent(phoneNumber)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`WhatsApp Unblock API error ${res.status}:`, detail);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error unblocking phone number:', error);
    return false;
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
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

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

// ============================================================================
// Media Download Functions (consolidated from whatsapp-media.ts)
// ============================================================================

export type WhatsAppMediaDownload = {
  bytes: Uint8Array
  mimeType: string
}

async function fetchGraphResource(path: string, token: string) {
  const url = `${GRAPH_BASE_URL}/${path}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`WhatsApp media fetch failed with ${res.status}`)
  }
  return res
}

function asUint8Array(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input)
}

/**
 * Resolve media URL from media ID
 */
export async function resolveMediaUrl(mediaId: string, token: string) {
  const res = await fetchGraphResource(mediaId, token)
  const body = (await res.json()) as { url?: string; mime_type?: string }
  if (!body?.url) {
    throw new Error('WhatsApp media metadata missing url')
  }
  return { url: body.url, mimeType: body.mime_type }
}

/**
 * Download WhatsApp media (images, audio, documents)
 * Consolidated from whatsapp-media.ts for better organization
 */
export async function downloadWhatsAppMedia(mediaId: string): Promise<WhatsAppMediaDownload> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) {
    throw new Error('WHATSAPP_TOKEN is not configured')
  }
  const { url, mimeType } = await resolveMediaUrl(mediaId, token)
  const mediaRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!mediaRes.ok) {
    throw new Error(`WhatsApp media content fetch failed with ${mediaRes.status}`)
  }
  const buffer = await mediaRes.arrayBuffer()
  const contentType = mediaRes.headers.get('content-type') ?? mimeType ?? 'application/octet-stream'
  return { bytes: asUint8Array(buffer), mimeType: contentType }
}
