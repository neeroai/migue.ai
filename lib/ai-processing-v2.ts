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
  createSchedulingAgent,
  createFinanceAgent,
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
function historyToClaudeMessages(
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
  const typingManager = createTypingManager(userPhone, messageId)
  const providerManager = getProviderManager()

  try {
    // Mark message as read
    await markAsRead(messageId)
    await reactWithThinking(userPhone, messageId)

    // Start typing
    await typingManager.start()

    // Get conversation history
    const history = await getConversationHistory(conversationId, 10)
    const claudeHistory = historyToClaudeMessages(history)

    // Try specialized agents first
    const schedulingAgent = createSchedulingAgent()
    const financeAgent = createFinanceAgent()

    // Check for appointment
    const appointment = await schedulingAgent.extractAppointment(userMessage)
    if (appointment) {
      const response = `✅ Cita agendada: "${appointment.title}"
📅 Fecha: ${appointment.date}
⏰ Hora: ${appointment.time}

Te enviaré recordatorios 1 día antes y 1 hora antes.`

      await sendTextAndPersist(conversationId, userPhone, response)
      await reactWithCheck(userPhone, messageId)

      // Track cost
      providerManager.trackSpending(
        PROVIDER_COSTS.chat.claude,
        'claude',
        'chat'
      )
      return
    }

    // Check for expense
    const expense = await financeAgent.extractExpense(userMessage)
    if (expense) {
      const response = `💰 Gasto registrado:
Monto: ${expense.currency} ${expense.amount}
Categoría: ${expense.category}
Descripción: ${expense.description}

¿Quieres ver un resumen de tus gastos?`

      await sendTextAndPersist(conversationId, userPhone, response)
      await reactWithCheck(userPhone, messageId)

      // Track cost
      providerManager.trackSpending(
        PROVIDER_COSTS.chat.claude,
        'claude',
        'chat'
      )
      return
    }

    // Default: use proactive agent
    const proactiveAgent = createProactiveAgent()
    const response = await proactiveAgent.respond(userMessage, claudeHistory)

    await sendTextAndPersist(conversationId, userPhone, response)
    await reactWithCheck(userPhone, messageId)

    // Track cost
    providerManager.trackSpending(
      PROVIDER_COSTS.chat.claude,
      'claude',
      'chat'
    )
  } catch (error: any) {
    logger.error('AI processing error', error)
    await reactWithWarning(userPhone, messageId)

    // Try fallback to OpenAI if Claude fails
    try {
      const history = await getConversationHistory(conversationId, 10)
      const chatHistory = historyToChatMessages(history)
      const fallbackResponse = await generateResponse({
        intent: 'casual_chat',
        conversationHistory: chatHistory,
        userMessage,
        userId,
      })

      await sendTextAndPersist(conversationId, userPhone, fallbackResponse)
      logger.info('Fallback to OpenAI successful')
    } catch (fallbackError: any) {
      logger.error('Fallback also failed', fallbackError)
      await sendTextAndPersist(
        conversationId,
        userPhone,
        'Disculpa, tuve un problema al procesar tu mensaje. ¿Puedes intentar de nuevo?'
      )
    }
  } finally {
    await typingManager.stop()
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
  if (!normalized.mediaUrl || !normalized.waMessageId || !normalized.from) {
    return
  }

  const providerManager = getProviderManager()
  const typingManager = createTypingManager(
    normalized.from,
    normalized.waMessageId
  )

  try {
    await markAsRead(normalized.waMessageId)
    await reactWithThinking(normalized.from, normalized.waMessageId)
    await typingManager.start()

    // Download audio
    const audioResponse = await fetch(normalized.mediaUrl)
    const audioBuffer = new Uint8Array(await audioResponse.arrayBuffer())

    // Transcribe with Groq (93% cheaper!)
    const audioFile = bufferToFile(audioBuffer, 'audio.ogg', 'audio/ogg')
    const transcript = await transcribeWithGroq(audioFile, {
      model: 'whisper-large-v3',
      language: 'es',
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
      await reactWithWarning(normalized.from, normalized.waMessageId)
    }
  } finally {
    await typingManager.stop()
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
  if (!normalized.mediaUrl || !normalized.waMessageId || !normalized.from) {
    return
  }

  const providerManager = getProviderManager()
  const typingManager = createTypingManager(
    normalized.from,
    normalized.waMessageId
  )

  try {
    await markAsRead(normalized.waMessageId)
    await reactWithThinking(normalized.from, normalized.waMessageId)
    await typingManager.start()

    // Download image/document
    const imageResponse = await fetch(normalized.mediaUrl)
    const imageArrayBuffer = await imageResponse.arrayBuffer()
    const imageBuffer = new Uint8Array(imageArrayBuffer)

    // Lazy load Tesseract (saves 2MB from bundle)
    const { extractTextFromImage } = await import('./tesseract-ocr')

    // Extract text with Tesseract (FREE!)
    const extractedText = await extractTextFromImage(imageBuffer, {
      language: 'spa+eng',
    })

    // Process extracted text with Claude for comprehension
    const proactiveAgent = createProactiveAgent()
    const history = await getConversationHistory(conversationId, 5)
    const claudeHistory = historyToClaudeMessages(history)

    const comprehension = await proactiveAgent.respond(
      `El usuario envió una imagen con este texto: "${extractedText}". Analiza y responde de forma útil.`,
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
    await typingManager.stop()
  }
}
