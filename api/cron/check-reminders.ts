export const config = { runtime: 'edge' };

import { getEnv } from '../../lib/env';
import { getSupabaseServerClient } from '../../lib/supabase';
import { recordCalendarEvent } from '../../lib/calendar-store';
import { sendWhatsAppText } from '../whatsapp/send';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

type DbReminder = {
  id: string
  user_id: string
  title: string
  description: string | null
  scheduled_time: string
  status: string
  send_token: string | null
}

type DueReminder = DbReminder & {
  phone_number: string | null
}

async function getDueReminders(): Promise<DueReminder[]> {
  const supabase = getSupabaseServerClient()
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('reminders')
    .select('id, user_id, title, description, scheduled_time, status, send_token, users ( phone_number )')
    .eq('status', 'pending')
    .lte('scheduled_time', nowIso)
  if (error) throw error
  return (data || []).map((row: any) => ({
    ...row,
    phone_number: row.users?.phone_number ?? null,
  }))
}

async function markReminderStatus(
  id: string,
  status: 'sent' | 'failed'
) {
  const supabase = getSupabaseServerClient()
  const patch: Record<string, unknown> = { status }
  if (status === 'sent') {
    patch.send_token = crypto.randomUUID()
  }
  const { error } = await supabase
    .from('reminders')
    .update(patch)
    .eq('id', id)
  if (error) throw error
}

export default async function handler(req: Request): Promise<Response> {
  // Verify cron authentication
  const { CRON_SECRET } = getEnv();
  if (CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  try {
    const due = await getDueReminders()
    let processed = 0
    const failures: Array<{ id: string; error: string }> = []
    for (const r of due) {
      try {
        const phone = r.phone_number
        if (!phone) {
          await markReminderStatus(r.id, 'failed')
          failures.push({ id: r.id, error: 'missing phone number' })
          continue
        }
        const body = r.description ? `${r.title}: ${r.description}` : r.title
        await sendWhatsAppText(phone, body)
        await recordCalendarEvent({
          userId: r.user_id,
          provider: 'google',
          externalId: `reminder-${r.id}`,
          summary: r.title,
          description: r.description,
          startTime: r.scheduled_time,
          endTime: r.scheduled_time,
          meetingUrl: null,
          metadata: { source: 'reminder-cron' },
        })
        await markReminderStatus(r.id, 'sent')
        processed++
      } catch (err: any) {
        const reason = err?.message ?? 'unknown error'
        await markReminderStatus(r.id, 'failed')
        failures.push({ id: r.id, error: reason })
      }
    }
    return jsonResponse({ processed, failures })
  } catch (err: any) {
    return jsonResponse({ error: err?.message ?? 'Cron error' }, 500)
  }
}
