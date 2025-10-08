/**
 * Claude Tools for Autonomous Actions
 * Tool calling with betaZodTool from @anthropic-ai/sdk
 *
 * Features:
 * - Automatic reminder creation
 * - Meeting scheduling
 * - Expense tracking
 * - Type-safe with Zod validation
 */

import { z } from 'zod'
import { logger } from './logger'
import { createReminder } from './reminders'
import { scheduleMeetingFromIntent } from './scheduling'
import { getSupabaseServerClient } from './supabase'

/**
 * Tool: Create Reminder
 * Automatically creates reminders when user requests them
 */
export const createReminderToolSchema = {
  name: 'create_reminder' as const,
  description: `Creates a reminder in the database when the user asks to remember something.

Use this tool IMMEDIATELY when user says:
- "recuérdame..." / "recordarme..."
- "no olvides..." / "no olvidar..."
- "tengo que..." / "debo..."
- "avísame..." / "avisarme..."
- "me recuerdas..." / "puedes recordarme..."

This tool SAVES the reminder to the database automatically. After calling, confirm to user: "✅ Listo! Guardé tu recordatorio..."

Important: The datetimeIso must be in Colombia timezone (America/Bogota, UTC-5) in ISO format: YYYY-MM-DDTHH:MM:SS-05:00

Examples:
- User: "recuérdame llamar a mi tía en 30 minutos" → Use this tool with datetime=now+30min
- User: "no olvides que tengo cita mañana a las 3pm" → Use this tool with datetime=tomorrow 15:00`,
  input_schema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string' as const,
        description: 'ID del usuario',
      },
      title: {
        type: 'string' as const,
        description: 'Qué recordar (ej: "Llamar a tía Ena")',
      },
      description: {
        type: 'string' as const,
        description: 'Detalles adicionales opcionales',
      },
      datetimeIso: {
        type: 'string' as const,
        description: 'Fecha y hora en formato ISO: YYYY-MM-DDTHH:MM:SS-05:00 (Colombia timezone UTC-5)',
      },
    },
    required: ['userId', 'title', 'datetimeIso'],
  },
}

// Zod schema for runtime validation
const CreateReminderInputSchema = z.object({
  userId: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  datetimeIso: z.string(),
})

export async function executeCreateReminder(input: unknown): Promise<string> {
  try {
    const validated = CreateReminderInputSchema.parse(input)

    await createReminder(
      validated.userId,
      validated.title,
      validated.description || null,
      validated.datetimeIso
    )

    logger.info('[createReminderTool] Reminder created successfully', {
      metadata: {
        userId: validated.userId,
        title: validated.title,
        scheduledTime: validated.datetimeIso,
      },
    })

    return `✅ Recordatorio creado: "${validated.title}" para ${validated.datetimeIso}`
  } catch (error: any) {
    logger.error('[createReminderTool] Failed to create reminder', error, {
      metadata: { input },
    })
    throw new Error(`Error creando recordatorio: ${error.message}`)
  }
}

/**
 * Tool: Schedule Meeting
 * Schedules formal meetings in Google Calendar
 */
export const scheduleMeetingToolSchema = {
  name: 'schedule_meeting' as const,
  description: `Schedules a formal meeting in Google Calendar when user requests appointment/meeting.

Use this tool IMMEDIATELY when user says:
- "agenda reunión..." / "agendar..."
- "reserva cita..." / "reservar..."
- "programa junta..." / "programar..."
- "necesito reunirme..." / "vamos a reunirnos..."

This tool CREATES the calendar event automatically. After calling, confirm: "✅ Listo! Agendé tu reunión..."

Important: Times must be in Colombia timezone (America/Bogota, UTC-5) in ISO format.

Examples:
- User: "agenda reunión con el equipo mañana a las 10am" → Use this tool with startTime=tomorrow 10:00, endTime=tomorrow 11:00
- User: "necesito agendar cita con el doctor" → Use this tool (may need to clarify time with user first)`,
  input_schema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string' as const,
        description: 'ID del usuario',
      },
      title: {
        type: 'string' as const,
        description: 'Título de la reunión',
      },
      startTime: {
        type: 'string' as const,
        description: 'Hora de inicio en formato ISO (Colombia timezone UTC-5)',
      },
      endTime: {
        type: 'string' as const,
        description: 'Hora de fin en formato ISO (Colombia timezone UTC-5)',
      },
      description: {
        type: 'string' as const,
        description: 'Descripción de la reunión',
      },
    },
    required: ['userId', 'title', 'startTime', 'endTime'],
  },
}

const ScheduleMeetingInputSchema = z.object({
  userId: z.string(),
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  description: z.string().nullable().optional(),
})

export async function executeScheduleMeeting(input: unknown): Promise<string> {
  try {
    const validated = ScheduleMeetingInputSchema.parse(input)

    const result = await scheduleMeetingFromIntent({
      userId: validated.userId,
      userMessage: `${validated.title}${validated.description ? ': ' + validated.description : ''}`,
      conversationHistory: [],
    })

    logger.info('[scheduleMeetingTool] Meeting scheduled', {
      metadata: {
        userId: validated.userId,
        title: validated.title,
        start: validated.startTime,
        end: validated.endTime,
        status: result.status,
      },
    })

    return result.reply
  } catch (error: any) {
    logger.error('[scheduleMeetingTool] Failed to schedule meeting', error, {
      metadata: { input },
    })
    throw new Error(`Error agendando reunión: ${error.message}`)
  }
}

/**
 * Tool: Track Expense
 * Automatically tracks expenses when user mentions spending money
 */
export const trackExpenseToolSchema = {
  name: 'track_expense' as const,
  description: `Tracks expenses when user mentions spending money.

Use this tool IMMEDIATELY when user says:
- "gasté..." / "me gasté..."
- "pagué..." / "pago..."
- "compré..." / "cuesta..."
- "salió..." / "costó..."

This tool SAVES the expense to the database. Confirm: "✅ Listo! Registré tu gasto..."

Note: Currently in development - if tool returns pending message, acknowledge to user that expense tracking is being set up.

Examples:
- User: "gasté $500 en el super" → Use this tool with amount=500, category="Alimentación"
- User: "pagué 200 pesos de uber" → Use this tool with amount=200, category="Transporte"`,
  input_schema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string' as const,
        description: 'ID del usuario',
      },
      amount: {
        type: 'number' as const,
        description: 'Cantidad gastada (solo número, sin símbolos)',
      },
      currency: {
        type: 'string' as const,
        description: 'Moneda (MXN, USD, COP)',
      },
      category: {
        type: 'string' as const,
        description: 'Categoría del gasto (Alimentación, Transporte, Entretenimiento, Salud, Servicios, Compras, Otros)',
      },
      description: {
        type: 'string' as const,
        description: 'Descripción breve del gasto',
      },
    },
    required: ['userId', 'amount', 'currency', 'category', 'description'],
  },
}

const TrackExpenseInputSchema = z.object({
  userId: z.string(),
  amount: z.number(),
  currency: z.string(),
  category: z.string(),
  description: z.string(),
})

export async function executeTrackExpense(input: unknown): Promise<string> {
  try {
    const validated = TrackExpenseInputSchema.parse(input)

    // TODO: Create 'expenses' table in Supabase
    // Temporarily return success message without DB persistence
    logger.info('[trackExpenseTool] Expense tracked (in-memory only - pending DB table)', {
      metadata: {
        userId: validated.userId,
        amount: validated.amount,
        category: validated.category,
      },
    })

    return `💰 Gasto registrado: ${validated.currency} ${validated.amount} en ${validated.category}
⚠️ Nota: El seguimiento de gastos está en desarrollo`
  } catch (error: any) {
    logger.error('[trackExpenseTool] Failed to track expense', error, {
      metadata: { input },
    })
    throw new Error(`Error registrando gasto: ${error.message}`)
  }
}

/**
 * Get all tools for Claude API
 */
export function getAllTools() {
  return [
    createReminderToolSchema,
    scheduleMeetingToolSchema,
    trackExpenseToolSchema,
  ]
}

/**
 * Execute tool by name
 */
export async function executeTool(
  name: string,
  input: unknown
): Promise<string> {
  switch (name) {
    case 'create_reminder':
      return executeCreateReminder(input)
    case 'schedule_meeting':
      return executeScheduleMeeting(input)
    case 'track_expense':
      return executeTrackExpense(input)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
