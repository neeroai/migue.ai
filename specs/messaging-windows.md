---
title: "Messaging Windows Tracking"
date: "2026-02-07 02:45"
updated: "2026-02-07 02:45"
status: "shipped"
phase: "step-8"
priority: "P3"
complexity: "medium"
estimated_hours: 4
---

# Messaging Windows Tracking

## What It Does

WhatsApp 24-hour messaging window management with business hours enforcement (7am-8pm Bogotá). Proactive message decision system with rate limiting (4h intervals, 4 msg/day max). Cron job (every 3 hours during business hours) sends contextual messages before window expiration (4h threshold).

## Why It Exists

**WhatsApp Constraint**: Free messages only within 24h of user's last message

**Engagement**: Proactive messages keep conversations active (avoid paying for templates)

**User Experience**: Context-aware messages during business hours (not at 2am)

## Current Implementation

### Files

| File | Lines | Purpose |
|------|-------|---------|
| lib/messaging-windows.ts | 443 | Window tracking + decision logic |
| app/api/cron/maintain-windows/route.ts | 362 | Proactive message cron job |

**Total**: 805 lines

### Key Exports

```typescript
// Window management
updateMessagingWindow(userId) // Update on inbound message
getMessagingWindow(userId) // Returns: { expiresAt, isActive, freeEntry }

// Proactive message decision
shouldSendProactiveMessage(userId, lastActivity, proactiveCount)
  // Returns: { should: boolean, reason: string }
incrementProactiveCounter(userId)

// Cron utilities
findWindowsNearExpiration(threshold) // Returns: windows expiring soon

// Constants
WINDOW_DURATION_MS = 86400000 // 24 hours
FREE_ENTRY_WINDOW_MS = 259200000 // 72 hours
BUSINESS_HOURS = { start: 7, end: 20 } // 7am-8pm
MAX_PROACTIVE_PER_DAY = 4
MIN_PROACTIVE_INTERVAL_MS = 14400000 // 4 hours
```

### External Dependencies

| Service | Cost | Purpose |
|---------|------|---------|
| Supabase | Included | Database (messaging_windows table) |
| Vercel Cron | Free | Scheduled proactive messages |
| OpenAI GPT-4o-mini | $0.15/$0.60 per 1M tokens | Contextual message generation |
| WhatsApp API | Free (24h window) | Message delivery |

### Database Schema

**Table**: `messaging_windows`

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| user_id | uuid | FK to users (UNIQUE) |
| last_inbound_at | timestamptz | Last user message |
| window_expires_at | timestamptz | 24h from last_inbound_at |
| free_entry_expires_at | timestamptz | 72h from first message (nullable) |
| proactive_count_today | int | Proactive messages sent today |
| last_proactive_at | timestamptz | Last proactive message (nullable) |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update |

**Upsert**: `ON CONFLICT (user_id) DO UPDATE`

### Critical Features

| Feature | Implementation |
|---------|----------------|
| 24h window | Update on every inbound message |
| 72h free entry | First 3 days after initial message |
| Business hours | 7am-8pm Bogotá (GMT-5) |
| Rate limiting | 4 msg/day max, 4h intervals |
| Contextual messages | AI-generated based on conversation history |
| Concurrency limit | 4 parallel message sends |

### Proactive Message Decision Logic

**shouldSendProactiveMessage() criteria**:
1. **Business hours**: 7am-8pm Bogotá (reject if outside)
2. **Daily limit**: <4 proactive messages today (reject if exceeded)
3. **Interval**: ≥4h since last proactive (reject if too soon)
4. **User activity**: ≥2h since last message (reject if too recent)
5. **Window status**: Window expiring in <4h (reject if not urgent)

**Result**:
```typescript
{ should: true, reason: 'All criteria met' }
// OR
{ should: false, reason: 'Outside business hours' }
```

### Cron Job Configuration

**Route**: `/api/cron/maintain-windows`

**Schedule**: Every 3 hours during business hours (7am-8pm)

**Timeout**: Edge Functions maxDuration: 10 seconds

**Process**:
1. Find windows expiring in <4h
2. Filter: shouldSendProactiveMessage()
3. Load conversation history (context for AI)
4. Generate contextual message (GPT-4o-mini)
5. Send via WhatsApp API
6. Increment proactive counter
7. Update last_proactive_at

**Concurrency**: Limit of 4 parallel sends

### AI-Generated Contextual Messages

**Prompt Template**:
```
Generate a brief, natural follow-up message based on this conversation:
[conversation history last 10 messages]

Guidelines:
- Keep it short (1-2 sentences)
- Reference something from the conversation
- Ask a relevant question or offer help
- Sound natural and friendly
- Spanish language
```

**Example Output**:
"Hola! ¿Cómo te fue con esa reunión del viernes? 😊"

## Test Coverage

| Test | File | Status |
|------|------|--------|
| Messaging windows | tests/unit/messaging-windows.test.ts | PASS |

**Coverage**: GOOD (decision logic tested)

## Related ADRs

**None** - WhatsApp constraint, no alternative approaches

## Known Issues

**None** - System working as designed

## Logs

**Proactive Messages Sent**: ~20-30/day

**Window Expiration Prevention**: ~90% (10% of windows expire despite proactive messages)

**Business Hours Compliance**: 100% (no messages outside 7am-8pm)

**Daily Limit Compliance**: 100% (max 4 msg/user/day enforced)

**AI Generation Success**: ~98% (failures mostly OpenAI API timeouts)

**Cost**: ~$0.05/day (AI-generated contextual messages)

## Next Steps

| Priority | Task | Effort |
|----------|------|--------|
| P3 | Add A/B testing for proactive message effectiveness | 6hr |
| P3 | Personalize business hours per user timezone | 4hr |
| P3 | Add user opt-out for proactive messages | 2hr |

## Implementation Completeness

**Status**: COMPLETE

**Shipped**: 2026-01-10

**Production**: Stable, preventing window expirations effectively
