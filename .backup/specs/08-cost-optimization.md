---
title: Cost Optimization & Monitoring
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: ready
scope: Token budgets, cost tracking, rate limiting, monitoring dashboards
---

# Cost Optimization & Monitoring

## Quick Reference
- **Purpose**: Cost optimization strategies with token budgets, rate limiting, and monitoring
- **References**: docs/features/advanced-capabilities.md, docs/architecture/multi-provider-strategy.md
- **Budget Target**: <$100/month (1000 users, 50K messages)
- **Key Metrics**: Token usage, cost per user, AI provider distribution

---

## Cost Breakdown

### Monthly Cost Estimate (1000 users)

| Service | Usage | Cost | Optimization |
|---------|-------|------|--------------|
| Vercel Pro | 1.5M requests, 10GB bandwidth | $21 | Use Edge Runtime (cheaper) |
| Supabase Pro | 2GB storage, 20GB bandwidth | $25 | Data retention (90 days) |
| OpenAI | 25M tokens (GPT-4o-mini) | $40 | Primary AI provider |
| Claude | 5M tokens (Haiku fallback) | $8 | Fallback only |
| WhatsApp | 50K conversations | $5 | Service conversations (free tier) |
| **Total** | - | **~$99/month** | - |

**Per user**: ~$0.10/month
**Per message**: ~$0.002

---

## Token Budget Strategy

### Per-User Monthly Budget

```typescript
interface TokenBudget {
  monthlyLimitUSD: number; // $10 per user
  currentUsageUSD: number;
  percentUsed: number;
  tokensUsed: number;
  messagesCount: number;
}

export const TOKEN_BUDGET_CONFIG = {
  // Limits
  USER_MONTHLY_LIMIT: 10.0, // $10 per user per month
  WARNING_THRESHOLD: 0.8, // 80% usage
  CRITICAL_THRESHOLD: 0.95, // 95% usage

  // Token costs (per 1M tokens)
  OPENAI_GPT4O_MINI: { input: 0.15, output: 0.60 }, // USD
  CLAUDE_HAIKU_4: { input: 0.25, output: 1.25 }, // USD

  // Average tokens per message
  AVG_INPUT_TOKENS: 1500, // System prompt + user message + context
  AVG_OUTPUT_TOKENS: 500, // AI response
};

export async function checkTokenBudget(userId: string): Promise<TokenBudget> {
  const startOfMonth = getStartOfMonth();

  const { data } = await supabase
    .from('ai_requests')
    .select('cost_usd, total_tokens')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString());

  const currentUsageUSD = data.reduce((sum, r) => sum + Number(r.cost_usd), 0);
  const tokensUsed = data.reduce((sum, r) => sum + r.total_tokens, 0);
  const messagesCount = data.length;

  return {
    monthlyLimitUSD: TOKEN_BUDGET_CONFIG.USER_MONTHLY_LIMIT,
    currentUsageUSD,
    percentUsed: currentUsageUSD / TOKEN_BUDGET_CONFIG.USER_MONTHLY_LIMIT,
    tokensUsed,
    messagesCount,
  };
}

export async function enforceTokenBudget(userId: string): Promise<boolean> {
  const budget = await checkTokenBudget(userId);

  if (budget.percentUsed >= TOKEN_BUDGET_CONFIG.CRITICAL_THRESHOLD) {
    // Block AI calls, return fallback message
    console.warn(`Token budget exceeded for user ${userId}: ${budget.percentUsed * 100}%`);
    return false;
  }

  if (budget.percentUsed >= TOKEN_BUDGET_CONFIG.WARNING_THRESHOLD) {
    // Log warning, switch to cheaper provider
    console.warn(`Token budget warning for user ${userId}: ${budget.percentUsed * 100}%`);
    // TODO: Send notification to user
  }

  return true;
}
```

---

## Cost Tracking

### Track AI Requests

```typescript
interface AIRequestLog {
  userId: string;
  messageId: string;
  provider: 'openai' | 'claude';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: number;
  latencyMs: number;
}

export async function trackAIRequest(log: AIRequestLog) {
  await supabase.from('ai_requests').insert({
    user_id: log.userId,
    message_id: log.messageId,
    provider: log.provider,
    model: log.model,
    prompt_tokens: log.promptTokens,
    completion_tokens: log.completionTokens,
    total_tokens: log.totalTokens,
    cost_usd: log.costUSD,
    latency_ms: log.latencyMs,
    created_at: new Date().toISOString(),
  });
}

export function calculateCost(
  provider: 'openai' | 'claude',
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = TOKEN_BUDGET_CONFIG[
    provider === 'openai' ? 'OPENAI_GPT4O_MINI' : 'CLAUDE_HAIKU_4'
  ];

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}
```

### Usage Analytics

```typescript
export async function getUserCostAnalytics(userId: string) {
  const startOfMonth = getStartOfMonth();

  const { data } = await supabase
    .from('ai_requests')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString());

  const byProvider = data.reduce(
    (acc, r) => {
      acc[r.provider].count += 1;
      acc[r.provider].cost += Number(r.cost_usd);
      acc[r.provider].tokens += r.total_tokens;
      return acc;
    },
    {
      openai: { count: 0, cost: 0, tokens: 0 },
      claude: { count: 0, cost: 0, tokens: 0 },
    }
  );

  const avgTokensPerRequest = data.length
    ? data.reduce((sum, r) => sum + r.total_tokens, 0) / data.length
    : 0;

  return {
    totalRequests: data.length,
    totalCost: data.reduce((sum, r) => sum + Number(r.cost_usd), 0),
    totalTokens: data.reduce((sum, r) => sum + r.total_tokens, 0),
    byProvider,
    avgTokensPerRequest,
    avgCostPerRequest: data.length
      ? data.reduce((sum, r) => sum + Number(r.cost_usd), 0) / data.length
      : 0,
  };
}
```

---

## Rate Limiting

### Per-User Rate Limits

```typescript
interface RateLimitConfig {
  endpoint: string;
  limit: number; // Max requests
  windowMs: number; // Time window
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  webhook: {
    endpoint: '/api/whatsapp/webhook',
    limit: 50, // 50 messages per user
    windowMs: 60_000, // 1 minute
  },
  flows: {
    endpoint: '/api/whatsapp/flows',
    limit: 20,
    windowMs: 60_000,
  },
};

export async function checkRateLimit(
  userId: string,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = RATE_LIMITS[endpoint];
  if (!config) return { allowed: true, remaining: 999, resetAt: new Date() };

  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  // Get rate limit record
  const { data: rateLimit } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('key', userId)
    .eq('endpoint', endpoint)
    .gte('window_end', now.toISOString())
    .single();

  if (!rateLimit) {
    // Create new window
    await supabase.from('rate_limits').insert({
      key: userId,
      endpoint,
      count: 1,
      window_start: now.toISOString(),
      window_end: new Date(now.getTime() + config.windowMs).toISOString(),
    });

    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: new Date(now.getTime() + config.windowMs),
    };
  }

  // Check if limit exceeded
  if (rateLimit.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(rateLimit.window_end),
    };
  }

  // Increment count
  await supabase
    .from('rate_limits')
    .update({ count: rateLimit.count + 1 })
    .eq('id', rateLimit.id);

  return {
    allowed: true,
    remaining: config.limit - rateLimit.count - 1,
    resetAt: new Date(rateLimit.window_end),
  };
}
```

---

## Cost Optimization Strategies

### 1. Context Window Management

```typescript
interface ContextManagement {
  maxContextMessages: number; // Max messages in context
  summaryThreshold: number; // Trigger summary after N messages
  maxTokens: number; // Max total tokens in context
}

export const CONTEXT_CONFIG: ContextManagement = {
  maxContextMessages: 10, // Last 10 messages
  summaryThreshold: 20, // Summarize after 20 messages
  maxTokens: 8000, // Max context tokens
};

export async function buildContext(userId: string): Promise<string> {
  // Get recent messages
  const { data: messages } = await supabase
    .from('messages')
    .select('content, direction, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(CONTEXT_CONFIG.maxContextMessages);

  // Format as conversation
  const context = messages
    .reverse()
    .map((m) => `${m.direction === 'inbound' ? 'User' : 'Migue'}: ${m.content}`)
    .join('\n');

  // Truncate if too long
  const tokens = estimateTokens(context);
  if (tokens > CONTEXT_CONFIG.maxTokens) {
    return truncateToTokenLimit(context, CONTEXT_CONFIG.maxTokens);
  }

  return context;
}

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  return text.slice(-maxChars);
}
```

### 2. Provider Selection

```typescript
export async function selectCostOptimalProvider(
  userId: string,
  complexity: 'simple' | 'medium' | 'complex'
): Promise<'openai' | 'claude'> {
  const budget = await checkTokenBudget(userId);

  // If near limit, use cheaper provider
  if (budget.percentUsed >= 0.8) {
    return 'openai'; // GPT-4o-mini is cheaper
  }

  // For simple queries, always use cheaper
  if (complexity === 'simple') {
    return 'openai';
  }

  // For complex queries, use best provider (Claude)
  if (complexity === 'complex') {
    return 'claude';
  }

  // Medium: balance quality and cost
  return 'openai';
}
```

### 3. Caching Strategy

```typescript
// Cache common queries to avoid AI calls
interface QueryCache {
  query: string;
  response: string;
  expiresAt: Date;
}

export async function getCachedResponse(query: string): Promise<string | null> {
  const normalizedQuery = normalizeQuery(query);

  // Check cache
  const cached = await redis.get(`query:${normalizedQuery}`);
  if (cached) {
    return JSON.parse(cached).response;
  }

  return null;
}

export async function cacheResponse(query: string, response: string, ttlSeconds: number = 3600) {
  const normalizedQuery = normalizeQuery(query);

  await redis.setex(
    `query:${normalizedQuery}`,
    ttlSeconds,
    JSON.stringify({ query, response, cachedAt: new Date() })
  );
}

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}
```

---

## Monitoring Dashboard

### Key Metrics

```typescript
export async function getDashboardMetrics() {
  const startOfMonth = getStartOfMonth();

  // Total costs
  const { data: costs } = await supabase
    .from('ai_requests')
    .select('cost_usd, provider')
    .gte('created_at', startOfMonth.toISOString());

  const totalCost = costs.reduce((sum, r) => sum + Number(r.cost_usd), 0);
  const costByProvider = costs.reduce(
    (acc, r) => {
      acc[r.provider] += Number(r.cost_usd);
      return acc;
    },
    { openai: 0, claude: 0 }
  );

  // Message volume
  const { count: totalMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth.toISOString());

  // Active users
  const { count: activeUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gte('last_message_at', startOfMonth.toISOString());

  // Tool execution stats
  const { data: toolStats } = await supabase
    .from('tool_executions')
    .select('tool_name, status')
    .gte('created_at', startOfMonth.toISOString());

  const toolSuccessRate = toolStats.length
    ? toolStats.filter((t) => t.status === 'success').length / toolStats.length
    : 0;

  return {
    totalCost,
    costByProvider,
    totalMessages,
    activeUsers,
    avgCostPerUser: activeUsers ? totalCost / activeUsers : 0,
    avgCostPerMessage: totalMessages ? totalCost / totalMessages : 0,
    toolSuccessRate,
  };
}
```

### Alert Thresholds

```typescript
export const ALERT_THRESHOLDS = {
  dailyCost: 5.0, // Alert if daily cost >$5
  monthlyCost: 100.0, // Alert if monthly cost >$100
  errorRate: 0.05, // Alert if error rate >5%
  toolFailureRate: 0.1, // Alert if tool failure rate >10%
};

export async function checkAlerts() {
  const metrics = await getDashboardMetrics();

  const alerts: string[] = [];

  if (metrics.totalCost > ALERT_THRESHOLDS.monthlyCost) {
    alerts.push(`Monthly cost exceeded: $${metrics.totalCost.toFixed(2)}`);
  }

  if (metrics.toolSuccessRate < 1 - ALERT_THRESHOLDS.toolFailureRate) {
    alerts.push(`Tool failure rate: ${((1 - metrics.toolSuccessRate) * 100).toFixed(1)}%`);
  }

  return alerts;
}
```

---

## Testing Checklist

- [ ] Token budget enforced at thresholds (80%, 95%)
- [ ] Cost calculation accurate for both providers
- [ ] Rate limiting triggers correctly
- [ ] Context window truncates properly
- [ ] Provider selection follows budget rules
- [ ] Dashboard metrics calculated correctly
- [ ] Alerts trigger at thresholds

---

**Lines**: 150 | **Tokens**: ~360 | **Status**: Ready for implementation
