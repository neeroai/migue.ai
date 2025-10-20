/**
 * OpenAI Client - Primary AI Provider (Production-Ready)
 *
 * Primary AI provider: OpenAI GPT-4o-mini ($0.15/$0.60 per 1M tokens)
 * Fallback: Claude Sonnet 4.5 ($3/$15 per 1M tokens)
 * Audio transcription: OpenAI Whisper ($0.36/hour)
 * OCR: Tesseract (free)
 *
 * Features:
 * - Singleton client pattern (optimized performance)
 * - Response validation & usage tracking
 * - Automatic cost calculation & monitoring
 * - Typed error handling
 * - Production-ready streaming
 * - Anti-repetition parameters
 *
 * Based on best practices from /docs-global/ai/openai
 */

import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { APIError, APIConnectionError } from 'openai/error'
import {
  validateChatResponse,
  logResponse,
  hasResponseError,
  type ValidatedChatResponse,
} from './openai-response-handler'
import { trackUsage } from './openai-cost-tracker'

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
 * Primary audio transcription provider at $0.36/hour
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
    model: options?.model ?? 'whisper-1',
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

/**
 * Generate system prompt with current time context
 * CRITICAL: Time context enables GPT to calculate "en 5 minutos", "mañana", etc.
 */
function generateSystemPrompt(): string {
  const now = new Date()
  const nowISO = now.toISOString()
  const nowBogota = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now)

  return `# CURRENT TIME CONTEXT (CRITICAL for tool calling)
Current time (UTC): ${nowISO}
Current time (Bogotá, Colombia): ${nowBogota} (America/Bogota, UTC-5)

When user says:
- "en X minutos" → Add X minutes to current time
- "en X horas" → Add X hours to current time
- "mañana a las Xam/pm" → Tomorrow at specified time
- "el [día] a las X" → Specified day at specified time

ALWAYS use Colombia timezone (America/Bogota, UTC-5) for datetimeIso.
Format: YYYY-MM-DDTHH:MM:SS-05:00

# ROLE AND OBJECTIVE
Eres Migue, un asistente personal conversacional en WhatsApp. Tu objetivo es mantener conversaciones naturales, cálidas y útiles en español colombiano, usando herramientas solo cuando el usuario lo necesite claramente.

# RESPONSE RULES (Critical)
1. **Read conversation history FIRST** - Adapta tu respuesta al contexto completo
2. **Never repeat responses** - Si ya saludaste, NO saludes de nuevo
3. **Be conversational** - Responde como un amigo cercano, NO como un bot
4. **Be concise** - 1-2 frases máximo (ideal para WhatsApp)
5. **Use tools automatically** - Cuando sea obvio (crear recordatorio, agendar, etc.)

# INSTRUCTIONS - Conversation Flow

## Initial Contact
- First greeting: "¡Hola! ¿Cómo estás?" (warm, simple)
- Follow-up: "¿Qué tal?" or "¿En qué te ayudo?" (NO templates genéricos)
- NEVER say: "¡Hola de nuevo! Estoy aquí para ayudarte" (too robotic)

## Ongoing Conversation
1. Check conversation history for context
2. Identify user intent from current message + history
3. If casual chat → respond naturally and briefly
4. If action needed → use appropriate tool + confirm
5. Continue until user's need is resolved

## Anti-Repetition Protocol
- IF already greeted → don't greet again
- IF similar question → acknowledge and build on previous answer
- IF conversation stale → ask engaging follow-up question

# AVAILABLE TOOLS (MANDATORY - use immediately when triggers detected)

## create_reminder ⚠️ MANDATORY WHEN TRIGGERS DETECTED
**Triggers**: "recuérdame", "recordarme", "no olvides", "avísame", "tengo que", "debo", "me recuerdas"
**Action**: YOU MUST call create_reminder tool immediately. DO NOT ask for confirmation. DO NOT say you can't do it.
**CRITICAL**: If user says ANY trigger word, you MUST use this tool. No exceptions.
**Example**: User: "recuérdame comprar pan mañana 8am" → [create_reminder] → "✅ Listo! Te recordaré mañana a las 8am"
**WRONG**: "Lo siento, no puedo establecer recordatorios" ❌ NEVER SAY THIS

## schedule_meeting ⚠️ MANDATORY WHEN TRIGGERS DETECTED
**Triggers**: "agenda", "agendar", "reserva", "reservar", "programa", "programar", "reunión", "cita"
**Action**: YOU MUST call schedule_meeting tool immediately. DO NOT ask for confirmation.
**CRITICAL**: If user says ANY trigger word, you MUST use this tool. No exceptions.
**Example**: User: "agenda reunión con Juan viernes 3pm" → [schedule_meeting] → "✅ Perfecto! Agendé reunión con Juan el viernes a las 3pm"
**WRONG**: "Lo siento, no puedo agendar" ❌ NEVER SAY THIS

## track_expense ⚠️ MANDATORY WHEN TRIGGERS DETECTED
**Triggers**: "gasté", "pagué", "compré", "costó", "salió", "me gasté"
**Action**: YOU MUST call track_expense tool immediately. DO NOT ask for confirmation.
**CRITICAL**: If user says ANY trigger word, you MUST use this tool. No exceptions.
**Example**: User: "gasté 50mil en mercado" → [track_expense] → "💰 Listo! Registré $50,000 en Mercado"
**WRONG**: "Lo siento, no puedo registrar gastos" ❌ NEVER SAY THIS

# OUTPUT FORMAT
- Language: Spanish (Colombia)
- Tone: Warm, friendly, professional
- Length: 1-2 sentences (max 280 characters)
- Emojis: Occasional (✅ for confirmations, 💰 for money, ❌ for errors)
- Structure: Direct answer → optional context/help offer

# EXAMPLES - Natural Conversations

Example 1: Basic Greeting
User: "hola"
You: "¡Hola! ¿Cómo estás?"

Example 2: Greeting Follow-up (context-aware)
[Previous: User said "hola", You said "¡Hola! ¿Cómo estás?"]
User: "como estas?"
You: "¡Muy bien, gracias! ¿Y tú? ¿En qué te puedo ayudar hoy?"
(Note: NO repeat greeting - build on conversation)

Example 3: Tool Use - Reminder
User: "recuérdame llamar a mamá mañana 10am"
[You use create_reminder with title="llamar a mamá", datetimeIso="2025-01-11T10:00:00-05:00"]
You: "✅ Listo! Te recordaré mañana a las 10am"

Example 4: Tool Use - Meeting
User: "agenda reunión con el equipo viernes 2pm"
[You use schedule_meeting]
You: "✅ Perfecto! Agendé la reunión con el equipo el viernes a las 2pm"

Example 5: Casual Chat
User: "que recomiendas para organizar mis tareas?"
You: "Te recomiendo crear recordatorios para lo importante y revisarlos cada mañana. ¿Quieres que te ayude a crear uno?"

# CONTEXT AWARENESS
- You have access to conversation history in the messages array
- Use it to avoid repetition and maintain context
- Reference previous messages when relevant
- Build on the conversation naturally

# CRITICAL REMINDERS
❌ NEVER say: "no puedo crear recordatorios", "no puedo establecer", "no tengo acceso a"
❌ NEVER say: "¡Estoy aquí para ayudarte!" or generic phrases
❌ NEVER repeat the same greeting twice in a conversation
❌ NEVER refuse to use a tool when trigger words are detected
❌ NEVER use generic template responses
✅ ALWAYS use tools IMMEDIATELY when trigger words detected (recuérdame, agenda, gasté, etc.)
✅ ALWAYS read conversation history before responding
✅ ALWAYS respond to the specific message, not a generic intent
✅ ALWAYS confirm actions with "✅ Listo!" after executing tools
✅ YOU HAVE THE ABILITY to create reminders, schedule meetings, and track expenses - USE IT!

You are an agent - continue the conversation naturally until the user's need is completely resolved.`
}

// Note: generateSystemPrompt() is called dynamically per request to inject current time

/**
 * Detect if message contains reminder keywords
 * Handles Spanish accents by normalizing text
 */
function hasReminderKeywords(message: string): boolean {
  // Normalize to remove accents: recuérdame → recuerdame
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const keywords = /recuerd|record|no olvid|avis|tengo que|debo|me recuerdas|recordar|puedes recordar/i

  // Test both original and normalized to catch all variations
  return keywords.test(message) || keywords.test(normalized)
}

/**
 * Detect if message contains meeting keywords
 * Handles Spanish accents by normalizing text
 */
function hasMeetingKeywords(message: string): boolean {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const keywords = /agenda|agendar|reserva|reservar|programa|programar|reun|cita/i

  return keywords.test(message) || keywords.test(normalized)
}

/**
 * Detect if message contains expense keywords
 * Handles Spanish accents by normalizing text
 */
function hasExpenseKeywords(message: string): boolean {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const keywords = /gast|pagu|pagué|compr|cost|costó|sali|salió/i

  return keywords.test(message) || keywords.test(normalized)
}

/**
 * ProactiveAgent con GPT-4o-mini (PRIMARY)
 * Production-ready with response validation and cost tracking
 */
export class ProactiveAgent {
  async respond(
    userMessage: string,
    userId: string,
    conversationHistory: OpenAIMessage[],
    context?: { conversationId?: string; messageId?: string }
  ): Promise<string> {
    const client = getOpenAIClient()

    // Generate system prompt with current time context (CRITICAL for "en 5 minutos")
    const systemPrompt = generateSystemPrompt()

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ]

    // Detect keywords to force appropriate tool calling
    const hasReminder = hasReminderKeywords(userMessage)
    const hasMeeting = hasMeetingKeywords(userMessage)
    const hasExpense = hasExpenseKeywords(userMessage)

    // Determine tool_choice based on keywords
    let toolChoice: 'auto' | { type: 'function'; function: { name: string } } = 'auto'

    if (hasReminder) {
      toolChoice = { type: 'function', function: { name: 'create_reminder' } }
      logger.decision('[ProactiveAgent] Forcing create_reminder tool', 'Reminder keywords detected', {
        metadata: { userMessage: userMessage.slice(0, 100) }
      })
    } else if (hasMeeting) {
      toolChoice = { type: 'function', function: { name: 'schedule_meeting' } }
      logger.decision('[ProactiveAgent] Forcing schedule_meeting tool', 'Meeting keywords detected', {
        metadata: { userMessage: userMessage.slice(0, 100) }
      })
    } else if (hasExpense) {
      toolChoice = { type: 'function', function: { name: 'track_expense' } }
      logger.decision('[ProactiveAgent] Forcing track_expense tool', 'Expense keywords detected', {
        metadata: { userMessage: userMessage.slice(0, 100) }
      })
    }

    // Tool calling loop (max 5 iterations)
    for (let i = 0; i < 5; i++) {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: getOpenAITools(),
        tool_choice: toolChoice,
        temperature: 0.8,          // Increased for more variety (was 0.7)
        max_tokens: 1024,
        frequency_penalty: 0.3,    // Discourage token repetition
        presence_penalty: 0.2,     // Encourage topic diversity
      })

      // ✅ NEW: Validate response structure
      const validated = validateChatResponse(response)

      // ✅ NEW: Track usage and cost
      if (validated.metadata.usage && validated.metadata.cost) {
        // Build context object with only defined properties (exactOptionalPropertyTypes)
        const trackingContext: {
          userId: string
          conversationId?: string
          messageId?: string
        } = { userId }
        if (context?.conversationId) trackingContext.conversationId = context.conversationId
        if (context?.messageId) trackingContext.messageId = context.messageId

        trackUsage(
          validated.metadata.model,
          validated.metadata.usage,
          validated.metadata.cost,
          trackingContext
        )
      }

      // ✅ NEW: Log response with full metadata
      const loggingContext: {
        userId: string
        conversationId?: string
        messageId?: string
      } = { userId }
      if (context?.conversationId) loggingContext.conversationId = context.conversationId
      if (context?.messageId) loggingContext.messageId = context.messageId

      logResponse(validated, loggingContext)

      // ✅ NEW: Check for response errors
      const errorCheck = hasResponseError(validated)
      if (errorCheck.hasError) {
        logger.warn('[ProactiveAgent] Response error detected', {
          metadata: {
            errorType: errorCheck.errorType,
            errorMessage: errorCheck.errorMessage,
            finishReason: validated.metadata.finishReason,
          },
        })
      }

      const toolCalls = validated.toolCalls

      // No tool calls → return text
      if (!toolCalls) {
        // Log refusal if keywords were detected but tool wasn't called
        if (hasReminder || hasMeeting || hasExpense) {
          logger.warn('[ProactiveAgent] Tool refused despite keywords', {
            metadata: {
              userMessage: userMessage.slice(0, 100),
              hasReminder,
              hasMeeting,
              hasExpense,
              response: validated.content?.slice(0, 150)
            }
          })
        }
        return validated.content || 'Lo siento, no entendí'
      }

      // Execute tools
      messages.push(validated.raw.choices[0]!.message)
      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue

        logger.info('[ProactiveAgent] Executing tool', {
          metadata: {
            toolName: toolCall.function.name,
            args: toolCall.function.arguments.slice(0, 200),
            forced: toolChoice !== 'auto'
          }
        })

        const args = JSON.parse(toolCall.function.arguments)
        args.userId = userId // Inject userId
        const result = await executeTool(toolCall.function.name, args)

        logger.info('[ProactiveAgent] Tool executed successfully', {
          metadata: {
            toolName: toolCall.function.name,
            result: result.slice(0, 100)
          }
        })

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        })
      }

      // After first iteration, switch to 'auto' to allow natural continuation
      toolChoice = 'auto'
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
