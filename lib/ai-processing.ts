/**
 * AI-powered message processing
 * Handles intent classification, response generation, and follow-up actions
 */

import { logger } from './logger';
import { getConversationHistory, historyToChatMessages } from './context';
import { classifyIntent } from './intent';
import { generateResponse } from './response';
import { scheduleMeetingFromIntent } from './scheduling';
import { parseReminderRequest, createReminder } from './reminders';
import { scheduleFollowUp } from './followups';
import { transcribeWhatsAppAudio } from './transcription';
import { insertOutboundMessage, updateInboundMessageByWaId } from './persist';
import {
  getScheduleButtons,
  getReminderOptions,
  type ActionDefinition,
} from './actions';
import {
  sendWhatsAppText,
  createTypingManager,
  sendInteractiveButtons,
  sendInteractiveList,
  markAsRead,
  reactWithThinking,
  reactWithCheck,
  reactWithWarning,
} from './whatsapp';
import type { NormalizedMessage } from './message-normalization';
import { ingestWhatsAppDocument, formatIngestionResponse } from './rag/document-ingestion';

/**
 * Send text message and persist to database
 */
async function sendTextAndPersist(
  conversationId: string,
  userPhone: string,
  response: string
) {
  const waMessageId = await sendWhatsAppText(userPhone, response);
  if (waMessageId) {
    await insertOutboundMessage(conversationId, response, waMessageId);
  } else {
    await insertOutboundMessage(conversationId, response);
  }
  return waMessageId;
}

/**
 * Send schedule follow-up buttons
 */
async function sendScheduleFollowUp(userPhone: string) {
  try {
    const buttons = getScheduleButtons().map((action) => ({
      id: action.id,
      title: action.title,
    }));
    await sendInteractiveButtons(userPhone, '¿Qué deseas hacer con la cita?', buttons);
  } catch (err: any) {
    logger.error('Schedule follow-up error', err);
  }
}

/**
 * Send reminder follow-up list
 */
async function sendReminderFollowUp(userPhone: string) {
  try {
    const rows = getReminderOptions().map((action) => ({
      id: action.id,
      title: action.title,
      ...(action.description && { description: action.description }),
    }));
    await sendInteractiveList(
      userPhone,
      '¿Qué quieres hacer con el recordatorio?',
      'Elegir',
      rows,
      'Acciones disponibles'
    );
  } catch (err: any) {
    logger.error('Reminder follow-up error', err);
  }
}

/**
 * Create processing notification manager
 * Sends "still processing" message after 30s delay
 */
function createProcessingNotifier(conversationId: string, userPhone: string) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const message = 'Sigo procesando tu solicitud, dame unos segundos…';

  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    start() {
      if (timer) return;
      timer = setTimeout(() => {
        (async () => {
          try {
            await sendTextAndPersist(conversationId, userPhone, message);
          } catch (err: any) {
            logger.error('Processing notice error', err);
          }
        })();
      }, 30000); // 30 seconds
    },
    stop() {
      clear();
    },
  };
}

/**
 * Process message with AI (intent classification + response generation)
 */
export async function processMessageWithAI(
  conversationId: string,
  userId: string,
  userPhone: string,
  userMessage: string,
  messageId: string,
  actionDefinition?: ActionDefinition | null
) {
  const typingManager = createTypingManager(userPhone, messageId);
  const processingNotifier = createProcessingNotifier(conversationId, userPhone);

  const ensureTyping = async () => {
    await typingManager.start();
    processingNotifier.start();
  };

  try {
    // Mark message as read immediately
    try {
      await markAsRead(messageId);
    } catch (err: any) {
      logger.error('Mark as read error', err);
    }

    // Quick acknowledgment with thinking reaction
    try {
      await reactWithThinking(userPhone, messageId);
    } catch (err: any) {
      logger.error('Reaction error', err);
    }

    // Direct response for predefined actions
    if (actionDefinition?.directResponse) {
      await sendTextAndPersist(conversationId, userPhone, actionDefinition.directResponse);
      // Success reaction
      try {
        await reactWithCheck(userPhone, messageId);
      } catch (err: any) {
        logger.error('Reaction error', err);
      }
      return;
    }

    // Get conversation history
    const history = await getConversationHistory(conversationId, 10);
    const chatHistory = historyToChatMessages(history);

    // Classify intent
    const intentResult = await classifyIntent(userMessage, chatHistory);

    let response: string;
    let sendScheduleActions = false;
    let sendReminderActions = false;

    // Handle intent-specific logic
    if (intentResult.intent === 'schedule_meeting') {
      await ensureTyping();
      const schedulingOutcome = await scheduleMeetingFromIntent({
        userId,
        userMessage,
        conversationHistory: chatHistory,
      });
      response = schedulingOutcome.reply;
      sendScheduleActions = true;
    } else if (intentResult.intent === 'set_reminder') {
      await ensureTyping();
      const parsed = await parseReminderRequest(userMessage, chatHistory);

      if (parsed.status === 'needs_clarification') {
        response = parsed.clarification;
      } else {
        await createReminder(userId, parsed.title, parsed.description, parsed.datetimeIso);
        response = `¡Perfecto! Te recordaré "${parsed.title}" el ${new Date(
          parsed.datetimeIso
        ).toLocaleString('es-MX', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}.`;
        sendReminderActions = true;
      }
    } else {
      // Generic response generation
      await ensureTyping();
      response = await generateResponse({
        intent: intentResult.intent,
        conversationHistory: chatHistory,
        userMessage,
        userId,
      });
    }

    // Send response
    await sendTextAndPersist(conversationId, userPhone, response);

    // Success reaction
    try {
      await reactWithCheck(userPhone, messageId);
    } catch (err: any) {
      logger.error('Reaction error', err);
    }

    // Send follow-up actions
    if (sendScheduleActions) {
      await sendScheduleFollowUp(userPhone);
      try {
        await scheduleFollowUp({
          userId,
          conversationId,
          category: 'schedule_confirm',
          payload: { intent: intentResult.intent },
          delayMinutes: 120, // 2 hours
        });
      } catch (err: any) {
        logger.error('Follow-up schedule error', err);
      }
    } else if (sendReminderActions) {
      await sendReminderFollowUp(userPhone);
      try {
        await scheduleFollowUp({
          userId,
          conversationId,
          category: 'reminder_check',
          payload: { intent: intentResult.intent },
          delayMinutes: 1440, // 24 hours
        });
      } catch (err: any) {
        logger.error('Follow-up schedule error', err);
      }
    }
  } catch (error: any) {
    logger.error('AI processing error', error);
    // Warning reaction on error
    try {
      await reactWithWarning(userPhone, messageId);
    } catch (err: any) {
      logger.error('Reaction error', err);
    }
  } finally {
    await typingManager.stop();
    processingNotifier.stop();
  }
}

/**
 * Process audio/voice message (transcribe + AI processing)
 */
export async function processAudioMessage(
  conversationId: string,
  userId: string,
  normalized: NormalizedMessage
) {
  if (!normalized.mediaUrl || !normalized.waMessageId || !normalized.from) {
    return;
  }

  try {
    const result = await transcribeWhatsAppAudio(normalized.mediaUrl, userId);

    // Update message with transcript
    await updateInboundMessageByWaId(normalized.waMessageId, {
      content: result.transcript,
      mediaUrl: result.storageUri,
    });

    // Process transcribed text with AI
    await processMessageWithAI(
      conversationId,
      userId,
      normalized.from,
      result.transcript,
      normalized.waMessageId
    );
  } catch (error: any) {
    logger.error('Audio processing error', error);
  }
}

/**
 * Process document/image message (extract text + ingest to RAG + summarize)
 */
export async function processDocumentMessage(
  conversationId: string,
  userId: string,
  normalized: NormalizedMessage
) {
  if (!normalized.mediaUrl || !normalized.waMessageId || !normalized.from) {
    return;
  }

  const userPhone = normalized.from;
  const messageId = normalized.waMessageId;
  const typingManager = createTypingManager(userPhone, messageId);

  try {
    // Mark as read immediately
    try {
      await markAsRead(messageId);
    } catch (err: any) {
      logger.error('Mark as read error', err);
    }

    // Quick acknowledgment with thinking reaction
    try {
      await reactWithThinking(userPhone, messageId);
    } catch (err: any) {
      logger.error('Reaction error', err);
    }

    // Start typing indicator
    await typingManager.start();

    // Ingest document into RAG system
    const result = await ingestWhatsAppDocument(
      normalized.mediaUrl,
      userId,
      normalized.content
    );

    // Format response
    const response = formatIngestionResponse(result);

    // Send response
    await sendTextAndPersist(conversationId, userPhone, response);

    // Success reaction
    try {
      await reactWithCheck(userPhone, messageId);
    } catch (err: any) {
      logger.error('Reaction error', err);
    }

    // Update message with extracted text
    await updateInboundMessageByWaId(messageId, {
      content: result.document.text.slice(0, 5000), // Store first 5000 chars
      mediaUrl: result.document.storageUri,
    });

    logger.info('Document processed successfully', {
      conversationId,
      userId,
      metadata: {
        documentId: result.documentId,
        type: result.document.type,
        chunks: result.chunksCreated,
      },
    });
  } catch (error: any) {
    logger.error('Document processing error', error, {
      conversationId,
      userId,
      metadata: {
        mediaUrl: normalized.mediaUrl,
      },
    });

    // Warning reaction on error
    try {
      await reactWithWarning(userPhone, messageId);
    } catch (err: any) {
      logger.error('Reaction error', err);
    }

    // Send error message
    const errorMessage =
      error?.message?.includes('Unsupported document type')
        ? 'Lo siento, solo puedo procesar archivos PDF e imágenes.'
        : 'Tuve problemas al procesar el documento. ¿Puedes intentar enviarlo de nuevo?';

    try {
      await sendTextAndPersist(conversationId, userPhone, errorMessage);
    } catch (err: any) {
      logger.error('Error message send failed', err);
    }
  } finally {
    await typingManager.stop();
  }
}
