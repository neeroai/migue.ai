import { logger } from '../../observability/logger';
import { getWhatsAppErrorHint, WhatsAppAPIError } from './errors';

export const GRAPH_BASE_URL = 'https://graph.facebook.com/v23.0';

export type WhatsAppPayload = {
  messaging_product: 'whatsapp';
  to: string;
  type: string;
  [key: string]: unknown;
};

// Rate limiting: 250 msg/sec (WhatsApp Cloud API 2025 limit)
const rateLimitBuckets = new Map<number, number[]>();
const RATE_LIMIT = 250;

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
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

export function _clearCaches() {
  rateLimitBuckets.clear();
}

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const second = Math.floor(now / 1000);

  if (!rateLimitBuckets.has(second)) {
    rateLimitBuckets.set(second, []);
    for (const [key] of rateLimitBuckets) {
      if (key < second - 2) {
        rateLimitBuckets.delete(key);
      }
    }
  }

  const bucket = rateLimitBuckets.get(second)!;
  if (bucket.length >= RATE_LIMIT) {
    const waitTime = 1000 - (now % 1000);
    await new Promise((r) => setTimeout(r, waitTime));
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
      Authorization: `Bearer ${token}`,
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
      // detail is not JSON
    }

    const errorDetails = {
      status: res.status,
      errorCode,
      errorSubcode,
      message: errorMessage || detail,
    };

    const hint = getWhatsAppErrorHint(errorDetails);
    const error = new WhatsAppAPIError(errorDetails, hint);

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
      });
    } catch {
      // Ignore logging errors in tests
    }

    throw error;
  }

  const data = await res.json();

  if (latency > 100) {
    logger.warn('[WhatsApp API] Slow response detected', {
      metadata: { latency, payloadType: payload.type, to: payload.to },
    });
  }

  return data;
}

export async function sendWhatsAppRequestWithRetry(payload: WhatsAppPayload, maxRetries = 3): Promise<unknown> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await sendWhatsAppRequest(payload);
    } catch (error: unknown) {
      const isLastAttempt = attempt === maxRetries - 1;

      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusMatch = errorMessage.match(/WhatsApp API error (\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1]!, 10) : 0;

      if (status >= 400 && status < 500) {
        logger.error(
          '[WhatsApp Retry] Client error, not retrying',
          error instanceof Error ? error : new Error(String(error)),
          { metadata: { status, attempt, maxRetries } }
        );
        throw error;
      }

      if (isLastAttempt) {
        logger.error(
          '[WhatsApp Retry] Max retries reached',
          error instanceof Error ? error : new Error(String(error)),
          { metadata: { maxRetries, totalAttempts: attempt + 1 } }
        );
        throw error;
      }

      const delayMs = 1000 * Math.pow(2, attempt);
      logger.warn('[WhatsApp Retry] Retrying after backoff', {
        metadata: { attempt: attempt + 1, maxRetries, delayMs },
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Unexpected retry loop exit');
}
