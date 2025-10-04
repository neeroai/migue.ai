# Smart Follow-ups

## Overview
Automated nudges keep conversations active without manual intervention. The follow-up scheduler stores jobs in Supabase and a Vercel cron (`api/cron/follow-ups.ts`) delivers reminder-style messages using WhatsApp utility templates (currently simulated with plain text placeholders pending template approval).

## Data Model
- `follow_up_jobs`: stores user/conversation, category (`schedule_confirm`, `reminder_check`, `document_status`, etc.), desired send time, payload and status (`pending`, `sent`, `failed`, `cancelled`).
- Jobs are unique per conversation/category while pending; new schedules replace previous ones.

## Scheduling API
Use `scheduleFollowUp` from `lib/followups.ts`:
```ts
await scheduleFollowUp({
  userId,
  conversationId,
  category: 'schedule_confirm',
  delayMinutes: 120,
  payload: { intent: 'schedule_meeting' },
})
```
- Defaults to 60 min delay if not provided.
- Automatically clears existing pending jobs in the same conversation/category.

## Cron Processing
`api/cron/follow-ups.ts` runs via Vercel Cron (suggest interval: every 5–10 min). For each due job:
1. Resolves the user’s phone number.
2. Sends the follow-up message (placeholder text; swap with approved template once available).
3. Marks the job `sent` or `failed`.

## Current Entry Points
- Successful `schedule_meeting` responses schedule a confirmation ping 2 h después.
- New reminders schedule a check-in after 24 h.
- Interactive quick actions (buttons/list) are logged in `conversation_actions` for analytics.

## Next Steps
1. Replace placeholder text with approved WhatsApp utility templates and track template IDs/versions.
2. Add cost telemetry (`follow_up_usage` table) to monitor template spend per user.
3. Allow jobs to trigger additional experience (e.g., interactive buttons in follow-up message).
4. Surface follow-up queue in admin dashboard for manual review/cancellation.

