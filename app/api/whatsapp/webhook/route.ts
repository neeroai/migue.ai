/**
 * @file WhatsApp Webhook Handler
 * @description Main webhook endpoint for WhatsApp Business API events with fire-and-forget pattern, signature validation, and rate limiting
 * @module app/api/whatsapp/webhook
 * @exports runtime, maxDuration, GET, POST, jsonResponse, getRequestId
 * @runtime edge
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 * @date 2026-02-07 19:00
 * @updated 2026-02-07 19:00
 */

export const runtime = 'edge';
export const maxDuration = 10;

import { waitUntil } from '@vercel/functions';
import { logger } from '../../../../src/shared/observability/logger';
import { processWebhookInBackground } from '../../../../src/modules/webhook/application/background-processor';
import { processWebhookIngress } from '../../../../src/modules/webhook/interface/ingress';
import { verifyToken } from '../../../../src/modules/webhook/interface/validation';
import { sendWhatsAppText } from '../../../../src/shared/infra/whatsapp';

/**
 * Create JSON response helper
 */
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * Generate unique request ID
 */
function getRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * GET handler for webhook verification
 */
export async function GET(req: Request): Promise<Response> {
  return verifyToken(req);
}

/**
 * POST handler for incoming WhatsApp messages
 * Uses fire-and-forget pattern for fast responses (<100ms)
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = getRequestId();

  logger.debug('[webhook] Incoming POST request', {
    requestId,
    metadata: {
      url: req.url,
      method: req.method,
    },
  });

  try {
    const ingress = await processWebhookIngress(req, requestId);

    if (ingress.kind === 'response') {
      return jsonResponse(ingress.body, ingress.status);
    }

    if (ingress.kind === 'rate_limited') {
      waitUntil(
        sendWhatsAppText(
          ingress.phoneNumber,
          `⚠️ Estás enviando mensajes muy rápido. Por favor espera ${ingress.waitSeconds} segundo${ingress.waitSeconds > 1 ? 's' : ''} e intenta de nuevo.`
        ).catch((err: unknown) => {
          const errorObj = err instanceof Error ? err : new Error(String(err));
          logger.error('[webhook] Failed to send rate limit message', errorObj, { requestId });
        })
      );

      return jsonResponse(ingress.body, 200);
    }

    const normalized = ingress.normalized;

    // ✅ RETURN 200 OK IMMEDIATELY (<100ms)
    // Fire-and-forget: Process in background using Vercel's waitUntil API
    logger.info('[webhook] Webhook validated, processing in background', {
      requestId,
      metadata: { waMessageId: normalized.waMessageId, from: normalized.from.slice(0, 8) + '***' },
    });

    waitUntil(
      processWebhookInBackground(requestId, normalized).catch((err: unknown) => {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        logger.error('[webhook] Background processing failed', errorObj, { requestId });
      })
    );

    return jsonResponse({ success: true, request_id: requestId }, 200);

  } catch (error: any) {
    // ⚠️ NEVER return 500 to WhatsApp - prevents retry storms
    logger.error('[webhook] Webhook processing error', error, { requestId });
    return jsonResponse(
      {
        success: false,
        error: 'Processing failed',
        request_id: requestId
      },
      200 // ✅ Always return 200
    );
  }
}
