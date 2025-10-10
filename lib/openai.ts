/**
 * OpenAI Client - FALLBACK ONLY
 *
 * ⚠️ IMPORTANT: This module is maintained for fallback purposes only.
 * Primary AI provider: Claude Sonnet 4.5 (see ai-providers.ts)
 * Primary transcription: Groq Whisper (see groq-client.ts)
 * Primary OCR: Tesseract (see tesseract-ocr.ts)
 *
 * Cost comparison (per 1M tokens):
 * - Claude Sonnet 4.5: $3 input / $15 output (75% cheaper than GPT-4o)
 * - GPT-4o: $15 input / $60 output (FALLBACK ONLY)
 *
 * Only use OpenAI when:
 * - Claude SDK is unavailable
 * - Groq transcription fails
 * - Backwards compatibility required
 *
 * @deprecated Prefer Claude SDK for chat, Groq for audio, Tesseract for OCR
 */

import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

let cachedClient: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    cachedClient = new OpenAI({
      apiKey,
      timeout: 30000, // 30s timeout
      maxRetries: 2,
    })
  }
  return cachedClient
}

/**
 * Chat message type (compatible with OpenAI SDK v5)
 * Uses OpenAI's native type for better compatibility
 */
export type ChatMessage = ChatCompletionMessageParam

/**
 * Call GPT-4o with a list of messages and get a response.
 * Edge-compatible: uses fetch under the hood via OpenAI SDK.
 *
 * @deprecated Use Claude SDK via ai-providers.ts (75% cheaper)
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
): Promise<string> {
  const client = getOpenAIClient()
  const response = await client.chat.completions.create({
    model: options?.model ?? 'gpt-4o',
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 500,
  })

  // Validate array access with noUncheckedIndexedAccess
  const choice = response.choices[0]
  if (!choice?.message?.content) {
    throw new Error('OpenAI returned empty response')
  }
  return choice.message.content
}

/**
 * @deprecated Not used in production - kept for backwards compatibility only
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
): Promise<string> {
  const client = getOpenAIClient()
  const stream = await client.chat.completions.create({
    model: options?.model ?? 'gpt-4o',
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 500,
    stream: true,
  })

  let fullText = ''
  for await (const chunk of stream) {
    // Use optional chaining for array access
    const choice = chunk.choices?.[0]
    if (choice?.delta?.content) {
      const delta = choice.delta.content
      // OpenAI SDK v5 returns string for delta.content
      if (typeof delta === 'string') {
        fullText += delta
      }
    }
  }

  if (!fullText.trim()) {
    throw new Error('OpenAI streaming returned empty response')
  }

  return fullText
}

export type TranscriptionOptions = {
  model?: string
  language?: string
  mimeType?: string
  fileName?: string
}

type UploadableInput = ArrayBuffer | Uint8Array | Blob

/**
 * Convert input to File for OpenAI SDK
 * Edge Runtime always has File available
 */
async function toUploadable(
  input: UploadableInput,
  fileName: string,
  mimeType: string
): Promise<File> {
  // Convert all inputs to File (always available in Edge Runtime)
  if (input instanceof Blob) {
    return new File([input], fileName, { type: mimeType })
  }
  if (input instanceof ArrayBuffer) {
    return new File([input as BlobPart], fileName, { type: mimeType })
  }
  if (input instanceof Uint8Array) {
    return new File([input as BlobPart], fileName, { type: mimeType })
  }
  throw new Error('Unsupported audio payload for transcription')
}

/**
 * Transcribe audio using OpenAI Whisper
 *
 * @deprecated Use Groq Whisper via groq-client.ts (93% cheaper: $0.05/hr vs $0.36/hr)
 */
export async function transcribeAudio(
  data: UploadableInput,
  options?: TranscriptionOptions
): Promise<string> {
  const client = getOpenAIClient()
  const mimeType = options?.mimeType ?? 'audio/ogg'

  // Safe array access for mime type extension
  const parts = mimeType.split('/')
  const extension = parts[1] ?? 'ogg'
  const fileName = options?.fileName ?? `audio.${extension}`

  const uploadable = await toUploadable(data, fileName, mimeType)
  const response = await client.audio.transcriptions.create({
    file: uploadable,
    model: options?.model ?? 'gpt-4o-mini-transcribe',
    language: options?.language ?? 'es',
    response_format: 'text',
  })

  // OpenAI SDK v5 returns string directly when response_format is 'text'
  if (typeof response === 'string') {
    const text = response.trim()
    if (!text) {
      throw new Error('Whisper transcription returned empty result')
    }
    return text
  }

  throw new Error('Unexpected transcription response format')
}

// ============================================
// GPT-4o-mini Agent (PRIMARY - 2025-10-10)
// ============================================

import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { logger } from './logger'
import { createReminder } from './reminders'
import { scheduleMeetingFromIntent } from './scheduling'

export type OpenAIMessage = ChatCompletionMessageParam

/**
 * Convert Claude tools to OpenAI function format
 */
function getOpenAITools(): ChatCompletionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'create_reminder',
        description: 'Crea recordatorio cuando usuario dice: recuérdame, no olvides, tengo que, avísame',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'ID del usuario' },
            title: { type: 'string', description: 'Qué recordar' },
            description: { type: 'string', description: 'Detalles' },
            datetimeIso: { type: 'string', description: 'ISO format: YYYY-MM-DDTHH:MM:SS-05:00' }
          },
          required: ['userId', 'title', 'datetimeIso']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'schedule_meeting',
        description: 'Agenda reunión cuando usuario dice: agenda, reserva cita, programa',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            title: { type: 'string' },
            startTime: { type: 'string', description: 'ISO format' },
            endTime: { type: 'string', description: 'ISO format' },
            description: { type: 'string' }
          },
          required: ['userId', 'title', 'startTime', 'endTime']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'track_expense',
        description: 'Registra gasto cuando usuario dice: gasté, pagué, compré, costó',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            category: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['userId', 'amount', 'currency', 'category', 'description']
        }
      }
    }
  ]
}

/**
 * Execute tool (reutiliza lógica de claude-tools.ts)
 */
async function executeTool(name: string, args: any): Promise<string> {
  switch (name) {
    case 'create_reminder':
      await createReminder(args.userId, args.title, args.description || null, args.datetimeIso)
      return `✅ Recordatorio creado: "${args.title}"`

    case 'schedule_meeting':
      const result = await scheduleMeetingFromIntent({
        userId: args.userId,
        userMessage: `${args.title}${args.description ? ': ' + args.description : ''}`,
        conversationHistory: []
      })
      return result.reply

    case 'track_expense':
      logger.info('[trackExpense] Registered', { metadata: args })
      return `💰 Gasto registrado: ${args.currency} ${args.amount} en ${args.category}`

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

const SYSTEM_PROMPT = `Eres Migue, asistente personal en WhatsApp con capacidades reales.

TUS CAPACIDADES:
✅ create_reminder - Guardas recordatorios
✅ schedule_meeting - Agendar reuniones
✅ track_expense - Registrar gastos

USA HERRAMIENTAS INMEDIATAMENTE cuando usuario dice:
- "recuérdame..." → create_reminder
- "agenda reunión..." → schedule_meeting
- "gasté $X..." → track_expense

CONFIRMA DESPUÉS: "✅ Listo! [lo que hiciste]"

NUNCA digas: "no puedo", "no tengo acceso"

Responde en español, cálido y conciso.`

/**
 * ProactiveAgent con GPT-4o-mini (PRIMARY)
 */
export class ProactiveAgent {
  async respond(
    userMessage: string,
    userId: string,
    conversationHistory: OpenAIMessage[]
  ): Promise<string> {
    const client = getOpenAIClient()
    const messages: OpenAIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ]

    // Tool calling loop (max 5 iterations)
    for (let i = 0; i < 5; i++) {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: getOpenAITools(),
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1024
      })

      const choice = response.choices[0]
      if (!choice) throw new Error('No response from GPT-4o-mini')

      const toolCalls = choice.message.tool_calls

      // No tool calls → return text
      if (!toolCalls) {
        return choice.message.content || 'Lo siento, no entendí'
      }

      // Execute tools
      messages.push(choice.message)
      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue
        const args = JSON.parse(toolCall.function.arguments)
        args.userId = userId // Inject userId
        const result = await executeTool(toolCall.function.name, args)
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        })
      }
    }

    throw new Error('Max tool iterations reached')
  }
}

/**
 * Crear instancia del agente
 */
export function createProactiveAgent() {
  return new ProactiveAgent()
}
