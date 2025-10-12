#!/usr/bin/env npx tsx

/**
 * Diagnostic tool for cron jobs
 *
 * Simulates the cron job logic to diagnose issues:
 * - Lists active users and their messaging windows
 * - Calculates windows near expiration
 * - Shows next maintenance messages to be sent
 * - Detects configuration problems
 *
 * Usage: npm run diagnose:cron
 */

import { config } from 'dotenv';
import { getSupabaseServerClient } from '../lib/supabase';
import {
  findWindowsNearExpiration,
  getCurrentHour,
  isWithinBusinessHours,
  COLOMBIA_TZ,
  BUSINESS_HOURS,
  MAX_PROACTIVE_PER_DAY,
  MIN_INTERVAL_HOURS,
} from '../lib/messaging-windows';

// Load environment variables
config({ path: '.env.local' });

async function main() {
  console.log('🔍 Diagnosing Cron Jobs Configuration\n');
  console.log('='.repeat(60));

  const supabase = getSupabaseServerClient();

  // 1. Check timezone and business hours
  console.log('\n📅 Timezone & Business Hours:');
  const currentHour = getCurrentHour(COLOMBIA_TZ);
  const withinHours = await isWithinBusinessHours(COLOMBIA_TZ);
  const now = new Date();
  const nowBogota = now.toLocaleString('en-US', {
    timeZone: COLOMBIA_TZ,
    dateStyle: 'medium',
    timeStyle: 'long',
  });

  console.log(`  Current time (Bogotá): ${nowBogota}`);
  console.log(`  Current hour: ${currentHour}:00`);
  console.log(`  Business hours: ${BUSINESS_HOURS.start}:00 - ${BUSINESS_HOURS.end}:00`);
  console.log(`  Within business hours: ${withinHours ? '✅ YES' : '❌ NO'}`);

  // 2. Check messaging_windows table
  console.log('\n💬 Messaging Windows Status:');
  const { data: windows, error: windowsError } = await supabase
    .from('messaging_windows')
    .select('*')
    .order('window_expires_at', { ascending: true });

  if (windowsError) {
    console.error(`  ❌ Error fetching windows: ${windowsError.message}`);
    process.exit(1);
  }

  if (!windows || windows.length === 0) {
    console.log('  ⚠️  No messaging windows found');
    console.log('  → This means no users have sent messages yet');
    console.log('  → Cron job will have nothing to process');
  } else {
    console.log(`  Total windows: ${windows.length}`);

    const activeWindows = windows.filter(w => new Date(w.window_expires_at) > now);
    const expiredWindows = windows.length - activeWindows.length;

    console.log(`  Active windows: ${activeWindows.length}`);
    console.log(`  Expired windows: ${expiredWindows}`);

    // Show details of each window
    console.log('\n  Window Details:');
    for (const w of windows) {
      const expiresAt = new Date(w.window_expires_at);
      const isExpired = expiresAt <= now;
      const hoursRemaining = Math.max(0, (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));

      console.log(`\n  📱 User: ${w.user_id.slice(0, 8)}... | Phone: ${w.phone_number.slice(0, 8)}***`);
      console.log(`     Status: ${isExpired ? '❌ EXPIRED' : '✅ ACTIVE'}`);
      console.log(`     Expires: ${expiresAt.toLocaleString('en-US', { timeZone: COLOMBIA_TZ })}`);
      console.log(`     Hours remaining: ${hoursRemaining.toFixed(2)}h`);
      console.log(`     Proactive messages today: ${w.proactive_messages_sent_today}/${MAX_PROACTIVE_PER_DAY}`);
      if (w.last_proactive_sent_at) {
        const lastSent = new Date(w.last_proactive_sent_at);
        const hoursSinceProactive = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
        console.log(`     Last proactive: ${hoursSinceProactive.toFixed(2)}h ago`);
        console.log(`     Can send another: ${hoursSinceProactive >= MIN_INTERVAL_HOURS ? '✅ YES' : `❌ NO (wait ${(MIN_INTERVAL_HOURS - hoursSinceProactive).toFixed(1)}h)`}`);
      } else {
        console.log(`     Last proactive: Never`);
        console.log(`     Can send another: ✅ YES`);
      }
    }
  }

  // 3. Check windows near expiration (what cron job would process)
  console.log('\n⏰ Windows Near Expiration (Next 4 hours):');
  const nearExpiration = await findWindowsNearExpiration(4);

  if (nearExpiration.length === 0) {
    console.log('  ℹ️  No windows expiring in the next 4 hours');
    console.log('  → Cron job would skip (nothing to process)');
  } else {
    console.log(`  Found ${nearExpiration.length} window(s) expiring soon:`);

    for (const w of nearExpiration) {
      console.log(`\n  📨 Would send maintenance message to:`);
      console.log(`     User: ${w.user_id.slice(0, 8)}...`);
      console.log(`     Phone: ${w.phone_number.slice(0, 8)}***`);
      console.log(`     Expires: ${new Date(w.window_expires_at).toLocaleString('en-US', { timeZone: COLOMBIA_TZ })}`);
      console.log(`     Hours remaining: ${w.hours_remaining.toFixed(2)}h`);
      console.log(`     Proactive today: ${w.proactive_messages_sent_today}/${MAX_PROACTIVE_PER_DAY}`);
    }
  }

  // 4. Check users table
  console.log('\n👥 Users Status:');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, phone_number, created_at')
    .order('created_at', { ascending: false });

  if (usersError) {
    console.error(`  ❌ Error fetching users: ${usersError.message}`);
  } else if (!users || users.length === 0) {
    console.log('  ⚠️  No users found in database');
  } else {
    console.log(`  Total users: ${users.length}`);

    const usersWithWindows = windows?.map(w => w.user_id) ?? [];
    const usersWithoutWindows = users.filter(u => !usersWithWindows.includes(u.id));

    if (usersWithoutWindows.length > 0) {
      console.log(`\n  ⚠️  ${usersWithoutWindows.length} user(s) without messaging windows:`);
      for (const u of usersWithoutWindows.slice(0, 5)) {
        console.log(`     - ${u.phone_number.slice(0, 8)}*** (created: ${new Date(u.created_at).toLocaleDateString()})`);
      }
      console.log('     → These users need to send a message to open a window');
    }
  }

  // 5. Check environment variables
  console.log('\n⚙️  Environment Variables:');
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'WHATSAPP_TOKEN',
    'WHATSAPP_PHONE_ID',
    'GOOGLE_AI_API_KEY', // Primary AI provider (Gemini 2.5 Flash)
  ];

  const optionalEnvVars = [
    'CRON_SECRET',
    'OPENAI_API_KEY',   // Fallback #1 (GPT-4o-mini) + Audio transcription
    'ANTHROPIC_API_KEY', // Emergency fallback (Claude Sonnet)
  ];

  for (const envVar of requiredEnvVars) {
    const exists = !!process.env[envVar];
    console.log(`  ${exists ? '✅' : '❌'} ${envVar}: ${exists ? 'SET' : 'MISSING'}`);
  }

  console.log('\n  Optional:');
  for (const envVar of optionalEnvVars) {
    const exists = !!process.env[envVar];
    console.log(`  ${exists ? '✅' : 'ℹ️ '} ${envVar}: ${exists ? 'SET' : 'NOT SET'}`);
  }

  if (!process.env.CRON_SECRET) {
    console.log('\n  ⚠️  CRON_SECRET not set - relying on Vercel user-agent for auth');
    console.log('     → Generate with: openssl rand -hex 32');
    console.log('     → Add to .env.local and Vercel environment variables');
  }

  // 6. Next cron execution times
  console.log('\n⏰ Next Cron Executions:');
  console.log('  Schedule: 0 12,15,18,21 * * * (UTC)');
  console.log('  Bogotá:   7am, 10am, 1pm, 4pm\n');

  const nextTimes = [12, 15, 18, 21].map(hour => {
    const next = new Date();
    next.setUTCHours(hour, 0, 0, 0);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  });

  for (const time of nextTimes) {
    const bogotaTime = time.toLocaleString('en-US', {
      timeZone: COLOMBIA_TZ,
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const hoursUntil = (time.getTime() - now.getTime()) / (1000 * 60 * 60);
    console.log(`  ${bogotaTime} (in ${hoursUntil.toFixed(1)}h)`);
  }

  // 7. Summary
  console.log('\n='.repeat(60));
  console.log('\n📊 Summary:');

  const issues: string[] = [];
  const warnings: string[] = [];

  if (!withinHours) {
    warnings.push('Outside business hours - cron job would skip');
  }

  if (!windows || windows.length === 0) {
    warnings.push('No messaging windows - no users have sent messages yet');
  }

  if (nearExpiration.length === 0 && windows && windows.length > 0) {
    warnings.push('No windows expiring soon - cron job would have nothing to send');
  }

  if (!process.env.CRON_SECRET) {
    warnings.push('CRON_SECRET not configured - ensure Vercel user-agent works');
  }

  if (issues.length > 0) {
    console.log('\n❌ Issues Found:');
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (issues.length === 0 && warnings.length === 0) {
    console.log('\n✅ All checks passed! Cron job should work correctly.');
  }

  console.log('\n💡 Next Steps:');
  console.log('  1. Test health endpoint: curl http://localhost:3000/api/cron/health');
  console.log('  2. Run type check: npm run typecheck');
  console.log('  3. Deploy: git push origin main');
  console.log('  4. Monitor logs: vercel logs https://migue.app --since=5m\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
