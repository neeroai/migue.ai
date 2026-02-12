import { generateText } from 'ai'
import { logger } from '../../observability/logger'

const AGENTIC_MODEL = 'openai/gpt-4o-mini'
const MESSAGE_MAX_CHARS = 280

type AgenticMessageParams = {
  objective: string
  context: string
  fallback: string
}

function normalizeMessage(text: string | undefined, fallback: string): string {
  const trimmed = (text ?? '').trim()
  const candidate = trimmed.length > 0 ? trimmed : fallback
  if (candidate.length <= MESSAGE_MAX_CHARS) return candidate
  return `${candidate.slice(0, MESSAGE_MAX_CHARS - 3).trimEnd()}...`
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`timeout_${timeoutMs}ms`)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function generateAgenticMessage(params: AgenticMessageParams): Promise<string> {
  if (process.env.NODE_ENV === 'test') {
    return params.fallback
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    return params.fallback
  }

  try {
    const response = await withTimeout(
      generateText({
        model: AGENTIC_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Eres Migue, asistente conversacional en WhatsApp. Escribe en español colombiano, cálido y natural. Máximo 1-2 frases (<=280 caracteres), sin sonar robótico ni usar plantillas rígidas.',
          },
          {
            role: 'user',
            content: `Objetivo: ${params.objective}\nContexto: ${params.context}\nEvita copiar texto literal del contexto; parafrasea de forma humana.`,
          },
        ],
        temperature: 0.9,
      }),
      1800
    )

    return normalizeMessage(response.text, params.fallback)
  } catch (error: any) {
    logger.warn('[agentic-messaging] Falling back to static message', {
      metadata: {
        errorMessage: error?.message,
        objective: params.objective.slice(0, 80),
      },
    })
    return params.fallback
  }
}

export async function generateSignupLifecycleMessage(
  type: 'flow_sent' | 'already_in_progress' | 'flow_send_failed'
): Promise<string> {
  if (type === 'flow_send_failed') {
    return generateAgenticMessage({
      objective: 'Explicar que el formulario no abrió y pedir datos por chat',
      context:
        'No se pudo abrir el flow de registro. Debe pedir nombre y email por mensaje en formato simple.',
      fallback:
        'No pude abrir el formulario de registro. Envíame por mensaje: "Me llamo <tu nombre>, mi email es <tu@email.com>".',
    })
  }

  if (type === 'already_in_progress') {
    return generateAgenticMessage({
      objective: 'Recordar que debe terminar su registro para continuar',
      context:
        'El usuario tiene un registro pendiente. Debe abrir "Completar registro" o escribir nombre+email por chat.',
      fallback:
        'Tu registro sigue pendiente. Abre el formulario "Completar registro" para continuar, o envíame: "Me llamo <tu nombre>, mi email es <tu@email.com>".',
    })
  }

  return generateAgenticMessage({
    objective: 'Acompañar el inicio de registro con tono cercano',
    context:
      'Acabamos de enviar el flow "Completar registro". Pedir que lo complete y adelantar que al terminar podrá usar recordatorios, gastos y agenda.',
    fallback:
      'Te acabo de enviar "Completar registro". Apenas lo completes, seguimos con recordatorios, gastos y agenda.',
  })
}

export async function generatePostSignupWelcomeMessage(firstName?: string | null): Promise<string> {
  const safeName = typeof firstName === 'string' ? firstName.trim() : ''
  const nameChunk = safeName ? `Nombre: ${safeName}.` : 'No hay nombre disponible.'

  return generateAgenticMessage({
    objective: 'Dar bienvenida post-registro y abrir conversación útil',
    context: `${nameChunk} Confirmar que el registro quedó completo y preguntar cuál es su primera tarea.`,
    fallback: safeName
      ? `Listo, ${safeName}. Tu registro quedó completo. ¿Con qué empezamos hoy?`
      : 'Listo. Tu registro quedó completo. ¿Con qué empezamos hoy?',
  })
}

export async function generateReminderDeliveryMessage(params: {
  title: string
  description?: string | null
  scheduledTime?: string
}): Promise<string> {
  const reminderContext = [
    `Título original: ${params.title}`,
    params.description ? `Descripción original: ${params.description}` : null,
    params.scheduledTime ? `Fecha programada: ${params.scheduledTime}` : null,
  ]
    .filter(Boolean)
    .join(' | ')

  return generateAgenticMessage({
    objective: 'Enviar recordatorio útil y humano por WhatsApp',
    context: `${reminderContext}. Debe sonar natural y no copiar literal.`,
    fallback: params.description
      ? `Hola, te recuerdo esto: ${params.title}. ${params.description}`
      : `Hola, te recuerdo esto: ${params.title}.`,
  })
}

export async function generateToolConfirmationMessage(params: {
  userMessage: string
  toolOutcome: string
  fallback: string
}): Promise<string> {
  return generateAgenticMessage({
    objective: 'Confirmar ejecución de herramienta con tono humano y contextual',
    context: `Mensaje del usuario: ${params.userMessage} | Resultado técnico: ${params.toolOutcome}. Debe sonar natural, útil y breve.`,
    fallback: params.fallback,
  })
}
