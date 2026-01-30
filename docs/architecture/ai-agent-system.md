---
title: "AI Agent System Architecture"
summary: "Core agent architecture with 20+ tools, thinking modes, and state management"
description: "Single-agent design with tool orchestration, thinking mode selection (fast/extended), session state machine, and integration patterns for WhatsApp conversational AI"
version: "1.0"
date: "2026-01-29"
updated: "2026-01-29"
scope: "Architecture"
---

# AI Agent System Architecture

## Architecture Comparison

| Aspect | Single-Agent | Multi-Agent | migue.ai Choice |
|--------|--------------|-------------|-----------------|
| Complexity | Low | High | Single-agent |
| Context sharing | Native | Requires coordination | Native |
| Tool orchestration | Centralized | Distributed | Centralized |
| State management | Simple | Complex | Simple |
| Cost | Lower | Higher | Lower |
| Maintenance | Easy | Difficult | Easy |
| Latency | Faster | Slower | Faster |

**Rationale**: 2-person team (ClaudeCode&OnlyMe), simpler maintenance, lower cost, WhatsApp 5s timeout

---

## Tool Catalog (20+ Tools)

| Tool | Category | Inputs | Outputs | Latency | Example |
|------|----------|--------|---------|---------|---------|
| list_events | Calendar | date_range, user_id | events[] | 200ms | List tomorrow's appointments |
| create_event | Calendar | title, datetime, duration | event_id | 300ms | Book appointment 2pm today |
| update_event | Calendar | event_id, changes | success | 250ms | Reschedule to 3pm |
| delete_event | Calendar | event_id | success | 200ms | Cancel meeting |
| create_reminder | Reminders | message, datetime, user_id | reminder_id | 150ms | Remind me at 9am |
| list_reminders | Reminders | user_id, status | reminders[] | 100ms | Show pending reminders |
| update_reminder | Reminders | reminder_id, changes | success | 150ms | Change to 10am |
| delete_reminder | Reminders | reminder_id | success | 100ms | Delete reminder |
| add_expense | Expenses | amount, category, description | expense_id | 200ms | Log $50 lunch |
| list_expenses | Expenses | date_range, user_id | expenses[] | 150ms | Show this week's expenses |
| categorize_expense | Expenses | description | category, confidence | 100ms | Auto-categorize "Starbucks" |
| get_expense_summary | Expenses | date_range, group_by | summary{} | 200ms | Monthly spending by category |
| search_memory | Memory | query, user_id | memories[] | 300ms | Find preference about coffee |
| store_memory | Memory | content, type, user_id | memory_id | 200ms | Save "prefers morning calls" |
| get_user_preferences | Memory | user_id, category | preferences{} | 150ms | Get notification settings |
| detect_language | Language | text | language, confidence | 50ms | Detect "Hola" → es |
| translate_text | Language | text, target_lang | translated_text | 400ms | Translate to English |
| extract_location | Location | text, context | location{}, confidence | 200ms | Extract "Bogotá" coords |
| get_timezone | Location | location | timezone, offset | 150ms | Bogotá → America/Bogota |
| transcribe_audio | Media | audio_url | text, confidence | 3000ms | Whisper transcription |
| extract_text_ocr | Media | image_url | text, confidence | 2000ms | Extract receipt text |
| send_interactive | WhatsApp | type, content, user_id | message_id | 500ms | Send buttons/list |
| send_reaction | WhatsApp | message_id, emoji | success | 200ms | React with 👍 |
| get_conversation_context | Context | user_id, depth | context{} | 200ms | Last 10 messages |
| check_messaging_window | Window | user_id | is_open, expires_at | 50ms | Verify 24h window |

**Tool selection strategy**: Context analysis → Confidence scoring → Single or parallel execution

---

## Thinking Mode Decision Matrix

| Condition | Mode | Cost | Latency | Use Case |
|-----------|------|------|---------|----------|
| Simple query | Fast | Low | 1-2s | "What's my schedule?" |
| Single tool call | Fast | Low | 1-3s | "Create reminder at 9am" |
| Calculation needed | Fast | Low | 2-4s | "Total expenses this week" |
| Multi-step workflow | Extended | Medium | 5-10s | "Book appointment, send confirmation" |
| Ambiguity resolution | Extended | Medium | 5-8s | "Schedule meeting with unclear time" |
| Complex reasoning | Extended | High | 8-15s | "Optimize calendar conflicts" |
| Multiple tool calls | Extended | High | 10-20s | "Summarize day, create tasks" |

**Selection logic**:
```typescript
function selectThinkingMode(request: string, context: Context): ThinkingMode {
  const complexity = analyzeComplexity(request);
  const toolCount = estimateToolCalls(request);
  const ambiguity = detectAmbiguity(request, context);

  if (complexity < 3 && toolCount <= 1 && !ambiguity) {
    return ThinkingMode.Fast;
  }
  return ThinkingMode.Extended;
}
```

---

## State Machine (Session Management)

| State | Trigger | Next State | Action | Timeout |
|-------|---------|------------|--------|---------|
| Idle | User message | Processing | Parse intent | - |
| Processing | Intent clear | Executing | Select tools | 3s |
| Processing | Intent unclear | Clarifying | Ask question | 3s |
| Clarifying | User response | Processing | Reparse with context | 5s |
| Clarifying | Timeout | Idle | Send timeout message | 30s |
| Executing | Tools success | Responding | Format response | 5s |
| Executing | Tools partial fail | Recovering | Attempt fallback | 3s |
| Executing | Tools total fail | Error | Send error message | - |
| Recovering | Fallback success | Responding | Format response | 3s |
| Recovering | Fallback fail | Error | Send error message | - |
| Responding | Message sent | AwaitingConfirmation | Wait for user | - |
| AwaitingConfirmation | User confirms | Idle | Update state | 60s |
| AwaitingConfirmation | User rejects | Processing | Retry with changes | 60s |
| AwaitingConfirmation | Timeout | Idle | Log unconfirmed | 60s |
| Error | Error handled | Idle | Reset session | - |

**State persistence**: Supabase session_state table, 24h TTL

---

## Tool Orchestration Schemas

### Tool Definition Schema
```yaml
tool:
  name: string              # Unique identifier
  category: enum            # Calendar, Reminders, Expenses, Memory, etc.
  description: string       # Natural language description
  parameters:
    - name: string
      type: string          # string, number, date, enum
      required: boolean
      validation: string    # Regex or rules
  returns:
    type: string
    schema: object
  dependencies: string[]    # Other tools required
  rate_limit:
    max_calls: number
    window: string          # "1m", "1h", "1d"
  timeout_ms: number
  retry:
    max_attempts: number
    backoff: string         # "exponential", "linear"
  cost:
    tokens_avg: number
    external_api: boolean
```

### Agent Configuration
```yaml
agent:
  model:
    primary: "claude-sonnet-4.5"
    fallback: "gpt-4o"
  thinking_mode:
    default: "fast"
    auto_switch: true
    threshold_complexity: 3
  tools:
    enabled: string[]       # List of enabled tool names
    parallel_max: number    # Max parallel tool calls
    timeout_global_ms: number
  context:
    max_messages: number    # Conversation depth
    include_memory: boolean
    include_preferences: boolean
  response:
    max_tokens: number
    format: "conversational"
    language: "auto"        # Auto-detect or fixed
```

### Session State Schema
```yaml
session:
  session_id: string
  user_id: string
  phone_number: string
  state: enum               # Idle, Processing, Clarifying, etc.
  context:
    messages: Message[]     # Recent conversation
    current_intent: string
    entities: object        # Extracted entities
    clarification_attempts: number
  execution:
    pending_tools: string[]
    completed_tools: string[]
    results: object
  metadata:
    started_at: datetime
    last_activity: datetime
    messaging_window_expires: datetime
    language: string
    timezone: string
```

---

## Architecture Overview

**Single-agent design**: Claude Sonnet 4.5 primary, GPT-4o fallback
**Tool orchestration**: Centralized manager, parallel execution when independent
**State management**: Session-based, Supabase persistence, 24h TTL
**Context**: Last 10 messages + user preferences + RAG memory
**Thinking mode**: Auto-switch based on complexity (fast <3s, extended <15s)

**Key principles**:
- **Simplicity**: Single agent reduces coordination overhead
- **Performance**: WhatsApp 5s webhook timeout compliance
- **Cost optimization**: Fast mode for simple queries, extended for complex
- **Tool reuse**: 20+ tools cover calendar, reminders, expenses, memory, media
- **Graceful degradation**: Fallback provider, retry logic, error recovery

---

## Integration Points

**Supabase**: Session state, user preferences, conversation history, RAG embeddings
**WhatsApp API**: Message receive, tool confirmation, interactive messages
**Google Calendar**: OAuth flow, event CRUD, timezone handling
**OpenAI/Anthropic**: LLM inference, function calling, embeddings
**Vercel Edge**: Cold start optimization, streaming responses
**Cron jobs**: Proactive reminders, window maintenance, daily summaries

**Data flow**: WhatsApp webhook → Edge function → Agent processing → Tool execution → Response formatting → WhatsApp send

---

## Citations

- **molbot agents/**: Multi-agent architecture analysis (Explore agent output)
- **PRD Section 8**: AI strategy and tool design
- **AI engineer output**: Architecture recommendations
- **docs-global/standards/workflow-architecture.md**: Feature-first patterns

---

**Lines**: 278 | **Tokens**: ~834
