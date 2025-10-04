# Calendar Integration & Reminders

Google Calendar integration for appointment scheduling and automated reminders via WhatsApp.

## Overview

migue.ai integrates with Google Calendar to:
- Schedule appointments from natural language requests
- Create Google Meet links automatically
- Send reminder notifications via WhatsApp
- Audit all calendar operations in Supabase

**Status**: 🔄 In Progress (Fase 2)

## Architecture

### Flow

1. **Intent Detection**: Intent classifier detects `schedule_meeting`
2. **Data Extraction**: `lib/scheduling.ts` uses GPT-4o-mini to extract date, time, and participants
3. **Validation**: If missing data, request clarification via WhatsApp
4. **Calendar Creation**: `lib/google-calendar.ts` creates event with auto-refresh token management
5. **Confirmation**: Event audited in `calendar_events` table, user receives WhatsApp confirmation
6. **Reminders**: Daily cron job (`/api/cron/check-reminders`) sends reminders at 9 AM UTC

### Components

```
app/api/whatsapp/webhook/route.ts  → Detects scheduling intent
                                   ↓
lib/scheduling.ts                  → Extracts event details (GPT-4o-mini)
                                   ↓
lib/google-calendar.ts             → Creates event + handles OAuth
                                   ↓
Supabase (calendar_events)         → Audit log
                                   ↓
app/api/cron/check-reminders       → Daily reminder checks
```

## Implementation

### Environment Variables

```bash
# Google OAuth (Web Application type)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Calendar API scope
# https://www.googleapis.com/auth/calendar.events
```

### Database Schema

```sql
-- Calendar credentials per user
CREATE TABLE calendar_credentials (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar event audit log
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_id TEXT NOT NULL,  -- Google Calendar event ID
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  attendees JSONB,
  meet_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Scheduling Module (`lib/scheduling.ts`)

```typescript
export async function scheduleAppointment(
  userMessage: string,
  userId: string
): Promise<SchedulingResult> {
  // 1. Extract event details using GPT-4o-mini
  const eventDetails = await extractEventDetails(userMessage);

  // 2. Validate required fields
  if (!eventDetails.title || !eventDetails.start) {
    return {
      success: false,
      message: 'Please provide event title and start time'
    };
  }

  // 3. Create calendar event
  const event = await createCalendarEvent(userId, eventDetails);

  // 4. Audit in Supabase
  await logCalendarEvent(userId, event);

  return {
    success: true,
    event,
    message: `✅ Scheduled: ${event.title} on ${formatDate(event.start)}`
  };
}
```

### Google Calendar Client (`lib/google-calendar.ts`)

```typescript
export async function createCalendarEvent(
  userId: string,
  eventDetails: EventDetails
): Promise<GoogleCalendarEvent> {
  // 1. Get/refresh OAuth token
  const credentials = await getCalendarCredentials(userId);
  const accessToken = await ensureValidToken(credentials);

  // 2. Create event with Google Meet link
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: eventDetails.title,
        start: { dateTime: eventDetails.start },
        end: { dateTime: eventDetails.end },
        attendees: eventDetails.attendees,
        conferenceData: {
          createRequest: {
            requestId: generateId(),
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        },
        conferenceDataVersion: 1
      })
    }
  );

  return await response.json();
}

// Auto-refresh expired tokens
async function ensureValidToken(credentials: CalendarCredentials) {
  if (credentials.token_expiry > new Date()) {
    return credentials.access_token;
  }

  // Refresh token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  const tokens = await response.json();
  await updateTokens(credentials.user_id, tokens);
  return tokens.access_token;
}
```

### Reminder Cron Job

```typescript
// app/api/cron/check-reminders/route.ts
export const runtime = 'edge';

export async function GET(req: Request): Promise<Response> {
  // 1. Query upcoming events (next 24 hours)
  const upcomingEvents = await getUpcomingEvents();

  // 2. Send WhatsApp reminders
  for (const event of upcomingEvents) {
    await sendMessage({
      to: event.user_phone,
      text: `📅 Reminder: ${event.title} tomorrow at ${formatTime(event.start)}\n\n🔗 Join: ${event.meet_link}`
    });
  }

  return new Response('OK', { status: 200 });
}
```

Configured in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/check-reminders",
    "schedule": "0 9 * * *"  // Daily at 9 AM UTC
  }]
}
```

## User Experience

### Scheduling Flow

**User**: "Schedule a meeting with Sarah tomorrow at 3pm"

**Assistant**:
1. Extracts: title="Meeting with Sarah", start="tomorrow 3pm"
2. Creates Google Calendar event with Meet link
3. Responds: "✅ Scheduled: Meeting with Sarah on Oct 4 at 3:00 PM. Google Meet: https://meet.google.com/abc-defg-hij"

### Missing Information

**User**: "Schedule a meeting tomorrow"

**Assistant**: "What time would you like to schedule the meeting?"

### Reminder

**System** (9 AM UTC, day before):
"📅 Reminder: Meeting with Sarah tomorrow at 3:00 PM

🔗 Join: https://meet.google.com/abc-defg-hij"

## Error Handling

### Missing Credentials

```typescript
if (!credentials) {
  return {
    success: false,
    message: 'Please link your Google Calendar first: [auth_link]'
  };
}
```

### Token Refresh Failure

```typescript
try {
  const accessToken = await ensureValidToken(credentials);
} catch (error) {
  await logError('calendar_token_refresh_failed', error);
  return {
    success: false,
    message: 'Calendar access expired. Please re-authorize.'
  };
}
```

### Calendar API Errors

```typescript
if (!response.ok) {
  const error = await response.json();
  await logError('calendar_api_error', error);

  if (error.code === 409) {
    return { success: false, message: 'Time slot unavailable' };
  }

  return { success: false, message: 'Failed to create event' };
}
```

## Testing

```bash
# Run calendar tests
npm run test -- calendar

# Specific test files
npx jest tests/unit/scheduling.test.ts --watchman=false
npx jest tests/unit/google-calendar.test.ts --watchman=false
```

## Future Enhancements

### Free/Busy Availability (Fase 3)
Query available time slots:
```typescript
const freeSlots = await queryFreeBusy(userId, startDate, endDate);
// Suggest available times to user
```

### User Timezone Preferences
Store timezone in `users.preferences`:
```sql
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';
-- Store: { "timezone": "America/New_York" }
```

### Cancellations via WhatsApp
Detect cancellation intent:
```typescript
if (intent === 'cancel_meeting') {
  await cancelCalendarEvent(eventId);
  await sendMessage({ to, text: '✅ Meeting cancelled' });
}
```

### Multi-Calendar Support
Allow users to select which calendar to use (work, personal, etc.).

## Latency Considerations

- **Target**: <2s for scheduling confirmation
- **Optimizations**:
  - Use GPT-4o-mini (faster than GPT-4)
  - Cache credentials in Supabase
  - Async event creation (respond before complete)
  - Parallel token refresh + API calls

## Related Documentation

- [Reminder Automation](./reminder-automation.md)
- [Smart Followups](./smart-followups.md)
- Database schema: [SUPABASE.md](../SUPABASE.md)
- Cron jobs: [Deployment Guide](../05-deployment/README.md)

---

**Status**: 🔄 In Progress (Fase 2)
**Target**: October 10, 2025
**Implementation**: `lib/scheduling.ts`, `lib/google-calendar.ts`
