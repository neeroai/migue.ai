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
  const parsed = JSON.parse(response) as any
  if (parsed.missing) {
    return {
      status: 'needs_clarification',
      missing: Array.isArray(parsed.missing) ? parsed.missing : ['detalle'],
      clarification:
        typeof parsed.clarification === 'string'
          ? parsed.clarification
          : 'Necesito saber la fecha y hora exacta para crear tu recordatorio.',
    }
  }
  const datetimeIso = parsed.datetime_iso as string
  const title = parsed.title as string
  const description = (parsed.description ?? null) as string | null
  return {
    status: 'ready',
    title,
    description,
    datetimeIso,
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
