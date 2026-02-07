/**
 * @file Meeting Scheduling
 * @description AI-powered meeting scheduling with natural language parsing, timezone handling (default: America/Bogota UTC-5), and discriminated union outcomes
 * @module lib/scheduling
 * @exports SchedulingOutcome, SchedulingRequestOptions, scheduleMeetingFromIntent
 * @see https://sdk.vercel.ai/docs/ai-sdk-core/generating-text
 * @date 2026-02-07 19:20
 * @updated 2026-02-07 19:20
 */

import { generateText, type ModelMessage } from 'ai'
import { models } from './ai/providers'
import { logger } from './logger'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

type ChatMessage = ChatCompletionMessageParam

// Default timezone changed to Bogotá, Colombia (UTC-5)
// Business hours: 7am-8pm Bogotá time
const DEFAULT_TIMEZONE = 'America/Bogota'

const EXTRACTION_PROMPT = `Eres un planificador experto para usuarios de América Latina.
Convierte la petición en JSON con el siguiente formato exacto:
{
  "ready": true|false,
  "missing": ["campo"],
  "summary": "Título del evento",
  "start_iso": "YYYY-MM-DDTHH:MM:SS-05:00",
  "end_iso": "YYYY-MM-DDTHH:MM:SS-05:00",
  "timezone": "Area/City",
  "duration_minutes": 30,
  "location": "",
  "attendees": ["correo@example.com"],
  "notes": "detalle adicional"
}
Si falta información crítica (fecha u hora), establece ready=false y lista los campos en "missing".
Responde únicamente con JSON válido.`

export type SchedulingOutcome =
  | { status: 'scheduled'; reply: string; start: string; end: string }
  | { status: 'needs_clarification'; reply: string }
  | { status: 'error'; reply: string }

export type SchedulingRequestOptions = {
  userId: string
  userMessage: string
  conversationHistory?: ChatMessage[]
  fallbackTimeZone?: string
  userName?: string
}

type Extraction = {
  ready: boolean
  missing?: string[]
  summary?: string
  start_iso?: string
  end_iso?: string
  timezone?: string
  duration_minutes?: number
  location?: string
  attendees?: string[]
  notes?: string
}

async function extractSchedulingDetails(
  message: string,
  history?: ChatMessage[]
): Promise<Extraction> {
  const messages: ModelMessage[] = [{ role: 'system', content: EXTRACTION_PROMPT }]
  if (history && history.length > 0) {
    messages.push(...(history.slice(-2) as ModelMessage[]))
  }
  messages.push({ role: 'user', content: message })

  const { text } = await generateText({
    model: models.openai.primary,
    messages,
    temperature: 0,
  })

  return JSON.parse(text) as Extraction
}

function ensureTimes(data: Extraction, fallbackTimeZone?: string) {
  if (!data.start_iso) return null
  const timezone = data.timezone ?? fallbackTimeZone ?? DEFAULT_TIMEZONE
  const start = new Date(data.start_iso)
  if (Number.isNaN(start.getTime())) return null
  let endIso = data.end_iso
  if (!endIso && data.duration_minutes) {
    endIso = new Date(start.getTime() + data.duration_minutes * 60000).toISOString()
  }
  if (!endIso) return null
  const end = new Date(endIso)
  if (Number.isNaN(end.getTime())) return null
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    timezone,
  }
}

function buildMeetingDetails(data: Extraction, times: NonNullable<ReturnType<typeof ensureTimes>>) {
  return {
    summary: data.summary ?? 'Reunión',
    description: data.notes ?? null,
    startIso: times.startIso,
    endIso: times.endIso,
    timezone: times.timezone,
    location: data.location ?? null,
    attendees: data.attendees ?? [],
  }
}

function formatConfirmation(summary: string, startIso: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: timezone,
  })
  return `¡Listo! Anoté "${summary}" para ${formatter.format(new Date(startIso))}.`
}

function formatMissingFields(missing: string[] | undefined) {
  if (!missing || missing.length === 0) {
    return 'Necesito algunos detalles (fecha y hora) para agendar la reunión.'
  }
  const list = missing.map((item) => `- ${item}`).join('\n')
  return `Necesito confirmar estos datos antes de agendar:\n${list}`
}

/**
 * Extracts meeting details from natural language and validates scheduling request
 * Uses OpenAI GPT with temperature 0 for deterministic parsing, handles missing fields clarification flow
 *
 * @param options - Scheduling request with userId, userMessage, optional conversationHistory, fallbackTimeZone, userName
 * @returns Discriminated union: scheduled (with ISO times) or needs_clarification or error
 *
 * @example
 * ```ts
 * const result = await scheduleMeetingFromIntent({
 *   userId: 'user-123',
 *   userMessage: 'Reunión mañana 3pm con equipo'
 * });
 * if (result.status === 'scheduled') {
 *   console.log(result.start); // '2026-02-08T15:00:00.000Z'
 * }
 * ```
 */
export async function scheduleMeetingFromIntent(
  options: SchedulingRequestOptions
): Promise<SchedulingOutcome> {
  try {
    const extraction = await extractSchedulingDetails(options.userMessage, options.conversationHistory)
    if (!extraction.ready) {
      return { status: 'needs_clarification', reply: formatMissingFields(extraction.missing) }
    }
    const times = ensureTimes(extraction, options.fallbackTimeZone)
    if (!times) {
      return { status: 'needs_clarification', reply: 'No pude entender la fecha u hora; ¿me ayudas a confirmarlas?' }
    }
    const meetingDetails = buildMeetingDetails(extraction, times)
    const reply = formatConfirmation(meetingDetails.summary, meetingDetails.startIso, meetingDetails.timezone)

    logger.info('[Scheduling] Meeting details extracted', {
      metadata: {
        userId: options.userId,
        summary: meetingDetails.summary,
        start: meetingDetails.startIso,
        end: meetingDetails.endIso,
      }
    })

    return {
      status: 'scheduled',
      reply,
      start: meetingDetails.startIso,
      end: meetingDetails.endIso,
    }
  } catch (error: any) {
    logger.error('[Scheduling] Error extracting meeting details', error instanceof Error ? error : new Error(String(error)), {
      metadata: { userId: options.userId }
    })
    return {
      status: 'error',
      reply: 'No pude procesar la información de la reunión. ¿Podrías repetirla?',
    }
  }
}
