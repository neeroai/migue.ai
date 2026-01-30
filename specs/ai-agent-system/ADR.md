---
title: ADR-002 Claude Primary, OpenAI Fallback
summary: Multi-provider AI strategy for reliability and cost optimization
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: Accepted
---

# ADR-002: Claude Primary, OpenAI Fallback

## Decision
**Will:** Use Claude Sonnet 4.5 as primary, GPT-4o as fallback
**Will NOT:** Single provider or 3+ providers

## Rationale
Claude has superior reasoning for tool orchestration (20+ tools). OpenAI provides reliability (99.9% uptime). Circuit breaker prevents cascade failures.

## ClaudeCode&OnlyMe Validation
| Question | Answer | Score |
|----------|--------|-------|
| Real problem TODAY? | YES - Need AI now | 1/1 |
| Simplest? | YES - Vercel AI SDK abstracts both | 1/1 |
| 2-person maintain? | YES - No custom integration | 1/1 |
| Value if never scale? | YES - Better AI = better UX today | 1/1 |
| **TOTAL** | **4/4 = ACCEPT** | **4/4** |

**Source:** docs/architecture/multi-provider-strategy.md
