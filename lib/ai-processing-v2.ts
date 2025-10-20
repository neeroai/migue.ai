/**
 * AI Processing V2 - Multi-Provider System
 * Integrates OpenAI and Tesseract for cost optimization
 *
 * Provider selection:
 * - Chat: OpenAI GPT-4o-mini (PRIMARY - 96% cheaper than Claude)
 * - Fallback: Claude Sonnet 4.5
 * - Audio: OpenAI Whisper ($0.36/hour)
 * - OCR: Tesseract (100% free)
 */

import { logger } from './logger'
import { getConversationHistory, historyToChatMessages } from './conversation-utils'
import { insertOutboundMessage, updateInboundMessageByWaId } from './persist'
import {
  getProviderManager,
  PROVIDER_COSTS,
} from './ai-providers'
import {
  createProactiveAgent,
  type OpenAIMessage,
  transcribeAudio,
} from './openai'
import { getBudgetStatus, isUserOverBudget } from './openai-cost-tracker'
// Note: tesseract-ocr is lazy loaded to reduce bundle size (2MB saved)
import {
  sendWhatsAppText,
  createTypingManager,
  sendInteractiveButtons,
  sendInteractiveList,
  markAsRead,
  reactWithThinking,
  reactWithCheck,
  reactWithWarning,
} from './whatsapp'
import type { NormalizedMessage } from './message-normalization'

/**
 * Convert conversation history to OpenAI format
 */
export function historyToOpenAIMessages(
  history: Array<{ direction: 'inbound' | 'outbound'; content: string | null }>
): OpenAIMessage[] {
  return history
    .filter((msg) => msg.content !== null)
    .map((msg) => ({
      role: msg.direction === 'outbound' ? ('assistant' as const) : ('user' as const),
      content: msg.content!,
    }))
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
 * Process message with AI using Claude Agents
 * 75% cost savings vs GPT-4o
 */
export async function processMessageWithAI(
  conversationId: string,
  userId: string,
  userPhone: string,
  userMessage: string,
  messageId: string
) {
  const startTime = Date.now()

  logger.functionEntry('processMessageWithAI', {
    conversationId,
    userId,
    userMessage: userMessage.slice(0, 100), // First 100 chars
    messageId,
  })

  let typingManager
  let providerManager
  let provider: string | null = null
  let providersAttempted: Set<string> = new Set()

  try {
    // Initialize managers inside try-catch to prevent synchronous errors
    typingManager = createTypingManager(userPhone, messageId)
    providerManager = getProviderManager()

    logger.debug('[AI] Initialized managers', {
      conversationId,
      userId,
    })

    // Mark message as read
    await markAsRead(messageId)
    await reactWithThinking(userPhone, messageId)

    // Start typing
    await typingManager.start()

    // Get conversation history (increased from 10 to 15 for better context)
    logger.debug('[AI] Getting conversation history', {
      conversationId,
      userId,
    })
    const history = await getConversationHistory(conversationId, 15)

    // Select provider based on availability and cost
    provider = await providerManager.selectProvider('chat')

    // CRITICAL FIX (2025-10-11): Handle emergency kill switch
    if (provider === null) {
      logger.warn('[AI] Emergency kill switch enabled - AI disabled', {
        conversationId,
        userId,
        metadata: { envVariable: 'AI_EMERGENCY_STOP=true' }
      })

      await reactWithWarning(userPhone, messageId)
      await sendTextAndPersist(
        conversationId,
        userPhone,
        'El sistema está temporalmente deshabilitado por mantenimiento. Por favor intenta más tarde.'
      )
      return
    }

    logger.decision('Provider selection', `Selected ${provider} for chat`, {
      conversationId,
      userId,
      metadata: {
        provider,
      }
    })

    // Track providers attempted to prevent fallback loops
    providersAttempted = new Set<string>([provider])

    let response: string
    let agentName: string
    let cost: number

    // Use OpenAI GPT-4o-mini (primary provider)
    const openaiHistory = historyToOpenAIMessages(history)
    logger.debug('[AI] Using OpenAI with conversation history', {
      conversationId,
      userId,
      metadata: {
        historyLength: openaiHistory.length,
        provider: 'openai',
        lastUserMessage: openaiHistory.slice(-3).filter(m => m.role === 'user').pop()?.content?.slice(0, 50)
      },
    })

    // ✅ Check budget limits BEFORE making API call
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

    // ✅ Budget OK, proceed with API call
    const proactiveAgent = createProactiveAgent()
    // ✅ NEW: Pass context for response validation and cost tracking
    response = await proactiveAgent.respond(userMessage, userId, openaiHistory, {
      conversationId,
      messageId,
    })
    agentName = 'ProactiveAgent'
    cost = PROVIDER_COSTS.chat.openai

    await sendTextAndPersist(conversationId, userPhone, response)
    await reactWithCheck(userPhone, messageId)

    // Track cost
    if (provider && ['openai', 'claude', 'tesseract'].includes(provider)) {
      providerManager.trackSpending(cost, provider as 'openai' | 'claude' | 'tesseract', 'chat')
    } else {
      logger.warn('[cost] Unknown provider for tracking', {
        conversationId,
        userId,
        metadata: { provider }
      })
    }

    logger.functionExit('processMessageWithAI', Date.now() - startTime, {
      agent: agentName,
      provider,
      responseLength: response.length,
      cost: `$${cost.toFixed(4)}`,
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
    const isAPIKeyError = error?.message?.includes('ANTHROPIC_API_KEY') ||
                          error?.message?.includes('API key') ||
                          error?.message?.includes('OPENAI_API_KEY')
    const errorMessage = isAPIKeyError
      ? 'El sistema está en mantenimiento temporalmente. Por favor intenta más tarde.'
      : 'Disculpa, tuve un problema al procesar tu mensaje. ¿Puedes intentar de nuevo?'

    // Fallback: Try Claude if OpenAI failed
    try {
      logger.info('Attempting Claude fallback', {
        conversationId,
        userId,
        metadata: {
          primaryProvider: provider,
          alreadyAttempted: Array.from(providersAttempted)
        }
      })

      // TODO: Implement Claude fallback when needed
      // For now, just send error message
      throw new Error('Claude fallback not yet implemented')
    } catch (fallbackError: any) {
      logger.error('Fallback failed', fallbackError, {
        conversationId,
        userId,
        metadata: {
          fallbackErrorType: fallbackError?.constructor?.name,
          fallbackErrorMessage: fallbackError?.message,
        },
      })

      // ALWAYS send a response to the user
      await sendTextAndPersist(conversationId, userPhone, errorMessage)
      logger.info('Sent error message to user', { conversationId, userId })
    }
  } finally {
    if (typingManager) {
      await typingManager.stop()
    }
  }
}

/**
 * Process audio with OpenAI Whisper
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

  let providerManager
  let typingManager

  try {
    // Initialize managers inside try-catch to prevent synchronous errors
    providerManager = getProviderManager()
    typingManager = createTypingManager(
      normalized.from,
      normalized.waMessageId
    )
    await markAsRead(normalized.waMessageId)
    await reactWithThinking(normalized.from, normalized.waMessageId)
    await typingManager.start()

    // Download audio
    logger.debug('[Audio] Downloading audio file', {
      conversationId,
      userId,
    })
    const audioResponse = await fetch(normalized.mediaUrl)
    const audioBuffer = new Uint8Array(await audioResponse.arrayBuffer())
    logger.debug('[Audio] Audio downloaded', {
      conversationId,
      userId,
      metadata: { bufferSize: audioBuffer.length },
    })

    // ✅ Check budget limits BEFORE making API call
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

    // Process transcribed text with AI
    await processMessageWithAI(
      conversationId,
      userId,
      normalized.from,
      transcript,
      normalized.waMessageId
    )

    // Track cost
    const durationMinutes = 1 // Assume 1 min average
    providerManager.trackSpending(
      PROVIDER_COSTS.transcription.openai * durationMinutes,
      'openai',
      'transcription'
    )

    logger.info('Audio processed with OpenAI Whisper', {
      metadata: {
        transcript: transcript.slice(0, 100),
        cost: `$${(PROVIDER_COSTS.transcription.openai * durationMinutes).toFixed(4)}`,
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

  let providerManager
  let typingManager

  try {
    // Initialize managers inside try-catch to prevent synchronous errors
    providerManager = getProviderManager()
    typingManager = createTypingManager(
      normalized.from,
      normalized.waMessageId
    )
    await markAsRead(normalized.waMessageId)
    await reactWithThinking(normalized.from, normalized.waMessageId)
    await typingManager.start()

    // Download image/document
    logger.debug('[Document] Downloading document', {
      conversationId,
      userId,
    })
    const imageResponse = await fetch(normalized.mediaUrl)
    const imageArrayBuffer = await imageResponse.arrayBuffer()
    const imageBuffer = new Uint8Array(imageArrayBuffer)
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'
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

      // Track cost (FREE!)
      providerManager.trackSpending(0, 'tesseract', 'ocr')

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
    const history = await getConversationHistory(conversationId, 5)
    const provider = await providerManager.selectProvider('chat')

    // Handle emergency kill switch
    if (provider === null) {
      logger.warn('[Document] Emergency kill switch enabled - AI disabled', {
        conversationId,
        userId,
        metadata: { envVariable: 'AI_EMERGENCY_STOP=true' }
      })

      await reactWithWarning(normalized.from, normalized.waMessageId)
      await sendTextAndPersist(
        conversationId,
        normalized.from,
        'El sistema está temporalmente deshabilitado por mantenimiento. Por favor intenta más tarde.'
      )
      return
    }

    // ✅ Check budget limits BEFORE making API call
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

    // ✅ Budget OK, proceed with API call
    // Use OpenAI for comprehension
    const proactiveAgent = createProactiveAgent()
    const openaiHistory = historyToOpenAIMessages(history)
    // ✅ NEW: Pass context for response validation and cost tracking
    const comprehension = await proactiveAgent.respond(
      `El usuario envió una imagen. Aquí está el contenido extraído:\n\n${extractedText}\n\nAnaliza y responde de forma útil.`,
      userId,
      openaiHistory,
      {
        conversationId,
        messageId: normalized.waMessageId,
      }
    )
    providerManager.trackSpending(PROVIDER_COSTS.chat.openai, 'openai', 'chat')

    // Send response
    await sendTextAndPersist(conversationId, normalized.from, comprehension)
    await reactWithCheck(normalized.from, normalized.waMessageId)

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
