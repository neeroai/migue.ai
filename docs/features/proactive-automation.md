---
title: "Proactive Automation"
summary: "Cron jobs for reminders, daily summaries, window maintenance, and batch processing"
description: "Cron job catalog with schedules, reminder delivery pipeline, daily summary components, messaging window maintenance rules, and batch processing strategies"
version: "1.0"
date: "2026-01-29"
updated: "2026-01-29"
scope: "Features"
---

# Proactive Automation

## Cron Job Catalog

| Job Name | Schedule | Purpose | Execution Time | Priority | Timeout |
|----------|----------|---------|----------------|----------|---------|
| check-reminders | */5 * * * * | Deliver due reminders | 10-30s | P0 | 50s |
| daily-summary | 0 8 * * * | Send daily agenda | 30-60s | P1 | 2min |
| window-maintenance | */15 * * * * | Alert expiring windows | 5-15s | P1 | 1min |
| expense-digest | 0 20 * * * | Daily spending summary | 20-40s | P2 | 2min |
| weekly-report | 0 9 * * 1 | Weekly analytics | 60-120s | P2 | 5min |
| cleanup-old-sessions | 0 2 * * * | Archive old data | 30-60s | P3 | 10min |

**Cron infrastructure**: Vercel Cron (configured in vercel.json)

**Configuration**:
```json
{
  "crons": [
    {
      "path": "/api/cron/check-reminders",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/daily-summary",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/window-maintenance",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

---

## Reminder Delivery Pipeline

| Stage | Query | Process | Rate Limit | Retry | Latency |
|-------|-------|---------|------------|-------|---------|
| 1. Fetch | Get due reminders | WHERE due_at <= NOW() | - | - | 100ms |
| 2. Window check | Check 24h window | Query messaging_windows | - | - | 50ms |
| 3. Template | Build message | Format with context | - | - | 20ms |
| 4. Send | WhatsApp API call | Batch send | 80/sec | 3 attempts | 500ms |
| 5. Update | Mark delivered | UPDATE reminders | - | - | 50ms |
| 6. Failure handling | Log failures | Insert into DLQ | - | - | 50ms |

**SQL query** (fetch due reminders):
```sql
-- Get reminders due in next 5 minutes
SELECT
  r.id,
  r.user_id,
  r.message,
  r.due_at,
  u.phone_number,
  u.timezone
FROM reminders r
JOIN users u ON u.id = r.user_id
WHERE r.status = 'pending'
  AND r.due_at <= NOW() + INTERVAL '5 minutes'
  AND r.due_at > NOW()
ORDER BY r.due_at ASC
LIMIT 100;
```

**Implementation**:
```typescript
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch due reminders
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*, users(phone_number, timezone)')
      .eq('status', 'pending')
      .lte('due_at', new Date(Date.now() + 5 * 60 * 1000).toISOString())
      .gt('due_at', new Date().toISOString())
      .limit(100);

    if (error) throw error;

    const results = {
      total: reminders.length,
      sent: 0,
      failed: 0,
      skipped: 0
    };

    // 2. Process in batches
    for (const reminder of reminders) {
      // Check messaging window
      const windowOpen = await isWindowOpen(reminder.user_id);
      if (!windowOpen) {
        results.skipped++;
        continue;
      }

      // Send reminder
      try {
        await sendWhatsAppMessage(
          reminder.users.phone_number,
          `⏰ Reminder: ${reminder.message}`
        );

        // Mark as delivered
        await supabase
          .from('reminders')
          .update({ status: 'delivered', delivered_at: new Date() })
          .eq('id', reminder.id);

        results.sent++;
      } catch (error) {
        // Log to DLQ
        await logToDeadLetterQueue({
          type: 'reminder',
          reminder_id: reminder.id,
          error: error.message
        });
        results.failed++;
      }

      // Rate limiting (80 msgs/sec max)
      await new Promise(resolve => setTimeout(resolve, 15));
    }

    return Response.json(results);
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

## Daily Summary Components

| Component | Query | Aggregation | Format | Token Budget |
|-----------|-------|-------------|--------|--------------|
| Morning greeting | User timezone | Personalized message | Text | 50 |
| Today's events | Calendar API | List by time | Bullet list | 200 |
| Pending reminders | Reminders table | Count + list | Numbered | 100 |
| Yesterday's expenses | Expenses table | SUM by category | Table | 150 |
| Weather (optional) | Weather API | Current + forecast | Text | 50 |
| Motivational quote | Random selection | - | Text | 30 |

**Daily summary SQL**:
```sql
-- Get today's schedule for user
SELECT
  title,
  start_time,
  end_time,
  location
FROM calendar_events
WHERE user_id = $1
  AND DATE(start_time AT TIME ZONE $2) = CURRENT_DATE
ORDER BY start_time ASC;

-- Get pending reminders
SELECT
  message,
  due_at
FROM reminders
WHERE user_id = $1
  AND status = 'pending'
  AND DATE(due_at AT TIME ZONE $2) = CURRENT_DATE
ORDER BY due_at ASC;

-- Get yesterday's expenses
SELECT
  category,
  SUM(amount) as total,
  COUNT(*) as count
FROM expenses
WHERE user_id = $1
  AND DATE(created_at AT TIME ZONE $2) = CURRENT_DATE - INTERVAL '1 day'
GROUP BY category
ORDER BY total DESC;
```

**Message template**:
```typescript
function buildDailySummary(data: {
  userName: string;
  events: CalendarEvent[];
  reminders: Reminder[];
  expenses: ExpenseSummary[];
}): string {
  let message = `Good morning, ${data.userName}! 🌅\n\n`;

  // Today's schedule
  if (data.events.length > 0) {
    message += `📅 Today's Schedule:\n`;
    data.events.forEach(event => {
      const time = formatTime(event.start_time);
      message += `• ${time} - ${event.title}\n`;
    });
    message += '\n';
  }

  // Pending reminders
  if (data.reminders.length > 0) {
    message += `⏰ Reminders:\n`;
    data.reminders.forEach((reminder, i) => {
      message += `${i + 1}. ${reminder.message}\n`;
    });
    message += '\n';
  }

  // Yesterday's expenses
  if (data.expenses.length > 0) {
    const total = data.expenses.reduce((sum, e) => sum + e.total, 0);
    message += `💰 Yesterday's Expenses: $${total.toFixed(2)}\n`;
    data.expenses.forEach(exp => {
      message += `• ${exp.category}: $${exp.total.toFixed(2)}\n`;
    });
  }

  return message;
}
```

---

## Window Maintenance Rules

| Check Condition | Threshold | Action | Template | Frequency |
|----------------|-----------|--------|----------|-----------|
| Window expiring soon | <1 hour | Alert user | "24h window closes in 1h" | Every 15min |
| Window expired | Expired | Mark closed | "Window closed, wait for reply" | On check |
| Window opening | User replies | Reopen window | "Window reopened for 24h" | Real-time |
| Pending messages | Window closed | Queue messages | Store in pending_messages | Real-time |
| Window reopened | Has pending | Send queued | Flush pending_messages | Real-time |

**Window expiry check SQL**:
```sql
-- Find windows expiring in next hour
SELECT
  mw.user_id,
  mw.phone_number,
  mw.expires_at,
  EXTRACT(EPOCH FROM (mw.expires_at - NOW())) / 60 AS minutes_remaining
FROM messaging_windows mw
WHERE mw.is_open = true
  AND mw.expires_at <= NOW() + INTERVAL '1 hour'
  AND mw.expires_at > NOW()
  AND NOT EXISTS (
    SELECT 1 FROM window_alerts wa
    WHERE wa.user_id = mw.user_id
      AND wa.created_at > NOW() - INTERVAL '1 hour'
  );
```

**Implementation**:
```typescript
export async function GET(req: Request) {
  // Auth check
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Find expiring windows
  const { data: expiringWindows } = await supabase.rpc(
    'get_expiring_windows',
    { threshold_minutes: 60 }
  );

  let alerted = 0;
  for (const window of expiringWindows) {
    const minutes = Math.floor(window.minutes_remaining);

    // Send alert
    await sendWhatsAppMessage(
      window.phone_number,
      `⚠️ Your 24-hour messaging window closes in ${minutes} minutes. ` +
      `Reply to keep it open!`
    );

    // Log alert
    await supabase.from('window_alerts').insert({
      user_id: window.user_id,
      expires_at: window.expires_at
    });

    alerted++;
  }

  // 2. Close expired windows
  const { data: closedWindows } = await supabase
    .from('messaging_windows')
    .update({ is_open: false })
    .eq('is_open', true)
    .lt('expires_at', new Date().toISOString())
    .select();

  return Response.json({
    alerted,
    closed: closedWindows?.length || 0
  });
}
```

---

## Batch Processing Strategy

| Task | Batch Size | Parallelism | Error Handling | Retry | Priority |
|------|------------|-------------|----------------|-------|----------|
| Send reminders | 50 | 5 concurrent | Log to DLQ | 3 attempts | P0 |
| Update windows | 100 | 1 sequential | Rollback batch | 2 attempts | P1 |
| Generate summaries | 20 | 3 concurrent | Skip failed | 1 attempt | P2 |
| Send templates | 50 | 5 concurrent | Log to DLQ | 3 attempts | P1 |
| Archive old data | 1000 | 1 sequential | Continue on error | 1 attempt | P3 |

**Batch processor**:
```typescript
class BatchProcessor {
  async processBatch<T>(
    items: T[],
    handler: (item: T) => Promise<void>,
    options: {
      batchSize: number;
      parallelism: number;
      retryAttempts: number;
    }
  ): Promise<BatchResult> {
    const results = {
      total: items.length,
      succeeded: 0,
      failed: 0,
      errors: []
    };

    // Process in batches
    for (let i = 0; i < items.length; i += options.batchSize) {
      const batch = items.slice(i, i + options.batchSize);

      // Parallel processing within batch
      const promises = batch.map(async (item) => {
        let lastError;
        for (let attempt = 0; attempt < options.retryAttempts; attempt++) {
          try {
            await handler(item);
            results.succeeded++;
            return;
          } catch (error) {
            lastError = error;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          }
        }

        results.failed++;
        results.errors.push(lastError);
      });

      // Wait for batch to complete (with parallelism limit)
      await Promise.all(promises);

      // Rate limiting between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }
}
```

---

## Template Sender

```typescript
async function sendTemplateMessage(
  phoneNumber: string,
  templateName: string,
  parameters: string[]
): Promise<void> {
  await fetch(`https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'es' },
        components: [
          {
            type: 'body',
            parameters: parameters.map(p => ({
              type: 'text',
              text: p
            }))
          }
        ]
      }
    })
  });
}

// Usage: Send daily summary template
await sendTemplateMessage(
  phoneNumber,
  'daily_summary',
  [userName, eventCount.toString(), totalExpenses.toString()]
);
```

---

## Citations

- **AI engineer output**: Cron architecture and proactive patterns
- **molbot cron system**: Cron job patterns and batch processing
- **PRD Section 4.5**: Reminders and proactive features
- **PRD Section 4.10**: Messaging window maintenance
- **docs-global/guides/whatsapp-window-maintenance.md**: Window rules

---

**Lines**: 238 | **Tokens**: ~714
