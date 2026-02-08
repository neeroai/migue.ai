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
import { MODEL_CATALOG, models } from '../domain/providers'
import { logger } from '../../../shared/observability/logger'
import { createReminder } from '../../reminders/application/service'
import { scheduleMeetingFromIntent } from '../../scheduling/application/service'
import {
  selectModel,
  getFallbackSelection,
  analyzeComplexity,
  estimateTokens,
  type ModelSelection,
} from '../domain/model-router'
import { canAffordFallback } from '../domain/fallback'
import { getBudgetStatus } from '../domain/cost-tracker'
import {
  isMemoryRecallQuestion,
  resolveMemoryReadPolicy,
  sanitizeMemoryContractResponse,
  shouldWriteMemory,
  type TextPathway,
} from './memory-policy'
import { emitSlaMetric, SLA_METRICS } from '../../../shared/observability/metrics'
import { executeGovernedTool, type ToolPolicyContext } from './tool-governance'

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

const SYSTEM_PROMPT_SHORT = `Eres Migue, asistente personal en WhatsApp. Responde en español colombiano, cálido y conciso (1-2 frases, max 280 caracteres). Evita repetir saludos.
Tienes acceso al historial de la conversación en los mensajes.
NUNCA digas frases como "no tengo acceso al historial", "no puedo ver mensajes anteriores" o "no tengo contexto".
Si hay historial, úsalo para continuar con contexto; si hay poco historial, pide precisión sin negar acceso.
Usa herramientas SOLO cuando el usuario lo necesite claramente:
- create_reminder: recuérdame / no olvides / avísame
- schedule_meeting: agenda / programa / cita
- track_expense: gasté / pagué / compré / costó
Si usas una herramienta, confirma con "Listo!".`

/**
 * Generate system prompt with current time context
 * CRITICAL: Time context enables GPT to calculate "en 5 minutos", "mañana", etc.
 */
function generateSystemPrompt(isShort: boolean): string {
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

  return `${timeContext}\n\n${isShort ? SYSTEM_PROMPT_SHORT : SYSTEM_PROMPT_BASE}`
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
 * Map AI-provided category to database constraint values
 * AI may use variations like "Comida", "Food", "Mercado" - we normalize to DB allowed values
 */
function mapExpenseCategory(aiCategory: string): string {
  const normalized = aiCategory.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Alimentación: food, groceries, restaurant
  if (/aliment|comida|mercado|supermerc|restauran|desayun|almuerzopor cena|food|groceries/.test(normalized)) {
    return 'Alimentación'
  }

  // Transporte: transport, uber, taxi, gas
  if (/transport|uber|taxi|gasolina|combustibl|pasaje|bus|metro|gas/.test(normalized)) {
    return 'Transporte'
  }

  // Entretenimiento: entertainment, movies, games, fun
  if (/entreteni|cine|pelicula|jueg|divers|entretencion|entertainment|movies|games|fun/.test(normalized)) {
    return 'Entretenimiento'
  }

  // Salud: health, medicine, doctor, hospital
  if (/salud|medicin|doctor|hospital|farmacia|clinica|health|medicine|doctor/.test(normalized)) {
    return 'Salud'
  }

  // Servicios: services, utilities, internet, phone
  if (/servicio|luz|agua|internet|telefon|celular|utilitie|service/.test(normalized)) {
    return 'Servicios'
  }

  // Compras: shopping, clothes, electronics (NEW - was missing from original plan)
  if (/compra|ropa|vestir|electronic|tienda|shopping|clothes/.test(normalized)) {
    return 'Compras'
  }

  // Educación: education, books, courses
  if (/educacion|estudio|libro|curso|escuela|univers|education|books|course/.test(normalized)) {
    return 'Educación'
  }

  // Hogar: home, rent, furniture
  if (/hogar|casa|arriendo|alquiler|mueble|home|rent|furniture/.test(normalized)) {
    return 'Hogar'
  }

  // Default: Otros
  return 'Otros'
}

/**
 * ProactiveAgent using Vercel AI SDK 6.0 generateText()
 */
export async function respond(
  userMessage: string,
  userId: string,
  history: ModelMessage[],
  context?: { conversationId?: string; messageId?: string; pathway?: TextPathway }
): Promise<{
  text: string
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
  cost: { input: number; output: number; total: number }
  finishReason: string
  toolCalls: number
}> {
  const pathway = context?.pathway ?? 'default'
  const readPolicy = resolveMemoryReadPolicy(pathway)
  const memoryReadStart = Date.now()

  const hasReminder = hasReminderKeywords(userMessage)
  const hasMeeting = hasMeetingKeywords(userMessage)
  const hasExpense = hasExpenseKeywords(userMessage)
  const isToolMessage = hasReminder || hasMeeting || hasExpense

  const {
    searchMemories,
    getMemoryProfile,
    containsPersonalFact,
    storeMemory,
    extractProfileUpdates,
    upsertMemoryProfile,
    buildMemoryProfileSummary,
  } = await import('../domain/memory')

  let memoryContext = ''
  let memoryHit = 0
  let profileHit = 0

  const profile = readPolicy.includeProfile ? await getMemoryProfile(userId) : null
  const profileSummary = buildMemoryProfileSummary(profile)
  if (profile) {
    profileHit = 1
    memoryContext += `\n\n# USER PROFILE (stable preferences):\n- ${profileSummary || 'perfil disponible sin detalles estructurados'}\n`
  }

  if (readPolicy.semanticEnabled && readPolicy.semanticTopK > 0) {
    const memories = await searchMemories(
      userId,
      userMessage,
      readPolicy.semanticTopK,
      readPolicy.semanticThreshold
    )
    if (memories.length > 0) {
      memoryHit = 1
      memoryContext = `\n\n# USER MEMORY (things you remember about this user):\n${memories
        .map((m: any) => `- ${m.content} (${m.type})`)
        .join('\n')}\n${memoryContext}`

      logger.info('[ProactiveAgent] Memories injected', {
        metadata: {
          userId,
          memoriesCount: memories.length,
          topSimilarity: memories[0]?.similarity || 0,
        },
      })
    }
  } else if (isToolMessage) {
    logger.info('[ProactiveAgent] Memory search skipped for tool message', {
      metadata: { userId, hasReminder, hasMeeting, hasExpense },
    })
  } else {
    logger.info('[ProactiveAgent] Semantic retrieval skipped by read policy', {
      metadata: { userId, pathway },
    })
  }

  emitSlaMetric(SLA_METRICS.MEMORY_READ_MS, {
    ...(context?.conversationId ? { conversationId: context.conversationId } : {}),
    userId,
    value: Date.now() - memoryReadStart,
    messageType: 'text',
    pathway,
  })
  emitSlaMetric(SLA_METRICS.MEMORY_HIT_RATIO, {
    ...(context?.conversationId ? { conversationId: context.conversationId } : {}),
    userId,
    value: memoryHit,
    messageType: 'text',
    pathway,
  })
  emitSlaMetric(SLA_METRICS.PROFILE_HIT_RATIO, {
    ...(context?.conversationId ? { conversationId: context.conversationId } : {}),
    userId,
    value: profileHit,
    messageType: 'text',
    pathway,
  })

  const useShortPrompt = userMessage.length < 120
  const recallQuestion = isMemoryRecallQuestion(userMessage)
  const recallGuard = recallQuestion
    ? '\n\n# MEMORY CONTRACT\nSi el usuario pregunta por historial/memoria, responde con lo que sí tienes de conversación/perfil/memoria. No digas que no tienes acceso al historial cuando sí hay contexto.'
    : ''
  const systemPrompt = generateSystemPrompt(useShortPrompt) + memoryContext + recallGuard

  const maxHistory = readPolicy.historyLimit
  const trimmedHistory = history.slice(-maxHistory)

  const messages: ModelMessage[] = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory,
    { role: 'user', content: userMessage },
  ]

  // Log keyword detection (variables already declared at top for memory optimization)
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
  const hasTools = isToolMessage
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

  const primaryModel = primarySelection.modelName
  const fallbackModel = fallbackSelection.modelName
  const policyContext: ToolPolicyContext = { userId, pathway }

  const toolsDefinition = isToolMessage ? {
      create_reminder: tool({
        description: 'Crea recordatorio cuando usuario dice: recuérdame, no olvides, tengo que, avísame',
        // @ts-expect-error - AI SDK tool() type inference issue: ZodObject not assignable to FlexibleSchema<never>
        inputSchema: z.object({
          title: z.string().describe('Qué recordar'),
          description: z.string().optional().describe('Detalles'),
          datetimeIso: z.string().describe('ISO format: YYYY-MM-DDTHH:MM:SS-05:00'),
        }),
        // @ts-expect-error - AI SDK tool() type inference issue: execute function signature incompatible
        execute: async ({ title, description, datetimeIso }: {
          title: string
          description?: string
          datetimeIso: string
        }) => {
          const governed = await executeGovernedTool({
            toolName: 'create_reminder',
            context: policyContext,
            input: { title, description, datetimeIso },
            execute: async ({ title, description, datetimeIso }) => {
              await createReminder(userId, title, description || null, datetimeIso)
              return `Recordatorio creado: "${title}"`
            },
          })
          if (governed.status === 'ok') return governed.output
          return governed.userMessage
        },
      }),
      schedule_meeting: tool({
        description: 'Agenda reunión cuando usuario dice: agenda, reserva cita, programa',
        // @ts-expect-error - AI SDK tool() type inference issue: ZodObject not assignable to FlexibleSchema<never>
        inputSchema: z.object({
          title: z.string(),
          startTime: z.string().describe('ISO format'),
          endTime: z.string().describe('ISO format'),
          description: z.string().optional(),
        }),
        // @ts-expect-error - AI SDK tool() type inference issue: execute function signature incompatible
        execute: async ({ title, startTime, endTime, description }: {
          title: string
          startTime: string
          endTime: string
          description?: string
        }) => {
          const governed = await executeGovernedTool({
            toolName: 'schedule_meeting',
            context: policyContext,
            input: { title, startTime, endTime, description },
            execute: async ({ title, description }) => {
              const result = await scheduleMeetingFromIntent({
                userId,
                userMessage: `${title}${description ? ': ' + description : ''}`,
                conversationHistory: [],
              })
              return result.reply
            },
          })
          if (governed.status === 'ok') return governed.output
          return governed.userMessage
        },
      }),
      track_expense: tool({
        description: 'Registra gasto cuando usuario dice: gasté, pagué, compré, costó',
        inputSchema: z.object({
          amount: z.number(),
          currency: z.string(),
          category: z.string(),
          description: z.string(),
        }),
        execute: async ({ amount, currency, category, description }: {
          amount: number
          currency: string
          category: string
          description: string
        }) => {
          const governed = await executeGovernedTool({
            toolName: 'track_expense',
            context: policyContext,
            input: { amount, currency, category, description },
            execute: async ({ amount, currency, category, description }) => {
              try {
                const { getSupabaseServerClient } = await import('../../../shared/infra/db/supabase')
                const supabase = getSupabaseServerClient()

                // Map AI category to DB constraint values
                const mappedCategory = mapExpenseCategory(category)
                const expenseDate = new Date().toISOString().split('T')[0] ?? new Date().toISOString().slice(0, 10)

                const { error } = await supabase.from('expenses').insert({
                  user_id: userId,
                  amount,
                  currency,
                  category: mappedCategory,
                  description,
                  expense_date: expenseDate,
                })

                if (error) {
                  logger.error('[trackExpense] Database insert failed', error, {
                    metadata: { userId, amount, currency, category: mappedCategory, description },
                  })
                  return 'Error al registrar gasto. Por favor intenta de nuevo.'
                }

                logger.info('[trackExpense] Persisted to database', {
                  metadata: { userId, amount, currency, category: mappedCategory, description },
                })
                return `Gasto registrado: ${currency} ${amount} en ${mappedCategory}`
              } catch (error: any) {
                logger.error('[trackExpense] Unexpected error', error)
                return 'Error al registrar gasto. Por favor intenta de nuevo.'
              }
            },
          })
          if (governed.status === 'ok') return governed.output
          return governed.userMessage
        },
      }),
  } : undefined

  const gatewayProviderOptions = budgetCheck.canAffordFallback
    ? ({
        gateway: {
          models: [fallbackModel],
        },
      } as any)
    : undefined

  const response = await generateText({
    model: primaryModel,
    messages,
    ...(toolsDefinition ? { tools: toolsDefinition } : {}),
    temperature: isToolMessage ? 0.8 : 0.6,
    ...(gatewayProviderOptions ? { providerOptions: gatewayProviderOptions } : {}),
  })

  let { text } = response
  const usage = {
    inputTokens: response.usage.inputTokens ?? 0,
    outputTokens: response.usage.outputTokens ?? 0,
    totalTokens: response.usage.totalTokens ?? 0,
  }
  const finishReason = response.finishReason
  const steps = response.steps

  const gatewayMeta = (response as any)?.providerMetadata?.gateway
  const gatewayModel = gatewayMeta?.model || primaryModel
  const modelConfig = MODEL_CATALOG[gatewayModel] || MODEL_CATALOG[primaryModel]
  const usedProvider = modelConfig?.provider ?? primarySelection.provider

  // Calculate cost based on actual provider used
  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const totalTokens = usage.totalTokens ?? (inputTokens + outputTokens)

  const providerConfig =
    usedProvider === 'openai' ? models.openai : models.gemini
  const inputCost = (inputTokens / 1_000_000) * providerConfig.costPer1MTokens.input
  const outputCost = (outputTokens / 1_000_000) * providerConfig.costPer1MTokens.output
  const totalCost = inputCost + outputCost

  // Enforce WhatsApp-friendly length
  if (text.length > 280) {
    text = text.slice(0, 277).trimEnd() + '...'
  }

  // Count tool calls
  const toolCallCount = steps.filter((s) => s.toolCalls && s.toolCalls.length > 0).length
  const toolResults = steps
    .flatMap((s: any) => Array.isArray(s?.toolResults) ? s.toolResults : [])
    .map((r: any) => r?.result)
    .filter((r: unknown): r is string => typeof r === 'string' && r.trim().length > 0)

  // Some providers/flows finish with tool-calls and empty assistant text.
  // Ensure we always return a non-empty user-facing confirmation.
  if (text.trim().length === 0 && toolCallCount > 0) {
    text = (toolResults[toolResults.length - 1] ?? 'Listo. Ya ejecuté tu solicitud.').trim()
  }

  logger.info('[ProactiveAgent] Response generated', {
    metadata: {
      ...context,
      provider: usedProvider,
      gatewayModel,
      gatewayMeta,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
      },
      cost: { input: inputCost, output: outputCost, total: totalCost },
      finishReason,
      toolCalls: toolCallCount,
      textLength: text.length,
      toolResultCount: toolResults.length,
    },
  })

  // Track usage for budget monitoring
  const { trackUsage } = await import('../domain/cost-tracker')
  const modelName = gatewayModel || primaryModel
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

  // WRITE policy: persist useful facts/preferences and completed actions only.
  const hasPersonalFact = containsPersonalFact(userMessage)
  if (shouldWriteMemory(userMessage, hasPersonalFact, toolCallCount)) {
    storeMemory(userId, userMessage, 'fact')
    emitSlaMetric(SLA_METRICS.MEMORY_WRITE_COUNT, {
      ...(context?.conversationId ? { conversationId: context.conversationId } : {}),
      userId,
      value: 1,
      messageType: 'text',
      pathway,
    })
  }

  const profileUpdates = extractProfileUpdates(userMessage)
  if (Object.keys(profileUpdates).length > 0) {
    void upsertMemoryProfile(userId, profileUpdates)
    emitSlaMetric(SLA_METRICS.MEMORY_WRITE_COUNT, {
      ...(context?.conversationId ? { conversationId: context.conversationId } : {}),
      userId,
      value: 1,
      messageType: 'text',
      pathway,
      extra: { write_type: 'profile' },
    })
  }

  if (recallQuestion) {
    text = sanitizeMemoryContractResponse(
      text,
      history.length > 0 || !!profile || memoryHit > 0,
      profileSummary ? `Lo que sé de ti: ${profileSummary}.` : ''
    )
    if (text.length > 280) {
      text = text.slice(0, 277).trimEnd() + '...'
    }
  }

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
