/**
 * @file AI Processing Pipeline V2
 * @description Multi-provider AI orchestration (OpenAI GPT-4o-mini PRIMARY, Gemini 2.5 Flash Lite fallback) with audio transcription (Whisper) and OCR (Tesseract) for cost optimization
 * @module lib/ai-processing-v2
 * @exports processMessageWithAI, processAudioMessage, processDocumentMessage
 * @runtime edge
 * @see https://platform.openai.com/docs/api-reference
 * @date 2026-02-07 18:50
 * @updated 2026-02-07 18:50
 */

import { logger } from '../../../shared/observability/logger'
import { emitSlaMetric, SLA_METRICS } from '../../../shared/observability/metrics'
import { getConversationHistory, historyToModelMessages, trimHistoryByChars } from '../../conversation/application/utils'
import { insertOutboundMessage, updateInboundMessageByWaId } from '../../../shared/infra/db/persist'
import { getSupabaseServerClient } from '../../../shared/infra/db/supabase'
// PROVIDER_COSTS removed - cost now comes from AI response
import { transcribeAudio } from '../../../shared/infra/openai/audio-transcription'
import { createProactiveAgent } from './proactive-agent'
import type { ModelMessage } from 'ai'
import { getBudgetStatus, isUserOverBudget, trackUsage } from '../domain/cost-tracker'
import { hasToolIntent } from '../domain/intent'
// Note: tesseract-ocr is lazy loaded to reduce bundle size (2MB saved)
import {
  sendWhatsAppText,
  createTypingManager,
  sendInteractiveButtons,
  sendInteractiveList,
  markAsRead,
  reactWithWarning,
  downloadWhatsAppMedia,
} from '../../../shared/infra/whatsapp'
import type { NormalizedMessage } from '@/src/modules/webhook/domain/message-normalization'

const proactiveAgent = createProactiveAgent()
const supabaseClient = getSupabaseServerClient()

const HISTORY_CHAR_BUDGET = 4000

type TextPathway = 'default' | 'fast_text' | 'tool_intent' | 'rich_input'

type ProcessMessageOptions = {
  pathway?: TextPathway
}

function getTrivialResponse(message: string): string | null {
  const normalized = message.trim().toLowerCase()
  const singleEmoji = /^[\u{1F300}-\u{1FAFF}]$/u.test(normalized)

  if (['ok', 'ok.', 'okay', 'listo', 'dale', 'perfecto', 'vale'].includes(normalized)) {
    return 'Listo.'
  }
  if (['gracias', 'gracias!', 'mil gracias', 'thank you', 'thanks'].includes(normalized)) {
    return '¡Con gusto!'
  }
  if (['👍', '👌', '✅'].includes(normalized) || singleEmoji) {
    return '¡Entendido!'
  }

  return null
}


/**
 * Send text message and persist to database
 */
async function sendTextAndPersist(
  conversationId: string,
  userPhone: string,
  response: string
) {
  const waMessageId = await sendWhatsAppText(userPhone, response)
  if (waMessageId) {
    await insertOutboundMessage(conversationId, response, waMessageId)
  } else {
    await insertOutboundMessage(conversationId, response)
  }
  return waMessageId
}

/**
 * Process message with AI using Vercel AI SDK agent
 * Cost-optimized with GPT-4o-mini primary
 */
/**
 * Processes text message with AI (OpenAI GPT-4o-mini PRIMARY, Gemini 2.5 Flash Lite fallback) and sends response
 * Shows typing indicator for messages ≥10 chars
 *
 * @param conversationId - Conversation UUID for history context
 * @param userId - User UUID for budget tracking
 * @param userPhone - E.164 format phone for sending response
 * @param userMessage - User's text message content
 * @param messageId - WhatsApp message ID for reactions
 * @throws {Error} If AI provider fails or budget exceeded
 *
 * @example
 * ```ts
 * await processMessageWithAI(
 *   'conv-uuid',
 *   'user-uuid',
 *   '+573001234567',
 *   'What is the weather?',
 *   'wamid.xxx'
 * );
 * // AI response sent to user
 * ```
 */
export async function processMessageWithAI(
  conversationId: string,
  userId: string,
  userPhone: string,
  userMessage: string,
  messageId: string,
  options: ProcessMessageOptions = {}
) {
  const startTime = Date.now()
  const pathway = options.pathway ?? 'default'

  logger.functionEntry('processMessageWithAI', {
    conversationId,
    userId,
    userMessage: userMessage.slice(0, 100), // First 100 chars
    messageId,
    pathway,
  })

  let typingManager

  const shouldShowTyping = userMessage.length >= 10

  try {
    // Hydrate cost tracker from database (fire-and-forget to reduce blocking)
    // OPTIMIZATION P0.1: Non-blocking hydration reduces cold start by 300-800ms
    const { getCostTracker } = await import('../domain/cost-tracker')
    const tracker = getCostTracker()
    if (!tracker.isHydratedState() && pathway !== 'fast_text') {
      await tracker.ensureHydrated()
    } else {
      void tracker.ensureHydrated() // Fire-and-forget
    }

    // Mark message as read early for short messages (typing path already marks as read)
    if (!shouldShowTyping) {
      await markAsRead(messageId)
    }

    // Early-exit for trivial messages (no AI call)
    const trivialResponse = getTrivialResponse(userMessage)
    if (trivialResponse) {
      await sendTextAndPersist(conversationId, userPhone, trivialResponse)
      return
    }

    if (shouldShowTyping) {
      // Initialize typing manager inside try-catch to prevent synchronous errors
      typingManager = createTypingManager(userPhone, messageId)

      logger.debug('[AI] Initialized typing manager', {
        conversationId,
        userId,
      })

      const typingStartAt = Date.now()
      await typingManager.startPersistent(20)
      emitSlaMetric(SLA_METRICS.TYPING_START_MS, {
        conversationId,
        userId,
        value: Date.now() - typingStartAt,
        messageType: 'text',
        pathway,
        extra: { message_length: userMessage.length },
      })
    }

    // Check budget limits BEFORE making API call
    const budgetStatus = getBudgetStatus()

    // Check global daily limit
    if (budgetStatus.dailyRemaining < 0.01) {
      logger.warn('[AI Processing] Daily budget exhausted', {
        conversationId,
        userId,
        metadata: {
          dailySpent: `$${budgetStatus.dailySpent.toFixed(4)}`,
          limit: `$${budgetStatus.dailyLimit.toFixed(2)}`,
        },
      })

      await sendWhatsAppText(
        userPhone,
        'Lo siento, he alcanzado mi límite diario de consultas. Vuelve mañana a las 7am.'
      )
      await reactWithWarning(userPhone, messageId)
      return
    }

    // Check per-user daily limit
    if (isUserOverBudget(userId)) {
      logger.warn('[AI Processing] User over budget', {
        conversationId,
        userId,
        metadata: { phoneNumber: userPhone },
      })

      await sendWhatsAppText(
        userPhone,
        'Has alcanzado tu límite diario de consultas ($0.50). Vuelve mañana.'
      )
      await reactWithWarning(userPhone, messageId)
      return
    }

    // Get conversation history (adaptive limit to reduce tokens for long messages)
    logger.debug('[AI] Getting conversation history', {
      conversationId,
      userId,
    })
    const historyLimit = pathway === 'fast_text'
      ? (userMessage.length > 300 ? 6 : 8)
      : userMessage.length > 600 ? 8 : userMessage.length > 200 ? 12 : 15
    const history = await getConversationHistory(conversationId, historyLimit, supabaseClient)
    const trimmedHistory = trimHistoryByChars(history, HISTORY_CHAR_BUDGET)

    let response: string
    let agentName: string

    // Use Vercel AI SDK (primary provider)
    const modelHistory = historyToModelMessages(trimmedHistory)
    logger.debug('[AI] Using Vercel AI SDK with conversation history', {
      conversationId,
      userId,
      metadata: {
        historyLength: modelHistory.length,
        provider: 'openai',
        lastUserMessage: modelHistory.slice(-3).filter(m => m.role === 'user').pop()?.content?.slice(0, 50)
      },
    })

    // Budget OK, proceed with API call
    const aiResponse = await proactiveAgent.respond(userMessage, userId, modelHistory, {
      conversationId,
      messageId,
    })
    response = aiResponse.text
    agentName = 'ProactiveAgent'

    await sendTextAndPersist(conversationId, userPhone, response)

    logger.functionExit('processMessageWithAI', Date.now() - startTime, {
      agent: agentName,
      responseLength: response.length,
      cost: `$${aiResponse.cost.total.toFixed(4)}`,
      pathway,
    }, { conversationId, userId })
  } catch (error: any) {
    logger.error('AI processing error', error, {
      conversationId,
      userId,
      metadata: {
        userPhone,
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
      },
    })

    // Always send warning reaction
    await reactWithWarning(userPhone, messageId)

    // Determine error type for better user messaging
    const isAPIKeyError = error?.message?.includes('AI_GATEWAY_API_KEY') ||
                          error?.message?.includes('API key') ||
                          error?.message?.includes('OPENAI_API_KEY')
    const isFallbackExhausted = error?.message?.includes('Primary provider failed and insufficient budget')

    const errorMessage = isAPIKeyError
      ? 'El sistema está en mantenimiento temporalmente. Por favor intenta más tarde.'
      : isFallbackExhausted
      ? 'He alcanzado el límite de presupuesto. Intenta mañana.'
      : 'Disculpa, tuve un problema al procesar tu mensaje. ¿Puedes intentar de nuevo?'

    // Fallback is now handled inside proactive-agent.ts via executeWithFallback
    // No need for outer fallback logic - just send error to user
    await sendTextAndPersist(conversationId, userPhone, errorMessage)
    logger.info('Sent error message to user', { conversationId, userId })
  } finally {
    if (typingManager) {
      await typingManager.stop()
    }
  }
}

/**
 * Process audio with OpenAI Whisper
 */
/**
 * Processes audio message with Whisper transcription + AI response pipeline
 * Requires mediaUrl, waMessageId, from fields (returns early if missing)
 *
 * @param conversationId - Conversation UUID for history context
 * @param userId - User UUID for budget tracking
 * @param normalized - Normalized WhatsApp message with mediaUrl required
 * @throws {Error} If audio download, transcription, or AI processing fails
 *
 * @example
 * ```ts
 * await processAudioMessage(
 *   'conv-uuid',
 *   'user-uuid',
 *   { type: 'audio', mediaUrl: '...', waMessageId: 'wamid.xxx', from: '+57...' }
 * );
 * // Transcription + AI response sent
 * ```
 */
export async function processAudioMessage(
  conversationId: string,
  userId: string,
  normalized: NormalizedMessage
) {
  const startTime = Date.now()

  logger.functionEntry('processAudioMessage', {
    conversationId,
    userId,
    hasMediaUrl: !!normalized.mediaUrl,
  })

  if (!normalized.mediaUrl || !normalized.waMessageId || !normalized.from) {
    logger.warn('[Audio] Missing required fields', {
      conversationId,
      userId,
      metadata: {
        hasMediaUrl: !!normalized.mediaUrl,
        hasMessageId: !!normalized.waMessageId,
        hasFrom: !!normalized.from,
      },
    })
    return
  }

  let typingManager

  try {
    await markAsRead(normalized.waMessageId)

    // ✅ Check budget limits BEFORE download/processing
    const budgetStatus = getBudgetStatus()

    // Check global daily limit
    if (budgetStatus.dailyRemaining < 0.01) {
      logger.warn('[Audio Processing] Daily budget exhausted', {
        conversationId,
        userId,
        metadata: {
          dailySpent: `$${budgetStatus.dailySpent.toFixed(4)}`,
          limit: `$${budgetStatus.dailyLimit.toFixed(2)}`,
        },
      })

      await sendWhatsAppText(
        normalized.from,
        'Lo siento, he alcanzado mi límite diario de consultas. Vuelve mañana a las 7am.'
      )
      await reactWithWarning(normalized.from, normalized.waMessageId)
      return
    }

    // Initialize typing manager inside try-catch to prevent synchronous errors
    typingManager = createTypingManager(
      normalized.from,
      normalized.waMessageId
    )
    await typingManager.startPersistent(20)

    // Check per-user daily limit
    if (isUserOverBudget(userId)) {
      logger.warn('[Audio Processing] User over budget', {
        conversationId,
        userId,
        metadata: { phoneNumber: normalized.from },
      })

      await sendWhatsAppText(
        normalized.from,
        'Has alcanzado tu límite diario de consultas ($0.50). Vuelve mañana.'
      )
      await reactWithWarning(normalized.from, normalized.waMessageId)
      return
    }

    // Download audio
    logger.debug('[Audio] Downloading audio file', {
      conversationId,
      userId,
    })
    const { bytes: audioBuffer } = await downloadWhatsAppMedia(normalized.mediaUrl)
    logger.debug('[Audio] Audio downloaded', {
      conversationId,
      userId,
      metadata: { bufferSize: audioBuffer.length },
    })

    // ✅ Budget OK, proceed with API call
    // Transcribe with OpenAI Whisper
    logger.debug('[Audio] Starting OpenAI Whisper transcription', {
      conversationId,
      userId,
    })
    const transcript = await transcribeAudio(audioBuffer, {
      language: 'es',
      mimeType: 'audio/ogg',
      fileName: 'audio.ogg'
    })
    logger.performance('OpenAI Whisper transcription', Date.now() - startTime, {
      conversationId,
      userId,
      metadata: { transcriptLength: transcript.length },
    })

    // Update message with transcript
    await updateInboundMessageByWaId(normalized.waMessageId, {
      content: transcript,
    })

    // Budget check before AI follow-up
    const followupBudgetStatus = getBudgetStatus()
    if (followupBudgetStatus.dailyRemaining < 0.01 || isUserOverBudget(userId)) {
      await sendWhatsAppText(
        normalized.from,
        followupBudgetStatus.dailyRemaining < 0.01
          ? 'Lo siento, he alcanzado mi límite diario de consultas. Vuelve mañana a las 7am.'
          : 'Has alcanzado tu límite diario de consultas ($0.50). Vuelve mañana.'
      )
      await reactWithWarning(normalized.from, normalized.waMessageId)
      return
    }

    // Process transcribed text with AI
    await processMessageWithAI(
      conversationId,
      userId,
      normalized.from,
      transcript,
      normalized.waMessageId,
      { pathway: hasToolIntent(transcript) ? 'tool_intent' : 'rich_input' }
    )

    logger.info('Audio processed with OpenAI Whisper', {
      metadata: {
        transcript: transcript.slice(0, 100),
      },
    })
  } catch (error: any) {
    logger.error('OpenAI audio processing error', error, {
      conversationId,
      userId,
      metadata: {
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
      },
    })

    // Send error message to user
    if (normalized.from && normalized.waMessageId) {
      await reactWithWarning(normalized.from, normalized.waMessageId)
      await sendTextAndPersist(
        conversationId,
        normalized.from,
        'Disculpa, tuve un problema procesando tu mensaje de audio. ¿Puedes enviar un mensaje de texto?'
      )
    }
  } finally {
    if (typingManager) {
      await typingManager.stop()
    }
  }
}

/**
 * Process document/image with Tesseract OCR
 *
 * Uses Tesseract for free text extraction from images/documents
 */
/**
 * Processes document/image message with Tesseract OCR + AI response pipeline
 * Requires mediaUrl, waMessageId, from fields (returns early if missing)
 *
 * @param conversationId - Conversation UUID for history context
 * @param userId - User UUID for budget tracking
 * @param normalized - Normalized WhatsApp message with mediaUrl required
 * @throws {Error} If media download, OCR, or AI processing fails
 *
 * @example
 * ```ts
 * await processDocumentMessage(
 *   'conv-uuid',
 *   'user-uuid',
 *   { type: 'image', mediaUrl: '...', waMessageId: 'wamid.xxx', from: '+57...' }
 * );
 * // OCR text + AI response sent
 * ```
 */
export async function processDocumentMessage(
  conversationId: string,
  userId: string,
  normalized: NormalizedMessage
) {
  const startTime = Date.now()

  logger.functionEntry('processDocumentMessage', {
    conversationId,
    userId,
    hasMediaUrl: !!normalized.mediaUrl,
  })

  if (!normalized.mediaUrl || !normalized.waMessageId || !normalized.from) {
    logger.warn('[Document] Missing required fields', {
      conversationId,
      userId,
      metadata: {
        hasMediaUrl: !!normalized.mediaUrl,
        hasMessageId: !!normalized.waMessageId,
        hasFrom: !!normalized.from,
      },
    })
    return
  }

  let typingManager

  try {
    await markAsRead(normalized.waMessageId)

    // Check budget limits BEFORE download/processing
    const budgetStatus = getBudgetStatus()

    // Check global daily limit
    if (budgetStatus.dailyRemaining < 0.01) {
      logger.warn('[Document Processing] Daily budget exhausted', {
        conversationId,
        userId,
        metadata: {
          dailySpent: `$${budgetStatus.dailySpent.toFixed(4)}`,
          limit: `$${budgetStatus.dailyLimit.toFixed(2)}`,
        },
      })

      await sendWhatsAppText(
        normalized.from,
        'Lo siento, he alcanzado mi límite diario de consultas. Vuelve mañana a las 7am.'
      )
      await reactWithWarning(normalized.from, normalized.waMessageId)
      return
    }

    // Check per-user daily limit
    if (isUserOverBudget(userId)) {
      logger.warn('[Document Processing] User over budget', {
        conversationId,
        userId,
        metadata: { phoneNumber: normalized.from },
      })

      await sendWhatsAppText(
        normalized.from,
        'Has alcanzado tu límite diario de consultas ($0.50). Vuelve mañana.'
      )
      await reactWithWarning(normalized.from, normalized.waMessageId)
      return
    }

    // Initialize typing manager inside try-catch to prevent synchronous errors
    typingManager = createTypingManager(
      normalized.from,
      normalized.waMessageId
    )
    await typingManager.startPersistent(20)

    // Download image/document
    logger.debug('[Document] Downloading document', {
      conversationId,
      userId,
    })
    const { bytes: imageBuffer, mimeType } = await downloadWhatsAppMedia(normalized.mediaUrl)
    logger.debug('[Document] Document downloaded', {
      conversationId,
      userId,
      metadata: { bufferSize: imageBuffer.length, mimeType },
    })

    let extractedText = ''

    // Use Tesseract OCR (free, text-only extraction)
    try {
      logger.debug('[Document] Using Tesseract OCR', { conversationId, userId })

      // Lazy load tesseract to reduce bundle size
      const Tesseract = await import('tesseract.js')

      const result = await Tesseract.recognize(
        Buffer.from(imageBuffer),
        'spa', // Spanish language
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              logger.debug(`[Tesseract] Progress: ${Math.round(m.progress * 100)}%`, {
                conversationId,
                userId,
              })
            }
          },
        }
      )

      extractedText = result.data.text.trim()

      logger.performance('Tesseract OCR', Date.now() - startTime, {
        conversationId,
        userId,
        metadata: { textLength: extractedText.length },
      })

      if (!extractedText || extractedText.length < 10) {
        logger.warn('[Document] No text extracted from image', {
          conversationId,
          userId,
          metadata: { extractedLength: extractedText.length },
        })

        await reactWithWarning(normalized.from, normalized.waMessageId)
        await sendTextAndPersist(
          conversationId,
          normalized.from,
          'No pude extraer texto de esta imagen. Asegúrate de que la imagen contenga texto claro y legible.'
        )

        return // Exit early
      }

    } catch (ocrError: any) {
      logger.error('[Document] Tesseract OCR failed', ocrError, {
        conversationId,
        userId,
        metadata: { error: ocrError.message },
      })

      await reactWithWarning(normalized.from, normalized.waMessageId)
      await sendTextAndPersist(
        conversationId,
        normalized.from,
        'Disculpa, tuve un problema procesando la imagen. ¿Puedes intentar de nuevo con una imagen más clara?'
      )

      return // Exit early
    }

    // Process extracted text with AI for comprehension
    const history = await getConversationHistory(conversationId, 5, supabaseClient)

    // Budget OK, proceed with API call
    // Use Vercel AI SDK for comprehension
    const modelHistory = historyToModelMessages(history)

    // Include caption in prompt if available (prevents double responses)
    const captionContext = normalized.content
      ? `\n\nCONTEXTO del usuario: "${normalized.content}"\n\n`
      : '\n\n'

    const aiResponse = await proactiveAgent.respond(
      `El usuario envió una imagen. Aquí está el contenido extraído:${captionContext}${extractedText}\n\nAnaliza y responde de forma útil.`,
      userId,
      modelHistory,
      {
        conversationId,
        messageId: normalized.waMessageId,
      }
    )

    // Send response
    await sendTextAndPersist(conversationId, normalized.from, aiResponse.text)

    // Update message
    await updateInboundMessageByWaId(normalized.waMessageId, {
      content: extractedText.slice(0, 5000),
    })

    logger.info('Document processed successfully with Tesseract OCR', {
      conversationId,
      userId,
      metadata: {
        method: 'Tesseract OCR',
        textLength: extractedText.length,
        cost: '$0.00 (free)',
        toolIntent: hasToolIntent(extractedText),
      },
    })

  } catch (error: any) {
    logger.error('[Document] Complete processing failure', error, {
      conversationId,
      userId,
    })

    await reactWithWarning(normalized.from, normalized.waMessageId)

    // Send generic error message
    await sendTextAndPersist(
      conversationId,
      normalized.from,
      'Disculpa, tuve un problema procesando la imagen. ¿Puedes intentar de nuevo?'
    )
  } finally {
    if (typingManager) {
      await typingManager.stop()
    }
  }
}
