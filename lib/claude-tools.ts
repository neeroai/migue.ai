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
  description: 'Crea recordatorios automáticamente cuando el usuario lo solicita. Usa esto cuando el usuario dice "recuérdame", "no olvides", "tengo que...", etc.',
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
        description: 'Fecha y hora en formato ISO: YYYY-MM-DDTHH:MM:SS-06:00',
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
  description: 'Agenda reuniones formales en Google Calendar cuando el usuario solicita una reunión, junta o cita formal.',
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
        description: 'Hora de inicio en formato ISO',
      },
      endTime: {
        type: 'string' as const,
        description: 'Hora de fin en formato ISO',
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
  description: 'Registra gastos automáticamente cuando el usuario menciona haber gastado dinero.',
  input_schema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string' as const,
        description: 'ID del usuario',
      },
      amount: {
        type: 'number' as const,
        description: 'Cantidad gastada',
      },
      currency: {
        type: 'string' as const,
        description: 'Moneda (ej: MXN, USD)',
      },
      category: {
        type: 'string' as const,
        description: 'Categoría del gasto (Alimentación, Transporte, Entretenimiento, Salud, Servicios, Compras, Otros)',
      },
      description: {
        type: 'string' as const,
        description: 'Descripción del gasto',
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
