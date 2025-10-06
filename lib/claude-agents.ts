/**
 * Claude Specialized Agents
 * Autonomous agents for specific tasks using Claude Agent SDK
 *
 * Agents:
 * - ProactiveAgent: Main conversational assistant
 * - SchedulingAgent: Autonomous appointment management
 * - FinanceAgent: Proactive expense tracking
 * - DocumentAgent: RAG with PDFs and OCR
 * - TranscriptionAgent: Audio processing with Groq
 */

import { getClaudeClient, type ClaudeMessage } from './claude-client'
import { logger } from './logger'

/**
 * Base Agent Configuration
 */
export type AgentConfig = {
  name: string
  model?: 'claude-sonnet-4-5' | 'claude-opus-4'
  systemPrompt: string
  temperature?: number
  maxTokens?: number
}

/**
 * Proactive Agent - Main conversational assistant
 * Handles general queries, anticipates user needs, maintains context
 */
export class ProactiveAgent {
  private config: AgentConfig

  constructor() {
    this.config = {
      name: 'ProactiveAgent',
      model: 'claude-sonnet-4-5',
      temperature: 0.7,
      maxTokens: 1024,
      systemPrompt: `Eres Migue, un asistente personal proactivo en WhatsApp.

Tu misión es ayudar al usuario con:
- Gestión de citas y calendario
- Recordatorios inteligentes
- Control de gastos
- Programación de mensajes
- Procesamiento de audios, imágenes y documentos

Características clave:
1. PROACTIVO: Anticipa necesidades, sugiere optimizaciones
2. CONVERSACIONAL: Respuestas naturales, cercanas, en español
3. CONTEXTUAL: Recuerda conversaciones previas
4. EFICIENTE: Respuestas concisas y accionables

Cuando el usuario mencione fechas, citas o recordatorios, extrae la información y sugiere crear el evento.
Cuando hable de gastos, ayuda a categorizarlos y ofrece análisis.
Siempre busca formas de ser útil más allá de solo responder.`,
    }
  }

  async respond(
    userMessage: string,
    conversationHistory: ClaudeMessage[]
  ): Promise<string> {
    const startTime = Date.now()
    const client = getClaudeClient()

    logger.debug('[ProactiveAgent] Processing message', {
      metadata: {
        messageLength: userMessage.length,
        historyLength: conversationHistory.length,
      },
    })

    const messages: ClaudeMessage[] = [
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ]

    try {
      const response = await client.messages.create({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        temperature: this.config.temperature || 0.7,
        system: this.config.systemPrompt,
        messages,
      })

      const content = response.content[0]
      if (content?.type === 'text') {
        logger.performance('ProactiveAgent.respond', Date.now() - startTime, {
          metadata: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            responseLength: content.text.length,
          },
        })
        return content.text.trim()
      }

      throw new Error('ProactiveAgent: Invalid response format')
    } catch (error: any) {
      logger.error('ProactiveAgent error', error, {
        metadata: {
          userMessage: userMessage.slice(0, 100),
          duration: Date.now() - startTime,
        },
      })
      throw error
    }
  }
}

/**
 * Scheduling Agent - Autonomous appointment management
 * Handles complex scheduling, calendar integration, reminders
 */
export class SchedulingAgent {
  private config: AgentConfig

  constructor() {
    this.config = {
      name: 'SchedulingAgent',
      model: 'claude-opus-4', // Use Opus for complex scheduling
      temperature: 0.3, // Lower for precision
      maxTokens: 512,
      systemPrompt: `Eres un agente especializado en gestión de citas y calendario.

Tus capacidades:
1. Extraer fechas, horas y descripciones de citas
2. Validar disponibilidad en calendario
3. Sugerir horarios alternativos
4. Programar recordatorios automáticos
5. Manejar reprogramaciones y cancelaciones

Formato de respuesta:
- Confirma detalles de la cita claramente
- Ofrece opciones si hay conflictos
- Programa recordatorios (1 día antes y 1 hora antes)
- Sé conciso y preciso

Extrae SIEMPRE esta información:
{
  "title": "Descripción de la cita",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "duration": "minutes",
  "reminders": ["-1day", "-1hour"]
}`,
    }
  }

  async extractAppointment(userMessage: string): Promise<{
    title: string
    date: string
    time: string
    duration?: number
  } | null> {
    const startTime = Date.now()
    const client = getClaudeClient()

    logger.debug('[SchedulingAgent] Extracting appointment', {
      metadata: { messageLength: userMessage.length },
    })

    try {
      const response = await client.messages.create({
        model: this.config.model!,
        max_tokens: 512,
        temperature: 0.1, // Very low for extraction
        system: this.config.systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Extrae la información de cita de este mensaje. Si no hay información clara de cita, responde "NO_APPOINTMENT".

Mensaje: "${userMessage}"`,
          },
        ],
      })

      const content = response.content[0]
      if (content?.type === 'text') {
        const text = content.text.trim()

        if (text === 'NO_APPOINTMENT') {
          return null
        }

        // Try to parse JSON
        try {
          const appointment = JSON.parse(text)
          logger.performance('SchedulingAgent.extractAppointment', Date.now() - startTime, {
            metadata: { found: true },
          })
          return appointment
        } catch {
          logger.warn('SchedulingAgent: Could not parse appointment JSON', {
            metadata: { text },
          })
          return null
        }
      }

      logger.debug('[SchedulingAgent] No appointment found', {
        metadata: { duration: Date.now() - startTime },
      })
      return null
    } catch (error: any) {
      logger.error('SchedulingAgent extraction error', error, {
        metadata: {
          userMessage: userMessage.slice(0, 100),
          duration: Date.now() - startTime,
        },
      })
      return null
    }
  }
}

/**
 * Finance Agent - Proactive expense tracking
 * Categorizes expenses, detects patterns, provides insights
 */
export class FinanceAgent {
  private config: AgentConfig

  constructor() {
    this.config = {
      name: 'FinanceAgent',
      model: 'claude-sonnet-4-5',
      temperature: 0.5,
      maxTokens: 512,
      systemPrompt: `Eres un agente especializado en control de gastos personal.

Tus funciones:
1. Extraer montos, categorías y descripciones de gastos
2. Categorizar automáticamente (comida, transporte, entretenimiento, etc.)
3. Detectar patrones de gasto
4. Alertar sobre gastos inusuales
5. Sugerir oportunidades de ahorro

Categorías disponibles:
- Alimentación
- Transporte
- Entretenimiento
- Salud
- Servicios
- Compras
- Otros

Formato de extracción:
{
  "amount": 123.45,
  "currency": "MXN",
  "category": "Alimentación",
  "description": "Comida del día",
  "date": "YYYY-MM-DD"
}`,
    }
  }

  async extractExpense(userMessage: string): Promise<{
    amount: number
    currency: string
    category: string
    description: string
  } | null> {
    const startTime = Date.now()
    const client = getClaudeClient()

    logger.debug('[FinanceAgent] Extracting expense', {
      metadata: { messageLength: userMessage.length },
    })

    try {
      const response = await client.messages.create({
        model: this.config.model!,
        max_tokens: 256,
        temperature: 0.1,
        system: this.config.systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Extrae información de gasto de este mensaje. Si no hay información de gasto, responde "NO_EXPENSE".

Mensaje: "${userMessage}"`,
          },
        ],
      })

      const content = response.content[0]
      if (content?.type === 'text') {
        const text = content.text.trim()

        if (text === 'NO_EXPENSE') {
          return null
        }

        try {
          const expense = JSON.parse(text)
          logger.performance('FinanceAgent.extractExpense', Date.now() - startTime, {
            metadata: { found: true },
          })
          return expense
        } catch {
          logger.warn('FinanceAgent: Could not parse expense JSON', {
            metadata: { text },
          })
          return null
        }
      }

      logger.debug('[FinanceAgent] No expense found', {
        metadata: { duration: Date.now() - startTime },
      })
      return null
    } catch (error: any) {
      logger.error('FinanceAgent extraction error', error, {
        metadata: {
          userMessage: userMessage.slice(0, 100),
          duration: Date.now() - startTime,
        },
      })
      return null
    }
  }
}

/**
 * Create agent instances
 */
export function createProactiveAgent() {
  return new ProactiveAgent()
}

export function createSchedulingAgent() {
  return new SchedulingAgent()
}

export function createFinanceAgent() {
  return new FinanceAgent()
}
