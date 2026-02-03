import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { parseReminderRequest, createReminder } from '../../lib/reminders'
import { generateText } from 'ai'
import { getSupabaseServerClient } from '../../lib/supabase'

jest.mock('ai', () => ({
  generateText: jest.fn(),
}))

jest.mock('../../lib/supabase', () => ({
  getSupabaseServerClient: jest.fn(),
}))

const mockedGenerateText = generateText as jest.MockedFunction<typeof generateText>
const mockedInsert = jest.fn() as jest.MockedFunction<
  (args: unknown) => Promise<{ error: Error | null }>
>
const mockedSupabase = {
  from: jest.fn(() => ({ insert: mockedInsert })),
}

describe('parseReminderRequest', () => {
  beforeEach(() => {
    mockedGenerateText.mockReset()
  })

  it('returns ready reminder when extraction succeeds', async () => {
    mockedGenerateText.mockResolvedValueOnce({
      text: JSON.stringify({
        status: 'ready',
        title: 'Llamar a Juan',
        description: 'Confirmar pago',
        datetime_iso: '2025-10-10T15:00:00-05:00',
      }),
    } as any)

    const result = await parseReminderRequest('Recuérdame llamar a Juan el 10 de octubre a las 3pm')

    expect(result).toEqual({
      status: 'ready',
      title: 'Llamar a Juan',
      description: 'Confirmar pago',
      datetimeIso: '2025-10-10T15:00:00-05:00',
    })
  })

  it('returns clarification when missing fields', async () => {
    mockedGenerateText.mockResolvedValueOnce({
      text: JSON.stringify({
        status: 'needs_clarification',
        missing: ['fecha', 'hora'],
        clarification: '¿Cuándo quieres el recordatorio?',
      }),
    } as any)

    const result = await parseReminderRequest('Recuérdame pagar la renta')

    expect(result.status).toBe('needs_clarification')
    if (result.status === 'needs_clarification') {
      expect(result.missing).toContain('fecha')
      expect(result.clarification).toContain('Cuándo')
    }
  })
})

describe('createReminder', () => {
  beforeEach(() => {
    mockedInsert.mockReset()
    mockedSupabase.from.mockImplementation(() => ({ insert: mockedInsert }))
    ;(getSupabaseServerClient as jest.MockedFunction<typeof getSupabaseServerClient>).mockReturnValue(
      mockedSupabase as any
    )
  })

  it('persists reminder to Supabase', async () => {
    mockedInsert.mockResolvedValueOnce({ error: null } as any)

    await createReminder('user-1', 'Llamar', 'Detalles', '2025-10-11T09:30:00-05:00')

    expect(mockedSupabase.from).toHaveBeenCalledWith('reminders')
    expect(mockedInsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      title: 'Llamar',
      description: 'Detalles',
      scheduled_time: '2025-10-11T09:30:00-05:00',
      status: 'pending',
    })
  })

  it('throws when insert fails', async () => {
    mockedInsert.mockResolvedValueOnce({ error: new Error('DB error') } as any)

    await expect(
      createReminder('user-2', 'Revisar', null, '2025-10-12T07:00:00-05:00')
    ).rejects.toThrow('DB error')
  })
})
