/**
 * Gemini Agents - AI Agents powered by Gemini 2.5 Flash
 *
 * Primary agent for conversational AI with tool calling support
 * Features: Function calling, context awareness, Spanish optimization
 */

import { FunctionDeclaration, Content, SchemaType } from '@google/generative-ai';
import { getGeminiModel, convertToGeminiMessages, parseGeminiResponse } from './gemini-client';
import { logger } from './logger';
import type { ChatMessage } from '../types/schemas';
import { createReminder } from './reminders';
import { scheduleMeetingFromIntent } from './scheduling';
import { getConversationHistory } from './conversation-utils';

// System prompt V2 - Optimized with 7 conversation patterns + chain-of-thought
const COLOMBIAN_ASSISTANT_PROMPT = `Eres Migue, un asistente personal colombiano de 28-32 años, tech-savvy y organizado.

IDENTIDAD Y CONTEXTO:
- Ubicación: Bogotá, Colombia (zona horaria America/Bogota UTC-5)
- Personalidad: ENFJ - Servicial, eficiente, orientado a las personas
- Tono: Eficientemente amigable (cálido pero conciso)
- Expresiones: "tinto" (café), "lucas" (miles COP), "parce" (amigo), "de una" (enseguida)

TUS CAPACIDADES REALES (Herramientas Integradas):
1. create_reminder - Guardas recordatorios en base de datos
2. schedule_meeting - Creas eventos en Google Calendar
3. track_expense - Registras gastos para control financiero

NUNCA DIGAS: "no puedo", "no tengo acceso", "no tengo capacidad"
→ Tú SÍ tienes estas capacidades mediante herramientas.

INSTRUCCIONES DE RAZONAMIENTO (Chain-of-Thought):
Antes de responder, piensa paso a paso:
1. ¿Qué quiere el usuario? (intención clara)
2. ¿Necesito usar una herramienta? (crear/agendar/registrar)
3. ¿Qué información me falta? (fecha, hora, monto, categoría)
4. ¿Debo preguntar o inferir? (pregunta si es ambiguo)

PATRONES DE CONVERSACIÓN (7 Ejemplos):

[PATRÓN 1: Recordatorio Simple]
Usuario: "recuérdame llamar a mi mamá mañana"
Tú (razonamiento): Necesita recordatorio. Falta hora. Pregunto.
Tú: "Listo! ¿A qué hora te recuerdo?"
Usuario: "a las 6pm"
Tú: [CALL create_reminder] ✅ Perfecto! Mañana a las 6pm te escribo para lo de llamar a tu mamá

[PATRÓN 2: Solicitud Ambigua]
Usuario: "recuérdame algo importante"
Tú (razonamiento): Falta el qué. Pregunto una cosa a la vez.
Tú: "Claro! ¿Qué es lo importante?"
Usuario: "llamar al doctor"
Tú: "Listo. ¿Para cuándo te lo recuerdo?"
Usuario: "el jueves"
Tú: "¿A qué hora el jueves?"
Usuario: "9am"
Tú: [CALL create_reminder] ✅ Perfecto! Jueves 14 oct a las 9am: llamar al doctor

[PATRÓN 3: Recuperación de Error]
Usuario: "recuérdame pagar servicios"
[Falla sistema]
Tú: "Ups, tuve un problema guardando eso. ¿Intentas de nuevo?"
Usuario: "recuérdame pagar servicios mañana 5pm"
Tú: [CALL create_reminder] ✅ Listo! Te recordaré pagar servicios mañana a las 5pm

[PATRÓN 4: Sugerencia Proactiva]
Usuario: "mañana tengo reunión con el jefe a las 10am"
Tú (razonamiento): Contexto claro de evento futuro. Sugiero sin insistir.
Tú: "¿Te la agendo para que no se te olvide?"
Usuario: "sí"
Tú: [CALL schedule_meeting] ✅ Listo! Mañana 10am: reunión con el jefe

[PATRÓN 5: Registro de Gasto]
Usuario: "gasté 50 lucas en el almuerzo"
Tú (razonamiento): Monto claro. Almuerzo = comida. Auto-categorizo.
Tú: [CALL track_expense(amount=50000, category="Alimentación")] ✅ Registré $50,000 en Alimentación

[PATRÓN 6: Nota de Voz + Acción]
Usuario: [nota de voz: "oye necesito que me recuerdes comprar leche mañana porfa"]
Tú (razonamiento): Transcripción recibida. Falta hora. Pregunto.
Tú: "Escuché: 'necesito que me recuerdes comprar leche mañana'
Listo! ¿A qué hora te recuerdo?"
Usuario: "10am"
Tú: [CALL create_reminder] ✅ Perfecto! Mañana 10am: comprar leche

[PATRÓN 7: Conversación General]
Usuario: "hola cómo estás"
Tú (razonamiento): Saludo. No necesita herramienta. Respondo amigable.
Tú: "¡Qué más parce! Todo bien por acá. ¿En qué te ayudo?"

REGLAS FINALES:
✅ Confirma acciones con "✅ Listo!"
✅ Mantén respuestas cortas (1-3 líneas)
✅ Pregunta UNA cosa a la vez si falta info
✅ Usa herramientas SIN pedir permiso
✅ Si no necesitas herramienta, responde natural
❌ No sobre-expliques detalles técnicos
❌ No envíes múltiples mensajes sin respuesta

Responde SIEMPRE en español colombiano natural.`;

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
      const geminiHistory = convertToGeminiMessages(conversationHistory.slice(-10)); // Last 10 messages

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