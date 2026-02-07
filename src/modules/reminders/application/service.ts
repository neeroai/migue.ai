/**
 * @file Reminder Parsing & Persistence
 * @description AI-powered reminder extraction with Zod validation, natural language parsing via OpenAI, and Supabase database persistence
 * @module lib/reminders
 * @exports ReminderParseResult, parseReminderRequest, createReminder
 * @see https://sdk.vercel.ai/docs/ai-sdk-core/generating-text
 * @see https://supabase.com/docs/reference/javascript/insert
 * @date 2026-02-07 19:15
 * @updated 2026-02-07 19:15
 */

import { z } from 'zod'
import { generateText, type ModelMessage } from 'ai'
import { models } from '../../ai/domain/providers'
import { getSupabaseServerClient } from '../../../shared/infra/db/supabase'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

type ChatMessage = ChatCompletionMessageParam

const REMINDER_PROMPT = `Extrae recordatorios de la frase del usuario y responde JSON:
{
  "status": "ready",
  "title": "Qué recordar",
  "description": "Detalles opcionales",
  "datetime_iso": "YYYY-MM-DDTHH:MM:SS-05:00"
}
Si falta información crítica (fecha u hora), responde con:
{
  "status": "needs_clarification",
  "missing": ["campo"],
  "clarification": "Pregunta al usuario"
}`

// Zod schemas for AI response validation (discriminated union for type safety)
const ReminderReadySchema = z.object({
  status: z.literal('ready'),
  title: z.string(),
  description: z.string().nullable().optional(),
  datetime_iso: z.string(),
})

const ReminderClarificationSchema = z.object({
  status: z.literal('needs_clarification'),
  missing: z.array(z.string()),
  clarification: z.string(),
})

const ReminderResponseSchema = z.discriminatedUnion('status', [
  ReminderReadySchema,
  ReminderClarificationSchema,
])

export type ReminderParseResult =
  | {
      status: 'ready'
      title: string
      description: string | null
      datetimeIso: string
    }
  | {
      status: 'needs_clarification'
      missing: string[]
      clarification: string
    }

/**
 * Extracts reminder details from natural language using AI with discriminated union response
 * Uses OpenAI GPT to parse message, validates with Zod, handles clarification flow
 *
 * @param message - Natural language reminder request from user
 * @param history - Optional last 2 conversation messages for context
 * @returns Discriminated union: ready (parsed) or needs_clarification (missing fields)
 * @throws {Error} Invalid JSON or schema validation failure from AI
 *
 * @example
 * ```ts
 * const result = await parseReminderRequest('Recordar reunión mañana 3pm');
 * if (result.status === 'ready') {
 *   console.log(result.datetimeIso); // '2026-02-08T15:00:00-05:00'
 * } else {
 *   console.log(result.clarification); // 'What should I remind you about?'
 * }
 * ```
 */
export async function parseReminderRequest(
  message: string,
  history?: ChatMessage[]
): Promise<ReminderParseResult> {
  const messages: ModelMessage[] = [{ role: 'system', content: REMINDER_PROMPT }]
  if (history && history.length > 0) {
    messages.push(...(history.slice(-2) as ModelMessage[]))
  }
  messages.push({ role: 'user', content: message })

  const { text } = await generateText({
    model: models.openai.primary,
    messages,
    temperature: 0,
  })

  // Parse and validate with Zod
  let jsonData: unknown
  try {
    jsonData = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON response from AI')
  }

  const result = ReminderResponseSchema.safeParse(jsonData)
  if (!result.success) {
    throw new Error(`Invalid reminder response format: ${result.error.message}`)
  }

  const parsed = result.data

  // TypeScript can now correctly narrow the type using discriminator
  if (parsed.status === 'needs_clarification') {
    return {
      status: 'needs_clarification',
      missing: parsed.missing,
      clarification: parsed.clarification,
    }
  }

  // It's a ready response
  return {
    status: 'ready',
    title: parsed.title,
    description: parsed.description ?? null,
    datetimeIso: parsed.datetime_iso,
  }
}

/**
 * Persists reminder to Supabase database with pending status
 *
 * @param userId - User UUID to associate reminder with
 * @param title - Reminder subject (what to remember)
 * @param description - Optional detailed notes
 * @param datetimeIso - Scheduled time in ISO 8601 format with timezone
 * @throws {Error} Database error if insert fails
 *
 * @example
 * ```ts
 * await createReminder(
 *   'user-123',
 *   'Team meeting',
 *   'Discuss Q2 roadmap',
 *   '2026-02-08T15:00:00-05:00'
 * );
 * ```
 */
export async function createReminder(
  userId: string,
  title: string,
  description: string | null,
  datetimeIso: string
) {
  const supabase = getSupabaseServerClient()
  const { error } = await supabase.from('reminders').insert({
    user_id: userId,
    title,
    description,
    scheduled_time: datetimeIso,
    status: 'pending',
  })
  if (error) throw error
}
