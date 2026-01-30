---
title: "Tool Orchestration Patterns"
summary: "20+ tool catalog with parallel execution, approval workflows, and error handling"
description: "Comprehensive tool catalog, parallel execution rules, approval workflow matrix, retry configuration, error handling decision tree, and orchestration strategies"
version: "1.0"
date: "2026-01-29"
updated: "2026-01-29"
scope: "Patterns"
---

# Tool Orchestration Patterns

## Tool Catalog (20+ Tools)

| Name | Category | Inputs | Outputs | Latency | Cost | Dependencies |
|------|----------|--------|---------|---------|------|--------------|
| list_events | Calendar | date_range, user_id | events[] | 200ms | Low | Google Calendar API |
| create_event | Calendar | title, datetime, duration, user_id | event_id | 300ms | Low | Google Calendar API |
| update_event | Calendar | event_id, changes | success | 250ms | Low | Google Calendar API |
| delete_event | Calendar | event_id | success | 200ms | Low | Google Calendar API |
| create_reminder | Reminders | message, datetime, user_id | reminder_id | 150ms | Low | Supabase |
| list_reminders | Reminders | user_id, status | reminders[] | 100ms | Low | Supabase |
| update_reminder | Reminders | reminder_id, changes | success | 150ms | Low | Supabase |
| delete_reminder | Reminders | reminder_id | success | 100ms | Low | Supabase |
| add_expense | Expenses | amount, category, description, user_id | expense_id | 200ms | Low | Supabase |
| list_expenses | Expenses | date_range, user_id, category | expenses[] | 150ms | Low | Supabase |
| categorize_expense | Expenses | description | category, confidence | 100ms | Low | AI categorization |
| get_expense_summary | Expenses | date_range, user_id, group_by | summary{} | 200ms | Low | Supabase aggregation |
| search_memory | Memory | query, user_id | memories[] | 300ms | Medium | pgvector search |
| store_memory | Memory | content, type, user_id | memory_id | 200ms | Medium | Embedding generation |
| get_user_preferences | Memory | user_id, category | preferences{} | 150ms | Low | Supabase |
| detect_language | Language | text | language, confidence | 50ms | Low | FastText |
| translate_text | Language | text, target_lang | translated_text | 400ms | Medium | Translation API |
| extract_location | Location | text, context | location{}, confidence | 200ms | Low | NER + geocoding |
| get_timezone | Location | location | timezone, offset | 150ms | Low | Timezone DB |
| transcribe_audio | Media | audio_url | text, confidence | 3000ms | High | Whisper API |
| extract_text_ocr | Media | image_url | text, confidence | 2000ms | Medium | Tesseract |
| send_interactive | WhatsApp | type, content, user_id | message_id | 500ms | Low | WhatsApp API |
| send_reaction | WhatsApp | message_id, emoji | success | 200ms | Low | WhatsApp API |
| get_conversation_context | Context | user_id, depth | context{} | 200ms | Low | Supabase |
| check_messaging_window | Window | user_id | is_open, expires_at | 50ms | Low | Supabase |

**Tool categories**:
- Calendar: 4 tools (CRUD operations)
- Reminders: 4 tools (CRUD operations)
- Expenses: 4 tools (CRUD + analytics)
- Memory: 3 tools (RAG + preferences)
- Language: 2 tools (detection + translation)
- Location: 2 tools (extraction + timezone)
- Media: 2 tools (audio + image processing)
- WhatsApp: 2 tools (interactive + reactions)
- Context: 2 tools (conversation + window)

---

## Parallel Execution Rules

| Tools | Independence Check | Execution Order | Merge Strategy | Max Parallel |
|-------|-------------------|-----------------|----------------|--------------|
| list_events + list_reminders | Yes (different tables) | Parallel | Merge arrays | 5 |
| create_event + create_reminder | Yes (independent writes) | Parallel | Return both IDs | 3 |
| search_memory + get_conversation_context | Yes (different queries) | Parallel | Combine contexts | 5 |
| list_expenses + get_expense_summary | No (summary depends on list) | Sequential | Use list for summary | - |
| create_event + update_event | No (update needs event_id) | Sequential | Return final state | - |
| transcribe_audio + detect_language | No (language needs text) | Sequential | Pass transcription | - |
| extract_location + get_timezone | No (timezone needs location) | Sequential | Return both | - |

**Independence criteria**:
- No data dependencies (output of A not input of B)
- Different resources (no write conflicts)
- Order doesn't affect result
- Can fail independently

**Orchestrator implementation**:
```typescript
class ToolOrchestrator {
  async execute(
    tools: ToolCall[],
    options: { allowParallel: boolean } = { allowParallel: true }
  ): Promise<ToolResult[]> {
    if (!options.allowParallel) {
      return this.executeSequential(tools);
    }

    // Build dependency graph
    const graph = this.buildDependencyGraph(tools);

    // Execute in waves (parallel within wave, sequential between waves)
    const results: ToolResult[] = [];
    const waves = this.topologicalSort(graph);

    for (const wave of waves) {
      const waveResults = await Promise.all(
        wave.map(tool => this.executeTool(tool, results))
      );
      results.push(...waveResults);
    }

    return results;
  }

  private buildDependencyGraph(tools: ToolCall[]): Graph {
    const graph = new Map<string, Set<string>>();

    for (const tool of tools) {
      const deps = this.findDependencies(tool, tools);
      graph.set(tool.id, deps);
    }

    return graph;
  }

  private findDependencies(
    tool: ToolCall,
    allTools: ToolCall[]
  ): Set<string> {
    const deps = new Set<string>();

    // Check if tool uses output of other tools
    for (const other of allTools) {
      if (tool.id === other.id) continue;

      if (this.dependsOn(tool, other)) {
        deps.add(other.id);
      }
    }

    return deps;
  }
}
```

---

## Approval Workflow Matrix

| Tool | Auto-Confirm Criteria | User Confirm Criteria | Timeout | Default |
|------|----------------------|----------------------|---------|---------|
| create_event | Confidence >0.9, non-business hours | All other cases | 60s | Require |
| delete_event | Never | Always | 60s | Require |
| update_event | Minor changes (time <30min) | Major changes | 60s | Require |
| create_reminder | Always | Never | - | Auto |
| add_expense | Amount <$50, category confident | Amount ≥$50 OR low confidence | 30s | Require |
| send_interactive | Always | Never | - | Auto |
| store_memory | Always | Never | - | Auto |
| delete_reminder | Never | Always | 30s | Require |
| transcribe_audio | Always | Never | - | Auto |

**Approval handler**:
```typescript
class ApprovalManager {
  async requestApproval(
    tool: ToolCall,
    params: any
  ): Promise<ApprovalResult> {
    // Check if auto-confirm allowed
    if (this.canAutoConfirm(tool, params)) {
      return { approved: true, auto: true };
    }

    // Build approval message
    const message = this.buildApprovalMessage(tool, params);

    // Send with buttons
    await sendWhatsAppMessage(params.phoneNumber, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: message },
        action: {
          buttons: [
            { id: 'approve', title: 'Confirm' },
            { id: 'reject', title: 'Cancel' }
          ]
        }
      }
    });

    // Wait for response (with timeout)
    const response = await this.waitForResponse(
      params.userId,
      tool.approvalId,
      60000 // 60s timeout
    );

    return {
      approved: response === 'approve',
      auto: false,
      timedOut: response === null
    };
  }

  private canAutoConfirm(tool: ToolCall, params: any): boolean {
    const rules = AUTO_CONFIRM_RULES[tool.name];
    if (!rules) return false;

    return rules.every(rule => rule.check(params));
  }
}
```

---

## Retry Configuration

| Error Type | Max Attempts | Backoff Strategy | Circuit Breaker Threshold | Priority |
|------------|--------------|------------------|---------------------------|----------|
| Network timeout | 3 | Exponential (1s, 2s, 4s) | 5 failures / 1min | P0 |
| Rate limit (429) | 5 | Linear (60s intervals) | 10 failures / 5min | P1 |
| Server error (5xx) | 3 | Exponential (2s, 4s, 8s) | 3 failures / 1min | P0 |
| Invalid params (4xx) | 1 | None | - | P2 |
| Authentication error | 2 | Immediate (refresh token) | 3 failures / 5min | P0 |
| Database error | 3 | Exponential (500ms, 1s, 2s) | 5 failures / 1min | P0 |

**Retry implementation**:
```typescript
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts: number;
    backoff: 'exponential' | 'linear';
    baseDelay: number;
  }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (except rate limits)
      if (isClientError(error) && !isRateLimitError(error)) {
        throw error;
      }

      // Calculate delay
      const delay = options.backoff === 'exponential'
        ? options.baseDelay * Math.pow(2, attempt)
        : options.baseDelay * (attempt + 1);

      // Wait before retry
      if (attempt < options.maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

---

## Error Handling Decision Tree

| Error | Severity | Action | User Notification | Fallback |
|-------|----------|--------|-------------------|----------|
| Tool not found | High | Log + skip | "Feature unavailable" | Use alternative tool |
| Invalid parameters | Medium | Validate + ask | "Please provide X" | Ask for missing params |
| Network timeout | Medium | Retry 3x | "Taking longer, please wait" | Continue without result |
| Rate limit | Low | Queue + retry | "High load, queued" | Process in background |
| Authentication error | High | Refresh + retry | None (transparent) | Use cached data |
| Database error | High | Retry 3x | "Error occurred, retrying" | Use cached data |
| External API error | Medium | Fallback provider | None (transparent) | Use backup API |
| Circuit breaker open | Medium | Block + wait | "Service temporarily down" | Return cached data |

**Error handler**:
```typescript
class ToolErrorHandler {
  async handleError(
    error: Error,
    tool: ToolCall,
    context: Context
  ): Promise<ErrorResolution> {
    // Classify error
    const classification = this.classifyError(error);

    switch (classification.severity) {
      case 'HIGH':
        // Try fallback
        if (classification.type === 'AUTHENTICATION') {
          await this.refreshAuth();
          return { action: 'RETRY', immediate: true };
        } else if (classification.type === 'DATABASE') {
          return {
            action: 'FALLBACK',
            fallback: 'USE_CACHE',
            notify: true
          };
        }
        break;

      case 'MEDIUM':
        // Retry or queue
        if (classification.type === 'TIMEOUT') {
          return {
            action: 'RETRY',
            attempts: 3,
            notify: true,
            message: 'Taking longer than expected, please wait...'
          };
        } else if (classification.type === 'RATE_LIMIT') {
          return {
            action: 'QUEUE',
            notify: true,
            message: 'High load, your request is queued'
          };
        }
        break;

      case 'LOW':
        // Continue with degraded service
        return {
          action: 'CONTINUE',
          degraded: true
        };
    }

    // Default: fail gracefully
    return {
      action: 'FAIL',
      notify: true,
      message: 'Unable to complete action, please try again'
    };
  }
}
```

---

## Tool Orchestration Configuration

```yaml
orchestration:
  parallel:
    enabled: true
    max_concurrent: 5
    timeout_per_tool_ms: 30000
    timeout_global_ms: 60000

  approval:
    enabled: true
    timeout_ms: 60000
    default_action: "require" # "require" or "auto"

  retry:
    enabled: true
    max_attempts: 3
    backoff: "exponential"
    base_delay_ms: 1000

  circuit_breaker:
    enabled: true
    failure_threshold: 5
    timeout_ms: 60000
    half_open_requests: 3

  error_handling:
    log_errors: true
    notify_user: true
    fallback_enabled: true
    cache_results: true
    cache_ttl_seconds: 3600
```

---

## Tool Definitions (YAML)

```yaml
tools:
  - name: create_event
    category: calendar
    description: Create a new calendar event
    parameters:
      - name: title
        type: string
        required: true
        validation: "^.{1,200}$"
      - name: datetime
        type: datetime
        required: true
        validation: "ISO 8601"
      - name: duration
        type: number
        required: false
        default: 60
        validation: "min:15,max:480"
    approval: required
    timeout_ms: 5000
    retry:
      max_attempts: 2
      backoff: exponential

  - name: add_expense
    category: expenses
    description: Log a new expense
    parameters:
      - name: amount
        type: number
        required: true
        validation: "min:0.01,max:999999"
      - name: category
        type: string
        required: true
        validation: "enum:food,transport,entertainment,other"
      - name: description
        type: string
        required: false
        validation: "max:500"
    approval: conditional # Amount ≥$50
    timeout_ms: 3000
    retry:
      max_attempts: 3
      backoff: linear
```

---

## Citations

- **molbot tools system**: Tool architecture and orchestration
- **AI engineer output**: Tool catalog and approval workflows
- **PRD Section 8.2**: Function tools specification
- **docs-global/patterns/tool-orchestration.md**: Orchestration patterns

---

**Lines**: 268 | **Tokens**: ~804
