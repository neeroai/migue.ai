/**
 * @file WhatsApp Business API Client
 * @description WhatsApp Cloud API v23.0 client with Edge Runtime optimization, rate limiting (250 msg/sec), message sending, media handling, and interactive components
 * @module lib/whatsapp
 * @exports GRAPH_BASE_URL, sendWhatsAppRequest, sendWhatsAppRequestWithRetry, sendWhatsAppText, sendInteractiveButtons, sendInteractiveList, sendCTAButton, requestLocation, sendLocation, requestCallPermission, blockPhoneNumber, unblockPhoneNumber, markAsReadWithTyping, createTypingManager, markAsRead, sendReaction, removeReaction, reactWithCheck, reactWithThinking, reactWithWarning, resolveMediaUrl, downloadWhatsAppMedia
 * @runtime edge
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api
 * @date 2026-02-07 18:40
 * @updated 2026-02-07 18:40
 */

import type {
  CTAButtonOptions,
  LocationRequestOptions,
  CallPermissionOptions,
  LocationData,
} from '../types/whatsapp';
import { logger } from './logger';
import { ButtonMessage, ListMessage } from './message-builders';
import { getWhatsAppErrorHint, WhatsAppAPIError } from './whatsapp-errors';

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
const MEDIA_FETCH_TIMEOUT_MS = 7000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof (timeoutId as NodeJS.Timeout).unref === 'function') {
    (timeoutId as NodeJS.Timeout).unref();
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);
  if (typeof (timeoutId as NodeJS.Timeout).unref === 'function') {
    (timeoutId as NodeJS.Timeout).unref();
  }

  const url = `${GRAPH_BASE_URL}/${phoneId}/messages`;
  const startTime = Date.now();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  const latency = Date.now() - startTime;

  if (!res.ok) {
    const detail = await res.text().catch(() => '');

    let errorCode: number | undefined;
    let errorSubcode: number | undefined;
    let errorMessage: string | undefined;

    try {
      const parsed = JSON.parse(detail);
      errorCode = parsed.error?.code;
      errorSubcode = parsed.error?.error_subcode;
      errorMessage = parsed.error?.message;
    } catch {
      // detail is not JSON, use as-is
    }

    const errorDetails = {
      status: res.status,
      errorCode,
      errorSubcode,
      message: errorMessage || detail,
    };

    const hint = getWhatsAppErrorHint(errorDetails);
    const error = new WhatsAppAPIError(errorDetails, hint);

    // Use logger instead of console.error (catch logging errors in tests)
    try {
      logger.error('[WhatsApp API] Request failed', error, {
        metadata: {
          status: res.status,
          errorCode,
          errorSubcode,
          hint,
          latency,
          payloadType: payload.type,
          to: payload.to,
        },
      })
    } catch (logErr) {
      // Ignore logging errors (e.g., in test environments)
    }

    throw error;
  }

  const data = await res.json();

  // Log performance metrics (Vercel Observability)
  if (latency > 100) {
    logger.warn('[WhatsApp API] Slow response detected', {
      metadata: { latency, payloadType: payload.type, to: payload.to }
    });
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
        logger.error('[WhatsApp Retry] Client error, not retrying', error instanceof Error ? error : new Error(String(error)), {
          metadata: { status, attempt, maxRetries }
        });
        throw error;
      }

      // On last attempt, throw the error
      if (isLastAttempt) {
        logger.error('[WhatsApp Retry] Max retries reached', error instanceof Error ? error : new Error(String(error)), {
          metadata: { maxRetries, totalAttempts: attempt + 1 }
        });
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = 1000 * Math.pow(2, attempt);
      logger.warn('[WhatsApp Retry] Retrying after backoff', {
        metadata: { attempt: attempt + 1, maxRetries, delayMs }
      });
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // This should never be reached due to throw in loop
  throw new Error('Unexpected retry loop exit');
}

/**
 * Sends text message via WhatsApp Cloud API
 *
 * @param to - Recipient phone number in E.164 format (e.g., +573001234567)
 * @param body - Message text content (max 4096 chars)
 * @returns WhatsApp message ID or null if send failed
 * @throws {WhatsAppAPIError} If API request fails
 *
 * @example
 * ```ts
 * const msgId = await sendWhatsAppText('+573001234567', 'Hello!');
 * // msgId: 'wamid.HBgLNTczMDAxMjM0NTY3FQIAERgRMTIzNDU2Nzg5MEFCQ0RF'
 * ```
 */
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

export interface InteractiveListOptions {
  header?: string;
  footer?: string;
  sectionTitle?: string;
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
    // Use type-safe ButtonMessage builder (validates at construction)
    const messageOptions: any = {};
    if (options.header) messageOptions.header = options.header;
    if (options.footer) messageOptions.footer = options.footer;

    const message = new ButtonMessage(body, buttons, messageOptions);

    const payload = message.toPayload(to);

    // Add reply-to context if provided
    if (options.replyToMessageId) {
      payload.context = {
        message_id: options.replyToMessageId,
      };
    }

    const result = await sendWhatsAppRequest(payload);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    logger.error('[WhatsApp] Error sending interactive buttons', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to, buttonsCount: buttons.length }
    });
    return null;
  }
}

export async function sendInteractiveList(
  to: string,
  body: string,
  buttonLabel: string,
  rows: Array<{ id: string; title: string; description?: string }>,
  optionsOrSectionTitle?: InteractiveListOptions | string
) {
  try {
    // Support both legacy (string) and new (object) signatures
    const options: InteractiveListOptions =
      typeof optionsOrSectionTitle === 'string'
        ? { sectionTitle: optionsOrSectionTitle }
        : (optionsOrSectionTitle || {});

    // Use type-safe ListMessage builder (validates at construction)
    const messageOptions: any = {};
    if (options.header) messageOptions.header = options.header;
    if (options.footer) messageOptions.footer = options.footer;
    if (options.sectionTitle) messageOptions.sectionTitle = options.sectionTitle;
    else messageOptions.sectionTitle = 'Opciones';

    const message = new ListMessage(body, buttonLabel, rows, messageOptions);

    const payload = message.toPayload(to);

    // Add reply-to context if provided
    if (options.replyToMessageId) {
      payload.context = {
        message_id: options.replyToMessageId,
      };
    }

    const result = await sendWhatsAppRequest(payload);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    logger.error('[WhatsApp] Error sending interactive list', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to, rowsCount: rows.length }
    });
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
      logger.error('[WhatsApp] CTA button text exceeds 20 characters', new Error('Validation failed'), {
        metadata: { buttonTextLength: buttonText.length, maxLength: 20 }
      });
      return null;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      logger.error('[WhatsApp] Invalid URL format for CTA button', new Error('URL validation failed'), {
        metadata: { url }
      });
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
    logger.error('[WhatsApp] Error sending CTA button', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to, buttonText, url }
    });
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
    logger.error('[WhatsApp] Error requesting location', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to }
    });
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
    logger.error('[WhatsApp] Error sending location', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to, location }
    });
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
    logger.error('[WhatsApp] Error requesting call permission', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to }
    });
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
      logger.error('[WhatsApp Block API] Request failed', new Error(`Status ${res.status}`), {
        metadata: { status: res.status, detail, phoneNumber }
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[WhatsApp] Error blocking phone number', error instanceof Error ? error : new Error(String(error)), {
      metadata: { phoneNumber }
    });
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
      logger.error('[WhatsApp Unblock API] Request failed', new Error(`Status ${res.status}`), {
        metadata: { status: res.status, detail, phoneNumber }
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[WhatsApp] Error unblocking phone number', error instanceof Error ? error : new Error(String(error)), {
      metadata: { phoneNumber }
    });
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
        logger.error('[WhatsApp Typing] Indicator error', err instanceof Error ? err : new Error(String(err)), {
          metadata: { to, messageId }
        });
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
          logger.error('[WhatsApp Typing] Indicator error', err instanceof Error ? err : new Error(String(err)), {
            metadata: { to, messageId, durationSeconds }
          });
          return;
        }
      }

      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        active = false;
        timeoutId = null;
      }, duration * 1000);
      if (typeof (timeoutId as NodeJS.Timeout).unref === 'function') {
        (timeoutId as NodeJS.Timeout).unref();
      }
    },
    isActive() {
      return active;
    },
  };
}

/**
 * Mark a message as read (without typing indicator)
 */
/**
 * Marks message as read (blue checkmarks for sender)
 *
 * @param messageId - WhatsApp message ID to mark as read
 * @throws {Error} If WHATSAPP_TOKEN or WHATSAPP_PHONE_ID missing
 * @throws {WhatsAppAPIError} If API request fails
 *
 * @example
 * ```ts
 * await markAsRead('wamid.xxx');
 * // Sender sees blue checkmarks
 * ```
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
/**
 * Reacts to message with checkmark emoji (visual acknowledgment)
 *
 * @param to - Recipient phone number in E.164 format
 * @param messageId - WhatsApp message ID to react to
 * @throws {WhatsAppAPIError} If API request fails
 *
 * @example
 * ```ts
 * await reactWithCheck('+573001234567', 'wamid.xxx');
 * // User sees ✅ reaction on their message
 * ```
 */
export const reactWithCheck = (to: string, messageId: string) =>
  sendReaction(to, messageId, '✅');

export const reactWithThinking = (to: string, messageId: string) =>
  sendReaction(to, messageId, '🤔');

export const reactWithWarning = (to: string, messageId: string) =>
  sendReaction(to, messageId, '⚠️');

// ============================================================================
// Media Download Functions (consolidated from whatsapp-media.ts)
// ============================================================================

export type WhatsAppMediaDownload = {
  bytes: Uint8Array
  mimeType: string
}

async function fetchGraphResource(path: string, token: string) {
  const url = `${GRAPH_BASE_URL}/${path}`
  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  }, MEDIA_FETCH_TIMEOUT_MS)
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
/**
 * Downloads WhatsApp media (image, audio, video) with 7-second timeout
 *
 * @param mediaId - WhatsApp media ID from webhook
 * @returns Binary content (Uint8Array) and MIME type
 * @throws {Error} If WHATSAPP_TOKEN missing, URL resolution fails, or timeout exceeded
 *
 * @example
 * ```ts
 * const { bytes, mimeType } = await downloadWhatsAppMedia('media_id_123');
 * // bytes: Uint8Array, mimeType: 'image/jpeg'
 * ```
 */
export async function downloadWhatsAppMedia(mediaId: string): Promise<WhatsAppMediaDownload> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) {
    throw new Error('WHATSAPP_TOKEN is not configured')
  }
  const { url, mimeType } = await resolveMediaUrl(mediaId, token)
  const mediaRes = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  }, MEDIA_FETCH_TIMEOUT_MS)
  if (!mediaRes.ok) {
    throw new Error(`WhatsApp media content fetch failed with ${mediaRes.status}`)
  }
  const buffer = await mediaRes.arrayBuffer()
  const contentType = mediaRes.headers.get('content-type') ?? mimeType ?? 'application/octet-stream'
  return { bytes: asUint8Array(buffer), mimeType: contentType }
}
