/**
 * @file Reminder Processing Cron Job
 * @description Processes due reminders with concurrency control and FOR UPDATE SKIP LOCKED to prevent race conditions
 * @module app/api/cron/check-reminders
 * @exports runtime, maxDuration, GET, jsonResponse, mapWithConcurrency, getDueReminders, markReminderStatus
 * @runtime edge
 * @date 2026-02-07 19:00
 * @updated 2026-02-07 19:00
 */

export const runtime = 'edge';
export const maxDuration = 10; // Edge Functions max timeout (cron may need time for multiple messages)

import { getEnv } from '../../../../src/shared/config/env';
import { getSupabaseServerClient } from '../../../../src/shared/infra/db/supabase';
import type { Tables } from '../../../../types/supabase-helpers';
import { recordCalendarEvent } from '../../../../src/shared/infra/calendar/store';
import { sendWhatsAppText } from '../../../../src/shared/infra/whatsapp';
import { generateReminderDeliveryMessage } from '../../../../src/shared/infra/ai/agentic-messaging';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

type ReminderProcessResult = {
  processed: boolean
  error?: string
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  const workerCount = Math.min(limit, items.length)

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const current = nextIndex++
      if (current >= items.length) return
      results[current] = await handler(items[current]!, current)
    }
  })

  await Promise.all(workers)
  return results
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

type SupabaseClient = ReturnType<typeof getSupabaseServerClient>;

// Type for RPC function return (matches migration 022 SQL function)
type RpcReminderRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  scheduled_time: string;
  status: 'pending' | 'failed' | 'sent' | 'cancelled';
  send_token: string | null;
  created_at: string;
  phone_number: string | null;
};

async function getDueReminders(supabase: SupabaseClient): Promise<DueReminder[]> {
  const nowIso = new Date().toISOString();

  // CRITICAL FIX: Use RPC with FOR UPDATE SKIP LOCKED to prevent race conditions
  // Multiple cron executions will get different reminders (locked rows are skipped)
  // @ts-expect-error - RPC function type not yet in generated types (migration 022)
  const { data, error } = await supabase.rpc('get_due_reminders_locked', {
    now_iso: nowIso
  });

  if (error) throw error;

  // Type assertion: We know the RPC returns an array of reminder rows
  const rows = (data || []) as unknown as RpcReminderRow[];

  return rows.map((row): DueReminder => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    scheduled_time: row.scheduled_time,
    status: row.status,
    send_token: row.send_token,
    created_at: row.created_at,
    phone_number: row.phone_number,
  }));
}

async function markReminderStatus(
  supabase: SupabaseClient,
  id: string,
  status: 'sent' | 'failed' | 'pending'
) {
  const patch: Partial<Tables<'reminders'>> = { status };
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
    const supabase = getSupabaseServerClient();
    const due = await getDueReminders(supabase);
    const concurrencyLimit = 4

    const results = await mapWithConcurrency(
      due,
      concurrencyLimit,
      async (r): Promise<ReminderProcessResult> => {
        try {
          const phone = r.phone_number
          if (!phone) {
            await markReminderStatus(supabase, r.id, 'failed')
            return { processed: false, error: 'missing phone number' }
          }

          // ✅ FIX: Mark as 'sent' BEFORE sending to prevent race condition duplicates
          await markReminderStatus(supabase, r.id, 'sent')

          const body = await generateReminderDeliveryMessage({
            title: r.title,
            description: r.description,
            scheduledTime: r.scheduled_time,
          })

          try {
            await sendWhatsAppText(phone, body)

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
              })
            } catch (calErr: any) {
              console.warn(`Calendar event failed for reminder ${r.id}:`, calErr.message)
            }

            return { processed: true }
          } catch (whatsappErr: any) {
            await markReminderStatus(supabase, r.id, 'pending')
            const reason = whatsappErr?.message ?? 'WhatsApp send failed'
            return { processed: false, error: reason }
          }
        } catch (err: any) {
          const reason = err?.message ?? 'unknown error'
          await markReminderStatus(supabase, r.id, 'failed')
          return { processed: false, error: reason }
        }
      }
    )

    const processed = results.filter((r) => r.processed).length
    const failures = results
      .map((r, index) => (r.error ? { id: due[index]!.id, error: r.error } : null))
      .filter((r): r is { id: string; error: string } => !!r)

    return jsonResponse({ processed, failures })
  } catch (err: any) {
    return jsonResponse({ error: err?.message ?? 'Cron error' }, 500);
  }
}
