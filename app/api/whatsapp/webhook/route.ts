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
import { processMessageWithAI, processAudioMessage, processDocumentMessage } from '../../../../lib/ai-processing';

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
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = getRequestId();

  try {
    // Read and validate signature
    const rawBody = await req.text();
    const signatureOk = await validateSignature(req, rawBody);
    if (!signatureOk) {
      return jsonResponse({ error: 'Invalid signature', request_id: requestId }, 401);
    }

    // Parse JSON
    let jsonBody: unknown;
    try {
      jsonBody = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: 'Invalid JSON body', request_id: requestId }, 400);
    }

    // Validate with Zod schemas
    const validationResult = safeValidateWebhookPayload(jsonBody);
    if (!validationResult.success) {
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
    const message = extractFirstMessage(payload);
    if (!message) {
      return jsonResponse({ status: 'ignored', reason: 'no message', request_id: requestId }, 200);
    }

    // Convert to normalized format
    const normalized = whatsAppMessageToNormalized(message);

    // Persist message to database
    let conversationId: string;
    let userId: string;
    try {
      const result = await persistNormalizedMessage(normalized);
      if (!result) {
        return jsonResponse(
          { status: 'ignored', reason: 'persist failed', request_id: requestId },
          200
        );
      }
      conversationId = result.conversationId;
      userId = result.userId;
    } catch (persistErr: any) {
      return jsonResponse(
        { error: 'DB error', detail: persistErr?.message, request_id: requestId },
        500
      );
    }

    // Handle interactive message replies (buttons, lists)
    const interactiveReply = extractInteractiveReply(normalized.raw);
    let actionDefinition = null;

    if (interactiveReply) {
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
      processMessageWithAI(
        conversationId,
        userId,
        normalized.from,
        normalized.content,
        normalized.waMessageId,
        actionDefinition
      ).catch((err) => {
        logger.error('Background AI processing failed', err, {
          requestId,
          conversationId,
          userId,
        });
      });
    }

    // Process audio/voice message (fire and forget)
    if (
      (normalized.type === 'audio' || normalized.type === 'voice') &&
      normalized.mediaUrl &&
      normalized.from
    ) {
      processAudioMessage(conversationId, userId, normalized).catch((err) => {
        logger.error('Background audio processing failed', err, {
          requestId,
          conversationId,
          userId,
        });
      });
    }

    // Process document/image message (fire and forget)
    if (
      (normalized.type === 'document' || normalized.type === 'image') &&
      normalized.mediaUrl &&
      normalized.from
    ) {
      processDocumentMessage(conversationId, userId, normalized).catch((err) => {
        logger.error('Background document processing failed', err, {
          requestId,
          conversationId,
          userId,
        });
      });
    }

    return jsonResponse({ success: true, request_id: requestId });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message ?? 'Unhandled error', request_id: requestId },
      500
    );
  }
}
