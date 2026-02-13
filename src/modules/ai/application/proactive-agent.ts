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
import type { AgentContextSnapshot } from './agent-context-builder'
import { generateToolConfirmationMessage } from '../../../shared/infra/ai/agentic-messaging'
import { composeSoulSystemPrompt } from './soul-composer'
import { resolveLocaleStyle } from './locale-style-resolver'
import {
  enforceEmojiLimit,
  isSoulEnabled,
  isSoulStrictGuardrailsEnabled,
  resolveEmojiLimit,
  rewriteRoboticFallback,
} from './soul-policy'

const WHATSAPP_TEXT_SOFT_LIMIT = 1200

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

function messageContentToText(content: ModelMessage['content']): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      if ('type' in part && part.type === 'text' && 'text' in part && typeof part.text === 'string') {
        return part.text
      }
      return ''
    })
    .filter(Boolean)
    .join(' ')
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
  context?: {
    conversationId?: string
    messageId?: string
    pathway?: TextPathway
    agentContext?: AgentContextSnapshot
    toolPolicy?: {
      toolsEnabled?: boolean
      explicitConsent?: boolean
    }
  }
): Promise<{
  text: string
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
  cost: { input: number; output: number; total: number }
  finishReason: string
  toolCalls: number
}> {
  const pathway = context?.pathway ?? 'default'
  const readPolicy = resolveMemoryReadPolicy(pathway)
  const toolsEnabled = context?.toolPolicy?.toolsEnabled ?? true

  const {
    containsPersonalFact,
    storeMemory,
    extractProfileUpdates,
    upsertMemoryProfile,
    upsertSoulSignals,
  } = await import('../domain/memory')

  const memoryContext = context?.agentContext?.memoryContext ?? ''
  const profileSummary = context?.agentContext?.profileSummary ?? ''
  const hasAnyContext = context?.agentContext?.hasAnyContext ?? history.length > 0

  const useShortPrompt = userMessage.length < 120
  const recallQuestion = isMemoryRecallQuestion(userMessage)
  const trimmedHistory = context?.agentContext?.modelHistory ?? history.slice(-readPolicy.historyLimit)
  const historySnippets = trimmedHistory
    .map((message) => messageContentToText(message.content))
    .filter((snippet) => snippet.trim().length > 0)
    .slice(-8)
  const localeStyle = resolveLocaleStyle({
    userMessage,
    historySnippets,
  })
  const now = new Date()
  const systemPrompt = composeSoulSystemPrompt({
    pathway,
    userMessage,
    useShortPrompt,
    memoryContext,
    recallQuestion,
    profileSummary,
    localeStyle,
    nowIsoUtc: now.toISOString(),
    nowBogotaText: BOGOTA_FORMATTER.format(now),
  })

  const messages: ModelMessage[] = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory,
    { role: 'user', content: userMessage },
  ]

  // Intelligent model selection
  const hasTools = toolsEnabled
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
  const policyContext: ToolPolicyContext = {
    userId,
    pathway,
    ...(context?.toolPolicy?.explicitConsent !== undefined
      ? { explicitConsent: context.toolPolicy.explicitConsent }
      : {}),
  }
  let lastToolOutcomeMessage: string | null = null

  const toolsDefinition = toolsEnabled ? {
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
          const outcome = governed.status === 'ok' ? governed.output : governed.userMessage
          if (typeof outcome === 'string' && outcome.trim().length > 0) {
            lastToolOutcomeMessage = outcome.trim()
          }
          return outcome
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
          const outcome = governed.status === 'ok' ? governed.output : governed.userMessage
          if (typeof outcome === 'string' && outcome.trim().length > 0) {
            lastToolOutcomeMessage = outcome.trim()
          }
          return outcome
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
          const outcome = governed.status === 'ok' ? governed.output : governed.userMessage
          if (typeof outcome === 'string' && outcome.trim().length > 0) {
            lastToolOutcomeMessage = outcome.trim()
          }
          return outcome
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
    temperature: toolsEnabled ? 0.8 : 0.6,
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

  // Enforce WhatsApp-friendly soft limit
  if (text.length > WHATSAPP_TEXT_SOFT_LIMIT) {
    text = text.slice(0, WHATSAPP_TEXT_SOFT_LIMIT - 3).trimEnd() + '...'
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
    const fallbackToolMessage = (
      toolResults[toolResults.length - 1] ??
      lastToolOutcomeMessage ??
      'Listo. Ya ejecuté tu solicitud.'
    ).trim()
    text = await generateToolConfirmationMessage({
      userMessage,
      toolOutcome: fallbackToolMessage,
      fallback: fallbackToolMessage,
    })
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

  emitSlaMetric(SLA_METRICS.SOUL_LOCALE_CONFIDENCE_AVG, {
    ...(context?.conversationId ? { conversationId: context.conversationId } : {}),
    userId,
    value: localeStyle.confidence,
    messageType: 'text',
    pathway,
    extra: { city: localeStyle.city, variant: localeStyle.variant },
  })
  emitSlaMetric(SLA_METRICS.SOUL_LOCALE_DETECTION_HIT_RATIO, {
    ...(context?.conversationId ? { conversationId: context.conversationId } : {}),
    userId,
    value: localeStyle.city === 'unknown' ? 0 : 1,
    messageType: 'text',
    pathway,
  })
  emitSlaMetric(SLA_METRICS.SOUL_PERSONALIZATION_HIT_RATIO, {
    ...(context?.conversationId ? { conversationId: context.conversationId } : {}),
    userId,
    value: (hasAnyContext || localeStyle.city !== 'unknown' || profileSummary.length > 0) ? 1 : 0,
    messageType: 'text',
    pathway,
  })

  if (localeStyle.city !== 'unknown' && localeStyle.confidence >= 0.72) {
    void upsertSoulSignals(userId, {
      city: localeStyle.city,
      cityConfidence: localeStyle.confidence,
      styleVariant: localeStyle.variant,
    }).then(() => {
      emitSlaMetric(SLA_METRICS.SOUL_PROFILE_UPDATES_COUNT, {
        ...(context?.conversationId ? { conversationId: context.conversationId } : {}),
        userId,
        value: 1,
        messageType: 'text',
        pathway,
        extra: { write_type: 'soul_locale' },
      })
    })
  }

  if (recallQuestion) {
    text = sanitizeMemoryContractResponse(
      text,
      hasAnyContext,
      profileSummary ? `Lo que sé de ti: ${profileSummary}.` : ''
    )
  }

  if (isSoulEnabled()) {
    if (isSoulStrictGuardrailsEnabled()) {
      const rewritten = rewriteRoboticFallback(text)
      if (rewritten !== text) {
        emitSlaMetric(SLA_METRICS.SOUL_ROBOTIC_REWRITE_COUNT, {
          ...(context?.conversationId ? { conversationId: context.conversationId } : {}),
          userId,
          value: 1,
          messageType: 'text',
          pathway,
        })
      }
      text = rewritten
    }

    const emojiLimit = resolveEmojiLimit(localeStyle.emojiPolicy)
    const emojiCapped = enforceEmojiLimit(text, emojiLimit)
    if (emojiCapped !== text) {
      emitSlaMetric(SLA_METRICS.SOUL_EMOJI_USAGE_AVG, {
        ...(context?.conversationId ? { conversationId: context.conversationId } : {}),
        userId,
        value: emojiLimit,
        messageType: 'text',
        pathway,
      })
    }
    text = emojiCapped
  }

  if (text.length > WHATSAPP_TEXT_SOFT_LIMIT) {
    text = text.slice(0, WHATSAPP_TEXT_SOFT_LIMIT - 3).trimEnd() + '...'
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
