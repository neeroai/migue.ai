import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import {
  executeCreateReminder,
  executeScheduleMeeting,
  executeTrackExpense,
  executeTool,
} from '../../lib/claude-tools'
import { createReminder } from '../../lib/reminders'
import { scheduleMeetingFromIntent } from '../../lib/scheduling'
import { getSupabaseServerClient } from '../../lib/supabase'

jest.mock('../../lib/reminders', () => ({
  createReminder: jest.fn(),
}))

jest.mock('../../lib/scheduling', () => ({
  scheduleMeetingFromIntent: jest.fn(),
}))

jest.mock('../../lib/supabase', () => ({
  getSupabaseServerClient: jest.fn(),
}))

const mockedCreateReminder = createReminder as jest.MockedFunction<typeof createReminder>
const mockedScheduleMeetingFromIntent = scheduleMeetingFromIntent as jest.MockedFunction<
  typeof scheduleMeetingFromIntent
>
const mockedInsert = jest.fn()
const mockedSupabase = {
  from: jest.fn(() => ({ insert: mockedInsert })),
}

describe('Claude Tools', () => {
  beforeEach(() => {
    mockedCreateReminder.mockReset()
    mockedScheduleMeetingFromIntent.mockReset()
    mockedInsert.mockReset()
    ;(getSupabaseServerClient as jest.MockedFunction<typeof getSupabaseServerClient>).mockReturnValue(
      mockedSupabase as any
    )
  })

  describe('executeCreateReminder', () => {
    it('creates reminder with valid input', async () => {
      mockedCreateReminder.mockResolvedValueOnce(undefined)

      const input = {
        userId: 'test-user-123',
        title: 'Llamar a tía Ena',
        description: 'Cumpleaños',
        datetimeIso: '2025-10-14T15:00:00-06:00',
      }

      const result = await executeCreateReminder(input)

      expect(mockedCreateReminder).toHaveBeenCalledWith(
        'test-user-123',
        'Llamar a tía Ena',
        'Cumpleaños',
        '2025-10-14T15:00:00-06:00'
      )
      expect(result).toContain('✅ Recordatorio creado')
      expect(result).toContain('Llamar a tía Ena')
      expect(result).toContain('2025-10-14T15:00:00-06:00')
    })

    it('creates reminder without description', async () => {
      mockedCreateReminder.mockResolvedValueOnce(undefined)

      const input = {
        userId: 'test-user-123',
        title: 'Llamar al doctor',
        datetimeIso: '2025-10-15T10:00:00-06:00',
      }

      const result = await executeCreateReminder(input)

      expect(mockedCreateReminder).toHaveBeenCalledWith(
        'test-user-123',
        'Llamar al doctor',
        null,
        '2025-10-15T10:00:00-06:00'
      )
      expect(result).toContain('✅ Recordatorio creado')
    })

    it('throws error on invalid input', async () => {
      const input = {
        // Missing userId
        title: 'Test',
        datetimeIso: '2025-10-14T15:00:00-06:00',
      }

      await expect(executeCreateReminder(input)).rejects.toThrow()
    })

    it('handles database errors', async () => {
      mockedCreateReminder.mockRejectedValueOnce(new Error('Database error'))

      const input = {
        userId: 'test-user-123',
        title: 'Test reminder',
        datetimeIso: '2025-10-14T15:00:00-06:00',
      }

      await expect(executeCreateReminder(input)).rejects.toThrow('Error creando recordatorio')
    })
  })

  describe('executeScheduleMeeting', () => {
    it('schedules meeting with valid input', async () => {
      mockedScheduleMeetingFromIntent.mockResolvedValueOnce({
        status: 'scheduled',
        reply: '✅ Reunión agendada para el 14 de octubre a las 3pm',
        start: '2025-10-14T15:00:00-06:00',
        end: '2025-10-14T16:00:00-06:00',
      })

      const input = {
        userId: 'test-user-123',
        title: 'Reunión con equipo',
        startTime: '2025-10-14T15:00:00-06:00',
        endTime: '2025-10-14T16:00:00-06:00',
        description: 'Discutir proyecto',
      }

      const result = await executeScheduleMeeting(input)

      expect(mockedScheduleMeetingFromIntent).toHaveBeenCalledWith({
        userId: 'test-user-123',
        userMessage: 'Reunión con equipo: Discutir proyecto',
        conversationHistory: [],
      })
      expect(result).toContain('✅ Reunión agendada')
    })

    it('schedules meeting without description', async () => {
      mockedScheduleMeetingFromIntent.mockResolvedValueOnce({
        status: 'scheduled',
        reply: '✅ Reunión agendada',
        start: '2025-10-14T15:00:00-06:00',
        end: '2025-10-14T16:00:00-06:00',
      })

      const input = {
        userId: 'test-user-123',
        title: 'Llamada rápida',
        startTime: '2025-10-14T15:00:00-06:00',
        endTime: '2025-10-14T15:30:00-06:00',
      }

      const result = await executeScheduleMeeting(input)

      expect(mockedScheduleMeetingFromIntent).toHaveBeenCalledWith({
        userId: 'test-user-123',
        userMessage: 'Llamada rápida',
        conversationHistory: [],
      })
      expect(result).toContain('✅ Reunión agendada')
    })

    it('throws error on invalid input', async () => {
      const input = {
        userId: 'test-user-123',
        // Missing title and times
      }

      await expect(executeScheduleMeeting(input)).rejects.toThrow()
    })
  })

  describe('executeTrackExpense', () => {
    it('tracks expense with valid input (in-memory, pending DB)', async () => {
      const input = {
        userId: 'test-user-123',
        amount: 150.5,
        currency: 'MXN',
        category: 'Alimentación',
        description: 'Comida con amigos',
      }

      const result = await executeTrackExpense(input)

      // TODO: Remove this test update when 'expenses' table is created
      expect(result).toContain('💰 Gasto registrado')
      expect(result).toContain('MXN 150.5')
      expect(result).toContain('Alimentación')
      expect(result).toContain('en desarrollo') // Temporary message
    })

    it('tracks expense without database persistence', async () => {
      const input = {
        userId: 'test-user-123',
        amount: 100,
        currency: 'USD',
        category: 'Transporte',
        description: 'Uber',
      }

      const result = await executeTrackExpense(input)

      // Temporarily returns success message without DB errors
      expect(result).toContain('💰 Gasto registrado')
      expect(result).toContain('USD 100')
    })

    it('throws error on invalid input', async () => {
      const input = {
        userId: 'test-user-123',
        amount: 'invalid', // Should be number
        currency: 'MXN',
        category: 'Test',
        description: 'Test',
      }

      await expect(executeTrackExpense(input)).rejects.toThrow()
    })
  })

  describe('executeTool', () => {
    it('executes create_reminder tool', async () => {
      mockedCreateReminder.mockResolvedValueOnce(undefined)

      const result = await executeTool('create_reminder', {
        userId: 'test-user',
        title: 'Test',
        datetimeIso: '2025-10-14T15:00:00-06:00',
      })

      expect(result).toContain('✅ Recordatorio creado')
    })

    it('executes schedule_meeting tool', async () => {
      mockedScheduleMeetingFromIntent.mockResolvedValueOnce({
        status: 'scheduled',
        reply: '✅ Reunión agendada',
        start: '2025-10-14T15:00:00-06:00',
        end: '2025-10-14T16:00:00-06:00',
      })

      const result = await executeTool('schedule_meeting', {
        userId: 'test-user',
        title: 'Test meeting',
        startTime: '2025-10-14T15:00:00-06:00',
        endTime: '2025-10-14T16:00:00-06:00',
      })

      expect(result).toContain('✅ Reunión agendada')
    })

    it('executes track_expense tool', async () => {
      mockedInsert.mockResolvedValueOnce({ error: null })

      const result = await executeTool('track_expense', {
        userId: 'test-user',
        amount: 50,
        currency: 'MXN',
        category: 'Test',
        description: 'Test expense',
      })

      expect(result).toContain('💰 Gasto registrado')
    })

    it('throws error for unknown tool', async () => {
      await expect(executeTool('unknown_tool', {})).rejects.toThrow('Unknown tool: unknown_tool')
    })
  })
})
