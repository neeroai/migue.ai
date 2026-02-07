---
title: "AI Cost Tracking"
date: "2026-02-07 02:45"
updated: "2026-02-07 02:45"
status: "shipped"
phase: "step-8"
priority: "P2"
complexity: "low"
estimated_hours: 4
---

# AI Cost Tracking

## What It Does

Multi-provider AI cost tracking (OpenAI, Gemini) with budget enforcement. Tracks usage per user with limits: $3/day system-wide, $90/month total, $0.50/day per user. In-memory tracking with database hydration on startup. Budget status cache with 30s TTL. Alert thresholds at 80% (warning) and 95% (critical).

## Why It Exists

**Budget Control**: Prevent runaway costs from AI API usage

**Per-User Limits**: Prevent individual users from exhausting system budget

**Monitoring**: Alert on high usage before hitting limits

## Current Implementation

### Files

| File | Lines | Purpose |
|------|-------|---------|
| lib/ai-cost-tracker.ts | 569 | Multi-provider cost tracking |

**Total**: 569 lines

### Key Exports

```typescript
// Cost tracking
trackUsage(provider, model, inputTokens, outputTokens, userId)

// Budget checks
getBudgetStatus() // Returns: { daily, monthly, percentUsed, alerts }
canAffordRequest(provider, estimatedTokens, userId)

// Class
CostTracker // Singleton with Map-based tracking

// Constants
DAILY_LIMIT = $3
MONTHLY_LIMIT = $90
USER_DAILY_LIMIT = $0.50
ALERT_THRESHOLD_WARNING = 0.80 (80%)
ALERT_THRESHOLD_CRITICAL = 0.95 (95%)
```

### External Dependencies

| Service | Cost | Purpose |
|---------|------|---------|
| Supabase | Included | Database (ai_usage_log table) |
| In-memory Map | Free | 30s budget status cache |

### Database Schema

**Table**: `ai_usage_log`

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| user_id | uuid | FK to users (nullable) |
| provider | text | openai/gemini |
| model | text | Model name |
| input_tokens | int | Input tokens used |
| output_tokens | int | Output tokens used |
| cost_usd | numeric | Calculated cost |
| created_at | timestamptz | Timestamp |

### Provider Pricing

**OpenAI GPT-4o-mini**:
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens

**Gemini 2.5 Flash Lite**:
- Input: $0.10 / 1M tokens
- Output: $0.40 / 1M tokens

**OpenAI text-embedding-3-small**:
- $0.02 / 1M tokens

**OpenAI Whisper**:
- $0.36 / hour

### Budget Limits

| Limit | Amount | Scope |
|-------|--------|-------|
| Daily system | $3 | All users combined |
| Monthly system | $90 | All users combined |
| Daily per user | $0.50 | Individual user |

### Alert Thresholds

| Threshold | Percentage | Action |
|-----------|------------|--------|
| Warning | 80% | Log warning |
| Critical | 95% | Block new requests |

### Critical Features

| Feature | Implementation |
|---------|----------------|
| In-memory tracking | Map-based (hydrated from DB on startup) |
| Budget cache | 30s TTL for getBudgetStatus() |
| Pre-flight check | canAffordRequest() before API call |
| Automatic reset | Daily/monthly reset logic |
| Per-user limits | $0.50/day per user |

### Budget Status Response

```typescript
{
  daily: {
    used: 2.45,
    limit: 3.0,
    percentUsed: 81.67,
    remaining: 0.55
  },
  monthly: {
    used: 67.80,
    limit: 90.0,
    percentUsed: 75.33,
    remaining: 22.20
  },
  alerts: [
    { level: 'warning', message: 'Daily budget at 81.67%' }
  ]
}
```

## Test Coverage

| Test | File | Status |
|------|------|--------|
| OpenAI cost tracker | tests/unit/openai-cost-tracker.test.ts | PASS |

**Coverage**: GOOD (core logic tested)

## Related ADRs

**ADR-002**: Cache TTL increases
- Budget: 30s→60s proposed
- **Status**: NOT implemented (code still shows 30s)

## Known Issues

**Cache TTL Mismatch**: ADR-002 proposed 60s, code implements 30s

## Logs

**Daily Usage**: $2-3 (within $3 limit)

**Monthly Usage**: $65-75 (within $90 limit)

**Per-User Peak**: $0.30-0.40 (within $0.50 limit)

**Budget Alerts**: ~2-3 warnings/day at 80% threshold

**Cost Breakdown**:
- OpenAI GPT-4o-mini: ~90% of cost
- Gemini 2.5 Flash Lite: ~5% (fallback usage)
- Embeddings: ~3%
- Whisper: ~2%

## Next Steps

| Priority | Task | Effort |
|----------|------|--------|
| P2 | Implement ADR-002 cache TTL increase (30s→60s) | 1hr |
| P3 | Add cost dashboard (daily/monthly trends) | 4hr |
| P3 | Alert notifications (email/WhatsApp on 95% threshold) | 3hr |

## Implementation Completeness

**Status**: COMPLETE

**Shipped**: 2026-01-01

**Production**: Stable, budget enforcement working
