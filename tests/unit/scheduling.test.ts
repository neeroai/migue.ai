import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { scheduleMeetingFromIntent } from '../../lib/scheduling'
import { chatCompletion } from '../../lib/openai'
import { createCalendarEventForUser } from '../../lib/google-calendar'

jest.mock('../../lib/openai', () => ({
  chatCompletion: jest.fn(),
}))

jest.mock('../../lib/google-calendar', () => ({
  createCalendarEventForUser: jest.fn(),
}))

type Mocked<T> = jest.MockedFunction<T>

const mockedChatCompletion = chatCompletion as Mocked<typeof chatCompletion>
const mockedCreateEvent = createCalendarEventForUser as Mocked<typeof createCalendarEventForUser>

describe('scheduleMeetingFromIntent', () => {
  beforeEach(() => {
    mockedChatCompletion.mockReset()
    mockedCreateEvent.mockReset()
  })

  it('schedules a meeting when extraction is ready', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        ready: true,
        summary: 'Reunión de seguimiento',
        start_iso: '2025-10-05T15:00:00-05:00',
        end_iso: '2025-10-05T15:30:00-05:00',
        timezone: 'America/Mexico_City',
      })
    )
    mockedCreateEvent.mockResolvedValueOnce({
      provider: 'google',
      externalId: 'event-123',
      start: '2025-10-05T15:00:00-05:00',
      end: '2025-10-05T15:30:00-05:00',
    })

    const result = await scheduleMeetingFromIntent({
      userId: 'user-1',
      userMessage: 'Agenda una reunión el 5 de octubre a las 3pm',
    })

    expect(result.status).toBe('scheduled')
    expect(result.reply).toContain('Reservé')
    expect(mockedCreateEvent).toHaveBeenCalledWith('user-1', expect.objectContaining({
      summary: 'Reunión de seguimiento',
    }))
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
    expect(mockedCreateEvent).not.toHaveBeenCalled()
  })

  it('returns credential error message when calendar is not connected', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        ready: true,
        summary: 'Sync',
        start_iso: '2025-10-06T09:00:00-05:00',
        end_iso: '2025-10-06T09:30:00-05:00',
        timezone: 'America/Mexico_City',
      })
    )
    mockedCreateEvent.mockRejectedValueOnce(new Error('Missing Google Calendar credential for user user-3'))
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const result = await scheduleMeetingFromIntent({
      userId: 'user-3',
      userMessage: 'Agenda con Pedro mañana a las 9am',
    })

    expect(result.status).toBe('error')
    expect(result.reply).toContain('conectes tu Google Calendar')
    consoleSpy.mockRestore()
  })

  it('handles unexpected errors gracefully', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        ready: true,
        summary: 'Demo',
        start_iso: '2025-10-07T10:00:00-05:00',
        end_iso: '2025-10-07T11:00:00-05:00',
        timezone: 'America/Mexico_City',
      })
    )
    mockedCreateEvent.mockRejectedValueOnce(new Error('500'))
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const result = await scheduleMeetingFromIntent({
      userId: 'user-4',
      userMessage: 'Agenda la demo el 7 a las 10',
    })

    expect(result.status).toBe('error')
    expect(result.reply).toContain('error interno')
    consoleSpy.mockRestore()
  })
})
