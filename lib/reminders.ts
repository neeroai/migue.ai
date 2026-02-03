import { z } from 'zod'
import { generateText, type ModelMessage } from 'ai'
import { models } from './ai/providers'
import { getSupabaseServerClient } from './supabase'
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
