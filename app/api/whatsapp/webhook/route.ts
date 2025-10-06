export const runtime = 'edge';

import { waitUntil } from '@vercel/functions';
import { logger } from '../../../../lib/logger';
import { recordConversationAction } from '../../../../lib/conversation-actions';
import { getActionDefinition } from '../../../../lib/actions';
import { safeValidateWebhookPayload, extractFirstMessage } from '../../../../types/schemas';
import { validateSignature, verifyToken } from '../../../../lib/webhook-validation';
import {
  whatsAppMessageToNormalized,
  extractInteractiveReply,
  persistNormalizedMessage,
  type NormalizedMessage,
} from '../../../../lib/message-normalization';
// Import V2 AI processing with multi-provider support (76% cost savings)
import { processMessageWithAI, processAudioMessage, processDocumentMessage } from '../../../../lib/ai-processing-v2';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { sendWhatsAppText, reactWithWarning } from '../../../../lib/whatsapp';

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
    // FAST PATH: Quick validations (<100ms target)

    // Read and validate signature
    const rawBody = await req.text();
    logger.debug('[webhook] Request body received', {
      requestId,
      metadata: { bodyLength: rawBody.length },
    });

    const signatureOk = await validateSignature(req, rawBody);
    if (!signatureOk) {
      logger.warn('[webhook] Invalid signature', { requestId });
      return jsonResponse({ error: 'Invalid signature', request_id: requestId }, 401);
    }
    logger.debug('[webhook] Signature validated successfully', { requestId });

    // Parse JSON
    let jsonBody: unknown;
    try {
      jsonBody = JSON.parse(rawBody);
      logger.debug('[webhook] JSON parsed successfully', {
        requestId,
        metadata: { object: (jsonBody as any)?.object },
      });
    } catch (parseErr: any) {
      logger.warn('[webhook] JSON parse failed', {
        requestId,
        metadata: { error: parseErr.message },
      });
      return jsonResponse({ error: 'Invalid JSON body', request_id: requestId }, 400);
    }

    // Validate with Zod schemas
    const validationResult = safeValidateWebhookPayload(jsonBody);
    if (!validationResult.success) {
      logger.debug('[webhook] Zod validation result', {
        requestId,
        metadata: {
          success: validationResult.success,
          errorCount: validationResult.error?.issues.length,
        },
      });
      logger.warn('[webhook] Validation failed', {
        requestId,
        metadata: { issues: validationResult.error.issues.slice(0, 3) },
      });
      return jsonResponse(
        {
          error: 'Invalid webhook payload',
          request_id: requestId,
          issues: validationResult.error.issues.slice(0, 3), // First 3 errors
        },
        400
      );
    }

    // Extract message from payload
    const payload = validationResult.data;
    logger.debug('[webhook] Payload validated, extracting message', {
      requestId,
      metadata: {
        entryCount: payload.entry.length,
      },
    });

    const message = extractFirstMessage(payload);
    if (!message) {
      logger.debug('[webhook] No message found in payload', { requestId });
      // Handle non-message webhook events (flows, template status, etc.)
      if (payload.entry.length > 0) {
        const entry = payload.entry[0]!;
        if (entry.changes.length > 0) {
          const change = entry.changes[0]!;

          // Log and acknowledge flow webhooks (monitoring/status events)
          if (change.field === 'flows') {
            logger.info('[webhook] Flow event received (acknowledged, not processed)', {
              requestId,
              metadata: {
                field: change.field,
                eventType: 'value' in change ? (change.value as any)?.event : 'unknown',
                flowId: 'value' in change ? (change.value as any)?.flow_id : undefined,
              },
            });
            return jsonResponse({
              status: 'acknowledged',
              reason: 'flow monitoring event',
              request_id: requestId
            }, 200);
          }

          // Log and acknowledge other unknown webhook field types
          if (change.field !== 'messages' && change.field !== 'call_events') {
            const valueKeys = 'value' in change && typeof change.value === 'object' && change.value !== null
              ? Object.keys(change.value)
              : [];
            logger.info('[webhook] Unknown webhook field type (acknowledged, not processed)', {
              requestId,
              metadata: {
                field: change.field,
                valueKeys,
              },
            });
            return jsonResponse({
              status: 'acknowledged',
              reason: `unsupported field: ${change.field}`,
              request_id: requestId
            }, 200);
          }
        }
      }

      return jsonResponse({ status: 'ignored', reason: 'no message or recognized event', request_id: requestId }, 200);
    }

    // Convert to normalized format
    logger.debug('[webhook] Normalizing message', {
      requestId,
      metadata: { messageType: message.type, from: message.from },
    });
    const normalized = whatsAppMessageToNormalized(message);

    // ✅ RETURN 200 OK IMMEDIATELY (<100ms)
    // Fire-and-forget: Process in background using Vercel's waitUntil API
    logger.info('[webhook] Webhook validated, processing in background', {
      requestId,
      metadata: { waMessageId: normalized.waMessageId, from: normalized.from.slice(0, 8) + '***' },
    });

    waitUntil(
      processWebhookInBackground(requestId, normalized, message).catch((err) => {
        logger.error('[webhook] Background processing failed', err, { requestId });
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

/**
 * Background webhook processing (fire-and-forget)
 * Handles: DB persist, dedup, interactive messages, AI processing, media processing
 */
async function processWebhookInBackground(
  requestId: string,
  normalized: NormalizedMessage,
  message: any
): Promise<void> {
  let conversationId: string | undefined;
  let userId: string | undefined;

  try {
    // Persist message to database (with DB-based deduplication)
    logger.debug('[background] Persisting message to database', {
      requestId,
      metadata: { waMessageId: normalized.waMessageId },
    });

    const result = await persistNormalizedMessage(normalized);
    if (!result) {
      logger.warn('[background] Persist returned null', { requestId });
      return;
    }

    conversationId = result.conversationId;
    userId = result.userId;
    const wasInserted = result.wasInserted;

    // Check if message was duplicate (detected by database unique constraint)
    if (!wasInserted) {
      logger.info('[background] Duplicate webhook detected by database', {
        requestId,
        metadata: { waMessageId: normalized.waMessageId },
      });
      return;
    }

    logger.debug('[background] Message persisted successfully', {
      requestId,
      conversationId,
      userId,
      metadata: { wasInserted },
    });

    // Handle interactive message replies (buttons, lists)
    const interactiveReply = extractInteractiveReply(normalized.raw);

    if (interactiveReply) {
      logger.debug('[background] Interactive reply detected', {
        requestId,
        conversationId,
        metadata: { interactiveId: interactiveReply.id },
      });
      const actionDefinition = getActionDefinition(interactiveReply.id);

      // Log conversation action
      try {
        await recordConversationAction({
          conversationId,
          userId,
          actionId: interactiveReply.id,
          actionType: actionDefinition?.category ?? 'interactive',
          payload: {
            title: interactiveReply.title,
            description: interactiveReply.description,
          },
        });
      } catch (logErr: any) {
        logger.error('[background] Action log error', logErr, { requestId, conversationId, userId });
      }

      // Replace message content if needed
      if (actionDefinition?.replacementMessage) {
        normalized.content = actionDefinition.replacementMessage;
      } else if (!actionDefinition && interactiveReply.title) {
        normalized.content = interactiveReply.title;
      }

      if (!normalized.content) {
        normalized.content = interactiveReply.id;
      }

      normalized.type = 'text';
    }

    // Process text message with AI
    if (normalized.content && normalized.from) {
      logger.decision('Message processing', 'AI text processing', {
        requestId,
        conversationId,
        userId,
        metadata: { contentLength: normalized.content.length },
      });

      try {
        await processMessageWithAI(
          conversationId,
          userId,
          normalized.from,
          normalized.content,
          normalized.waMessageId
        );
      } catch (err: any) {
        logger.error('[background] AI processing failed', err, {
          requestId,
          conversationId,
          userId,
        });

        // Send fallback response to user
        try {
          await sendWhatsAppText(
            normalized.from,
            'Disculpa, tuve un problema procesando tu mensaje. ¿Puedes intentar de nuevo?'
          );
          await reactWithWarning(normalized.from, normalized.waMessageId);
        } catch (fallbackErr: any) {
          logger.error('[background] Failed to send error message to user', fallbackErr, {
            requestId,
            conversationId,
            userId,
          });
        }
      }
    }

    // Process audio/voice message
    if (
      (normalized.type === 'audio' || normalized.type === 'voice') &&
      normalized.mediaUrl &&
      normalized.from
    ) {
      try {
        await processAudioMessage(conversationId, userId, normalized);
      } catch (err: any) {
        logger.error('[background] Audio processing failed', err, {
          requestId,
          conversationId,
          userId,
        });
      }
    }

    // Process document/image message
    if (
      (normalized.type === 'document' || normalized.type === 'image') &&
      normalized.mediaUrl &&
      normalized.from
    ) {
      try {
        await processDocumentMessage(conversationId, userId, normalized);
      } catch (err: any) {
        logger.error('[background] Document processing failed', err, {
          requestId,
          conversationId,
          userId,
        });
      }
    }

    // Process location message (v23.0)
    if (normalized.type === 'location' && message.location && conversationId && userId) {
      try {
        const supabase = getSupabaseServerClient();
        const { error } = await supabase
          .from('user_locations')
          .insert({
            user_id: userId,
            conversation_id: conversationId,
            latitude: message.location.latitude,
            longitude: message.location.longitude,
            name: message.location.name || null,
            address: message.location.address || null,
            timestamp: new Date().toISOString(),
          });

        if (error) {
          logger.error('[background] Failed to save location', error, {
            requestId,
            conversationId,
            userId,
          });
        } else {
          logger.info('[background] Location saved', {
            requestId,
            conversationId,
            userId,
          });
        }
      } catch (err: any) {
        logger.error('[background] Location save error', err, {
          requestId,
          conversationId,
          userId,
        });
      }
    }

  } catch (error: any) {
    logger.error('[background] Processing error', error, {
      requestId,
      ...(conversationId && { conversationId }),
      ...(userId && { userId }),
      metadata: {
        errorMessage: error?.message,
        errorCode: error?.code,
      },
    });
    // Errors are logged but don't propagate - webhook already returned 200 OK
  }
}
