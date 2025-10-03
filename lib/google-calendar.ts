import { fetchCalendarCredential, updateAccessToken, recordCalendarEvent } from './calendar-store'

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const TOKEN_SAFETY_BUFFER_SECONDS = 60

type TokenRefreshResponse = {
  access_token: string
  expires_in: number
  scope?: string
}

export type GoogleEventTime = {
  dateTime: string
  timeZone: string
}

export type GoogleEventAttendee = { email: string }

export type CalendarEventInput = {
  summary: string
  description?: string | null
  start: GoogleEventTime
  end: GoogleEventTime
  attendees?: GoogleEventAttendee[]
  location?: string | null
  conferencing?: 'google_meet' | 'none'
}

export type CalendarEventResult = {
  provider: 'google'
  externalId: string
  htmlLink?: string
  meetingUrl?: string | null
  start: string
  end: string
}

function getEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} environment variable is not set`)
  }
  return value
}

function isTokenFresh(expiresAtIso: string | null): boolean {
  if (!expiresAtIso) return false
  const expiresAt = new Date(expiresAtIso).getTime()
  if (Number.isNaN(expiresAt)) return false
  return expiresAt - TOKEN_SAFETY_BUFFER_SECONDS * 1000 > Date.now()
}

async function refreshAccessTokenForUser(credentialId: string, refreshToken: string) {
  const clientId = getEnv('GOOGLE_CLIENT_ID')
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET')
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`Google token refresh failed (${res.status}): ${errorBody}`)
  }
  const json = (await res.json()) as TokenRefreshResponse
  const expiresAt = new Date(Date.now() + (json.expires_in - TOKEN_SAFETY_BUFFER_SECONDS) * 1000).toISOString()
  const scopeArray = json.scope ? json.scope.split(' ') : null
  await updateAccessToken(credentialId, json.access_token, expiresAt, scopeArray ?? undefined)
  return { accessToken: json.access_token, expiresAt }
}

async function ensureAccessToken(userId: string) {
  const credential = await fetchCalendarCredential(userId, 'google')
  if (!credential) {
    throw new Error(`Missing Google Calendar credential for user ${userId}`)
  }
  if (credential.access_token && isTokenFresh(credential.access_token_expires_at)) {
    return { accessToken: credential.access_token, credential }
  }
  const refreshed = await refreshAccessTokenForUser(credential.id, credential.refresh_token)
  return { accessToken: refreshed.accessToken, credential }
}

async function postGoogleEvent(accessToken: string, input: CalendarEventInput) {
  const payload: Record<string, unknown> = {
    summary: input.summary,
    description: input.description ?? undefined,
    start: input.start,
    end: input.end,
    attendees: input.attendees && input.attendees.length > 0 ? input.attendees : undefined,
    location: input.location ?? undefined,
  }
  if (input.conferencing === 'google_meet') {
    payload.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now().toString(36)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }
  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?conferenceDataVersion=1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (res.status === 401) {
    throw new Error('unauthorized')
  }
  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`Google Calendar event creation failed (${res.status}): ${errorBody}`)
  }
  return (await res.json()) as Record<string, any>
}

export async function createCalendarEventForUser(
  userId: string,
  input: CalendarEventInput
): Promise<CalendarEventResult> {
  const { accessToken, credential } = await ensureAccessToken(userId)
  let response: Record<string, any>
  try {
    response = await postGoogleEvent(accessToken, input)
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      const refreshed = await refreshAccessTokenForUser(credential.id, credential.refresh_token)
      response = await postGoogleEvent(refreshed.accessToken, input)
    } else {
      throw error
    }
  }
  const externalId = response.id as string
  const start = response.start?.dateTime ?? input.start.dateTime
  const end = response.end?.dateTime ?? input.end.dateTime
  await recordCalendarEvent({
    userId,
    provider: 'google',
    externalId,
    summary: input.summary,
    description: input.description ?? null,
    startTime: start,
    endTime: end,
    meetingUrl: response.hangoutLink ?? null,
    metadata: {
      htmlLink: response.htmlLink,
      attendees: response.attendees,
    },
  })
  return {
    provider: 'google',
    externalId,
    htmlLink: response.htmlLink,
    meetingUrl: response.hangoutLink ?? null,
    start,
    end,
  }
}
