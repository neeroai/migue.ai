export const runtime = 'edge';

import { getEnv } from '../../../../lib/env';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import type { Tables } from '../../../../types/supabase-helpers';
import { recordCalendarEvent } from '../../../../lib/calendar-store';
import { sendWhatsAppText } from '../../../../lib/whatsapp';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// Type for reminders with joined users table
type ReminderRow = Tables<'reminders'> & {
  users: {
    phone_number: string;
  } | null;
};

type DueReminder = Tables<'reminders'> & {
  phone_number: string | null;
};

async function getDueReminders(): Promise<DueReminder[]> {
  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('reminders')
    .select('*, users ( phone_number )')
    .eq('status', 'pending')
    .lte('scheduled_time', nowIso);
  if (error) throw error;

  return (data || []).map((row: ReminderRow): DueReminder => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    scheduled_time: row.scheduled_time,
    status: row.status,
    send_token: row.send_token,
    created_at: row.created_at,
    phone_number: row.users?.phone_number ?? null,
  }));
}

async function markReminderStatus(id: string, status: 'sent' | 'failed' | 'pending') {
  const supabase = getSupabaseServerClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'sent') {
    patch.send_token = crypto.randomUUID();
  }
  const { error } = await supabase.from('reminders').update(patch).eq('id', id);
  if (error) throw error;
}

export async function GET(req: Request): Promise<Response> {
  // Verify cron authentication (Vercel uses 'vercel-cron/1.0' user-agent)
  const userAgent = req.headers.get('user-agent');
  const isVercelCron = userAgent?.startsWith('vercel-cron/');

  if (!isVercelCron) {
    // Fallback to CRON_SECRET if configured
    const { CRON_SECRET } = getEnv();
    if (CRON_SECRET) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
    } else {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  try {
    const due = await getDueReminders();
    let processed = 0;
    const failures: Array<{ id: string; error: string }> = [];
    for (const r of due) {
      try {
        const phone = r.phone_number;
        if (!phone) {
          await markReminderStatus(r.id, 'failed');
          failures.push({ id: r.id, error: 'missing phone number' });
          continue;
        }

        // ✅ FIX: Mark as 'sent' BEFORE sending to prevent race condition duplicates
        await markReminderStatus(r.id, 'sent');

        // Format message with emoji and context for better UX
        const emoji = '🔔';
        const body = r.description
          ? `${emoji} Recordatorio: ${r.title}\n\n${r.description}`
          : `${emoji} Recordatorio: ${r.title}`;

        try {
          // Send WhatsApp message
          await sendWhatsAppText(phone, body);

          // Record calendar event (non-critical - log failure but don't rollback)
          try {
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
            });
          } catch (calErr: any) {
            // Log calendar failure but don't fail the reminder
            // User got the WhatsApp notification which is the primary goal
            console.warn(`Calendar event failed for reminder ${r.id}:`, calErr.message);
          }

          processed++;
        } catch (whatsappErr: any) {
          // WhatsApp send failed - rollback status to 'pending' for retry
          await markReminderStatus(r.id, 'pending');
          const reason = whatsappErr?.message ?? 'WhatsApp send failed';
          failures.push({ id: r.id, error: reason });
        }
      } catch (err: any) {
        // Unexpected error in outer try block
        const reason = err?.message ?? 'unknown error';
        await markReminderStatus(r.id, 'failed');
        failures.push({ id: r.id, error: reason });
      }
    }
    return jsonResponse({ processed, failures });
  } catch (err: any) {
    return jsonResponse({ error: err?.message ?? 'Cron error' }, 500);
  }
}
