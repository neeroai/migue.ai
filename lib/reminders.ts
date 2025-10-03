import { z } from 'zod'
import { chatCompletion, type ChatMessage } from './openai'
import { getSupabaseServerClient } from './supabase'

const REMINDER_PROMPT = `Extrae recordatorios de la frase del usuario y responde JSON:
{
  "title": "Qué recordar",
  "description": "Detalles opcionales",
  "datetime_iso": "YYYY-MM-DDTHH:MM:SS-05:00"
}
Si falta información crítica (fecha u hora), responde con:
{
  "missing": ["campo"],
  "clarification": "Pregunta al usuario"
}`

// Zod schemas for AI response validation
const ReminderReadySchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  datetime_iso: z.string(),
})

const ReminderClarificationSchema = z.object({
  missing: z.array(z.string()),
  clarification: z.string(),
})

const ReminderResponseSchema = z.union([
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
  const messages: ChatMessage[] = [{ role: 'system', content: REMINDER_PROMPT }]
  if (history && history.length > 0) {
    messages.push(...history.slice(-2))
  }
  messages.push({ role: 'user', content: message })
  const response = await chatCompletion(messages, {
    model: 'gpt-4o-mini',
    temperature: 0,
    maxTokens: 150,
  })

  // Parse and validate with Zod
  let jsonData: unknown
  try {
    jsonData = JSON.parse(response)
  } catch {
    throw new Error('Invalid JSON response from AI')
  }

  const result = ReminderResponseSchema.safeParse(jsonData)
  if (!result.success) {
    throw new Error(`Invalid reminder response format: ${result.error.message}`)
  }

  const parsed = result.data

  // Check if it's a clarification response (has 'missing' field)
  if ('missing' in parsed) {
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
