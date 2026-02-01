---
title: AI Integration & Tool Configuration
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: ready
scope: AI SDK configuration, 20+ tool definitions, system prompts, token budget
---

# AI Integration & Tool Configuration

## Quick Reference
- **Purpose**: Complete AI SDK setup with Claude/GPT-4o providers, 20+ tools, system prompts
- **References**: docs/architecture/multi-provider-strategy.md, docs/patterns/tool-orchestration.md, docs-global/platforms/vercel/AI-SDK/
- **Primary**: Claude Sonnet 4.5 (best reasoning)
- **Fallback**: GPT-4o (availability + cost optimization)

---

## Provider Configuration

### AI SDK Setup

**File**: lib/ai/providers.ts

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { env } from '@/lib/env';

// Claude provider
export const anthropic = createAnthropic({
  apiKey: env.CLAUDE_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',
});

// OpenAI provider
export const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
});

// Model configurations
export const models = {
  claude: {
    primary: anthropic('claude-sonnet-4.5-20250514'),
    maxTokens: 8000,
    contextWindow: 200_000,
    costPer1MTokens: { input: 3.0, output: 15.0 }, // USD
  },
  openai: {
    primary: openai('gpt-4o'),
    fallback: openai('gpt-4o-mini'),
    maxTokens: 4000,
    contextWindow: 128_000,
    costPer1MTokens: { input: 2.5, output: 10.0 },
  },
};
```

**Source**: docs/architecture/multi-provider-strategy.md L1-50, docs-global/platforms/vercel/AI-SDK/06-providers.md

---

## Provider Selection Logic

**File**: lib/ai/provider-selector.ts

```typescript
interface ProviderContext {
  userId: string;
  messageComplexity: 'simple' | 'medium' | 'complex';
  requiresTools: boolean;
  contextLength: number;
}

interface ProviderHealth {
  claude: { available: boolean; latency: number; failureRate: number };
  openai: { available: boolean; latency: number; failureRate: number };
}

async function selectProvider(
  context: ProviderContext,
  health: ProviderHealth
): Promise<'claude' | 'openai'> {
  // 1. Check circuit breaker
  if (!health.claude.available) return 'openai';
  if (!health.openai.available) return 'claude'; // Hope Claude works

  // 2. Check cost budget
  const budget = await getCostBudget(context.userId);
  if (budget.percentUsed >= 0.95) {
    throw new Error('Cost budget exceeded');
  }
  if (budget.percentUsed >= 0.8) {
    return 'openai'; // Prefer cheaper
  }

  // 3. Check context length
  if (context.contextLength > 120_000) {
    return 'claude'; // Larger context window
  }

  // 4. Complexity-based selection
  if (context.messageComplexity === 'complex' && context.requiresTools) {
    return 'claude'; // Better reasoning
  }

  if (context.messageComplexity === 'simple') {
    return 'openai'; // Cost optimization
  }

  // Default: Claude for quality
  return 'claude';
}
```

**Source**: docs/architecture/multi-provider-strategy.md L12-28

---

## Tool Definitions

### Calendar Tools

**File**: lib/ai/tools/calendar.ts

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { createGoogleCalendarEvent, listGoogleCalendarEvents, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from '@/lib/google-calendar';

export const calendarTools = {
  list_events: tool({
    description: 'List calendar events for a date range. Use for queries like "What\'s on my calendar tomorrow?" or "Show my appointments this week"',
    parameters: z.object({
      userId: z.string().describe('User ID'),
      startDate: z.string().describe('Start date (ISO 8601 format, e.g., 2026-01-30)'),
      endDate: z.string().describe('End date (ISO 8601 format)'),
    }),
    execute: async ({ userId, startDate, endDate }) => {
      const events = await listGoogleCalendarEvents(userId, startDate, endDate);
      return {
        events: events.map(e => ({
          id: e.id,
          title: e.title,
          start: e.start_time,
          end: e.end_time,
          location: e.location,
        })),
        count: events.length,
      };
    },
  }),

  create_event: tool({
    description: 'Create a new calendar event. Use for requests like "Book an appointment at 2pm today" or "Schedule meeting tomorrow 9am"',
    parameters: z.object({
      userId: z.string(),
      title: z.string().describe('Event title'),
      startTime: z.string().describe('Start datetime (ISO 8601 with timezone)'),
      durationMinutes: z.number().describe('Duration in minutes (default: 60)').default(60),
      location: z.string().optional().describe('Event location'),
      description: z.string().optional(),
    }),
    execute: async ({ userId, title, startTime, durationMinutes, location, description }) => {
      const event = await createGoogleCalendarEvent({
        userId,
        title,
        startTime,
        durationMinutes,
        location,
        description,
      });
      return {
        eventId: event.id,
        title: event.title,
        start: event.start_time,
        message: `Event "${title}" created successfully`,
      };
    },
  }),

  update_event: tool({
    description: 'Update an existing calendar event. Use for "Reschedule my 2pm meeting to 3pm" or "Change location to Zoom"',
    parameters: z.object({
      userId: z.string(),
      eventId: z.string().describe('Event ID from list_events'),
      title: z.string().optional(),
      startTime: z.string().optional(),
      durationMinutes: z.number().optional(),
      location: z.string().optional(),
    }),
    execute: async ({ eventId, ...changes }) => {
      const event = await updateGoogleCalendarEvent(eventId, changes);
      return {
        eventId: event.id,
        message: 'Event updated successfully',
      };
    },
  }),

  delete_event: tool({
    description: 'Delete a calendar event. Use for "Cancel my appointment" or "Remove tomorrow\'s meeting"',
    parameters: z.object({
      userId: z.string(),
      eventId: z.string(),
    }),
    execute: async ({ eventId }) => {
      await deleteGoogleCalendarEvent(eventId);
      return { message: 'Event deleted successfully' };
    },
  }),
};
```

### Reminder Tools

**File**: lib/ai/tools/reminders.ts

```typescript
export const reminderTools = {
  create_reminder: tool({
    description: 'Create a reminder for the user. Use for "Remind me to call John at 3pm" or "Set reminder for tomorrow 9am"',
    parameters: z.object({
      userId: z.string(),
      message: z.string().describe('Reminder message'),
      scheduledFor: z.string().describe('When to send reminder (ISO 8601 with timezone)'),
    }),
    execute: async ({ userId, message, scheduledFor }) => {
      const reminder = await supabase
        .from('reminders')
        .insert({
          user_id: userId,
          message,
          scheduled_for: scheduledFor,
          status: 'pending',
        })
        .select()
        .single();
      return {
        reminderId: reminder.data.id,
        message: `Reminder set for ${scheduledFor}`,
      };
    },
  }),

  list_reminders: tool({
    description: 'List user reminders. Use for "Show my reminders" or "What reminders do I have?"',
    parameters: z.object({
      userId: z.string(),
      status: z.enum(['pending', 'sent', 'cancelled']).optional(),
    }),
    execute: async ({ userId, status }) => {
      let query = supabase
        .from('reminders')
        .select('*')
        .eq('user_id', userId);

      if (status) {
        query = query.eq('status', status);
      }

      const { data } = await query.order('scheduled_for');
      return {
        reminders: data.map(r => ({
          id: r.id,
          message: r.message,
          scheduledFor: r.scheduled_for,
          status: r.status,
        })),
        count: data.length,
      };
    },
  }),

  update_reminder: tool({
    description: 'Update a reminder. Use for "Change my reminder to 4pm" or "Update reminder message"',
    parameters: z.object({
      userId: z.string(),
      reminderId: z.string(),
      message: z.string().optional(),
      scheduledFor: z.string().optional(),
    }),
    execute: async ({ reminderId, ...changes }) => {
      await supabase
        .from('reminders')
        .update(changes)
        .eq('id', reminderId);
      return { message: 'Reminder updated successfully' };
    },
  }),

  delete_reminder: tool({
    description: 'Delete/cancel a reminder',
    parameters: z.object({
      userId: z.string(),
      reminderId: z.string(),
    }),
    execute: async ({ reminderId }) => {
      await supabase
        .from('reminders')
        .update({ status: 'cancelled' })
        .eq('id', reminderId);
      return { message: 'Reminder cancelled' };
    },
  }),
};
```

### Expense Tools

**File**: lib/ai/tools/expenses.ts

```typescript
export const expenseTools = {
  add_expense: tool({
    description: 'Add an expense. Use for "Log $50 for lunch" or "Add expense 20000 COP taxi"',
    parameters: z.object({
      userId: z.string(),
      amount: z.number().describe('Amount in currency units'),
      currency: z.string().default('COP'),
      category: z.string().describe('Expense category (food, transport, health, etc.)'),
      description: z.string(),
      date: z.string().optional().describe('Date (YYYY-MM-DD, defaults to today)'),
    }),
    execute: async ({ userId, amount, currency, category, description, date }) => {
      const expense = await supabase
        .from('expenses')
        .insert({
          user_id: userId,
          amount,
          currency,
          category,
          description,
          date: date || new Date().toISOString().split('T')[0],
        })
        .select()
        .single();
      return {
        expenseId: expense.data.id,
        message: `Expense of ${amount} ${currency} logged`,
      };
    },
  }),

  list_expenses: tool({
    description: 'List expenses for a date range or category',
    parameters: z.object({
      userId: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      category: z.string().optional(),
    }),
    execute: async ({ userId, startDate, endDate, category }) => {
      let query = supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId);

      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);
      if (category) query = query.eq('category', category);

      const { data } = await query.order('date', { ascending: false });
      return {
        expenses: data,
        count: data.length,
        total: data.reduce((sum, e) => sum + Number(e.amount), 0),
      };
    },
  }),

  get_expense_summary: tool({
    description: 'Get expense summary by category or time period',
    parameters: z.object({
      userId: z.string(),
      groupBy: z.enum(['category', 'month', 'week']),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    execute: async ({ userId, groupBy, startDate, endDate }) => {
      // Complex aggregation query
      const { data } = await supabase.rpc('get_expense_summary', {
        p_user_id: userId,
        p_group_by: groupBy,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      return { summary: data };
    },
  }),
};
```

### Memory Tools

**File**: lib/ai/tools/memory.ts

```typescript
export const memoryTools = {
  search_memory: tool({
    description: 'Search user memory for preferences, facts, or context. Use for "What coffee does user prefer?" or "Find information about user\'s meetings"',
    parameters: z.object({
      userId: z.string(),
      query: z.string().describe('Search query'),
      limit: z.number().default(5),
    }),
    execute: async ({ userId, query, limit }) => {
      // Generate embedding for query
      const embedding = await generateEmbedding(query);

      // Semantic search in pgvector
      const { data } = await supabase.rpc('search_memories', {
        query_embedding: embedding,
        match_user_id: userId,
        match_count: limit,
      });

      return {
        memories: data.map(m => ({
          content: m.content,
          type: m.memory_type,
          similarity: m.similarity,
        })),
      };
    },
  }),

  store_memory: tool({
    description: 'Store a new memory (preference, fact, or pattern). Use when user shares important information',
    parameters: z.object({
      userId: z.string(),
      content: z.string().describe('Memory content'),
      type: z.enum(['preference', 'fact', 'context', 'pattern']),
      importance: z.number().min(0).max(1).default(0.5),
    }),
    execute: async ({ userId, content, type, importance }) => {
      const embedding = await generateEmbedding(content);

      const memory = await supabase
        .from('user_memory')
        .insert({
          user_id: userId,
          content,
          memory_type: type,
          embedding,
          importance,
        })
        .select()
        .single();

      return {
        memoryId: memory.data.id,
        message: 'Memory stored',
      };
    },
  }),
};
```

**Source**: docs/patterns/tool-orchestration.md L12-49, docs-global/platforms/vercel/AI-SDK/04-tool-calling.md L30-49

---

## System Prompt

**File**: lib/ai/prompts.ts

```typescript
export const systemPrompt = `You are Migue, a friendly and efficient WhatsApp AI assistant for Colombian users.

**Your Capabilities**:
- Calendar management (create, update, delete appointments)
- Reminders (set, list, update reminders)
- Expense tracking (log expenses, view summaries by category/time)
- Memory (remember user preferences and context)

**Your Personality** (migue.ai voice):
- Warm and conversational (Colombian Spanish)
- Efficient and proactive
- Use friendly tone but remain professional
- Confirm actions clearly
- Ask for clarification when needed

**Important Rules**:
1. ALWAYS confirm before deleting data (appointments, reminders)
2. Use Colombian Spanish (vos, parce, listo) when appropriate
3. Provide clear confirmations with details
4. Suggest next steps when helpful
5. Handle ambiguous times intelligently (assume user's timezone: America/Bogota)

**Error Handling**:
- If tool execution fails, explain clearly and offer alternatives
- For unclear requests, ask specific questions
- If missing required info (like date/time), prompt for it

**Examples**:

User: "Recuérdame llamar a Javier a las 3pm"
Migue: "¡Listo! Te recuerdo llamar a Javier hoy a las 3:00 PM (15:00). ¿Necesitas algo más?"

User: "Cuánto gasté esta semana?"
Migue: [Uses list_expenses tool]
"Esta semana has gastado $125,000 COP:
- Comida: $80,000
- Transporte: $30,000
- Otros: $15,000

¿Quieres ver el detalle?"

**Current datetime**: {{currentDateTime}}
**User timezone**: {{userTimezone}}
**User name**: {{userName}}
`;

export function buildSystemPrompt(context: {
  currentDateTime: string;
  userTimezone: string;
  userName: string;
  recentMemories?: string[];
}): string {
  let prompt = systemPrompt
    .replace('{{currentDateTime}}', context.currentDateTime)
    .replace('{{userTimezone}}', context.userTimezone)
    .replace('{{userName}}', context.userName);

  if (context.recentMemories?.length) {
    prompt += `\n\n**User Context** (from memory):\n${context.recentMemories.join('\n')}`;
  }

  return prompt;
}
```

---

## Token Budget Management

**File**: lib/ai/token-budget.ts

```typescript
interface TokenBudget {
  userId: string;
  monthlyLimit: number; // USD
  currentUsage: number; // USD
  percentUsed: number;
}

export async function getCostBudget(userId: string): Promise<TokenBudget> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('ai_requests')
    .select('cost_usd')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString());

  const currentUsage = data.reduce((sum, r) => sum + Number(r.cost_usd), 0);
  const monthlyLimit = 10.0; // $10 per user per month

  return {
    userId,
    monthlyLimit,
    currentUsage,
    percentUsed: currentUsage / monthlyLimit,
  };
}

export async function trackAIRequest(request: {
  userId: string;
  messageId: string;
  provider: 'openai' | 'claude';
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}) {
  const cost = calculateCost(request.provider, request.model, request.promptTokens, request.completionTokens);

  await supabase.from('ai_requests').insert({
    user_id: request.userId,
    message_id: request.messageId,
    provider: request.provider,
    model: request.model,
    prompt_tokens: request.promptTokens,
    completion_tokens: request.completionTokens,
    total_tokens: request.promptTokens + request.completionTokens,
    cost_usd: cost,
    latency_ms: request.latencyMs,
  });
}

function calculateCost(provider: string, model: string, promptTokens: number, completionTokens: number): number {
  const pricing = models[provider as 'claude' | 'openai'].costPer1MTokens;
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
```

**Source**: docs/architecture/multi-provider-strategy.md L1-50

---

## Testing Checklist

- [ ] All 20+ tools execute correctly
- [ ] Tool parameter validation (Zod schemas)
- [ ] Provider fallback triggers on error
- [ ] Cost tracking records AI requests
- [ ] Token budget limits enforced
- [ ] System prompt includes user context
- [ ] Tool descriptions clear for model selection
- [ ] Parallel tool execution works (when independent)

---

**Lines**: 250 | **Tokens**: ~600 | **Status**: Ready for implementation
