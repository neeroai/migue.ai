---
title: "Agentic Message Patterns"
summary: "Reactive vs proactive messaging, multi-step flows, context preservation, escalation strategies"
description: "Message pattern catalog with state machines for appointment booking, expense categorization, confidence scoring, and graceful escalation to user when needed"
version: "1.0"
date: "2026-01-29"
updated: "2026-01-29"
scope: "Features"
---

# Agentic Message Patterns

## Reactive vs Proactive Comparison

| Pattern | Trigger | Timing | Confidence | Example | Response Time |
|---------|---------|--------|------------|---------|---------------|
| Reactive | User message | Immediate | High | User: "What's my schedule?" | <3s |
| Reactive | User question | Immediate | Medium | User: "How much did I spend?" | <3s |
| Reactive | User command | Immediate | High | User: "Create reminder" | <5s |
| Proactive | Cron schedule | Predetermined | High | Daily summary at 8am | <10s |
| Proactive | Event trigger | Event-based | Medium | Reminder 10min before meeting | <5s |
| Proactive | Pattern detected | Contextual | Low | "You usually order now, want coffee?" | <5s |
| Proactive | Anomaly detected | Alert-based | High | "Unusual expense detected" | <5s |
| Proactive | Window expiring | Time-based | High | "24h window closes in 1h" | <3s |

**Decision logic**:
- Reactive: Always respond to user-initiated messages
- Proactive: Require confidence >0.8 OR user opt-in OR critical alert

---

## Multi-Step Flow States

### Appointment Booking Flow

| Step | State | Actions | Validation | Next State | Rollback |
|------|-------|---------|------------|------------|----------|
| 1 | Intent | Detect "book appointment" | Intent confidence >0.8 | Collecting | Cancel |
| 2 | Collecting | Ask for date/time | Parse datetime | Confirming | Retry |
| 3 | Confirming | Show summary, ask confirm | User responds yes/no | Executing | Edit |
| 4 | Executing | Call create_event tool | API success | Completed | Retry |
| 5 | Completed | Send confirmation | Message sent | Idle | - |

**State machine diagram**:
```
Idle → [User: "book appointment"]
  → Intent (confidence check)
    → Collecting (ask date)
      → Collecting (ask time)
        → Confirming (show summary)
          → [User: "yes"] → Executing (API call)
            → Completed (confirmation)
              → Idle
          → [User: "no"] → Edit (ask what to change)
            → Collecting (retry)
          → [User: "cancel"] → Cancelled → Idle
```

**Implementation**:
```typescript
class AppointmentBookingFlow {
  async handle(message: string, state: FlowState): Promise<FlowResponse> {
    switch (state.current) {
      case 'INTENT':
        if (detectIntent(message) > 0.8) {
          return {
            nextState: 'COLLECTING',
            message: "When would you like to schedule the appointment?",
            context: { intent: 'book_appointment' }
          };
        }
        break;

      case 'COLLECTING':
        const datetime = parseDatetime(message);
        if (datetime) {
          return {
            nextState: 'CONFIRMING',
            message: `Book appointment for ${datetime}?`,
            context: { ...state.context, datetime }
          };
        } else {
          return {
            nextState: 'COLLECTING',
            message: "I didn't understand the date. Please say like 'tomorrow at 2pm'",
            context: state.context
          };
        }

      case 'CONFIRMING':
        if (message.toLowerCase().includes('yes')) {
          return {
            nextState: 'EXECUTING',
            action: 'create_event',
            context: state.context
          };
        } else {
          return {
            nextState: 'EDIT',
            message: "What would you like to change?",
            context: state.context
          };
        }

      case 'EXECUTING':
        const result = await createEvent(state.context.datetime);
        return {
          nextState: 'COMPLETED',
          message: `Appointment booked for ${result.datetime}`,
          context: { event_id: result.id }
        };
    }
  }
}
```

---

### Expense Categorization Flow

| Step | State | Actions | Validation | Next State | Rollback |
|------|-------|---------|------------|------------|----------|
| 1 | Detect | OCR extract or parse text | Has amount | Categorizing | Manual |
| 2 | Categorizing | AI suggest category | Confidence >0.7 | Confirming | Manual |
| 3 | Confirming | Show: "$50 lunch?" | User confirms | Storing | Edit |
| 4 | Storing | Insert into expenses | DB success | Learning | Retry |
| 5 | Learning | Update category patterns | Pattern saved | Completed | - |

**State machine diagram**:
```
Idle → [Receipt image OR "spent $50"]
  → Detect (OCR/parse)
    → Categorizing (AI suggest)
      → [confidence > 0.7] → Confirming ("$50 lunch?")
        → [User: "yes"] → Storing (DB insert)
          → Learning (update patterns)
            → Completed → Idle
        → [User: "no, it was dinner"] → Edit (user corrects)
          → Storing (with correction)
            → Learning → Completed → Idle
      → [confidence < 0.7] → Manual ("What category?")
        → [User provides] → Storing
          → Learning → Completed → Idle
```

**Implementation**:
```typescript
class ExpenseCategorizationFlow {
  async categorize(data: {
    amount: number;
    description: string;
    userId: string;
  }): Promise<FlowResponse> {
    // AI categorization
    const suggestion = await this.aiCategorize(data.description);

    if (suggestion.confidence > 0.7) {
      return {
        nextState: 'CONFIRMING',
        message: `Log $${data.amount} as ${suggestion.category}?`,
        context: { ...data, suggested: suggestion.category }
      };
    } else {
      return {
        nextState: 'MANUAL',
        message: `What category for $${data.amount} (${data.description})?`,
        context: data
      };
    }
  }

  async store(data: ExpenseData, category: string): Promise<void> {
    // Store expense
    await supabase.from('expenses').insert({
      user_id: data.userId,
      amount: data.amount,
      category: category,
      description: data.description
    });

    // Learn pattern
    await this.updateCategoryPattern(data.description, category);
  }
}
```

---

## Context Preservation Strategies

| Entity Type | Cache Duration | Storage | Retrieval | Invalidation |
|-------------|----------------|---------|-----------|--------------|
| Active intent | 5 minutes | Redis/Edge | By session_id | On intent completion |
| User preferences | 24 hours | Redis + Supabase | By user_id | On preference update |
| Conversation context | 30 minutes | Redis | By user_id + sliding window | On inactivity |
| Multi-step flow state | 10 minutes | Supabase | By user_id + flow_id | On flow completion |
| Calendar cache | 1 hour | Redis | By user_id | On event CRUD |
| Expense patterns | 7 days | Redis + Supabase | By user_id | On pattern update |
| Location context | 6 hours | Redis | By user_id | On explicit change |
| Language preference | Indefinite | Supabase | By user_id | On language switch |

**Cache hierarchy**:
1. Edge function memory (fastest, 30s TTL)
2. Redis (fast, configurable TTL)
3. Supabase (persistent, long TTL)

**Refresh strategy**:
- Read-through: Check cache → Miss → Query DB → Update cache
- Write-through: Update DB → Invalidate cache → Next read refreshes
- Background sync: Cron job refreshes hot caches every 5 minutes

---

## Escalation Decision Matrix

| Confidence | Ambiguity | Action | Message Template | Retry Limit |
|------------|-----------|--------|------------------|-------------|
| >0.9 | None | Auto-execute | Confirmation only | - |
| 0.7-0.9 | Low | Ask confirm | "Did you mean X?" | 1 |
| 0.5-0.7 | Medium | Clarify | "Did you mean X or Y?" | 2 |
| 0.3-0.5 | High | Ask open | "I'm not sure, can you clarify?" | 2 |
| <0.3 | Very high | Apologize | "I don't understand, can you rephrase?" | 3 |
| Retry exceeded | - | Escalate | "Let me connect you with support" | - |

**Confidence scoring**:
```typescript
function calculateConfidence(
  intent: string,
  entities: Entity[],
  context: Context
): number {
  let score = 0;

  // Intent clarity (0-0.5)
  score += intentModel.score(intent) * 0.5;

  // Entity completeness (0-0.3)
  const requiredEntities = INTENT_ENTITIES[intent];
  const extracted = entities.filter(e => requiredEntities.includes(e.type));
  score += (extracted.length / requiredEntities.length) * 0.3;

  // Context relevance (0-0.2)
  score += contextRelevance(context, intent) * 0.2;

  return Math.min(score, 1.0);
}
```

**Escalation handler**:
```typescript
async function handleUncertainty(
  confidence: number,
  intent: string,
  context: Context
): Promise<Message> {
  if (confidence > 0.9) {
    return { type: 'execute', confirmFirst: false };
  } else if (confidence > 0.7) {
    return { type: 'confirm', message: `Did you mean to ${intent}?` };
  } else if (confidence > 0.5) {
    const alternatives = getTopAlternatives(intent, 2);
    return {
      type: 'clarify',
      message: `Did you mean ${alternatives[0]} or ${alternatives[1]}?`
    };
  } else if (confidence > 0.3) {
    return {
      type: 'open_question',
      message: "I'm not sure I understand. Can you clarify?"
    };
  } else {
    return {
      type: 'apologize',
      message: "I don't understand. Can you rephrase that?"
    };
  }
}
```

---

## Proactive Pattern Detection

| Pattern | Detection Logic | Confidence Threshold | Example | Frequency Limit |
|---------|----------------|---------------------|---------|-----------------|
| Daily routine | 3+ occurrences same time | 0.8 | Coffee order at 9am | 1x/day |
| Weekly habit | 2+ weeks same day | 0.7 | Grocery shopping Sundays | 1x/week |
| Location-based | Arrive at saved location | 0.9 | "Arrived at gym, start workout?" | 1x/visit |
| Spending anomaly | 3x average spend | 0.85 | "$500 expense, unusual for you" | Immediate |
| Forgotten reminder | Reminder passed, no action | 0.9 | "You had meeting at 2pm, missed?" | 30min after |
| Calendar conflict | 2 events overlap | 1.0 | "2 meetings at same time" | Immediate |

**Proactive message rules**:
- User must opt-in to pattern-based messages
- Max 3 proactive messages per day
- Allow user to disable patterns individually
- Always allow "stop suggestions" command

---

## Conversation Flow Best Practices

**Do**:
- Keep state for multi-step flows
- Confirm before destructive actions
- Provide escape hatches ("cancel", "start over")
- Give clear progress indicators ("Step 2 of 3")
- Preserve context across messages
- Handle typos gracefully

**Don't**:
- Assume user intent without confirmation
- Execute high-impact actions without review
- Forget conversation context
- Send proactive messages without opt-in
- Continue failed flow without offering restart
- Over-explain (be concise)

---

## Citations

- **WhatsApp expert output**: Conversational flow patterns
- **molbot auto-reply pipeline**: Reactive/proactive architecture
- **PRD Section 4**: Feature requirements for booking, expenses, reminders
- **docs-global/standards/ai-first-interfaces.md**: Error-as-prompt patterns

---

**Lines**: 276 | **Tokens**: ~828
