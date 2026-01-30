---
title: AI Agent System
summary: Multi-provider AI processing with tool orchestration, circuit breaker, token budget
description: Vercel AI SDK integration with Claude Sonnet 4.5 primary and GPT-4o fallback, 20+ tools for calendar/reminders/expenses, circuit breaker for reliability, token budget tracking
version: 1.0
date: 2026-01-29 14:15
updated: 2026-01-29 15:50
scope: AI SDK setup, tool definitions, multi-provider failover, cost tracking
status: Draft
---

# SPEC: AI Agent System

Version: 1.0 | Date: 2026-01-29 | Owner: ClaudeCode&OnlyMe | Status: Draft

---

## Problem

Process user WhatsApp messages with AI to understand intent and execute tools (create reminders, book appointments, add expenses). Need <3s response time, 95% tool success rate, automatic provider failover, and per-user token budget enforcement to prevent cost overruns.

---

## Objective

**Primary Goal:** Process 10K messages/day with <3s p95 latency and 95% tool execution success

**Success Metrics:**
- AI response time p95 < 3s
- Tool execution success rate > 95%
- Automatic failover to OpenAI when Claude unavailable
- Token budget enforcement (block users exceeding 100K tokens/month)
- Cost per conversation < $0.05

**Source:** .backup/specs/04-ai-integration.md L1-50, .backup/specs/08-cost-optimization.md L37-80

---

## Scope

| In | Out |
|---|---|
| Vercel AI SDK 6.0 setup | Custom LLM integration |
| Claude Sonnet 4.5 primary provider | Other models (GPT-3.5, Gemini) |
| GPT-4o fallback provider | Fine-tuning |
| 20+ tools (calendar, reminders, expenses) | Web scraping, advanced reasoning |
| Circuit breaker (3 failures → fallback) | Load balancing across multiple providers |
| Token budget tracking per user | Billing/payment processing |

**References:**
- AI integration: .backup/specs/04-ai-integration.md
- Multi-provider: docs/architecture/multi-provider-strategy.md
- Tool orchestration: docs/patterns/tool-orchestration.md

---

## Contracts

### Input

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| message | string | Y | User's WhatsApp message text |
| userId | string | Y | WhatsApp phone number (user ID) |
| conversationHistory | Message[] | N | Last 10 messages for context |
| systemPrompt | string | Y | migue.ai personality + instructions |

### Output

| Field | Type | Condition | Notes |
|-------|------|-----------|-------|
| response | string | Always | AI-generated reply |
| toolCalls | ToolCall[] | On tool execution | Tools executed (calendar, reminders) |
| tokensUsed | { input, output } | Always | For cost tracking |
| provider | 'claude' \| 'openai' | Always | Which provider responded |
| error | string | On failure | Error message if both providers fail |

**Tool Types:** reminder_create, reminder_list, calendar_create, calendar_list, expense_add, expense_list, user_preferences_get, user_preferences_set

---

## Business Rules

1. **Provider Priority:** Try Claude first, fallback to OpenAI on error (API error, rate limit, timeout)
2. **Circuit Breaker:** After 3 consecutive failures, skip Claude for 5 minutes
3. **Token Budget:** Reject requests if user exceeded monthly limit (100K tokens), return budget error
4. **Tool Execution:** Execute tools sequentially, abort on first error, return partial results
5. **Context Window:** Include last 10 messages (max 50K tokens) for conversation continuity
6. **Timeout:** Abort AI request after 25s (prevents hanging requests)
7. **Cost Tracking:** Record every request to `ai_requests` table with provider, tokens, cost

**Source:** .backup/specs/04-ai-integration.md L410-470 (circuit breaker), .backup/specs/08-cost-optimization.md L80-120

---

## Definition of Done

- [x] Claude Sonnet 4.5 integration working
- [x] GPT-4o fallback functional (tested with Claude failure simulation)
- [x] 20+ tools defined and executable
- [x] Circuit breaker prevents cascade failures
- [x] Token budget enforced (user blocked when exceeded)
- [x] Cost tracking per request (ai_requests table)
- [x] System prompt optimized (<2K tokens)
- [x] Unit tests for all tools (80% coverage)
- [x] Integration test with real providers
- [x] Load test (100 concurrent requests, <3s p95)

---

**Related:** specs/database-foundation/ (ai_requests table), specs/reminder-automation/ (tools), specs/observability/ (cost dashboard)
