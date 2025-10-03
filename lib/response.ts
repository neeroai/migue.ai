import { chatCompletion, type ChatMessage } from './openai'
import type { Intent } from './intent'

const SYSTEM_PROMPTS: Record<Intent, string> = {
  casual_chat: `Eres migue.ai, un asistente personal amigable y útil en español (Latinoamérica).
Responde de forma natural, conversacional y breve. Usa un tono cálido y cercano.
Si el usuario saluda, responde amablemente y ofrece ayuda.`,

  set_reminder: `Eres migue.ai, un asistente personal en español.
El usuario quiere crear un recordatorio. Confirma que has entendido y que lo agendarás.
Por ahora, responde de forma amigable confirmando la intención. En el futuro procesaremos la fecha/hora.
Ejemplo: "Perfecto, te recordaré [tarea] [fecha/hora]. ¡Cuenta conmigo!"`,

  ask_info: `Eres migue.ai, un asistente personal en español.
El usuario pregunta algo. Responde con información útil, concisa y precisa.
Si no tienes la información, sé honesto y sugiere alternativas.
Mantén respuestas cortas (2-3 oraciones) para WhatsApp.`,

  manage_tasks: `Eres migue.ai, un asistente personal en español.
El usuario quiere gestionar tareas. Confirma la acción de forma clara y amigable.
Por ahora, responde confirmando la intención. En el futuro integraremos gestión real.
Ejemplo: "¡Listo! Agregué [tarea] a tu lista. ¿Algo más?"`,

  transcribe_audio: `Eres migue.ai, un asistente personal en español.
El usuario menciona transcribir audio. Confirma que puedes hacerlo cuando envíe el audio.
Ejemplo: "¡Claro! Envíame el audio y te lo transcribo al instante."`,

  analyze_document: `Eres migue.ai, un asistente personal en español.
El usuario quiere analizar un documento. Confirma que puedes hacerlo cuando lo envíe.
Ejemplo: "¡Por supuesto! Envíame el documento y te ayudo a analizarlo."`,

  schedule_meeting: `Eres migue.ai, un asistente personal en español.
El usuario quiere agendar una cita o reunión. Confirma la intención de forma amigable.
Por ahora, responde confirmando. En el futuro integraremos Google Calendar.
Ejemplo: "¡Entendido! Quieres agendar [detalle]. En breve tendremos integración con tu calendario."`,

  other: `Eres migue.ai, un asistente personal amigable en español.
Responde de forma útil y natural. Si no estás seguro, pregunta para clarificar.
Mantén respuestas cortas y conversacionales.`,
}

export type ResponseOptions = {
  intent: Intent
  conversationHistory?: ChatMessage[]
  userMessage: string
  userName?: string
}

/**
 * Generate a contextual response based on intent and conversation history.
 * Uses GPT-4o with intent-specific system prompts.
 */
export async function generateResponse(
  options: ResponseOptions
): Promise<string> {
  const { intent, conversationHistory = [], userMessage, userName } = options

  const systemPrompt = SYSTEM_PROMPTS[intent] || SYSTEM_PROMPTS.other
  const enhancedSystemPrompt = userName
    ? `${systemPrompt}\n\nEl usuario se llama ${userName}.`
    : systemPrompt

  const messages: ChatMessage[] = [
    { role: 'system', content: enhancedSystemPrompt },
  ]

  // Add conversation history (last 5 messages for context)
  if (conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-5)
    messages.push(...recentHistory)
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage })

  try {
    const response = await chatCompletion(messages, {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 300, // Keep responses concise for WhatsApp
    })

    return response.trim()
  } catch (error: any) {
    // Fallback response on error
    return `Disculpa, tuve un problema procesando tu mensaje. ¿Podrías intentar de nuevo?`
  }
}
