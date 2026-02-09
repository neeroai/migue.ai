/**
 * @file Background Webhook Processor
 * @description Fire-and-forget webhook pipeline for persistence, actions, and AI/media processing
 */

import { waitUntil } from '@vercel/functions';
import { logger } from '../../../shared/observability/logger';
import { recordConversationAction, getActionDefinition } from '../../conversation/application/utils';
import {
  extractInteractiveReply,
  persistNormalizedMessage,
  type NormalizedMessage,
} from '../domain/message-normalization';
import { sendWhatsAppText, reactWithWarning } from '../../../shared/infra/whatsapp';
import { retryWithBackoff, isDuplicateError, isTransientError } from '../../../shared/resilience/error-recovery';
import { updateMessagingWindow } from '../../messaging-window/application/service';
import { processInputByClass } from './input-orchestrator';
import { isAgentEventLedgerEnabled } from '../../agent/application/feature-flags';
import { enqueueAgentEvent } from '../../agent/infra/ledger';
import { ensureSignupOnFirstContact } from '../../onboarding/application/service';

/**
 * Background webhook processing (fire-and-forget)
 * Handles: DB persist, dedup, interactive messages, AI processing, media processing
 */
export async function processWebhookInBackground(
  requestId: string,
  normalized: NormalizedMessage
): Promise<void> {
  let conversationId: string | undefined;
  let userId: string | undefined;

  try {
    logger.debug('[background] Persisting message to database', {
      requestId,
      metadata: { waMessageId: normalized.waMessageId },
    });

    let result;
    try {
      result = await retryWithBackoff(
        () => persistNormalizedMessage(normalized),
        'persistNormalizedMessage',
        {
          maxRetries: 1,
          initialDelayMs: 500,
        }
      );
    } catch (persistError: any) {
      if (isDuplicateError(persistError)) {
        logger.info('[background] Duplicate message detected, skipping', {
          requestId,
          metadata: {
            waMessageId: normalized.waMessageId,
            errorCode: persistError.code,
          },
        });
        return;
      }

      logger.error('[background] Persist failed after retries', persistError, {
        requestId,
        metadata: {
          errorCode: persistError.code,
          errorMessage: persistError.message,
          isTransient: isTransientError(persistError),
          waMessageId: normalized.waMessageId,
        },
      });

      try {
        await sendWhatsAppText(
          normalized.from,
          'Disculpa, hubo un problema guardando tu mensaje. Por favor intenta de nuevo en unos momentos.'
        );
        if (normalized.waMessageId) {
          await reactWithWarning(normalized.from, normalized.waMessageId);
        }
      } catch (notifyError: any) {
        logger.error('[background] Failed to notify user of persist failure', notifyError, {
          requestId,
          metadata: { phoneNumber: normalized.from },
        });
      }

      return;
    }

    if (!result) {
      logger.warn('[background] Persist returned null', { requestId });
      return;
    }

    conversationId = result.conversationId;
    userId = result.userId;
    const wasInserted = result.wasInserted;

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

    if (isAgentEventLedgerEnabled()) {
      waitUntil(
        Promise.resolve(
          enqueueAgentEvent({
            requestId,
            conversationId,
            userId,
            normalized,
          })
        ).catch((err) =>
          logger.error('[background] Failed to enqueue agent event', err, {
            requestId,
            ...(conversationId && { conversationId }),
            ...(userId && { userId }),
            metadata: {
              waMessageId: normalized.waMessageId,
              inputType: normalized.type,
            },
          })
        )
      );
    }

    waitUntil(
      Promise.resolve(updateMessagingWindow(normalized.from, normalized.waMessageId ?? `gen-${Date.now()}`, true)).catch((err) =>
        logger.error('[background] Failed to update messaging window', err, {
          requestId,
          ...(conversationId && { conversationId }),
          ...(userId && { userId }),
          metadata: { phoneNumber: normalized.from.slice(0, 8) + '***' },
        })
      )
    );

    const interactiveReply = extractInteractiveReply(normalized.raw);

    if (interactiveReply) {
      logger.debug('[background] Interactive reply detected', {
        requestId,
        conversationId,
        metadata: { interactiveId: interactiveReply.id },
      });

      const actionDefinition = getActionDefinition(interactiveReply.id);

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

    if (normalized.from) {
      const signupGate = await ensureSignupOnFirstContact({
        userId,
        phoneNumber: normalized.from,
        conversationId,
        requestId,
      });
      if (signupGate.reason === 'flow_send_failed') {
        await sendWhatsAppText(
          normalized.from,
          'No pude abrir el formulario de registro. Envíame por mensaje: "Me llamo <tu nombre>, mi email es <tu@email.com>".'
        ).catch(() => undefined);
        logger.warn('[background] Signup flow send failed, continuing AI turn', {
          requestId,
          conversationId,
          userId,
          metadata: { type: normalized.type },
        });
      }
      if (signupGate.blocked) {
        if (signupGate.reason === 'already_in_progress') {
          await sendWhatsAppText(
            normalized.from,
            'Tu registro sigue pendiente. Abre el formulario "Completar registro" para continuar, o envíame: "Me llamo <tu nombre>, mi email es <tu@email.com>".'
          ).catch(() => undefined);
        }
        logger.info('[background] Onboarding gate active, skipping AI turn', {
          requestId,
          conversationId,
          userId,
          metadata: { reason: signupGate.reason, type: normalized.type },
        });
        return;
      }
    }

    try {
      await processInputByClass({
        requestId,
        conversationId,
        userId,
        normalized,
      });
    } catch (err: any) {
      logger.error('[background] Input orchestration failed', err, {
        requestId,
        conversationId,
        userId,
      });

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
  }
}
