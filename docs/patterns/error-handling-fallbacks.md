---
title: "Error Handling and Fallbacks"
summary: "Circuit breakers, degradation modes, retry strategies, DLQ processing"
description: "Circuit breaker state machine, degradation mode matrix, retry strategy decision tree, error classification, and dead letter queue processing rules for resilient error handling"
version: "1.0"
date: "2026-01-29"
updated: "2026-01-29"
scope: "Patterns"
---

# Error Handling and Fallbacks

## Circuit Breaker State Machine

| State | Condition | Duration | Action | Metrics |
|-------|-----------|----------|--------|---------|
| CLOSED | Failure rate <20% | Continuous | Allow all requests | success_count, failure_count, last_failure_time |
| HALF_OPEN | After timeout from OPEN | 60s test window | Allow 1 test request | test_request_result, test_count |
| OPEN | Failure rate ≥50% in 1min | 120s cooldown | Block all requests | failure_rate, opened_at, cooldown_remaining |
| FORCED_OPEN | Manual override | Until manual reset | Block all requests | manual_override_reason, override_by |

**Transition rules**:
- CLOSED → OPEN: 5 failures in 10 requests OR 10 failures in 60 seconds
- OPEN → HALF_OPEN: After 120-second cooldown
- HALF_OPEN → CLOSED: Test request succeeds
- HALF_OPEN → OPEN: Test request fails
- Any state → FORCED_OPEN: Manual intervention (production incident)

**Circuit breaker implementation**:
```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private openedAt: number = 0;
  private failureWindow: number[] = [];

  constructor(
    private config: {
      failureThreshold: number;
      cooldownMs: number;
      failureWindowMs: number;
    }
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check state
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed > this.config.cooldownMs) {
        this.state = 'HALF_OPEN';
        console.log('Circuit breaker: OPEN → HALF_OPEN');
      } else {
        throw new Error(
          `Circuit breaker OPEN (${Math.ceil((this.config.cooldownMs - elapsed) / 1000)}s remaining)`
        );
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
    this.successes++;
    this.failures = 0;
    this.failureWindow = [];

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log('Circuit breaker: HALF_OPEN → CLOSED');
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.failureWindow.push(this.lastFailureTime);

    // Remove old failures outside window
    const windowStart = Date.now() - this.config.failureWindowMs;
    this.failureWindow = this.failureWindow.filter(t => t > windowStart);

    // Check if should open
    const recentFailures = this.failureWindow.length;
    if (
      recentFailures >= this.config.failureThreshold ||
      (this.failures >= 5 && this.successes + this.failures >= 10)
    ) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      console.log('Circuit breaker: CLOSED → OPEN');
    }
  }

  getState(): string {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      recentFailures: this.failureWindow.length,
      failureRate: this.successes + this.failures > 0
        ? this.failures / (this.successes + this.failures)
        : 0
    };
  }
}

// Usage
const openaiBreaker = new CircuitBreaker({
  failureThreshold: 5,
  cooldownMs: 120000,
  failureWindowMs: 60000
});

const anthropicBreaker = new CircuitBreaker({
  failureThreshold: 5,
  cooldownMs: 120000,
  failureWindowMs: 60000
});
```

---

## Degradation Mode Matrix

| Service | Degraded Mode | Functionality Retained | User Experience | Fallback Data |
|---------|---------------|------------------------|-----------------|---------------|
| OpenAI API | Use Anthropic | Full AI features | Slightly slower | Live fallback |
| Anthropic API | Use OpenAI | Full AI features | Different style | Live fallback |
| Both AI APIs | Use cached responses | Limited to known queries | "Service busy" | Cached responses |
| Google Calendar | Read-only + cache | View events only | Can't create events | 1h cache |
| Supabase | Read-only replica | View data only | Can't save changes | Replica lag <5s |
| WhatsApp API | Queue messages | Async delivery | Delayed delivery | Message queue |
| RAG/Embeddings | Keyword search | Basic search only | Less relevant | Text search |
| OCR (Tesseract) | Manual input | No auto-extract | User types data | None |

**Degradation levels**:
- **Level 0**: Full functionality
- **Level 1**: Non-critical features disabled (OCR, RAG)
- **Level 2**: Read-only mode (Calendar, Supabase)
- **Level 3**: Cached responses only (AI, data queries)
- **Level 4**: Offline mode (queue all writes)

**Degradation manager**:
```typescript
class DegradationManager {
  private degradationLevel: number = 0;

  async checkServiceHealth(): Promise<void> {
    const health = {
      openai: await this.pingOpenAI(),
      anthropic: await this.pingAnthropic(),
      supabase: await this.pingSupabase(),
      whatsapp: await this.pingWhatsApp()
    };

    // Determine degradation level
    if (!health.openai && !health.anthropic) {
      this.degradationLevel = 3; // AI down, use cache
    } else if (!health.supabase) {
      this.degradationLevel = 2; // Read-only mode
    } else if (!health.whatsapp) {
      this.degradationLevel = 2; // Queue messages
    } else {
      this.degradationLevel = 0; // Full functionality
    }
  }

  isFeatureAvailable(feature: string): boolean {
    const requirements = {
      ai_chat: this.degradationLevel < 3,
      create_event: this.degradationLevel < 2,
      view_event: this.degradationLevel < 4,
      ocr: this.degradationLevel < 1,
      rag_search: this.degradationLevel < 1
    };

    return requirements[feature] ?? true;
  }
}
```

---

## Retry Strategy Decision

| HTTP Code | Retryable | Backoff | Jitter | Max Attempts | Example |
|-----------|-----------|---------|--------|--------------|---------|
| 429 (Rate Limit) | ✅ | Linear 60s | No | 5 | Wait exactly 60s between |
| 500 (Server Error) | ✅ | Exponential | Yes | 3 | 1s, 2s, 4s + jitter |
| 502 (Bad Gateway) | ✅ | Exponential | Yes | 3 | 2s, 4s, 8s + jitter |
| 503 (Unavailable) | ✅ | Exponential | Yes | 3 | 2s, 4s, 8s + jitter |
| 504 (Timeout) | ✅ | Linear | No | 2 | 5s, 10s |
| 401 (Unauthorized) | ✅ | Immediate | No | 1 | Refresh token, retry |
| 400 (Bad Request) | ❌ | None | No | 0 | Invalid params |
| 404 (Not Found) | ❌ | None | No | 0 | Resource missing |
| 409 (Conflict) | ❌ | None | No | 0 | Business logic error |

**Retry helper**:
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts: number;
    backoff: 'exponential' | 'linear';
    baseDelay: number;
    jitter: boolean;
  }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if retryable
      if (!isRetryableError(error)) {
        throw error;
      }

      // Last attempt, don't wait
      if (attempt === options.maxAttempts - 1) {
        break;
      }

      // Calculate delay
      let delay = options.backoff === 'exponential'
        ? options.baseDelay * Math.pow(2, attempt)
        : options.baseDelay * (attempt + 1);

      // Add jitter (±25%)
      if (options.jitter) {
        const jitterAmount = delay * 0.25;
        delay += (Math.random() - 0.5) * 2 * jitterAmount;
      }

      // Wait
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function isRetryableError(error: any): boolean {
  const retryableCodes = [429, 500, 502, 503, 504];

  if (error.response?.status) {
    return retryableCodes.includes(error.response.status);
  }

  // Network errors are retryable
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true;
  }

  return false;
}
```

---

## Error Classification

| HTTP Code Range | Category | Severity | User Message | Action |
|----------------|----------|----------|--------------|--------|
| 200-299 | Success | None | - | Continue |
| 400-499 (except 429) | Client Error | Medium | "Invalid request" | Ask user for correction |
| 429 | Rate Limit | Low | "High load, please wait" | Queue and retry |
| 500-599 | Server Error | High | "Service error, retrying" | Retry with backoff |
| Network timeout | Network Error | Medium | "Connection issue" | Retry 3x |
| DNS failure | Network Error | High | "Network unavailable" | Fail fast |

**Error classifier**:
```typescript
class ErrorClassifier {
  classify(error: Error | any): ErrorClassification {
    // HTTP errors
    if (error.response?.status) {
      const status = error.response.status;

      if (status >= 500) {
        return {
          category: 'SERVER_ERROR',
          severity: 'HIGH',
          retryable: true,
          userMessage: 'Service temporarily unavailable, retrying...'
        };
      } else if (status === 429) {
        return {
          category: 'RATE_LIMIT',
          severity: 'LOW',
          retryable: true,
          userMessage: 'High load, your request is queued'
        };
      } else if (status >= 400) {
        return {
          category: 'CLIENT_ERROR',
          severity: 'MEDIUM',
          retryable: false,
          userMessage: 'Invalid request, please check your input'
        };
      }
    }

    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return {
        category: 'NETWORK_ERROR',
        severity: 'MEDIUM',
        retryable: true,
        userMessage: 'Connection issue, retrying...'
      };
    }

    // Unknown errors
    return {
      category: 'UNKNOWN',
      severity: 'HIGH',
      retryable: false,
      userMessage: 'An error occurred, please try again'
    };
  }
}
```

---

## DLQ Processing Rules

| Failure Reason | Retention | Alert Threshold | Auto-Retry Criteria | Manual Review |
|----------------|-----------|-----------------|---------------------|---------------|
| Rate limit | 24h | >10/hour | After cooldown | No |
| Server error | 7d | >50/hour | After 1h | Yes (if recurring) |
| Invalid payload | 30d | >5/hour | Never | Yes |
| Authentication | 24h | >1/hour | After token refresh | Yes |
| Timeout | 24h | >20/hour | After 5min | No |
| Unknown | 30d | >10/hour | Manual only | Yes |

**DLQ schema** (Supabase):
```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  phone_number TEXT,
  failure_reason TEXT NOT NULL,
  error_message TEXT,
  payload JSONB NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_dlq_retry ON dead_letter_queue(next_retry_at)
  WHERE resolved_at IS NULL;
```

**DLQ manager**:
```typescript
class DeadLetterQueueManager {
  async addToQueue(
    failure: {
      userId: string;
      phoneNumber: string;
      failureReason: string;
      errorMessage: string;
      payload: any;
    }
  ): Promise<void> {
    await supabase.from('dead_letter_queue').insert({
      user_id: failure.userId,
      phone_number: failure.phoneNumber,
      failure_reason: failure.failureReason,
      error_message: failure.errorMessage,
      payload: failure.payload,
      next_retry_at: this.calculateNextRetry(failure.failureReason)
    });
  }

  async processQueue(): Promise<void> {
    const { data: items } = await supabase
      .from('dead_letter_queue')
      .select('*')
      .is('resolved_at', null)
      .lte('next_retry_at', new Date().toISOString())
      .lt('retry_count', 'max_retries')
      .limit(50);

    for (const item of items) {
      try {
        // Retry original operation
        await this.retryOperation(item.payload);

        // Mark as resolved
        await supabase
          .from('dead_letter_queue')
          .update({ resolved_at: new Date() })
          .eq('id', item.id);
      } catch (error) {
        // Increment retry count
        await supabase
          .from('dead_letter_queue')
          .update({
            retry_count: item.retry_count + 1,
            next_retry_at: this.calculateNextRetry(item.failure_reason),
            error_message: error.message
          })
          .eq('id', item.id);
      }
    }
  }

  private calculateNextRetry(reason: string): Date {
    const delays = {
      rate_limit: 3600000, // 1 hour
      server_error: 3600000, // 1 hour
      timeout: 300000, // 5 minutes
      authentication: 1800000, // 30 minutes
      unknown: 3600000 // 1 hour
    };

    const delay = delays[reason] || 3600000;
    return new Date(Date.now() + delay);
  }
}
```

---

## Citations

- **AI engineer output**: Error handling and circuit breaker patterns
- **Archived lib/error-recovery.ts + dead-letter-queue.ts**: Implementation patterns
- **PRD Section 12**: Risk mitigation and error handling
- **docs-global/patterns/error-handling-fallbacks.md**: Fallback strategies

---

**Lines**: 198 | **Tokens**: ~594
