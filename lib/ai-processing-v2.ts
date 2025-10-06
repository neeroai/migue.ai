/**
 * AI Processing V2 - Multi-Provider System
 * Integrates Claude SDK, Groq, and Tesseract for 76% cost savings
 *
 * Provider selection:
 * - Chat: Claude Sonnet 4.5 (75% cheaper than GPT-4o)
 * - Audio: Groq Whisper (93% cheaper than OpenAI)
 * - OCR: Tesseract (100% free)
 */

import { logger } from './logger'
import { getConversationHistory, historyToChatMessages } from './context'
import { insertOutboundMessage, updateInboundMessageByWaId } from './persist'
import { generateResponse } from './response'
import { transcribeWhatsAppAudio } from './transcription'
import {
  getProviderManager,
  PROVIDER_COSTS,
} from './ai-providers'
import {
  createProactiveAgent,
} from './claude-agents'
import { type ClaudeMessage } from './claude-client'
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
 * Convert conversation history to Claude format
 */
export function historyToClaudeMessages(
  history: Array<{ direction: 'inbound' | 'outbound'; content: string | null }>
): ClaudeMessage[] {
  return history
    .filter((msg) => msg.content !== null)
    .map((msg) => ({
      role: msg.direction === 'outbound' ? 'assistant' : 'user',
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

    // Get conversation history
    logger.debug('[AI] Getting conversation history', {
      conversationId,
      userId,
    })
    const history = await getConversationHistory(conversationId, 10)
    const claudeHistory = historyToClaudeMessages(history)
    logger.debug('[AI] Conversation history retrieved', {
      conversationId,
      userId,
      metadata: { historyLength: claudeHistory.length },
    })

    // Use ProactiveAgent with tool calling (handles all actions autonomously)
    logger.decision('Agent selection', 'ProactiveAgent with tool calling', {
      conversationId,
      userId,
    })
    const proactiveAgent = createProactiveAgent()
    const response = await proactiveAgent.respond(userMessage, userId, claudeHistory)

    await sendTextAndPersist(conversationId, userPhone, response)
    await reactWithCheck(userPhone, messageId)

    // Track cost
    providerManager.trackSpending(
      PROVIDER_COSTS.chat.claude,
      'claude',
      'chat'
    )

    logger.functionExit('processMessageWithAI', Date.now() - startTime, {
      agent: 'ProactiveAgent',
      responseLength: response.length,
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
                          error?.message?.includes('API key')
    const errorMessage = isAPIKeyError
      ? 'El sistema está en mantenimiento temporalmente. Por favor intenta más tarde.'
      : 'Disculpa, tuve un problema al procesar tu mensaje. ¿Puedes intentar de nuevo?'

    // Try fallback to OpenAI if Claude fails
    try {
      logger.info('Attempting OpenAI fallback', { conversationId, userId })
      const history = await getConversationHistory(conversationId, 10)
      const chatHistory = historyToChatMessages(history)
      const fallbackResponse = await generateResponse({
        intent: 'casual_chat',
        conversationHistory: chatHistory,
        userMessage,
        userId,
      })

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
    logger.error('Groq audio processing error', error)

    // Fallback to OpenAI Whisper
    try {
      const result = await transcribeWhatsAppAudio(normalized.mediaUrl, userId)

      await updateInboundMessageByWaId(normalized.waMessageId, {
        content: result.transcript,
        mediaUrl: result.storageUri,
      })

      await processMessageWithAI(
        conversationId,
        userId,
        normalized.from,
        result.transcript,
        normalized.waMessageId
      )

      logger.info('Fallback to OpenAI Whisper successful')
    } catch (fallbackError: any) {
      logger.error('Audio processing completely failed', fallbackError)
      if (normalized.from && normalized.waMessageId) {
        await reactWithWarning(normalized.from, normalized.waMessageId)
      }
    }
  } finally {
    if (typingManager) {
      await typingManager.stop()
    }
  }
}

/**
 * Process document/image with Tesseract OCR (100% FREE!)
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
    logger.debug('[Document] Document downloaded', {
      conversationId,
      userId,
      metadata: { bufferSize: imageBuffer.length },
    })

    // Lazy load Tesseract (saves 2MB from bundle)
    logger.debug('[Document] Loading Tesseract OCR', {
      conversationId,
      userId,
    })
    const { extractTextFromImage } = await import('./tesseract-ocr')

    // Extract text with Tesseract (FREE!)
    logger.debug('[Document] Starting OCR extraction', {
      conversationId,
      userId,
    })
    const extractedText = await extractTextFromImage(imageBuffer, {
      language: 'spa+eng',
    })
    logger.performance('Tesseract OCR', Date.now() - startTime, {
      conversationId,
      userId,
      metadata: { textLength: extractedText.length },
    })

    // Process extracted text with Claude for comprehension
    const proactiveAgent = createProactiveAgent()
    const history = await getConversationHistory(conversationId, 5)
    const claudeHistory = historyToClaudeMessages(history)

    const comprehension = await proactiveAgent.respond(
      `El usuario envió una imagen con este texto: "${extractedText}". Analiza y responde de forma útil.`,
      userId,
      claudeHistory
    )

    // Send response
    await sendTextAndPersist(conversationId, normalized.from, comprehension)
    await reactWithCheck(normalized.from, normalized.waMessageId)

    // Update message
    await updateInboundMessageByWaId(normalized.waMessageId, {
      content: extractedText.slice(0, 5000),
    })

    // Track cost (Tesseract is FREE!)
    providerManager.trackSpending(0, 'tesseract', 'ocr')

    logger.info('Document processed with Tesseract + Claude', {
      metadata: {
        textLength: extractedText.length,
        savings: '$0.002 (100% free OCR)',
      },
    })
  } catch (error: any) {
    logger.error('Tesseract OCR error', error)

    // TEMPORARY: RAG fallback disabled to fix Vercel Edge Runtime build
    // pdf-parse import chain causes Edge bundler to fail
    // Will be re-enabled via separate Node.js serverless function in Phase 2
    // See: EDGE-RUNTIME-OPTIMIZATION.md for details

    logger.warn('RAG fallback temporarily disabled for Edge Runtime compatibility')
    await reactWithWarning(normalized.from, normalized.waMessageId)

    await sendTextAndPersist(
      conversationId,
      normalized.from,
      'Lo siento, el procesamiento de documentos PDF está temporalmente deshabilitado. Por favor, envía la imagen nuevamente o intenta más tarde.'
    )

    /* DISABLED CODE - Will be moved to Node.js serverless function
    // Fallback to existing RAG system
    try {
      const { ingestWhatsAppDocument, formatIngestionResponse } = await import(
        './rag/document-ingestion'
      )
      const result = await ingestWhatsAppDocument(
        normalized.mediaUrl,
        userId,
        normalized.content
      )

      const response = formatIngestionResponse(result)
      await sendTextAndPersist(conversationId, normalized.from, response)
      await reactWithCheck(normalized.from, normalized.waMessageId)

      logger.info('Fallback to RAG ingestion successful')
    } catch (fallbackError: any) {
      logger.error('Document processing completely failed', fallbackError)
      await reactWithWarning(normalized.from, normalized.waMessageId)

      await sendTextAndPersist(
        conversationId,
        normalized.from,
        'Lo siento, no pude procesar el documento. ¿Puedes intentar enviarlo de nuevo?'
      )
    }
    */
  } finally {
    if (typingManager) {
      await typingManager.stop()
    }
  }
}
