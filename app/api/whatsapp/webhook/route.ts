export const runtime = 'edge';

import { logger } from '../../../../lib/logger';
import { recordConversationAction } from '../../../../lib/conversation-actions';
import { getActionDefinition } from '../../../../lib/actions';
import { safeValidateWebhookPayload, extractFirstMessage } from '../../../../types/schemas';
import { validateSignature, verifyToken } from '../../../../lib/webhook-validation';
import {
  whatsAppMessageToNormalized,
  extractInteractiveReply,
  persistNormalizedMessage,
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
 * Webhook deduplication cache
 * WhatsApp retries failed webhooks up to 5 times
 */
const processedWebhooks = new Map<string, number>();
const DEDUP_WINDOW_MS = 60000; // 1 minute

/**
 * Check if webhook was already processed recently
 */
function isDuplicateWebhook(messageId: string): boolean {
  const now = Date.now();

  // Check if message was processed recently
  if (processedWebhooks.has(messageId)) {
    const processedAt = processedWebhooks.get(messageId)!;
    if (now - processedAt < DEDUP_WINDOW_MS) {
      return true;
    }
  }

  // Mark message as processed
  processedWebhooks.set(messageId, now);

  // Clean old entries (prevent memory leak)
  for (const [id, timestamp] of processedWebhooks) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      processedWebhooks.delete(id);
    }
  }

  return false;
}

/**
 * GET handler for webhook verification
 */
export async function GET(req: Request): Promise<Response> {
  return verifyToken(req);
}

/**
 * POST handler for incoming WhatsApp messages
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

    // Check for duplicate webhook (WhatsApp retries up to 5 times)
    logger.debug('[webhook] Checking for duplicate webhook', {
      requestId,
      metadata: { messageId: message.id },
    });

    const isDuplicate = isDuplicateWebhook(message.id);
    logger.decision('Duplicate check', isDuplicate ? 'DUPLICATE' : 'NEW', {
      requestId,
      metadata: { messageId: message.id },
    });

    if (isDuplicate) {
      logger.info('[webhook] Duplicate webhook detected', {
        requestId,
        metadata: { messageId: message.id },
      });
      return jsonResponse(
        { status: 'duplicate', message_id: message.id, request_id: requestId },
        200
      );
    }

    // Convert to normalized format
    logger.debug('[webhook] Normalizing message', {
      requestId,
      metadata: { messageType: message.type, from: message.from },
    });
    const normalized = whatsAppMessageToNormalized(message);

    // Persist message to database
    logger.debug('[webhook] Persisting message to database', { requestId });
    let conversationId: string;
    let userId: string;
    try {
      const result = await persistNormalizedMessage(normalized);
      if (!result) {
        logger.warn('[webhook] Persist returned null', { requestId });
        return jsonResponse(
          { status: 'ignored', reason: 'persist failed', request_id: requestId },
          200
        );
      }
      conversationId = result.conversationId;
      userId = result.userId;
      logger.debug('[webhook] Message persisted successfully', {
        requestId,
        conversationId,
        userId,
      });
    } catch (persistErr: any) {
      logger.error('[webhook] Persist error', persistErr, { requestId });
      return jsonResponse(
        { error: 'DB error', detail: persistErr?.message, request_id: requestId },
        500
      );
    }

    // Handle interactive message replies (buttons, lists)
    const interactiveReply = extractInteractiveReply(normalized.raw);
    let actionDefinition = null;

    if (interactiveReply) {
      logger.debug('[webhook] Interactive reply detected', {
        requestId,
        conversationId,
        metadata: { interactiveId: interactiveReply.id },
      });
      actionDefinition = getActionDefinition(interactiveReply.id);

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
        logger.error('Action log error', logErr, { requestId, conversationId, userId });
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

    // Process text message with AI (fire and forget)
    if (normalized.content && normalized.from) {
      logger.decision('Message processing', 'AI text processing', {
        requestId,
        conversationId,
        userId,
        metadata: { contentLength: normalized.content.length },
      });

      try {
        processMessageWithAI(
          conversationId,
          userId,
          normalized.from,
          normalized.content,
          normalized.waMessageId
        ).catch(async (err) => {
          logger.error('Background AI processing failed', err, {
            requestId,
            conversationId,
            userId,
          });

          // CRITICAL FIX: Send fallback response to user
          try {
            await sendWhatsAppText(
              normalized.from,
              'Disculpa, tuve un problema procesando tu mensaje. ¿Puedes intentar de nuevo?'
            );
            await reactWithWarning(normalized.from, normalized.waMessageId);
          } catch (fallbackErr: any) {
            logger.error('Failed to send error message to user', fallbackErr, {
              requestId,
              conversationId,
              userId,
            });
          }

          // CRITICAL FIX: Remove from dedup cache to allow retry
          processedWebhooks.delete(normalized.waMessageId);
          logger.info('[webhook] Removed failed message from dedup cache', {
            requestId,
            metadata: { messageId: normalized.waMessageId },
          });
        });
      } catch (syncErr: any) {
        // Catch any synchronous errors to prevent webhook crash
        logger.error('Synchronous error in AI processing', syncErr, {
          requestId,
          conversationId,
          userId,
        });
      }
    }

    // Process audio/voice message (fire and forget)
    if (
      (normalized.type === 'audio' || normalized.type === 'voice') &&
      normalized.mediaUrl &&
      normalized.from
    ) {
      try {
        processAudioMessage(conversationId, userId, normalized).catch((err) => {
          logger.error('Background audio processing failed', err, {
            requestId,
            conversationId,
            userId,
          });
        });
      } catch (syncErr: any) {
        logger.error('Synchronous error in audio processing', syncErr, {
          requestId,
          conversationId,
          userId,
        });
      }
    }

    // Process document/image message (fire and forget)
    if (
      (normalized.type === 'document' || normalized.type === 'image') &&
      normalized.mediaUrl &&
      normalized.from
    ) {
      try {
        processDocumentMessage(conversationId, userId, normalized).catch((err) => {
          logger.error('Background document processing failed', err, {
            requestId,
            conversationId,
            userId,
          });
        });
      } catch (syncErr: any) {
        logger.error('Synchronous error in document processing', syncErr, {
          requestId,
          conversationId,
          userId,
        });
      }
    }

    // Process location message (v23.0)
    if (normalized.type === 'location' && message.location) {
      // Fire and forget - save location asynchronously
      (async () => {
        try {
          const supabase = getSupabaseServerClient();
          const { error } = await supabase
            .from('user_locations')
            .insert({
              user_id: userId,
              conversation_id: conversationId,
              latitude: message.location!.latitude,
              longitude: message.location!.longitude,
              name: message.location!.name || null,
              address: message.location!.address || null,
              timestamp: new Date().toISOString(),
            });

          if (error) {
            logger.error('Failed to save location', error, {
              requestId,
              conversationId,
              userId,
            });
          } else {
            logger.info('[webhook] Location saved', {
              requestId,
              conversationId,
              userId,
            });
          }
        } catch (err: any) {
          logger.error('Failed to save location', err, {
            requestId,
            conversationId,
            userId,
          });
        }
      })();
    }

    return jsonResponse({ success: true, request_id: requestId });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message ?? 'Unhandled error', request_id: requestId },
      500
    );
  }
}
