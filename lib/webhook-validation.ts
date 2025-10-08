/**
 * WhatsApp webhook validation utilities
 * Handles signature verification and token validation
 */

import { getEnv } from './env';
import { logger } from './logger';

/**
 * Convert ArrayBuffer to hex string
 */
function hex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Escape non-ASCII characters to Unicode escape sequences
 * This ensures consistent signature validation with emojis and special characters
 *
 * Pattern from: Secreto31126/whatsapp-api-js
 * @param str - String to escape
 * @returns String with Unicode escape sequences
 */
function escapeUnicode(str: string): string {
  return str.replace(/[^\x00-\x7F]/g, (char) => {
    return '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
  });
}

/**
 * Generate HMAC-SHA256 hex signature
 */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  // Escape Unicode characters before encoding to ensure consistent signature validation
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(escapeUnicode(message)));
  return hex(sig);
}

/**
 * Validate WhatsApp webhook signature using constant-time comparison
 * Implements timing-attack resistant HMAC-SHA256 validation
 *
 * Security: Uses XOR-based constant-time comparison to prevent timing attacks
 * where attackers could measure execution time to guess the signature
 *
 * @param req - Request with x-hub-signature-256 header
 * @param rawBody - Raw request body as string
 * @returns true if signature is valid or validation is disabled, false otherwise
 */
export async function validateSignature(req: Request, rawBody: string): Promise<boolean> {
  const header = req.headers.get('x-hub-signature-256') || req.headers.get('X-Hub-Signature-256');
  const { WHATSAPP_APP_SECRET } = getEnv();

  // Security: Fail closed in production if credentials missing
  if (!header || !WHATSAPP_APP_SECRET) {
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    if (isProd) {
      logger.error('[Webhook Validation] Missing WHATSAPP_APP_SECRET in production', new Error('Missing credentials'), {
        metadata: { isProd, hasHeader: !!header, hasSecret: !!WHATSAPP_APP_SECRET }
      });
      return false;
    }

    logger.warn('[Webhook Validation] Development mode: signature validation disabled', {
      metadata: { isProd, hasHeader: !!header, hasSecret: !!WHATSAPP_APP_SECRET }
    });
    return true;
  }

  // Header format: sha256=abcdef...
  const parts = header.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    logger.error('[Webhook Validation] Invalid signature header format', new Error('Invalid header format'), {
      metadata: { header, partsLength: parts.length, algorithm: parts[0] }
    });
    return false;
  }

  const provided = parts[1];
  if (!provided) {
    logger.error('[Webhook Validation] Missing signature value', new Error('Empty signature'), {
      metadata: { header }
    });
    return false;
  }

  // Calculate expected signature
  const expected = await hmacSha256Hex(WHATSAPP_APP_SECRET, rawBody);

  // Constant-time comparison to prevent timing attacks
  // Note: Length check is OK as length is public information
  if (provided.length !== expected.length) {
    logger.error('[Webhook Validation] Signature length mismatch', new Error('Length mismatch'), {
      metadata: { providedLength: provided.length, expectedLength: expected.length }
    });
    return false;
  }

  // XOR-based constant-time string comparison
  // This ensures comparison takes the same time regardless of where strings differ
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }

  const isValid = diff === 0;

  if (!isValid) {
    logger.error('[Webhook Validation] Signature validation failed', new Error('Invalid signature'), {
      metadata: { providedLength: provided.length, expectedLength: expected.length }
    });
  }

  return isValid;
}

/**
 * Check if request is a webhook verification request
 */
export function isVerifyRequest(req: Request): boolean {
  const url = new URL(req.url);
  return req.method === 'GET' && url.searchParams.has('hub.mode');
}

/**
 * Handle webhook verification request
 */
export function verifyToken(req: Request): Response {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const { WHATSAPP_VERIFY_TOKEN } = getEnv();

  if (mode === 'subscribe' && token && token === WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
  }

  return new Response('Unauthorized', { status: 401 });
}
