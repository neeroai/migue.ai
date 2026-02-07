---
title: "Rate Limiting"
date: "2026-02-07 02:45"
updated: "2026-02-07 02:45"
status: "shipped"
phase: "step-8"
priority: "P3"
complexity: "low"
estimated_hours: 2
---

# Rate Limiting

## What It Does

In-memory rate limiter with 5 seconds minimum interval between messages per user. Token bucket-style tracking with Map-based storage. Automatic cleanup every 5 minutes (removes entries older than 1 hour). Prevents burst attacks and spam.

## Why It Exists

**Spam Prevention**: Prevent users from sending rapid-fire messages

**Cost Control**: Reduce AI API calls from spam attacks

**User Experience**: Enforce reasonable message pacing

## Current Implementation

### Files

| File | Lines | Purpose |
|------|-------|---------|
| lib/simple-rate-limiter.ts | 134 | In-memory rate limiter |

**Total**: 134 lines

### Key Exports

```typescript
// Rate limit check
checkRateLimit(userId)
  // Returns: { allowed: boolean, waitTime: number }

// Wait time calculation
getRateLimitWaitTime(userId)
  // Returns: milliseconds remaining until next allowed message

// Admin controls
resetRateLimit(userId) // Override/testing
cleanupOldEntries() // Auto-runs every 5min

// Monitoring
getRateLimiterStats()
  // Returns: { trackedUsers, minInterval }

// Constants
MIN_INTERVAL_MS = 5000 // 5 seconds
CLEANUP_INTERVAL_MS = 300000 // 5 minutes
```

### External Dependencies

**None** - Pure in-memory implementation

### Critical Features

| Feature | Implementation |
|---------|----------------|
| Token bucket style | Map-based tracking (userId → lastMessageTime) |
| Minimum interval | 5 seconds between messages |
| Automatic cleanup | Every 5 minutes (removes entries >1hr old) |
| Privacy-preserving | Logs masked phone numbers (***1234) |
| Cold start reset | In-memory (resets on deployment) |

### Rate Limit Logic

**Check Flow**:
1. Get last message timestamp for user (from Map)
2. Calculate elapsed time since last message
3. If elapsed < 5 seconds: REJECT (return waitTime)
4. If elapsed >= 5 seconds: ALLOW (update lastMessageTime)

**Cleanup**:
- Runs every 5 minutes (setInterval)
- Removes entries where lastMessageTime > 1 hour ago
- Reduces memory footprint for inactive users

### Configuration

**Constants**:
```typescript
MIN_INTERVAL_MS = 5000 // 5 seconds per message
CLEANUP_INTERVAL_MS = 300000 // Cleanup every 5 minutes
ENTRY_MAX_AGE_MS = 3600000 // Remove entries after 1 hour
```

### Rate Limit Response

**Allowed**:
```typescript
{ allowed: true, waitTime: 0 }
```

**Rejected**:
```typescript
{ allowed: false, waitTime: 3000 } // 3 seconds remaining
```

### Privacy-Preserving Logging

**Masked Phone Numbers**:
```typescript
// Input: +573001234567
// Logged: ***4567
```

**Why**: Avoid logging full phone numbers in rate limit logs

## Test Coverage

| Test | File | Status |
|------|------|--------|
| Rate limiter | tests/unit/rate-limiter.test.ts | PASS |

**Coverage**: GOOD (core logic tested)

## Related ADRs

**None** - Simple utility, no architecture decisions

**Related to ADR-004**: WhatsApp API has 250 msg/sec limit (this is user-level rate limiting)

## Known Issues

**Cold Start Reset**: In-memory tracking resets on deployment (acceptable for MVP)

**No Persistence**: Rate limit state lost on server restart

## Logs

**Rate Limit Violations**: ~5-10/day (mostly accidental rapid messages)

**Average Wait Time**: 2-3 seconds when rejected

**Cleanup Runs**: Every 5 minutes, removes ~10-20 inactive users

**Memory Usage**: ~1KB per tracked user (~100 users = ~100KB)

## Next Steps

| Priority | Task | Effort |
|----------|------|--------|
| P3 | Add Redis persistence (survive cold starts) | 4hr |
| P3 | Configurable rate limits per user tier | 3hr |
| P3 | Add burst allowance (allow 3 messages in 5s, then enforce) | 2hr |

## Implementation Completeness

**Status**: COMPLETE (sufficient for MVP)

**Shipped**: 2026-01-01

**Production**: Stable, preventing spam effectively
