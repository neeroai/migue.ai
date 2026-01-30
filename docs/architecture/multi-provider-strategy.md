---
title: "Multi-Provider AI Strategy"
summary: "Claude primary, GPT-4o fallback with circuit breakers and cost tracking"
description: "Provider selection matrix, fallback triggers, circuit breaker implementation, cost tracking schema, and token budget management for resilient AI service"
version: "1.0"
date: "2026-01-29"
updated: "2026-01-29"
scope: "Architecture"
---

# Multi-Provider AI Strategy

## Provider Selection Matrix

| Condition | Primary | Fallback | Rationale | Auto-Switch |
|-----------|---------|----------|-----------|-------------|
| Normal operation | Claude Sonnet 4.5 | GPT-4o | Best reasoning | No |
| Claude rate limit hit | - | GPT-4o | Availability | Yes |
| Claude 5xx error | - | GPT-4o | Service health | Yes |
| Claude timeout >10s | - | GPT-4o | Performance | Yes |
| Circuit breaker open | - | GPT-4o | Protection | Yes |
| Cost threshold 80% | GPT-4o | Claude | Budget control | Yes |
| Cost threshold 95% | - | Error mode | Hard limit | Yes |
| Token limit exceeded | GPT-4o (lower context) | - | Context management | Yes |
| Simple query | GPT-4o | Claude | Cost optimization | No |
| Complex reasoning | Claude | GPT-4o | Quality priority | No |

**Selection logic**: Health check → Cost check → Complexity analysis → Provider assignment

---

## Fallback Trigger Thresholds

| Trigger | Threshold | Action | Priority | Retry Delay |
|---------|-----------|--------|----------|-------------|
| Rate limit (429) | Immediate | Switch provider | P0 | 60s |
| Server error (5xx) | 2 consecutive | Switch provider | P0 | 30s |
| Timeout | >10s | Switch provider | P1 | 15s |
| Invalid response | 3 consecutive | Switch provider | P1 | 30s |
| Token limit | >120K context | Use lower context provider | P2 | Immediate |
| Cost limit warning | 80% budget | Prefer cheaper provider | P2 | Immediate |
| Cost limit critical | 95% budget | Block expensive calls | P0 | Manual reset |
| Circuit breaker half-open | 50% failure rate | Open circuit | P0 | 60s |
| Circuit breaker open | Time elapsed | Test with single request | P1 | 120s |

**Priority**: P0=Immediate switch, P1=Retry then switch, P2=Gradual transition

---

## Circuit Breaker States

| State | Condition | Duration | Retry Logic | Metrics |
|-------|-----------|----------|-------------|---------|
| Closed | Failure rate <20% | Continuous | Normal operation | success_count, failure_count |
| Half-Open | After timeout from Open | 60s test window | Single request probe | test_request_result |
| Open | Failure rate ≥50% in 1min | 120s cooldown | Block all requests | failure_rate, opened_at |
| Forced Open | Manual override | Until reset | Block all requests | manual_override_reason |

**Transition rules**:
- Closed → Open: 5 failures in 10 requests OR 10 failures in 1 minute
- Open → Half-Open: After 120s cooldown
- Half-Open → Closed: Test request succeeds
- Half-Open → Open: Test request fails
- Any → Forced Open: Manual intervention

**State machine**:
```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private openedAt: number = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt > 120000) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.successes = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    const recentWindow = Date.now() - 60000;
    if (this.failures >= 5 ||
        (this.lastFailureTime > recentWindow && this.failures >= 10)) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
```

---

## Cost Tracking Schema

| Metric | Storage | Query | Alert Threshold | Retention |
|--------|---------|-------|-----------------|-----------|
| Token usage (input) | openai_usage.input_tokens | SUM by date_range | 80% of budget | 90d |
| Token usage (output) | openai_usage.output_tokens | SUM by date_range | 80% of budget | 90d |
| API calls count | openai_usage.COUNT(*) | COUNT by date_range | 10K/day | 90d |
| Cost per user | GROUP BY user_id | SUM(cost) by user | Top 10 users | 90d |
| Cost per provider | openai_usage.model | SUM by provider | Compare ratios | 90d |
| Error rate | openai_usage.error | PERCENTAGE | >5% | 30d |
| Latency p95 | openai_usage.latency_ms | PERCENTILE(95) | >10s | 30d |

**Table schema** (Supabase):
```sql
CREATE TABLE openai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  phone_number TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'openai' or 'anthropic'
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_usd NUMERIC(10,6) NOT NULL,
  latency_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_user_date ON openai_usage(user_id, created_at);
CREATE INDEX idx_usage_provider ON openai_usage(provider, created_at);
```

---

## Provider Configuration

```yaml
providers:
  anthropic:
    model: "claude-sonnet-4.5"
    endpoint: "https://api.anthropic.com/v1/messages"
    max_tokens: 200000        # Context window
    output_max_tokens: 8192   # Max output
    rate_limits:
      rpm: 4000               # Requests per minute
      tpm: 400000             # Tokens per minute
      tpd: 10000000           # Tokens per day
    costs:
      input_per_1m: 3.00      # $3 per 1M input tokens
      output_per_1m: 15.00    # $15 per 1M output tokens
    timeout_ms: 30000
    retry:
      max_attempts: 2
      backoff: "exponential"

  openai:
    model: "gpt-4o"
    endpoint: "https://api.openai.com/v1/chat/completions"
    max_tokens: 128000        # Context window
    output_max_tokens: 16384  # Max output
    rate_limits:
      rpm: 10000
      tpm: 800000
      tpd: 20000000
    costs:
      input_per_1m: 2.50      # $2.50 per 1M input tokens
      output_per_1m: 10.00    # $10 per 1M output tokens
    timeout_ms: 30000
    retry:
      max_attempts: 2
      backoff: "exponential"
```

---

## Fallback Chain Implementation

```typescript
class AIProviderManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  async execute(
    request: AIRequest,
    options: { allowFallback: boolean } = { allowFallback: true }
  ): Promise<AIResponse> {
    const providers = this.selectProviders(request);

    for (const provider of providers) {
      const breaker = this.getCircuitBreaker(provider);

      try {
        return await breaker.execute(() =>
          this.callProvider(provider, request)
        );
      } catch (error) {
        if (!options.allowFallback || provider === providers[providers.length - 1]) {
          throw error;
        }
        await this.logFallback(provider, error);
      }
    }
  }

  private selectProviders(request: AIRequest): string[] {
    const complexity = analyzeComplexity(request);
    const costBudget = this.getCurrentBudgetUsage();

    if (costBudget > 0.95) {
      return ['error']; // Hard limit
    } else if (costBudget > 0.80 || complexity < 3) {
      return ['openai', 'anthropic'];
    } else {
      return ['anthropic', 'openai'];
    }
  }
}
```

---

## Cost Tracking Implementation

```typescript
class CostTracker {
  async trackUsage(data: {
    userId: string;
    phoneNumber: string;
    provider: 'openai' | 'anthropic';
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  }): Promise<void> {
    const cost = this.calculateCost(
      data.provider,
      data.inputTokens,
      data.outputTokens
    );

    await supabase.from('openai_usage').insert({
      user_id: data.userId,
      phone_number: data.phoneNumber,
      model: data.model,
      provider: data.provider,
      input_tokens: data.inputTokens,
      output_tokens: data.outputTokens,
      total_tokens: data.inputTokens + data.outputTokens,
      cost_usd: cost,
      latency_ms: data.latencyMs
    });

    await this.checkThresholds(data.userId);
  }

  private calculateCost(
    provider: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const rates = PROVIDER_COSTS[provider];
    return (
      (inputTokens / 1000000) * rates.input_per_1m +
      (outputTokens / 1000000) * rates.output_per_1m
    );
  }
}
```

---

## Cost Alert Rules

```yaml
alerts:
  daily_budget:
    threshold: 50.00          # $50/day
    check_frequency: "1h"
    actions:
      - type: "email"
        recipients: ["admin@migue.ai"]
      - type: "slack"
        channel: "#alerts"

  user_anomaly:
    threshold: 5.00           # $5 per user per day
    percentile: 95            # Alert if user in top 5%
    check_frequency: "1h"
    actions:
      - type: "log"
      - type: "email"

  provider_imbalance:
    threshold: 0.9            # 90% on one provider
    check_frequency: "1h"
    actions:
      - type: "log"
      - type: "review"

  error_rate:
    threshold: 0.05           # 5% error rate
    window: "5m"
    check_frequency: "1m"
    actions:
      - type: "pager"
      - type: "switch_provider"
```

---

## Citations

- **molbot auth-profiles + model-fallback.ts**: Multi-provider pattern
- **PRD Section 8.4**: Cost optimization strategy
- **AI engineer output**: Fallback chain recommendations
- **docs-global/patterns/error-handling-fallbacks.md**: Circuit breaker patterns

---

**Lines**: 218 | **Tokens**: ~654
