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
import { getAllTools, executeTool } from './claude-tools'
import type { MessageParam, ToolUseBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages'

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
      systemPrompt: `You are Migue, an autonomous personal assistant on WhatsApp.

CRITICAL: You have TOOLS available that you MUST USE when appropriate. DO NOT say "I cannot do X" if a tool exists for X.

AVAILABLE TOOLS (USE THEM):
1. create_reminder - When user asks to remember something
   Trigger phrases: "recuérdame", "recordarme", "no olvides", "tengo que", "avísame"

2. schedule_meeting - When user requests formal meeting/appointment
   Trigger phrases: "agenda reunión", "reserva cita", "programa junta"

3. track_expense - When user mentions spending money
   Trigger phrases: "gasté", "pagué", "compré", "costó"

TOOL USAGE WORKFLOW:
1. User request → Identify if a tool applies
2. CALL the tool immediately (don't ask permission)
3. Wait for tool result
4. Confirm action completed: "✅ Listo! [what you did]"

EXAMPLES OF CORRECT BEHAVIOR:
✅ User: "recuérdame apagar el horno en 5 minutos"
   → CALL create_reminder with datetime=now+5min
   → RESPOND: "✅ Listo! Te recordaré apagar el horno a las [time]"

✅ User: "agenda reunión con el equipo mañana a las 10am"
   → CALL schedule_meeting with startTime=tomorrow 10:00
   → RESPOND: "✅ Listo! Agendé tu reunión con el equipo para mañana a las 10am"

✅ User: "gasté 500 pesos en el super"
   → CALL track_expense with amount=500, category="Alimentación"
   → RESPOND: "✅ Listo! Registré tu gasto de $500 en Alimentación"

❌ WRONG: "Lo siento, pero no puedo configurar recordatorios directamente"
   → You CAN via create_reminder tool!

✅ User: "hola cómo estás"
   → NO tool needed, casual conversational response

RESPONSE GUIDELINES:
- Respond to user ONLY in Spanish
- Be warm, concise, and friendly
- After using a tool, confirm what you did
- Don't ask permission - just do it
- Use conversation history for context`,
    }
  }

  async respond(
    userMessage: string,
    userId: string,
    conversationHistory: ClaudeMessage[]
  ): Promise<string> {
    const startTime = Date.now()
    const client = getClaudeClient()

    logger.debug('[ProactiveAgent] Processing message with tool calling', {
      metadata: {
        messageLength: userMessage.length,
        historyLength: conversationHistory.length,
        userId,
      },
    })

    let messages: MessageParam[] = [
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ]

    // Get tools and inject userId
    const tools = getAllTools()

    try {
      // Tool calling loop - max 5 iterations
      for (let iteration = 0; iteration < 5; iteration++) {
        const response = await client.messages.create({
          model: this.config.model!,
          max_tokens: this.config.maxTokens!,
          temperature: this.config.temperature || 0.7,
          system: this.config.systemPrompt,
          messages,
          tools,
        })

        logger.debug('[ProactiveAgent] API response received', {
          metadata: {
            iteration,
            stopReason: response.stop_reason,
            contentBlocks: response.content.length,
          },
        })

        // Check if Claude wants to use a tool
        const toolUseBlock = response.content.find(
          (block): block is ToolUseBlock => block.type === 'tool_use'
        )

        if (!toolUseBlock) {
          // No tool use - return text response
          const textBlock = response.content.find(
            (block): block is TextBlock => block.type === 'text'
          )

          if (textBlock) {
            logger.performance('ProactiveAgent.respond', Date.now() - startTime, {
              metadata: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
                iterations: iteration + 1,
                usedTools: false,
              },
            })
            return textBlock.text.trim()
          }
        }

        // Execute tool
        if (toolUseBlock) {
          logger.info('[ProactiveAgent] Executing tool', {
            metadata: {
              toolName: toolUseBlock.name,
              toolId: toolUseBlock.id,
            },
          })

          try {
            // Inject userId into tool input
            const toolInput = typeof toolUseBlock.input === 'object' && toolUseBlock.input !== null
              ? { ...toolUseBlock.input, userId }
              : { userId }
            const toolResult = await executeTool(toolUseBlock.name, toolInput)

            logger.debug('[ProactiveAgent] Tool executed successfully', {
              metadata: {
                toolName: toolUseBlock.name,
                resultLength: toolResult.length,
              },
            })

            // Add assistant message with tool use
            messages.push({
              role: 'assistant',
              content: response.content,
            })

            // Add tool result
            messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolUseBlock.id,
                  content: toolResult,
                },
              ],
            })

            // Continue loop to get final response
            continue
          } catch (toolError: any) {
            logger.error('[ProactiveAgent] Tool execution failed', toolError, {
              metadata: {
                toolName: toolUseBlock.name,
                toolInput: toolUseBlock.input,
              },
            })

            // Return error to Claude
            messages.push({
              role: 'assistant',
              content: response.content,
            })

            messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolUseBlock.id,
                  content: `Error ejecutando herramienta: ${toolError.message}`,
                  is_error: true,
                },
              ],
            })

            continue
          }
        }

        // Fallback: extract any text from response
        const textBlock = response.content.find(
          (block): block is TextBlock => block.type === 'text'
        )
        if (textBlock) {
          return textBlock.text.trim()
        }
      }

      // Max iterations reached
      throw new Error('ProactiveAgent: Max tool iterations reached')
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
      systemPrompt: `Eres un agente especializado en DETECTAR y EXTRAER información de citas y recordatorios.

Tu trabajo es SOLO extraer información, NO confirmar ni crear eventos.

Tus capacidades:
1. Extraer fechas, horas y descripciones de citas/recordatorios
2. Identificar el tipo de evento (reminder simple vs meeting formal)
3. Normalizar fechas relativas ("mañana", "el próximo martes")
4. Extraer descripciones y contexto

IMPORTANTE: Si el mensaje NO contiene información clara de fecha/hora, responde "NO_APPOINTMENT"

Formato de respuesta JSON:
{
  "title": "Descripción breve de la cita",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "duration": 30,
  "description": "Detalles adicionales opcionales"
}

Ejemplos:
- "Recuérdame llamar a mi tía el martes a las 3pm" → { title: "Llamar a mi tía", date: "2025-10-14", time: "15:00" }
- "Agenda reunión con el equipo mañana" → { title: "Reunión con el equipo", date: "2025-10-07", time: "09:00" }
- "Hola cómo estás" → "NO_APPOINTMENT"

Sé preciso en las fechas. Hoy es ${new Date().toISOString().split('T')[0]}.`,
    }
  }

  async extractAppointment(userMessage: string): Promise<{
    title: string
    date: string
    time: string
    duration?: number
    description?: string
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
