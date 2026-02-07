/**
 * @file webhook-validation.ts
 * @description WhatsApp webhook validation utilities with HMAC-SHA256 signature verification, constant-time comparison, and token validation
 * @module lib/webhook-validation
 * @exports validateSignature, isVerifyRequest, verifyToken
 * @runtime edge
 * @date 2026-02-07 19:00
 * @updated 2026-02-07 19:00
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
 *
 * Implements timing-attack resistant HMAC-SHA256 validation per WhatsApp security requirements.
 * Uses XOR-based constant-time comparison to prevent timing attacks where attackers measure
 * execution time to guess the signature byte-by-byte.
 *
 * Security behavior:
 * - Production: Fails closed (returns false) if WHATSAPP_APP_SECRET missing
 * - Development: Logs warning and allows requests through for local testing
 * - Handles emojis/Unicode via escapeUnicode to match Meta's signature generation
 *
 * @param req - Request object containing x-hub-signature-256 header (case-insensitive)
 * @param rawBody - Raw request body as string (must be unparsed, exact bytes as received)
 * @returns true if signature valid or dev mode without credentials, false if validation fails
 *
 * @example
 * // Webhook route handler
 * const rawBody = await req.text();
 * const isValid = await validateSignature(req, rawBody);
 * if (!isValid) {
 *   return new Response('Unauthorized', { status: 401 });
 * }
 * const payload = JSON.parse(rawBody);
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
 *
 * WhatsApp sends GET request with hub.mode query param during webhook setup.
 * This happens once when configuring webhook URL in Meta Developer Console.
 *
 * @param req - Request object to check
 * @returns true if GET request with hub.mode parameter (verification request), false otherwise
 *
 * @example
 * // Webhook route handler
 * if (isVerifyRequest(req)) {
 *   return verifyToken(req); // One-time setup
 * }
 * // Handle normal webhook POST
 */
export function isVerifyRequest(req: Request): boolean {
  const url = new URL(req.url);
  return req.method === 'GET' && url.searchParams.has('hub.mode');
}

/**
 * Handle webhook verification request
 *
 * WhatsApp webhook setup requires responding with hub.challenge value if hub.verify_token matches.
 * This is a one-time handshake when configuring webhook URL in Meta Developer Console.
 *
 * Expected query params:
 * - hub.mode: Should be "subscribe"
 * - hub.verify_token: Must match WHATSAPP_VERIFY_TOKEN env var
 * - hub.challenge: Random string to echo back
 *
 * @param req - GET request with query parameters from WhatsApp
 * @returns Response with challenge text (200) if token matches, Unauthorized (401) otherwise
 *
 * @example
 * // Webhook setup flow in Meta Console:
 * // 1. Enter webhook URL: https://app.com/api/whatsapp/webhook
 * // 2. Enter verify token: "your-secret-token"
 * // 3. Meta sends: GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=your-secret-token&hub.challenge=12345
 * // 4. verifyToken responds: 200 "12345"
 * // 5. Webhook is verified and activated
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
