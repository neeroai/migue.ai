import { chatCompletion, type ChatMessage } from './openai'
import { createCalendarEventForUser, type CalendarEventInput } from './google-calendar'

const DEFAULT_TIMEZONE = 'America/Mexico_City'

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
  const messages: ChatMessage[] = [{ role: 'system', content: EXTRACTION_PROMPT }]
  if (history && history.length > 0) {
    messages.push(...history.slice(-2))
  }
  messages.push({ role: 'user', content: message })
  const response = await chatCompletion(messages, { model: 'gpt-4o-mini', temperature: 0 })
  return JSON.parse(response) as Extraction
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

function buildCalendarInput(data: Extraction, times: ReturnType<typeof ensureTimes>): CalendarEventInput {
  return {
    summary: data.summary ?? 'Reunión',
    description: data.notes ?? null,
    start: { dateTime: times.startIso, timeZone: times.timezone },
    end: { dateTime: times.endIso, timeZone: times.timezone },
    attendees: data.attendees?.map((email) => ({ email })) ?? undefined,
    location: data.location ?? null,
    conferencing: 'google_meet',
  }
}

function formatConfirmation(summary: string, startIso: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: timezone,
  })
  return `¡Listo! Reservé "${summary}" para ${formatter.format(new Date(startIso))}. Te envié la invitación en Google Calendar.`
}

function formatMissingFields(missing: string[] | undefined) {
  if (!missing || missing.length === 0) {
    return 'Necesito algunos detalles (fecha y hora) para agendar la reunión.'
  }
  const list = missing.map((item) => `- ${item}`).join('\n')
  return `Necesito confirmar estos datos antes de agendar:\n${list}`
}

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
    const calendarInput = buildCalendarInput(extraction, times)
    const result = await createCalendarEventForUser(options.userId, calendarInput)
    const reply = formatConfirmation(calendarInput.summary, result.start, calendarInput.start.timeZone)
    return { status: 'scheduled', reply, start: result.start, end: result.end }
  } catch (error: any) {
    if (error?.message?.includes('Missing Google Calendar credential')) {
      return {
        status: 'error',
        reply: 'Necesito que conectes tu Google Calendar antes de agendar. Abre el panel de configuración y vincula tu cuenta.',
      }
    }
    console.error('Scheduling error:', error)
    return {
      status: 'error',
      reply: 'No pude agendar la reunión por un error interno. Intentemos de nuevo en unos minutos.',
    }
  }
}
