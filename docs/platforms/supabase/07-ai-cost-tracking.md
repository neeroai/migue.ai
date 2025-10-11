# AI Cost Tracking

Multi-provider AI usage analytics and budget management system.

## Overview

**ai_usage_tracking** table monitors costs across 5 AI providers:
- **Gemini 2.5 Flash** - Primary chat ($0 within 1,500 req/day)
- **GPT-4o-mini** - Fallback chat ($0.15/$0.60 per 1M tokens)
- **Groq Whisper** - Audio transcription ($0.05/hour)
- **Tesseract** - OCR (100% free)
- **Claude Sonnet** - Emergency fallback ($3/$15 per 1M tokens)

**Current status (Oct 2025)**: $0/month within Gemini free tier

## ai_usage_tracking Table

### Schema

```sql
CREATE TABLE ai_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('claude', 'groq', 'tesseract', 'openai', 'supabase', 'gemini')),
  task_type TEXT NOT NULL CHECK (task_type IN ('chat', 'audio_transcription', 'ocr', 'embeddings', 'image_analysis')),
  model TEXT,
  tokens_input INT,
  tokens_output INT,
  cost_usd DECIMAL(12, 8) NOT NULL,  -- 8 decimal places for micro-transactions
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Field Details

| Field | Type | Description |
|-------|------|-------------|
| `provider` | TEXT | AI provider: gemini, openai, claude, groq, tesseract |
| `task_type` | TEXT | chat, audio_transcription, ocr, embeddings |
| `model` | TEXT | Specific model (e.g., "gemini-2.0-flash-exp") |
| `tokens_input` | INT | Input tokens (nullable for non-token tasks) |
| `tokens_output` | INT | Output tokens |
| `cost_usd` | DECIMAL(12,8) | Cost with 8 decimal precision |
| `metadata` | JSONB | Extra data (response_time, error_count, etc.) |

### Indexes

```sql
CREATE INDEX ai_usage_created_at_idx ON ai_usage_tracking(created_at DESC);
CREATE INDEX ai_usage_provider_idx ON ai_usage_tracking(provider);
CREATE INDEX ai_usage_task_type_idx ON ai_usage_tracking(task_type);
CREATE INDEX ai_usage_user_id_idx ON ai_usage_tracking(user_id);
```

## TypeScript Integration

### Track Usage

```typescript
// lib/metrics.ts
import { getSupabaseServerClient } from './supabase'

export async function trackAIUsage(params: {
  provider: 'gemini' | 'openai' | 'claude' | 'groq' | 'tesseract'
  taskType: 'chat' | 'audio_transcription' | 'ocr' | 'embeddings'
  model: string
  tokensInput?: number
  tokensOutput?: number
  costUsd: number
  userId?: string
  conversationId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const supabase = getSupabaseServerClient()

  await supabase.from('ai_usage_tracking').insert({
    provider: params.provider,
    task_type: params.taskType,
    model: params.model,
    tokens_input: params.tokensInput ?? null,
    tokens_output: params.tokensOutput ?? null,
    cost_usd: params.costUsd,
    user_id: params.userId ?? null,
    conversation_id: params.conversationId ?? null,
    metadata: params.metadata ?? null,
  })
}
```

### Usage Examples

```typescript
// Chat completion (Gemini)
await trackAIUsage({
  provider: 'gemini',
  taskType: 'chat',
  model: 'gemini-2.0-flash-exp',
  tokensInput: 250,
  tokensOutput: 150,
  costUsd: 0.0,  // Free tier
  userId,
  conversationId,
  metadata: { cached_tokens: 100 }
})

// Audio transcription (Groq)
await trackAIUsage({
  provider: 'groq',
  taskType: 'audio_transcription',
  model: 'whisper-large-v3',
  costUsd: 0.004,  // $0.05/hour × 4.8 seconds
  userId,
  metadata: { duration_seconds: 4.8 }
})

// OCR (Tesseract)
await trackAIUsage({
  provider: 'tesseract',
  taskType: 'ocr',
  model: 'tesseract-v5',
  costUsd: 0.0,  // Always free
  userId
})
```

## Analytics Functions

### get_daily_ai_costs()

**Daily summary by provider and task:**

```sql
-- supabase/migrations/004_ai_cost_tracking.sql
CREATE OR REPLACE FUNCTION get_daily_ai_costs(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  provider TEXT,
  task_type TEXT,
  total_requests BIGINT,
  total_cost DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT provider, task_type, COUNT(*), SUM(cost_usd)
  FROM ai_usage_tracking
  WHERE DATE(created_at) = target_date
  GROUP BY provider, task_type
  ORDER BY SUM(cost_usd) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**TypeScript usage:**
```typescript
const { data } = await supabase.rpc('get_daily_ai_costs', {
  target_date: '2025-10-11'
})

console.log(data)
// [
//   { provider: 'gemini', task_type: 'chat', total_requests: 1450, total_cost: 0.00 },
//   { provider: 'groq', task_type: 'audio_transcription', total_requests: 15, total_cost: 0.12 }
// ]
```

### get_ai_cost_trends()

**Cost trends over last N days:**

```sql
CREATE OR REPLACE FUNCTION get_ai_cost_trends(days INT DEFAULT 30)
RETURNS TABLE (
  date DATE,
  total_cost DECIMAL,
  claude_cost DECIMAL,
  groq_cost DECIMAL,
  openai_cost DECIMAL,
  gemini_cost DECIMAL,
  total_requests BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at),
    SUM(cost_usd),
    SUM(CASE WHEN provider = 'claude' THEN cost_usd ELSE 0 END),
    SUM(CASE WHEN provider = 'groq' THEN cost_usd ELSE 0 END),
    SUM(CASE WHEN provider = 'openai' THEN cost_usd ELSE 0 END),
    SUM(CASE WHEN provider = 'gemini' THEN cost_usd ELSE 0 END),
    COUNT(*)
  FROM ai_usage_tracking
  WHERE created_at >= CURRENT_DATE - days
  GROUP BY DATE(created_at)
  ORDER BY DATE(created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Cost Calculation

### Gemini 2.5 Flash (Free Tier)

**Pricing (Oct 2025):**
- Input: $0.00 per 1M tokens
- Output: $0.00 per 1M tokens
- **Limit**: 1,500 requests/day
- Context caching: 75% savings (if exceeding free tier)

**Calculate cost:**
```typescript
function calculateGeminiCost(tokensInput: number, tokensOutput: number): number {
  // Free tier: first 1,500 requests/day
  return 0.00
}
```

### GPT-4o-mini (Fallback)

**Pricing:**
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens

**Calculate cost:**
```typescript
function calculateGPTCost(tokensInput: number, tokensOutput: number): number {
  const inputCost = (tokensInput / 1_000_000) * 0.15
  const outputCost = (tokensOutput / 1_000_000) * 0.60
  return inputCost + outputCost
}
```

### Groq Whisper

**Pricing:** $0.05 per hour of audio

**Calculate cost:**
```typescript
function calculateGroqCost(durationSeconds: number): number {
  return (durationSeconds / 3600) * 0.05
}
```

### Claude Sonnet 4.5 (Emergency)

**Pricing:**
- Input: $3.00 per 1M tokens
- Output: $15.00 per 1M tokens

**Calculate cost:**
```typescript
function calculateClaudeCost(tokensInput: number, tokensOutput: number): number {
  const inputCost = (tokensInput / 1_000_000) * 3.00
  const outputCost = (tokensOutput / 1_000_000) * 15.00
  return inputCost + outputCost
}
```

## Budget Management

### Daily Budget Alert

```typescript
async function checkDailyBudget(limit: number = 10.00): Promise<void> {
  const { data } = await supabase.rpc('get_daily_ai_costs')

  const total = data?.reduce((sum, row) => sum + Number(row.total_cost), 0) ?? 0

  if (total > limit) {
    // Alert via webhook, email, or Slack
    await sendAlert({
      type: 'budget_exceeded',
      daily_cost: total,
      limit,
      breakdown: data
    })
  }
}
```

### Monthly Projections

```typescript
async function getMonthlyProjection(): Promise<number> {
  const { data } = await supabase.rpc('get_ai_cost_trends', { days: 30 })

  const totalCost = data?.reduce((sum, row) => sum + Number(row.total_cost), 0) ?? 0
  const avgDailyCost = totalCost / 30

  return avgDailyCost * 30  // Project for full month
}
```

## Real-Time Monitoring

### Dashboard Query

```sql
-- Current month costs by provider
SELECT
  provider,
  COUNT(*) as requests,
  SUM(tokens_input) as total_input_tokens,
  SUM(tokens_output) as total_output_tokens,
  SUM(cost_usd) as total_cost
FROM ai_usage_tracking
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY provider
ORDER BY total_cost DESC;
```

### Per-User Costs

```sql
-- Top users by AI cost (last 7 days)
SELECT
  u.phone_number,
  COUNT(*) as ai_calls,
  SUM(ai.cost_usd) as total_cost
FROM ai_usage_tracking ai
JOIN users u ON u.id = ai.user_id
WHERE ai.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY u.id, u.phone_number
ORDER BY total_cost DESC
LIMIT 10;
```

## Cost Optimization History

### Oct 2025 Migration

**Before (Claude Sonnet):**
- Input: $3.00 per 1M tokens
- Output: $15.00 per 1M tokens
- Monthly cost: ~$300

**After (GPT-4o-mini):**
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens
- Monthly cost: ~$90
- **Savings**: 70%

**Current (Gemini 2.5 Flash):**
- Input: $0.00 per 1M tokens (free tier)
- Output: $0.00 per 1M tokens (free tier)
- Monthly cost: ~$0 (within 1,500 req/day)
- **Savings**: 100% vs Claude, 100% vs GPT-4o-mini

## Next Steps

- **[Messaging Windows](./06-messaging-windows.md)** - Reduce WhatsApp costs
- **[Monitoring](./11-monitoring-performance.md)** - Query performance tracking

**Last Updated**: 2025-10-11
