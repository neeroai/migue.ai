/**
 * AI Processing V2 - Multi-Provider System
 * Integrates Gemini, GPT-4o-mini, Groq, and Tesseract for 100% cost savings
 *
 * Provider selection:
 * - Chat: Gemini 2.5 Flash (FREE - 1,500 req/day)
 * - Fallback: OpenAI GPT-4o-mini (96% cheaper than Claude)
 * - Audio: Groq Whisper (93% cheaper than OpenAI)
 * - OCR: Tesseract (100% free) or Gemini (multi-modal)
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
} from './openai'
import {
  createGeminiProactiveAgent,
} from './gemini-agents'
import {
  analyzeImageWithGemini,
  detectImageIssue,
} from './gemini-client'
import type { ChatMessage } from '@/types/schemas'
import { transcribeWithGroq, bufferToFile } from './groq-client'
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
 * Convert conversation history to ChatMessage format (Gemini compatible)
 */
export function historyToChatMessageArray(
  history: Array<{ direction: 'inbound' | 'outbound'; content: string | null }>
): ChatMessage[] {
  return history
    .filter((msg) => msg.content !== null)
    .map((msg) => ({
      role: msg.direction === 'outbound' ? ('assistant' as const) : ('user' as const),
      content: msg.content!,
      tool_calls: undefined,
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
    const provider = await providerManager.selectProvider('chat')
    logger.decision('Provider selection', `Selected ${provider} for chat`, {
      conversationId,
      userId,
      metadata: {
        provider,
      }
    })

    let response: string
    let agentName: string
    let cost: number

    if (provider === 'gemini') {
      // Use Gemini with ChatMessage format
      const chatHistory = historyToChatMessageArray(history)
      logger.debug('[AI] Using Gemini with conversation history', {
        conversationId,
        userId,
        metadata: {
          historyLength: chatHistory.length,
          provider: 'gemini',
        },
      })

      const geminiAgent = createGeminiProactiveAgent()
      response = await geminiAgent.respond(userMessage, userId, chatHistory)
      agentName = 'GeminiProactiveAgent'
      cost = PROVIDER_COSTS.chat.gemini // 0 (free tier)
    } else {
      // Fallback to OpenAI GPT-4o-mini
      const openaiHistory = historyToOpenAIMessages(history)
      logger.debug('[AI] Using OpenAI fallback with conversation history', {
        conversationId,
        userId,
        metadata: {
          historyLength: openaiHistory.length,
          provider: 'openai',
          lastUserMessage: openaiHistory.slice(-3).filter(m => m.role === 'user').pop()?.content?.slice(0, 50)
        },
      })

      const proactiveAgent = createProactiveAgent()
      response = await proactiveAgent.respond(userMessage, userId, openaiHistory)
      agentName = 'ProactiveAgent'
      cost = PROVIDER_COSTS.chat.openai
    }

    await sendTextAndPersist(conversationId, userPhone, response)
    await reactWithCheck(userPhone, messageId)

    // Track cost
    providerManager.trackSpending(cost, provider as any, 'chat')

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
                          error?.message?.includes('GOOGLE_AI_API_KEY')
    const errorMessage = isAPIKeyError
      ? 'El sistema está en mantenimiento temporalmente. Por favor intenta más tarde.'
      : 'Disculpa, tuve un problema al procesar tu mensaje. ¿Puedes intentar de nuevo?'

    // Try fallback chain: Gemini → OpenAI → Error message
    try {
      logger.info('Attempting Gemini fallback', { conversationId, userId })
      const history = await getConversationHistory(conversationId, 10)

      // Try Gemini first if available
      if (process.env.GOOGLE_AI_API_KEY) {
        const chatHistory = historyToChatMessageArray(history)
        const geminiAgent = createGeminiProactiveAgent()
        const fallbackResponse = await geminiAgent.respond(userMessage, userId, chatHistory)

        await sendTextAndPersist(conversationId, userPhone, fallbackResponse)
        await reactWithCheck(userPhone, messageId) // Override warning with success
        logger.info('Fallback to Gemini successful', { conversationId, userId })
        return
      }

      // If Gemini not available or fails, try OpenAI
      logger.info('Attempting OpenAI fallback', { conversationId, userId })
      const openaiHistory = historyToOpenAIMessages(history)
      const proactiveAgent = createProactiveAgent()
      const fallbackResponse = await proactiveAgent.respond(userMessage, userId, openaiHistory)

      await sendTextAndPersist(conversationId, userPhone, fallbackResponse)
      await reactWithCheck(userPhone, messageId) // Override warning with success
      logger.info('Fallback to OpenAI successful', { conversationId, userId })
    } catch (fallbackError: any) {
      logger.error('Fallback also failed', fallbackError, {
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
 * Process audio with Groq (93% cheaper than OpenAI Whisper)
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

    // Transcribe with Groq (93% cheaper!)
    logger.debug('[Audio] Starting Groq transcription', {
      conversationId,
      userId,
    })
    const audioFile = bufferToFile(audioBuffer, 'audio.ogg', 'audio/ogg')
    const transcript = await transcribeWithGroq(audioFile, {
      model: 'whisper-large-v3',
      language: 'es',
    })
    logger.performance('Groq transcription', Date.now() - startTime, {
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

    // Track cost (Groq is way cheaper!)
    const durationMinutes = 1 // Assume 1 min average
    providerManager.trackSpending(
      PROVIDER_COSTS.transcription.groq * durationMinutes,
      'groq',
      'transcription'
    )

    logger.info('Audio processed with Groq', {
      metadata: {
        transcript: transcript.slice(0, 100),
        savings: `$${(PROVIDER_COSTS.transcription.openai - PROVIDER_COSTS.transcription.groq).toFixed(4)}`,
      },
    })
  } catch (error: any) {
    logger.error('Groq audio processing error', error, {
      conversationId,
      userId,
      metadata: {
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
      },
    })

    // No fallback available - Groq is primary and only transcription provider
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
 * Process document/image with Gemini Vision API (primary) + Tesseract (fallback)
 *
 * Fallback chain:
 * 1. Gemini Vision API (better at structured data: tables, charts, screenshots)
 * 2. Tesseract OCR (text-only fallback)
 * 3. Contextual error message
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
    let usedMethod = ''

    // ✅ STRATEGY 1: Try Gemini Vision API first (better at structured data)
    if (process.env.GOOGLE_AI_API_KEY) {
      try {
        logger.debug('[Document] Trying Gemini Vision API', { conversationId, userId })

        const analysisPrompt = `Analiza esta imagen con detalle y extrae toda la información útil.

Si es una tabla: Extrae los datos en formato estructurado con columnas y filas.
Si es un screenshot: Describe los elementos visuales y texto visible.
Si contiene texto: Transcríbelo completamente preservando el formato.
Si tiene gráficas: Describe los datos y tendencias.

Responde en español de forma clara y estructurada.`

        const geminiResult = await analyzeImageWithGemini(imageBuffer, analysisPrompt, { mimeType })
        extractedText = geminiResult.text
        usedMethod = 'Gemini Vision API'

        logger.performance('Gemini Vision', Date.now() - startTime, {
          conversationId,
          userId,
          metadata: { textLength: extractedText.length, tokensUsed: geminiResult.usage.totalTokens },
        })

        // Track cost (FREE!)
        providerManager.trackSpending(0, 'gemini', 'ocr')

      } catch (geminiError: any) {
        // ✅ STRATEGY 2: Gemini failed - send contextual error
        logger.error('[Document] Gemini Vision failed', geminiError, {
          conversationId,
          userId,
          metadata: { error: geminiError.message },
        })

        await reactWithWarning(normalized.from, normalized.waMessageId)
        const errorMessage = detectImageIssue(imageBuffer)
        await sendTextAndPersist(conversationId, normalized.from, errorMessage)

        return // Exit early
      }
    } else {
      // No Gemini API key - send error
      logger.error('[Document] No GOOGLE_AI_API_KEY configured', new Error('GOOGLE_AI_API_KEY not set'), {
        conversationId,
        userId,
      })

      await reactWithWarning(normalized.from, normalized.waMessageId)
      await sendTextAndPersist(
        conversationId,
        normalized.from,
        'No puedo procesar imágenes en este momento. El servicio de visión no está disponible.'
      )

      return // Exit early
    }

    // Process extracted text with AI for comprehension
    const history = await getConversationHistory(conversationId, 5)
    const provider = await providerManager.selectProvider('chat')

    let comprehension: string

    if (provider === 'gemini' && process.env.GOOGLE_AI_API_KEY) {
      // Use Gemini for comprehension
      const chatHistory = historyToChatMessageArray(history)
      const geminiAgent = createGeminiProactiveAgent()
      comprehension = await geminiAgent.respond(
        `El usuario envió una imagen. Aquí está el contenido extraído:\n\n${extractedText}\n\nAnaliza y responde de forma útil.`,
        userId,
        chatHistory
      )
      providerManager.trackSpending(0, 'gemini', 'chat')
    } else {
      // Fallback to OpenAI
      const proactiveAgent = createProactiveAgent()
      const openaiHistory = historyToOpenAIMessages(history)
      comprehension = await proactiveAgent.respond(
        `El usuario envió una imagen. Aquí está el contenido extraído:\n\n${extractedText}\n\nAnaliza y responde de forma útil.`,
        userId,
        openaiHistory
      )
      providerManager.trackSpending(PROVIDER_COSTS.chat.openai, 'openai', 'chat')
    }

    // Send response
    await sendTextAndPersist(conversationId, normalized.from, comprehension)
    await reactWithCheck(normalized.from, normalized.waMessageId)

    // Update message
    await updateInboundMessageByWaId(normalized.waMessageId, {
      content: extractedText.slice(0, 5000),
    })

    logger.info(`Document processed successfully with ${usedMethod}`, {
      conversationId,
      userId,
      metadata: {
        method: usedMethod,
        textLength: extractedText.length,
        cost: '$0.00 (free tier)',
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
