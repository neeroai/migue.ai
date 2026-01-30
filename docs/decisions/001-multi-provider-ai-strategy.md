---
title: ADR 001 - Multi-Provider AI Strategy
summary: Decision to use OpenAI GPT-4o-mini as primary with Claude Sonnet as automatic fallback
description: Architecture decision record covering AI provider selection, cost analysis, failover strategy, and reliability considerations for migue.ai
version: 1.0
date: 2026-01-28
updated: 2026-01-28
scope: architecture
status: accepted
---

# ADR 001: Multi-Provider AI Strategy

## Status

**Accepted** - 2026-01-28

## Context

migue.ai requires reliable AI processing for:
- Natural language understanding (Spanish)
- Function calling (reminders, expenses, calendar)
- Conversation context management
- Voice transcription

**Requirements**:
1. High availability (>99.5% uptime)
2. Low latency (<3s response time)
3. Cost efficiency (<$0.05 per user/month)
4. Spanish language quality
5. Function calling support

**Constraints**:
- 2-person team (minimal ops overhead)
- LATAM-focused (Spanish primary language)
- Budget-conscious (target <$10/month pricing)

## Decision

**Primary Provider**: OpenAI GPT-4o-mini

**Fallback Provider**: Claude 3.5 Sonnet

**Transcription**: OpenAI Whisper

## Rationale

### Cost Analysis

| Provider | Model | Input Cost | Output Cost | Use Case |
|----------|-------|------------|-------------|----------|
| OpenAI | GPT-4o-mini | $0.15/1M | $0.60/1M | Primary AI |
| Claude | 3.5 Sonnet | $3.00/1M | $15.00/1M | Fallback only |
| OpenAI | Whisper | $0.006/min | N/A | Voice transcription |

**Average User Profile**:
- 20 messages/week
- 5,000 input tokens/week (context + message)
- 1,000 output tokens/week (responses)
- 2 voice messages/week (avg 30s each)

**Monthly Cost Calculation**:
```
GPT-4o-mini:
- Input: (5k tokens × 4 weeks) × $0.15/1M = $0.003
- Output: (1k tokens × 4 weeks) × $0.60/1M = $0.0024
- Total: $0.0054

Whisper:
- (1 min × 4 weeks) × $0.006 = $0.024

Total per user: $0.03/month
```

**Target**: <$0.05/month ✅ **Met**

### Reliability Strategy

**Auto-Failover Logic**:

```typescript
async function callAI(messages: Message[]) {
  try {
    return await openai.chat(messages);
  } catch (error) {
    if (error.code === 'rate_limit_exceeded' || error.status >= 500) {
      console.warn('OpenAI unavailable, falling back to Claude');
      return await claude.chat(messages);
    }
    throw error;
  }
}
```

**Failover Triggers**:
- OpenAI rate limit exceeded
- OpenAI server error (5xx)
- OpenAI timeout (>10s)

**Expected Failover Rate**: <5% of requests

**Cost Impact of Failover**:
- 5% of requests use Claude (20x more expensive)
- Additional cost: $0.03 × 0.05 × 20 = $0.03/user/month
- Total with failover: $0.06/month ✅ **Still within budget**

### Spanish Language Quality

**OpenAI GPT-4o-mini**:
- Trained on large Spanish corpus
- Handles LATAM dialects well
- Tested in archived migue.ai (good results)

**Claude 3.5 Sonnet**:
- Excellent Spanish quality
- Better at nuanced understanding
- Overkill for most tasks (hence fallback only)

**Decision**: Primary is sufficient, fallback provides quality safety net

### Function Calling Support

Both providers support function calling with similar syntax:

```typescript
const tools = [
  {
    name: "schedule_reminder",
    description: "Schedule a reminder for the user",
    parameters: { /* ... */ }
  }
];

// OpenAI
const response = await openai.chat({
  model: "gpt-4o-mini",
  messages,
  tools
});

// Claude (compatible interface via SDK)
const response = await claude.chat({
  model: "claude-3-5-sonnet-20241022",
  messages,
  tools
});
```

**Compatibility**: High - minimal code changes needed for failover

## Implementation

### Provider Abstraction

```typescript
// lib/ai-providers.ts
interface AIProvider {
  chat(messages: Message[], tools?: Tool[]): Promise<AIResponse>;
}

class OpenAIProvider implements AIProvider {
  async chat(messages, tools) {
    return await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools,
      temperature: 0.7
    });
  }
}

class ClaudeProvider implements AIProvider {
  async chat(messages, tools) {
    return await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages,
      tools,
      temperature: 0.7
    });
  }
}

// Auto-failover wrapper
async function processWithAI(messages, tools) {
  try {
    const response = await primaryProvider.chat(messages, tools);
    await logAIUsage('openai', 'gpt-4o-mini', response);
    return response;
  } catch (error) {
    if (shouldFallback(error)) {
      const response = await fallbackProvider.chat(messages, tools);
      await logAIUsage('claude', 'claude-3-5-sonnet', response);
      return response;
    }
    throw error;
  }
}
```

### Cost Tracking

```sql
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  provider TEXT, -- 'openai', 'claude'
  model TEXT,
  input_tokens INT,
  output_tokens INT,
  cost_usd DECIMAL(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
```

**Daily Cost Monitoring**:
```sql
-- Per-user costs (last 30 days)
SELECT
  user_id,
  SUM(cost_usd) as total_cost,
  COUNT(*) as request_count,
  SUM(CASE WHEN provider = 'claude' THEN 1 ELSE 0 END) as fallback_count
FROM ai_usage_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
HAVING SUM(cost_usd) > 1.00 -- Alert if user costs >$1/month
ORDER BY total_cost DESC;
```

## Consequences

### Positive

1. **Cost efficient**: $0.03-0.06 per user/month (vs $0.50+ with Claude-only)
2. **Reliable**: Auto-failover prevents downtime during OpenAI issues
3. **Simple ops**: No manual intervention needed for failover
4. **Quality safety net**: Claude fallback ensures high-quality responses
5. **Proven**: Both providers tested in production (molbot, archived migue.ai)

### Negative

1. **Complexity**: Must maintain two provider integrations
2. **Cost variance**: Failover increases costs unpredictably
3. **Monitoring needed**: Must track failover rates and costs
4. **Token counting differences**: Slight differences between providers

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Both providers down simultaneously | Very Low | High | Queue messages, retry after delay |
| Claude costs spike during outage | Low | Medium | Set monthly cost caps, alert at $100 |
| Provider API changes break integration | Medium | Medium | Automated tests, vendor monitoring |
| Spanish quality degrades | Low | Medium | User feedback system, quality metrics |

## Alternatives Considered

### Alternative 1: OpenAI Only

**Pros**: Simplest, lowest cost
**Cons**: No failover, single point of failure
**Rejected**: Reliability requirement not met

### Alternative 2: Claude Only

**Pros**: Highest quality, simple
**Cons**: 20x more expensive ($0.60/user/month)
**Rejected**: Cost target not met

### Alternative 3: Open-Source Models (Llama, Mistral)

**Pros**: No per-token costs, full control
**Cons**: Self-hosting complexity, GPU costs, ops overhead
**Rejected**: 2-person team cannot maintain infrastructure

## Monitoring Plan

### Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| AI response latency (p95) | <3s | >5s |
| OpenAI success rate | >95% | <90% |
| Failover rate | <5% | >10% |
| Cost per user/month | <$0.05 | >$0.10 |
| Spanish quality score (user feedback) | >4.5/5 | <4.0/5 |

### Dashboard Queries

```sql
-- Failover rate (last 24h)
SELECT
  provider,
  COUNT(*) as request_count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM ai_usage_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;

-- Avg cost per user (last 30 days)
SELECT AVG(user_cost) as avg_cost_per_user
FROM (
  SELECT user_id, SUM(cost_usd) as user_cost
  FROM ai_usage_logs
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY user_id
) subquery;
```

## Review Schedule

- **Weekly** during Phase 1-2 (initial implementation)
- **Monthly** after launch
- **Ad-hoc** if failover rate >10% or costs >$0.10/user

## References

**C1**: OpenAI Pricing - https://openai.com/pricing (2026-01-28)
**C2**: Claude Pricing - https://anthropic.com/pricing (2026-01-28)
**C3**: molbot project - Multi-provider implementation pattern
**C4**: Archived migue.ai - OpenAI integration testing results

---

**Decision Maker**: Javier Polo (CEO)
**Stakeholders**: ClaudeCode&OnlyMe team
**Implementation**: Phase 1 (Weeks 1-3)
