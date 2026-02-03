/**
 * @file proactive-agent.ts
 * @description Proactive AI agent using Vercel AI SDK 6.0
 * @module lib/ai
 * @exports respond, createProactiveAgent
 * @date 2026-02-01 15:20
 * @updated 2026-02-01 15:20
 */

import { generateText, tool } from 'ai'
import type { ModelMessage } from 'ai'
import { z } from 'zod'
import { models } from './providers'
import { logger } from '../logger'
import { createReminder } from '../reminders'
import { scheduleMeetingFromIntent } from '../scheduling'
import {
  selectModel,
  getFallbackSelection,
  analyzeComplexity,
  estimateTokens,
  type ModelSelection,
} from './model-router'
import { getModel } from './gateway'
import { executeWithFallback, canAffordFallback, type FallbackResult } from './fallback'
import { getBudgetStatus } from '../ai-cost-tracker'

const BOGOTA_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const SYSTEM_PROMPT_BASE = `# ROLE AND OBJECTIVE
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

## create_reminder MANDATORY WHEN TRIGGERS DETECTED
**Triggers**: "recuérdame", "recordarme", "no olvides", "avísame", "tengo que", "debo", "me recuerdas"
**Action**: YOU MUST call create_reminder tool immediately. DO NOT ask for confirmation. DO NOT say you can't do it.
**CRITICAL**: If user says ANY trigger word, you MUST use this tool. No exceptions.
**Example**: User: "recuérdame comprar pan mañana 8am" → [create_reminder] → "Listo! Te recordaré mañana a las 8am"
**WRONG**: "Lo siento, no puedo establecer recordatorios" NEVER SAY THIS

## schedule_meeting MANDATORY WHEN TRIGGERS DETECTED
**Triggers**: "agenda", "agendar", "reserva", "reservar", "programa", "programar", "reunión", "cita"
**Action**: YOU MUST call schedule_meeting tool immediately. DO NOT ask for confirmation.
**CRITICAL**: If user says ANY trigger word, you MUST use this tool. No exceptions.
**Example**: User: "agenda reunión con Juan viernes 3pm" → [schedule_meeting] → "Perfecto! Agendé reunión con Juan el viernes a las 3pm"
**WRONG**: "Lo siento, no puedo agendar" NEVER SAY THIS

## track_expense MANDATORY WHEN TRIGGERS DETECTED
**Triggers**: "gasté", "pagué", "compré", "costó", "salió", "me gasté"
**Action**: YOU MUST call track_expense tool immediately. DO NOT ask for confirmation.
**CRITICAL**: If user says ANY trigger word, you MUST use this tool. No exceptions.
**Example**: User: "gasté 50mil en mercado" → [track_expense] → "Listo! Registré $50,000 en Mercado"
**WRONG**: "Lo siento, no puedo registrar gastos" NEVER SAY THIS

# OUTPUT FORMAT
- Language: Spanish (Colombia)
- Tone: Warm, friendly, professional
- Length: 1-2 sentences (max 280 characters)
- Emojis: Occasional (for confirmations, money, errors)
- Structure: Direct answer → optional context/help offer

# CONTEXT AWARENESS
- You have access to conversation history in the messages array
- Use it to avoid repetition and maintain context
- Reference previous messages when relevant
- Build on the conversation naturally

# CRITICAL REMINDERS
NEVER say: "no puedo crear recordatorios", "no puedo establecer", "no tengo acceso a"
NEVER say: "¡Estoy aquí para ayudarte!" or generic phrases
NEVER repeat the same greeting twice in a conversation
NEVER refuse to use a tool when trigger words are detected
NEVER use generic template responses
ALWAYS use tools IMMEDIATELY when trigger words detected (recuérdame, agenda, gasté, etc.)
ALWAYS read conversation history before responding
ALWAYS respond to the specific message, not a generic intent
ALWAYS confirm actions with "Listo!" after executing tools
YOU HAVE THE ABILITY to create reminders, schedule meetings, and track expenses - USE IT!

You are an agent - continue the conversation naturally until the user's need is completely resolved.`

/**
 * Generate system prompt with current time context
 * CRITICAL: Time context enables GPT to calculate "en 5 minutos", "mañana", etc.
 */
function generateSystemPrompt(): string {
  const now = new Date()
  const nowISO = now.toISOString()
  const nowBogota = BOGOTA_FORMATTER.format(now)

  const timeContext = `# CURRENT TIME CONTEXT (CRITICAL for tool calling)
Current time (UTC): ${nowISO}
Current time (Bogotá, Colombia): ${nowBogota} (America/Bogota, UTC-5)

When user says:
- "en X minutos" → Add X minutes to current time
- "en X horas" → Add X hours to current time
- "mañana a las Xam/pm" → Tomorrow at specified time
- "el [día] a las X" → Specified day at specified time

ALWAYS use Colombia timezone (America/Bogota, UTC-5) for datetimeIso.
Format: YYYY-MM-DDTHH:MM:SS-05:00`

  return `${timeContext}\n\n${SYSTEM_PROMPT_BASE}`
}

/**
 * Detect if message contains reminder keywords
 */
function hasReminderKeywords(message: string): boolean {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const keywords = /recuerd|record|no olvid|avis|tengo que|debo|me recuerdas|recordar|puedes recordar/i
  return keywords.test(message) || keywords.test(normalized)
}

/**
 * Detect if message contains meeting keywords
 */
function hasMeetingKeywords(message: string): boolean {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const keywords = /agenda|agendar|reserva|reservar|programa|programar|reun|cita/i
  return keywords.test(message) || keywords.test(normalized)
}

/**
 * Detect if message contains expense keywords
 */
function hasExpenseKeywords(message: string): boolean {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const keywords = /gast|pagu|pagué|compr|cost|costó|sali|salió/i
  return keywords.test(message) || keywords.test(normalized)
}

/**
 * ProactiveAgent using Vercel AI SDK 6.0 generateText()
 */
export async function respond(
  userMessage: string,
  userId: string,
  history: ModelMessage[],
  context?: { conversationId?: string; messageId?: string }
): Promise<{
  text: string
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
  cost: { input: number; output: number; total: number }
  finishReason: string
  toolCalls: number
}> {
  const systemPrompt = generateSystemPrompt()

  const maxHistory = userMessage.length > 600 ? 6 : userMessage.length > 200 ? 8 : 12
  const trimmedHistory = history.slice(-maxHistory)

  const messages: ModelMessage[] = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory,
    { role: 'user', content: userMessage },
  ]

  // Detect keywords to determine tool forcing strategy
  const hasReminder = hasReminderKeywords(userMessage)
  const hasMeeting = hasMeetingKeywords(userMessage)
  const hasExpense = hasExpenseKeywords(userMessage)

  // Log keyword detection
  if (hasReminder || hasMeeting || hasExpense) {
    logger.decision(
      '[ProactiveAgent] Keywords detected',
      `Reminder: ${hasReminder}, Meeting: ${hasMeeting}, Expense: ${hasExpense}`,
      {
        metadata: { userMessage: userMessage.slice(0, 100) },
      }
    )
  }

  // Intelligent model selection
  const hasTools = hasReminder || hasMeeting || hasExpense
  const complexity = analyzeComplexity(userMessage, trimmedHistory.length, hasTools)
  const estimatedTokenCount = estimateTokens(userMessage, trimmedHistory.length)
  const budgetStatus = getBudgetStatus()

  const primarySelection = selectModel({
    estimatedTokens: estimatedTokenCount,
    complexity,
    budgetRemaining: budgetStatus.dailyRemaining,
    hasTools,
  })

  logger.info('[ProactiveAgent] Model selected', {
    metadata: {
      provider: primarySelection.provider,
      model: primarySelection.modelName,
      reason: primarySelection.reason,
      complexity,
      estimatedTokens: estimatedTokenCount,
      budgetRemaining: budgetStatus.dailyRemaining,
    },
  })

  // Get fallback selection
  const fallbackSelection = getFallbackSelection(primarySelection, {
    estimatedTokens: estimatedTokenCount,
    complexity,
    budgetRemaining: budgetStatus.dailyRemaining,
    hasTools,
  })

  // Budget check for fallback
  const budgetCheck = canAffordFallback(
    budgetStatus.dailyRemaining,
    fallbackSelection.estimatedCost
  )

  // Get model instance
  const primaryModel = getModel(primarySelection)
  const fallbackModel = getModel(fallbackSelection)

  // AI SDK 6.0: Tool definitions with new structure
  const toolsDefinition = {
      create_reminder: {
        description: 'Crea recordatorio cuando usuario dice: recuérdame, no olvides, tengo que, avísame',
        inputSchema: z.object({
          userId: z.string().describe('ID del usuario'),
          title: z.string().describe('Qué recordar'),
          description: z.string().optional().describe('Detalles'),
          datetimeIso: z.string().describe('ISO format: YYYY-MM-DDTHH:MM:SS-05:00'),
        }),
        execute: async ({ userId: _userId, title, description, datetimeIso }: {
          userId: string
          title: string
          description?: string
          datetimeIso: string
        }) => {
          await createReminder(userId, title, description || null, datetimeIso)
          return `Recordatorio creado: "${title}"`
        },
      },
      schedule_meeting: {
        description: 'Agenda reunión cuando usuario dice: agenda, reserva cita, programa',
        inputSchema: z.object({
          userId: z.string(),
          title: z.string(),
          startTime: z.string().describe('ISO format'),
          endTime: z.string().describe('ISO format'),
          description: z.string().optional(),
        }),
        execute: async ({ userId: _userId, title, startTime, endTime, description }: {
          userId: string
          title: string
          startTime: string
          endTime: string
          description?: string
        }) => {
          const result = await scheduleMeetingFromIntent({
            userId,
            userMessage: `${title}${description ? ': ' + description : ''}`,
            conversationHistory: [],
          })
          return result.reply
        },
      },
      track_expense: {
        description: 'Registra gasto cuando usuario dice: gasté, pagué, compré, costó',
        inputSchema: z.object({
          userId: z.string(),
          amount: z.number(),
          currency: z.string(),
          category: z.string(),
          description: z.string(),
        }),
        execute: async ({ userId: _userId, amount, currency, category, description }: {
          userId: string
          amount: number
          currency: string
          category: string
          description: string
        }) => {
          logger.info('[trackExpense] Registered', {
            metadata: { amount, currency, category, description },
          })
          return `Gasto registrado: ${currency} ${amount} en ${category}`
        },
      },
  } as const

  // Execute with fallback chain
  const result = await executeWithFallback<{
    text: string
    usage: { inputTokens: number; outputTokens: number; totalTokens: number }
    finishReason: string
    steps: any[]
  }>(
    // Primary provider
    async () => {
      const response = await generateText({
        model: primaryModel,
        messages,
        tools: toolsDefinition as any,
        temperature: 0.8,
        frequencyPenalty: 0.3,
        presencePenalty: 0.2,
      })
      return {
        text: response.text,
        usage: {
          inputTokens: response.usage.inputTokens ?? 0,
          outputTokens: response.usage.outputTokens ?? 0,
          totalTokens: response.usage.totalTokens ?? 0,
        },
        finishReason: response.finishReason,
        steps: response.steps,
      }
    },
    // Fallback provider
    async () => {
      const response = await generateText({
        model: fallbackModel,
        messages,
        tools: toolsDefinition as any,
        temperature: 0.8,
        frequencyPenalty: 0.3,
        presencePenalty: 0.2,
      })
      return {
        text: response.text,
        usage: {
          inputTokens: response.usage.inputTokens ?? 0,
          outputTokens: response.usage.outputTokens ?? 0,
          totalTokens: response.usage.totalTokens ?? 0,
        },
        finishReason: response.finishReason,
        steps: response.steps,
      }
    },
    {
      primarySelection,
      fallbackSelection,
      userId,
      conversationId: context?.conversationId || 'unknown',
    },
    budgetCheck
  )

  const { text, usage, finishReason, steps } = result.result
  const usedProvider = result.provider

  // Calculate cost based on actual provider used
  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const totalTokens = usage.totalTokens ?? (inputTokens + outputTokens)

  const providerConfig = models[usedProvider]
  const inputCost = (inputTokens / 1_000_000) * providerConfig.costPer1MTokens.input
  const outputCost = (outputTokens / 1_000_000) * providerConfig.costPer1MTokens.output
  const totalCost = inputCost + outputCost

  // Count tool calls
  const toolCallCount = steps.filter((s) => s.toolCalls && s.toolCalls.length > 0).length

  logger.info('[ProactiveAgent] Response generated', {
    metadata: {
      ...context,
      provider: usedProvider,
      fallbackUsed: result.fallbackUsed,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
      },
      cost: { input: inputCost, output: outputCost, total: totalCost },
      finishReason,
      toolCalls: toolCallCount,
      textLength: text.length,
    },
  })

  // Track usage for budget monitoring
  const { trackUsage } = await import('../ai-cost-tracker')
  const modelName = usedProvider === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4'
  trackUsage(
    usedProvider,
    modelName,
    {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens,
    },
    {
      inputCost,
      outputCost,
      totalCost,
      model: modelName,
    },
    {
      ...(context?.conversationId && { conversationId: context.conversationId }),
      userId,
      ...(context?.messageId && { messageId: context.messageId }),
    }
  )

  return {
    text,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens,
    },
    cost: { input: inputCost, output: outputCost, total: totalCost },
    finishReason,
    toolCalls: toolCallCount,
  }
}

/**
 * Factory function for backwards compatibility
 */
export function createProactiveAgent() {
  return { respond }
}
