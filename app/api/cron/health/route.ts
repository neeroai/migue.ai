export const runtime = 'edge';
export const maxDuration = 10;

import { getSupabaseServerClient } from '../../../../lib/supabase';
import { COLOMBIA_TZ, BUSINESS_HOURS, getCurrentHour } from '../../../../lib/messaging-windows';

/**
 * Health check endpoint for cron jobs
 *
 * Purpose: Diagnose messaging window status and cron job readiness
 * - No authentication required (read-only, aggregated data)
 * - Exposes metrics from messaging_windows_stats view
 * - Shows current business hours status
 * - Lists windows near expiration
 */

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-cache, no-store, must-revalidate',
    },
  });
}

export async function GET(): Promise<Response> {
  const supabase = getSupabaseServerClient();

  try {
    // Get aggregated stats from view
    const { data: stats, error: statsError } = await supabase
      .from('messaging_windows_stats')
      .select('*')
      .single();

    if (statsError) {
      return jsonResponse({
        status: 'error',
        error: 'Failed to fetch messaging_windows_stats',
        details: statsError.message,
      }, 500);
    }

    // Get windows near expiration (next 4 hours)
    const { data: nearExpiration, error: rpcError } = await supabase
      .rpc('find_windows_near_expiration', { hours_threshold: 4 });

    if (rpcError) {
      return jsonResponse({
        status: 'error',
        error: 'Failed to call find_windows_near_expiration',
        details: rpcError.message,
      }, 500);
    }

    // Calculate current timezone info
    const currentHour = getCurrentHour(COLOMBIA_TZ);
    const isBusinessHours = currentHour >= BUSINESS_HOURS.start && currentHour < BUSINESS_HOURS.end;
    const now = new Date();
    const nowBogota = now.toLocaleString('en-US', {
      timeZone: COLOMBIA_TZ,
      dateStyle: 'medium',
      timeStyle: 'long',
    });

    // Calculate next cron execution times (12pm, 3pm, 6pm, 9pm UTC)
    const nextCronTimes = [12, 15, 18, 21].map(hour => {
      const next = new Date();
      next.setUTCHours(hour, 0, 0, 0);
      if (next <= now) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      return {
        utc: next.toISOString(),
        bogota: next.toLocaleString('en-US', {
          timeZone: COLOMBIA_TZ,
          dateStyle: 'short',
          timeStyle: 'short',
        }),
      };
    });

    return jsonResponse({
      status: 'healthy',
      timestamp: now.toISOString(),
      timezone: {
        current: COLOMBIA_TZ,
        currentTime: nowBogota,
        currentHour,
        businessHours: `${BUSINESS_HOURS.start}:00 - ${BUSINESS_HOURS.end}:00`,
        isBusinessHours,
      },
      messagingWindows: {
        total: stats?.total_windows ?? 0,
        active: stats?.active_windows ?? 0,
        nearExpiration: stats?.windows_near_expiration ?? 0,
        freeEntryActive: stats?.free_entry_active ?? 0,
        proactiveToday: stats?.total_proactive_today ?? 0,
        avgProactivePerUser: stats?.avg_proactive_per_active_user ?? 0,
      },
      upcomingMaintenanceMessages: {
        count: nearExpiration?.length ?? 0,
        windows: (nearExpiration ?? []).map((w: any) => ({
          userId: w.user_id,
          phoneNumber: w.phone_number.slice(0, 8) + '***',
          expiresAt: w.window_expires_at,
          hoursRemaining: parseFloat(w.hours_remaining).toFixed(2),
          proactiveToday: w.proactive_messages_sent_today,
        })),
      },
      cronSchedule: {
        nextExecutions: nextCronTimes,
        schedule: '0 12,15,18,21 * * * (UTC)',
        description: '7am, 10am, 1pm, 4pm Bogotá time',
      },
    });
  } catch (error: any) {
    return jsonResponse({
      status: 'error',
      error: 'Unexpected error',
      message: error?.message ?? 'Unknown error',
    }, 500);
  }
}
