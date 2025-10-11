/**
 * Gemini Agents - AI Agents powered by Gemini 2.5 Flash
 *
 * Primary agent for conversational AI with tool calling support
 * Features: Function calling, context awareness, Spanish optimization
 */

import { FunctionDeclaration, Content, SchemaType } from '@google/generative-ai';
import { getGeminiModel, convertToGeminiMessages, parseGeminiResponse, getCachedContext, setCachedContext } from './gemini-client';
import { logger } from './logger';
import type { ChatMessage } from '../types/schemas';
import { createReminder } from './reminders';
import { scheduleMeetingFromIntent } from './scheduling';
import { getConversationHistory } from './conversation-utils';

// System prompt for Colombian Spanish assistant
const COLOMBIAN_ASSISTANT_PROMPT = `Eres Migue, un asistente personal colombiano experto, amigable y eficiente.

CONTEXTO:
- Ubicación: Colombia
- Zona horaria: America/Bogota (UTC-5)
- Moneda: Pesos colombianos (COP)
- Idioma: Español colombiano (informal pero respetuoso)

TU PERSONALIDAD:
- Amigable y servicial, usando expresiones colombianas naturales
- Proactivo: sugieres soluciones sin que te las pidan
- Eficiente: respondes de forma clara y concisa
- Entiendes modismos como "tinto" (café), "lucas" (miles de pesos), "arepa e' huevo"

CAPACIDADES:
Tienes acceso a herramientas para:
1. create_reminder: Crear recordatorios con fecha/hora
2. schedule_meeting: Agendar citas y reuniones
3. track_expense: Registrar gastos y finanzas

INSTRUCCIONES:
- SIEMPRE usa las herramientas cuando el usuario lo solicite
- Detecta intenciones aunque no sean explícitas
- Confirma acciones con "✅ Listo!" cuando uses herramientas
- Si falta información, pregunta de forma natural
- Mantén conversaciones cortas y útiles

EJEMPLOS:
Usuario: "Recuérdame comprar leche mañana"
Tú: [Usas create_reminder] ✅ Listo! Te recordaré comprar leche mañana.

Usuario: "Gasté 50 mil en el almuerzo"
Tú: [Usas track_expense] ✅ Registré tu gasto de $50,000 en almuerzo.`;

/**
 * Tool definitions for Gemini
 */
const createReminderTool: FunctionDeclaration = {
  name: 'create_reminder',
  description: 'Crea un recordatorio para el usuario',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      title: {
        type: SchemaType.STRING,
        description: 'Título del recordatorio'
      },
      datetime: {
        type: SchemaType.STRING,
        description: 'Fecha y hora en formato ISO 8601 (zona horaria America/Bogota)'
      },
      notes: {
        type: SchemaType.STRING,
        description: 'Notas adicionales (opcional)'
      },
      priority: {
        type: SchemaType.STRING,
        description: 'Prioridad del recordatorio'
      }
    },
    required: ['title', 'datetime']
  }
};

const scheduleMeetingTool: FunctionDeclaration = {
  name: 'schedule_meeting',
  description: 'Programa una cita o reunión',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      title: {
        type: SchemaType.STRING,
        description: 'Título de la cita'
      },
      datetime: {
        type: SchemaType.STRING,
        description: 'Fecha y hora en formato ISO 8601'
      },
      duration_minutes: {
        type: SchemaType.NUMBER,
        description: 'Duración en minutos'
      },
      attendees: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: 'Lista de asistentes'
      },
      location: {
        type: SchemaType.STRING,
        description: 'Ubicación o link de videollamada'
      }
    },
    required: ['title', 'datetime', 'duration_minutes']
  }
};

const trackExpenseTool: FunctionDeclaration = {
  name: 'track_expense',
  description: 'Registra un gasto o egreso',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      amount: {
        type: SchemaType.NUMBER,
        description: 'Monto del gasto'
      },
      currency: {
        type: SchemaType.STRING,
        description: 'Moneda (por defecto COP)'
      },
      category: {
        type: SchemaType.STRING,
        description: 'Categoría del gasto'
      },
      description: {
        type: SchemaType.STRING,
        description: 'Descripción del gasto'
      },
      date: {
        type: SchemaType.STRING,
        description: 'Fecha del gasto en formato ISO 8601'
      }
    },
    required: ['amount', 'category', 'description']
  }
};

/**
 * Execute tool calls
 */
async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<string> {
  try {
    switch (name) {
      case 'create_reminder': {
        try {
          await createReminder(
            userId,
            args.title as string,
            args.notes as string | null || null,
            args.datetime as string
          );
          return `✅ Listo! Guardé tu recordatorio "${args.title}" para ${new Date(args.datetime as string).toLocaleString('es-CO')}`;
        } catch (error) {
          logger.error('[gemini-agent] Failed to create reminder', error instanceof Error ? error : new Error(String(error)));
          return 'No pude crear el recordatorio. Intenta de nuevo.';
        }
      }

      case 'schedule_meeting': {
        // Build a descriptive message from the args
        const meetingDescription = `Agendar ${args.title} para ${args.datetime} con duración de ${args.duration_minutes} minutos${
          args.location ? ` en ${args.location}` : ''
        }${args.attendees ? ` con ${(args.attendees as string[]).join(', ')}` : ''}`;

        const result = await scheduleMeetingFromIntent({
          userId,
          userMessage: meetingDescription,
          conversationHistory: [],
          fallbackTimeZone: 'America/Bogota'
        });

        if (result.status === 'scheduled') {
          return `✅ Agendé tu cita "${args.title}" para ${new Date(args.datetime as string).toLocaleString('es-CO')}`;
        }
        return 'No pude agendar la cita. Intenta de nuevo.';
      }

      case 'track_expense': {
        // TODO: Implement expense tracking when database table is ready
        logger.info('[gemini-agent] Expense tracking called', {
          metadata: {
            userId,
            amount: args.amount,
            category: args.category,
            description: args.description
          }
        });

        // For now, just acknowledge the request
        return `✅ Registré tu gasto de $${(args.amount as number).toLocaleString('es-CO')} en ${args.category}`;
      }

      default:
        logger.warn('[gemini-agent] Unknown tool call', { metadata: { name, args } });
        return 'No reconozco esa acción.';
    }
  } catch (error) {
    logger.error('[gemini-agent] Tool execution failed', error instanceof Error ? error : new Error(String(error)));
    return 'Hubo un error al ejecutar esa acción. Intenta de nuevo.';
  }
}

/**
 * Gemini Proactive Agent - Main conversational assistant
 */
export class GeminiProactiveAgent {
  private tools = [createReminderTool, scheduleMeetingTool, trackExpenseTool];
  private maxIterations = 5;

  async respond(
    userMessage: string,
    userId: string,
    conversationHistory: ChatMessage[]
  ): Promise<string> {
    const startTime = Date.now();

    try {
      logger.info('[gemini-agent] Processing message', {
        metadata: { userId, messageLength: userMessage.length }
      });

      // Convert conversation history to Gemini format
      const historyKey = `user_${userId}_history`;
      let geminiHistory = await getCachedContext(historyKey);

      if (!geminiHistory) {
        geminiHistory = convertToGeminiMessages(conversationHistory.slice(-10)); // Last 10 messages
        await setCachedContext(historyKey, geminiHistory);
      }

      // Get model with system prompt (temperature = 0 for deterministic function calling)
      const model = getGeminiModel('gemini-2.5-flash-lite', COLOMBIAN_ASSISTANT_PROMPT, { useToolCalling: true });

      // Start chat with history and tools
      const chat = model.startChat({
        history: geminiHistory,
        tools: [{ functionDeclarations: this.tools }]
      });

      // Send user message
      const result = await chat.sendMessage(userMessage);
      const parsed = parseGeminiResponse(result);

      // Handle tool calling loop
      let finalResponse = parsed.text;
      let iterations = 0;

      // If there are function calls, execute them
      if (parsed.functionCalls && parsed.functionCalls.length > 0) {
        const toolResults: string[] = [];

        for (const call of parsed.functionCalls) {
          logger.info('[gemini-agent] Executing tool', {
            metadata: { tool: call.name, args: call.args }
          });

          const toolResult = await executeToolCall(call.name, call.args, userId);
          toolResults.push(toolResult);

          iterations++;
          if (iterations >= this.maxIterations) {
            logger.warn('[gemini-agent] Max iterations reached');
            break;
          }
        }

        // Combine tool results with original response
        if (toolResults.length > 0) {
          finalResponse = toolResults.join('\n');
        }
      }

      // Log performance
      const latency = Date.now() - startTime;
      logger.info('[gemini-agent] Response generated', {
        metadata: {
          userId,
          latency,
          toolsUsed: parsed.functionCalls?.length || 0,
          responseLength: finalResponse.length,
          model: 'gemini-2.5-flash-lite'
        }
      });

      return finalResponse;

    } catch (error) {
      logger.error('[gemini-agent] Failed to generate response', error instanceof Error ? error : new Error(String(error)));

      // Return friendly error message
      return 'Disculpa, tuve un problema al procesar tu mensaje. ¿Podrías intentarlo de nuevo?';
    }
  }

  /**
   * Generate a proactive follow-up message
   */
  async generateFollowUp(
    userId: string,
    conversationHistory: ChatMessage[]
  ): Promise<string | null> {
    try {
      const lastMessages = conversationHistory.slice(-5);
      const context = lastMessages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const prompt = `Basándote en esta conversación reciente, genera UN mensaje proactivo corto y útil para el usuario.

Conversación:
${context}

Genera un mensaje que:
- Sea relevante al contexto
- Ofrezca ayuda específica
- Use tono colombiano amigable
- Sea máximo 1-2 líneas

Si no hay nada relevante que agregar, responde con "null".`;

      const model = getGeminiModel('gemini-2.5-flash-lite');
      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();

      if (response === 'null' || !response) {
        return null;
      }

      logger.info('[gemini-agent] Follow-up generated', {
        metadata: { userId, message: response }
      });

      return response;

    } catch (error) {
      logger.error('[gemini-agent] Failed to generate follow-up', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Analyze user intent for routing
   */
  async analyzeIntent(message: string): Promise<{
    intent: 'reminder' | 'meeting' | 'expense' | 'general';
    confidence: number;
  }> {
    try {
      const prompt = `Analiza el siguiente mensaje y determina la intención principal:

Mensaje: "${message}"

Intenciones posibles:
- reminder: Crear recordatorio o alarma
- meeting: Agendar cita o reunión
- expense: Registrar gasto o finanzas
- general: Conversación general

Responde SOLO con el formato JSON:
{"intent": "xxx", "confidence": 0.X}`;

      const model = getGeminiModel('gemini-2.5-flash-lite');
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Parse JSON response
      const match = text.match(/\{.*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          intent: parsed.intent || 'general',
          confidence: parsed.confidence || 0.5
        };
      }

      return { intent: 'general', confidence: 0.5 };

    } catch (error) {
      logger.error('[gemini-agent] Intent analysis failed', error instanceof Error ? error : new Error(String(error)));
      return { intent: 'general', confidence: 0.5 };
    }
  }
}

/**
 * Factory function to create agent instance
 */
export function createGeminiProactiveAgent(): GeminiProactiveAgent {
  return new GeminiProactiveAgent();
}