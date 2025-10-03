import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { parseReminderRequest, createReminder } from '../../lib/reminders'
import { chatCompletion } from '../../lib/openai'
import { getSupabaseServerClient } from '../../lib/supabase'

jest.mock('../../lib/openai', () => ({
  chatCompletion: jest.fn(),
}))

jest.mock('../../lib/supabase', () => ({
  getSupabaseServerClient: jest.fn(),
}))

const mockedChatCompletion = chatCompletion as jest.MockedFunction<typeof chatCompletion>
const mockedInsert = jest.fn()
const mockedSupabase = {
  from: jest.fn(() => ({ insert: mockedInsert })),
}

describe('parseReminderRequest', () => {
  beforeEach(() => {
    mockedChatCompletion.mockReset()
  })

  it('returns ready reminder when extraction succeeds', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        title: 'Llamar a Juan',
        description: 'Confirmar pago',
        datetime_iso: '2025-10-10T15:00:00-05:00',
      })
    )

    const result = await parseReminderRequest('Recuérdame llamar a Juan el 10 de octubre a las 3pm')

    expect(result).toEqual({
      status: 'ready',
      title: 'Llamar a Juan',
      description: 'Confirmar pago',
      datetimeIso: '2025-10-10T15:00:00-05:00',
    })
  })

  it('returns clarification when missing fields', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({ missing: ['fecha', 'hora'], clarification: '¿Cuándo quieres el recordatorio?' })
    )

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
    mockedInsert.mockResolvedValueOnce({ error: null })

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
    mockedInsert.mockResolvedValueOnce({ error: new Error('DB error') })

    await expect(
      createReminder('user-2', 'Revisar', null, '2025-10-12T07:00:00-05:00')
    ).rejects.toThrow('DB error')
  })
})
