---
title: "Message Processing"
date: "2026-02-07 02:45"
updated: "2026-02-07 02:45"
status: "shipped"
phase: "step-8"
priority: "P1"
complexity: "medium"
estimated_hours: 10
---

# Message Processing

## What It Does

Message normalization, database persistence, and conversation history management. Converts WhatsApp webhook messages to normalized format supporting all message types (text, image, audio, sticker, document, video, reaction, order, interactive). Persists inbound/outbound messages with RLS error detection. Conversation history with 60s in-memory cache.

## Why It Exists

**Data Normalization**: WhatsApp webhook format is complex, normalization simplifies AI processing

**Persistence**: All messages stored in database for conversation history

**Cache Optimization**: 60s cache reduces database queries during active conversations

## Current Implementation

### Files

| File | Lines | Purpose |
|------|-------|---------|
| lib/message-normalization.ts | 153 | Webhook to normalized format |
| lib/persist.ts | 245 | Database persistence with RLS detection |
| lib/conversation-utils.ts | 229 | History management + actions |

**Total**: 627 lines

### Key Exports

```typescript
// Normalization
whatsAppMessageToNormalized(webhookMessage)
  // Converts: WhatsApp webhook → NormalizedMessage
extractInteractiveReply(interactive)
  // Parses: button/list responses

// Database persistence
persistNormalizedMessage(conversationId, normalizedMessage)
upsertUserByPhone(phoneNumber, name)
getOrCreateConversation(userId)
insertInboundMessage(conversationId, message)
insertOutboundMessage(conversationId, message)
updateInboundMessageByWaId(waMessageId, updates)

// Conversation history
getConversationHistory(conversationId, limit)
  // Returns: cached or fresh from database
historyToChatMessages(history) // → CoreMessage[]
historyToModelMessages(history) // → Message[]

// Actions
recordConversationAction(conversationId, actionType, actionData)
```

### External Dependencies

| Service | Cost | Purpose |
|---------|------|---------|
| Supabase | Included | Database (users, conversations, messages) |
| Zod | Free | Schema validation |
| In-memory Map | Free | 60s history cache |

### Database Schema

**Table**: `users`

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| phone_number | text | WhatsApp phone (UNIQUE) |
| name | text | User name |
| created_at | timestamptz | Creation timestamp |

**Table**: `conversations`

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last message |

**Table**: `messages`

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| conversation_id | uuid | FK to conversations |
| wa_message_id | text | WhatsApp message ID (UNIQUE, up to 68 chars) |
| direction | text | inbound/outbound |
| message_type | text | text/image/audio/sticker/document/video/reaction/order/interactive |
| content | jsonb | Message content |
| created_at | timestamptz | Timestamp |

**Upsert**: `ON CONFLICT (wa_message_id) DO UPDATE`

### Supported Message Types

**All WhatsApp types**:
- text
- image
- audio
- sticker
- document
- video
- reaction
- order
- interactive (button/list responses)

**Normalized Format**:
```typescript
{
  type: 'text' | 'image' | ...,
  text?: string,
  mediaId?: string,
  mimeType?: string,
  caption?: string,
  reaction?: { emoji, messageId },
  interactive?: { type, id, title }
}
```

### Critical Features

| Feature | Implementation |
|---------|----------------|
| RLS error detection | Enhanced logging for permission errors |
| Message upsert | ON CONFLICT (wa_message_id) DO UPDATE |
| History cache | 60s TTL (per code) |
| Type validation | Zod schemas for all message types |
| Error categories | duplicate, invalid_type, constraint_violation, rls_denied |
| Action tracking | Record user actions (schedule, reminder, expense) |

### Error Detection

**Enhanced Logging**:
- `duplicate` - Message already exists (wa_message_id conflict)
- `invalid_type` - Unknown message type
- `constraint_violation` - Database constraint error
- `rls_denied` - Row-level security permission denied (includes diagnostic info)

**RLS Diagnostic**:
- Current user ID
- Attempted conversation ID
- User's conversations list (for debugging)

## Test Coverage

| Test | File | Status |
|------|------|--------|
| Persist failures | tests/unit/persist-failures.test.ts | PASS |
| Schema validation | tests/unit/schemas.test.ts | PASS |

**Coverage**: PARTIAL (error handling tested, normalization pending)

## Related ADRs

**ADR-002**: Cache TTL increases
- History: 60s→5min proposed
- **Status**: NOT implemented (code still shows 60s)

## Known Issues

**Cache TTL Mismatch**: ADR-002 proposed 5min, code implements 60s

**Missing Tests**: Normalization logic lacks unit tests

## Logs

**Normalization Success Rate**: ~99% (failures mostly unsupported message types)

**RLS Errors**: <1% (mostly race conditions during user creation)

**Cache Hit Rate**: ~70% during active conversations

**Average Persist Latency**: 50-150ms

## Next Steps

| Priority | Task | Effort |
|----------|------|--------|
| P1 | Add unit tests for message normalization | 3hr |
| P2 | Implement ADR-002 cache TTL increase (60s→5min) | 1hr |
| P2 | Add support for new WhatsApp message types (polls, reactions to reactions) | 4hr |
| P3 | Optimize RLS policies (reduce permission checks) | 4hr |

## Implementation Completeness

**Status**: COMPLETE

**Shipped**: 2026-01-01 (initial), 2026-02-03 (wa_message_id column resize)

**Production**: Stable, all message types supported
