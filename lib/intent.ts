import { chatCompletion, type ChatMessage } from './openai'

export type Intent =
  | 'casual_chat'        // General conversation
  | 'set_reminder'       // Create a reminder
  | 'ask_info'           // Request information/search
  | 'manage_tasks'       // Task management (lists, todos)
  | 'transcribe_audio'   // Audio transcription request
  | 'analyze_document'   // Document analysis request
  | 'schedule_meeting'   // Calendar/appointment scheduling
  | 'other'              // Fallback

export type IntentResult = {
  intent: Intent
  confidence: 'high' | 'medium' | 'low'
  reasoning?: string
}

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a personal AI assistant in Spanish (Latin America).

Given a user message, classify it into ONE of these intents:
- casual_chat: Greetings, casual conversation, chitchat
- set_reminder: User wants to create a reminder or be notified later
- ask_info: User asks for information, news, weather, facts
- manage_tasks: User wants to create/view/update tasks or to-do lists
- transcribe_audio: User explicitly mentions transcribing audio (rare, usually implied)
- analyze_document: User asks to analyze/summarize a document or PDF
- schedule_meeting: User wants to schedule/manage appointments or calendar events
- other: Anything that doesn't fit above

Respond with JSON:
{
  "intent": "<intent_name>",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation (optional)"
}

Examples:
User: "Hola, cómo estás?" -> {"intent": "casual_chat", "confidence": "high"}
User: "Recuérdame mañana a las 3pm llamar a Juan" -> {"intent": "set_reminder", "confidence": "high"}
User: "¿Qué clima hay hoy?" -> {"intent": "ask_info", "confidence": "high"}
User: "Agregar leche a mi lista de compras" -> {"intent": "manage_tasks", "confidence": "high"}
User: "Agenda una reunión con María el viernes" -> {"intent": "schedule_meeting", "confidence": "high"}

Be concise. Respond ONLY with valid JSON.`

/**
 * Classify user message into an intent using GPT-4o.
 * Fast, lightweight call (~100 tokens output).
 */
export async function classifyIntent(
  userMessage: string,
  conversationHistory?: ChatMessage[]
): Promise<IntentResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: INTENT_SYSTEM_PROMPT },
  ]

  // Add recent history for context (optional, last 3 messages)
  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-3)
    messages.push(...recentHistory)
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage })

  try {
    const response = await chatCompletion(messages, {
      model: 'gpt-4o',
      temperature: 0.3, // Low temperature for consistent classification
      maxTokens: 150,
    })

    // Parse JSON response
    const parsed = JSON.parse(response) as IntentResult
    const result: IntentResult = {
      intent: parsed.intent || 'other',
      confidence: parsed.confidence || 'medium',
    }
    if (parsed.reasoning) {
      result.reasoning = parsed.reasoning
    }
    return result
  } catch (error: any) {
    // Fallback on error
    const fallback: IntentResult = {
      intent: 'other',
      confidence: 'low',
    }
    if (error?.message) {
      fallback.reasoning = `Classification failed: ${error.message}`
    }
    return fallback
  }
}
