import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { createCalendarEventForUser } from '../../lib/google-calendar'
import {
  fetchCalendarCredential,
  updateAccessToken,
  recordCalendarEvent,
} from '../../lib/calendar-store'

jest.mock('../../lib/calendar-store', () => ({
  fetchCalendarCredential: jest.fn(),
  updateAccessToken: jest.fn(),
  recordCalendarEvent: jest.fn(),
}))

type Mocked<T> = jest.MockedFunction<T>

const mockedFetchCredential = fetchCalendarCredential as Mocked<typeof fetchCalendarCredential>
const mockedUpdateAccessToken = updateAccessToken as Mocked<typeof updateAccessToken>
const mockedRecordEvent = recordCalendarEvent as Mocked<typeof recordCalendarEvent>

describe('createCalendarEventForUser', () => {
  beforeEach(() => {
    mockedFetchCredential.mockReset()
    mockedUpdateAccessToken.mockReset()
    mockedRecordEvent.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('creates event with existing valid access token', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        id: 'evt-123',
        htmlLink: 'https://calendar.google.com/event?eid=evt-123',
        start: { dateTime: '2025-10-05T15:00:00-05:00' },
        end: { dateTime: '2025-10-05T15:30:00-05:00' },
        hangoutLink: 'https://meet.google.com/xyz',
        attendees: [],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    )
    mockedFetchCredential.mockResolvedValueOnce({
      id: 'cred-1',
      user_id: 'user-1',
      provider: 'google',
      refresh_token: 'refresh-token',
      access_token: 'access-token',
      access_token_expires_at: new Date(Date.now() + 120000).toISOString(),
      scope: ['https://www.googleapis.com/auth/calendar.events'],
    })

    const result = await createCalendarEventForUser('user-1', {
      summary: 'Demo',
      start: { dateTime: '2025-10-05T15:00:00-05:00', timeZone: 'America/Mexico_City' },
      end: { dateTime: '2025-10-05T15:30:00-05:00', timeZone: 'America/Mexico_City' },
    })

    expect(result.externalId).toBe('evt-123')
    expect(mockedUpdateAccessToken).not.toHaveBeenCalled()
    expect(mockedRecordEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      provider: 'google',
      externalId: 'evt-123',
      summary: 'Demo',
      description: null,
      startTime: '2025-10-05T15:00:00-05:00',
      endTime: '2025-10-05T15:30:00-05:00',
      meetingUrl: 'https://meet.google.com/xyz',
      metadata: expect.any(Object),
    })
    fetchSpy.mockRestore()
  })

  it('refreshes token when expired before creating event', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'new-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          id: 'evt-456',
          start: { dateTime: '2025-10-06T10:00:00-05:00' },
          end: { dateTime: '2025-10-06T10:45:00-05:00' },
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      )
    mockedFetchCredential.mockResolvedValueOnce({
      id: 'cred-2',
      user_id: 'user-2',
      provider: 'google',
      refresh_token: 'refresh-token',
      access_token: null,
      access_token_expires_at: null,
      scope: null,
    })

    const result = await createCalendarEventForUser('user-2', {
      summary: 'Retro',
      description: 'Revisión semanal',
      start: { dateTime: '2025-10-06T10:00:00-05:00', timeZone: 'America/Mexico_City' },
      end: { dateTime: '2025-10-06T10:45:00-05:00', timeZone: 'America/Mexico_City' },
    })

    expect(result.externalId).toBe('evt-456')
    expect(mockedUpdateAccessToken).toHaveBeenCalledWith(
      'cred-2',
      'new-token',
      expect.any(String),
      undefined
    )
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    fetchSpy.mockRestore()
  })
})
