import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { scheduleMeetingFromIntent } from '../../lib/scheduling'
import { chatCompletion } from '../../lib/openai'

jest.mock('../../lib/openai', () => ({
  chatCompletion: jest.fn(),
}))

type Mocked<T> = jest.MockedFunction<T>

const mockedChatCompletion = chatCompletion as Mocked<typeof chatCompletion>

describe('scheduleMeetingFromIntent', () => {
  beforeEach(() => {
    mockedChatCompletion.mockReset()
  })

  it('extracts meeting details when ready', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        ready: true,
        summary: 'Reunión de seguimiento',
        start_iso: '2025-10-05T15:00:00-05:00',
        end_iso: '2025-10-05T15:30:00-05:00',
        timezone: 'America/Bogota',
      })
    )

    const result = await scheduleMeetingFromIntent({
      userId: 'user-1',
      userMessage: 'Agenda una reunión el 5 de octubre a las 3pm',
    })

    expect(result.status).toBe('scheduled')
    expect(result.reply).toContain('¡Listo! Anoté')
    expect(result.reply).toContain('Reunión de seguimiento')
  })

  it('asks for missing data when extraction not ready', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({ ready: false, missing: ['fecha', 'hora'] })
    )

    const result = await scheduleMeetingFromIntent({
      userId: 'user-2',
      userMessage: 'Agenda con Laura',
    })

    expect(result.status).toBe('needs_clarification')
    expect(result.reply).toContain('fecha')
  })

  it('handles extraction errors gracefully', async () => {
    mockedChatCompletion.mockRejectedValueOnce(new Error('API Error'))

    const result = await scheduleMeetingFromIntent({
      userId: 'user-3',
      userMessage: 'Agenda reunión',
    })

    expect(result.status).toBe('error')
    expect(result.reply).toContain('No pude procesar')
  })

  it('handles invalid JSON response', async () => {
    mockedChatCompletion.mockResolvedValueOnce('invalid json')

    const result = await scheduleMeetingFromIntent({
      userId: 'user-4',
      userMessage: 'Agenda la demo',
    })

    expect(result.status).toBe('error')
    expect(result.reply).toContain('No pude procesar')
  })
})
