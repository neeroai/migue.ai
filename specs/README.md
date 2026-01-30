---
title: migue.ai Specifications (SDD Format)
summary: Modular feature specifications following Spec-Driven Development (SDD) methodology
description: Six core features organized in /specs/<feature>/ directories, each with SPEC, PLAN, TASKS, ADR, TESTPLAN files
version: 2.0
date: 2026-01-29 14:15
updated: 2026-01-29 15:50
scope: SDD-organized specifications for migue.ai implementation
---

# migue.ai Specifications (SDD Format)

Version: 2.0 | Date: 2026-01-29 | Format: SDD Modular

---

## Overview

This directory contains **6 core features** organized following the **SDD (Spec-Driven Development)** methodology. Each feature has its own directory with 5 standard files:

1. **SPEC.md** - Problem, Objective, Scope, Contracts, Business Rules, DoD
2. **PLAN.md** - Stack validation, Implementation steps, Risks, Dependencies
3. **TASKS.md** - TODO/DOING/DONE task tracking (1-4hr granularity)
4. **ADR.md** - Architecture Decision Record with ClaudeCode&OnlyMe 4-question validation
5. **TESTPLAN.md** - Unit, Integration, E2E tests with 80% coverage target

**Methodology Reference:** `/Users/mercadeo/neero/docs-global/guides/sdd/`

---

## Feature Breakdown

### Priority 0 (MVP - Weeks 1-3)

| Feature | Description | Key Files | Dependencies |
|---------|-------------|-----------|--------------|
| **whatsapp-webhook/** | Receive WhatsApp messages, HMAC validation, normalization | SPEC.md, ADR-001 (Edge Runtime) | Zod, Supabase cache |
| **ai-agent-system/** | Multi-provider AI (Claude/OpenAI), 20+ tools, circuit breaker | SPEC.md, ADR-002 (Multi-provider) | Vercel AI SDK, tools |
| **database-foundation/** | 14 tables, RLS policies, pgvector semantic search | SPEC.md, ADR-003 (Supabase) | PostgreSQL 15.8 |

### Priority 1 (Features - Weeks 4-5)

| Feature | Description | Key Files | Dependencies |
|---------|-------------|-----------|--------------|
| **reminder-automation/** | Automated reminders, Google Calendar sync, cron jobs | SPEC.md, ADR-004 (Vercel Cron) | Calendar API, 24h window tracker |

### Priority 2 (Advanced - Weeks 6-8)

| Feature | Description | Key Files | Dependencies |
|---------|-------------|-----------|--------------|
| **whatsapp-flows/** | Interactive UX with Flows v3, buttons, lists | SPEC.md, ADR-005 (Flows) | AES-256 encryption |
| **observability/** | Cost tracking, error monitoring, health checks, DLQ | SPEC.md, ADR-006 (Supabase monitoring) | ai_requests table |

---

## Feature Dependencies

Technical dependencies between features (order of implementation):

| Feature | Depends On | Provides To | Rationale |
|---------|------------|-------------|-----------|
| **database-foundation** | None (foundation) | All features | Core tables, RLS policies, pgvector |
| **whatsapp-webhook** | database-foundation | ai-agent-system | Queues normalized messages to DB |
| **ai-agent-system** | database-foundation, whatsapp-webhook | reminder-automation, observability | Reads messages, writes ai_requests |
| **reminder-automation** | database-foundation, ai-agent-system | None | Uses reminders table + AI tools |
| **whatsapp-flows** | ai-agent-system | None | Interactive messages triggered by AI |
| **observability** | ai-agent-system | None | Tracks ai_requests for cost analysis |

**Implementation order:** database-foundation → whatsapp-webhook → ai-agent-system → (reminder-automation \|\| whatsapp-flows \|\| observability)

**Note:** reminder-automation, whatsapp-flows, and observability can be developed in parallel after ai-agent-system is complete.

---

## Directory Structure

```
specs/
├── README.md                    # This file
├── whatsapp-webhook/            # P0: Webhook handler
│   ├── SPEC.md                  # Problem: 5s timeout, HMAC validation
│   ├── PLAN.md                  # Stack: Edge Runtime, Zod
│   ├── TASKS.md                 # Week 1-2 tasks (18 tasks)
│   ├── ADR.md                   # ADR-001: Edge Runtime decision
│   └── TESTPLAN.md              # HMAC, normalization, load tests
├── ai-agent-system/             # P0: AI processing
│   ├── SPEC.md                  # Problem: Multi-provider AI, tools
│   ├── PLAN.md                  # Stack: Vercel AI SDK, Claude/OpenAI
│   ├── TASKS.md                 # Week 2-3 tasks (11 tasks)
│   ├── ADR.md                   # ADR-002: Claude primary, OpenAI fallback
│   └── TESTPLAN.md              # Tool mocks, failover tests
├── database-foundation/         # P0: Supabase setup
│   ├── SPEC.md                  # Problem: 14 tables, RLS, pgvector
│   ├── PLAN.md                  # Stack: PostgreSQL 15.8, pgvector
│   ├── TASKS.md                 # Week 1 tasks (6 tasks)
│   ├── ADR.md                   # ADR-003: Supabase over self-hosted
│   └── TESTPLAN.md              # RLS enforcement, migrations
├── reminder-automation/         # P1: Reminders + Calendar
│   ├── SPEC.md                  # Problem: Automated reminders, sync
│   ├── PLAN.md                  # Stack: Vercel Cron, Calendar API
│   ├── TASKS.md                 # Week 3-4 tasks (6 tasks)
│   ├── ADR.md                   # ADR-004: Vercel Cron decision
│   └── TESTPLAN.md              # Reminder delivery, calendar sync
├── whatsapp-flows/              # P2: Interactive UX
│   ├── SPEC.md                  # Problem: Flows v3, encryption
│   ├── PLAN.md                  # Stack: Flows v3, AES-256
│   ├── TASKS.md                 # Week 5-6 tasks (5 tasks)
│   ├── ADR.md                   # ADR-005: Flows for structured inputs
│   └── TESTPLAN.md              # Encryption, E2E Playwright
├── observability/               # P2: Monitoring
│   ├── SPEC.md                  # Problem: Cost tracking, errors
│   ├── PLAN.md                  # Stack: Supabase monitoring
│   ├── TASKS.md                 # Week 7-8 tasks (4 tasks)
│   ├── ADR.md                   # ADR-006: Supabase for monitoring
│   └── TESTPLAN.md              # Cost calculation, DLQ tests
├── ops/                         # Operational docs (non-SDD)
│   ├── deployment-config.md     # Vercel config, env vars
│   └── runbook.md               # Incident response, troubleshooting
└── _archive/                    # Old flat specs (pre-SDD)
    ├── PRD.md                   # Original PRD (reference)
    ├── 00-implementation-phases.md
    ├── 01-api-contracts.md
    ├── 02-database-schema.md
    ├── 03-deployment-config.md
    ├── 04-ai-integration.md
    ├── 05-whatsapp-integration.md
    ├── 06-security-compliance.md
    ├── 07-testing-strategy.md
    ├── 08-cost-optimization.md
    └── 09-runbook.md
```

---

## Content Mapping (Old → New)

| Old Spec | New Location(s) | What Was Extracted |
|----------|----------------|-------------------|
| **PRD.md** | _archive/ (reference) | Vision, market context, features |
| **00-implementation-phases.md** | _archive/ (replaced) | Tasks distributed to TASKS.md per feature |
| **01-api-contracts.md** | whatsapp-webhook/SPEC.md, ai-agent-system/, reminder-automation/ | Webhook schemas, cron endpoints, tool contracts |
| **02-database-schema.md** | database-foundation/ | All 14 tables, RLS, pgvector |
| **03-deployment-config.md** | ops/deployment-config.md | Vercel config, env vars |
| **04-ai-integration.md** | ai-agent-system/ | AI SDK, providers, tools, circuit breaker |
| **05-whatsapp-integration.md** | whatsapp-webhook/, whatsapp-flows/ | Webhook handling, Flows v3 |
| **06-security-compliance.md** | whatsapp-webhook/SPEC.md, database-foundation/ | HMAC validation, RLS policies |
| **07-testing-strategy.md** | Each feature/TESTPLAN.md | Unit tests, integration tests, fixtures |
| **08-cost-optimization.md** | ai-agent-system/, observability/ | Token budget, cost tracking |
| **09-runbook.md** | ops/runbook.md | Incident response, troubleshooting |

---

## How to Use

### For Implementation

1. **Choose a feature** (start with P0: whatsapp-webhook)
2. **Read in order:**
   - SPEC.md - Understand problem, contracts, business rules
   - ADR.md - Understand key decisions (all 4/4 YES validated)
   - PLAN.md - Review stack, implementation steps
   - TASKS.md - Pick next TODO task (1-4hr granularity)
   - TESTPLAN.md - Write tests alongside code

### For Planning

1. **Read SPEC.md** for each feature to understand scope
2. **Check TASKS.md** to estimate effort (tasks already broken down)
3. **Review ADR.md** for architectural decisions
4. **Use PLAN.md** to sequence features (dependencies listed)

### For Quality Assurance

1. **TESTPLAN.md** has full test strategy per feature
2. **SPEC.md Definition of Done** lists acceptance criteria
3. **Quality gates** defined in each TESTPLAN.md (80% coverage target)

---

## Architecture Decisions (ADRs)

All architecture decisions validated with **ClaudeCode&OnlyMe 4-question filter** (ALL 4 = YES):

| ADR | Decision | Result | Rationale |
|-----|----------|--------|-----------|
| **ADR-001** | Edge Runtime for webhook | 4/4 YES | <50ms cold starts, 5s timeout compliance |
| **ADR-002** | Claude primary, OpenAI fallback | 4/4 YES | Best reasoning + reliability |
| **ADR-003** | Supabase over self-hosted | 4/4 YES | Managed service, 2-person maintainable |
| **ADR-004** | Vercel Cron for reminders | 4/4 YES | Built-in, no external service |
| **ADR-005** | WhatsApp Flows for structured inputs | 4/4 YES | Native feature, better UX |
| **ADR-006** | Supabase for monitoring | 4/4 YES | Existing stack, cost transparency |

**Filter:** Real TODAY? Simplest? 2-person maintain? Value NOW?

---

## Implementation Timeline

**Total:** 8 weeks (56 days) to full launch

| Weeks | Features | Tasks | Focus |
|-------|----------|-------|-------|
| 1-2 | whatsapp-webhook, database-foundation | 24 tasks | MVP infrastructure |
| 2-3 | ai-agent-system | 11 tasks | Core AI processing |
| 3-4 | reminder-automation | 6 tasks | Automation features |
| 5-6 | whatsapp-flows | 5 tasks | Interactive UX |
| 7-8 | observability | 4 tasks | Monitoring & optimization |

**Total Tasks:** 50 tasks (1-4hr each) = ~120-150 hours = 8 weeks @ 20 hrs/week

---

## Cross-References

**External Docs:**
- SDD Methodology: `/Users/mercadeo/neero/docs-global/guides/sdd/`
- SDD Templates: `/Users/mercadeo/neero/docs-global/templates/sdd/`
- Architecture docs: `docs/architecture/` (ai-agent-system.md, multi-provider-strategy.md, memory-rag-system.md)
- Pattern docs: `docs/patterns/` (tool-orchestration.md, edge-runtime-optimization.md, error-handling-fallbacks.md)

**Internal Refs:**
- Original PRD: `specs/_archive/PRD.md`
- Deployment: `specs/ops/deployment-config.md`
- Runbook: `specs/ops/runbook.md`

---

## Migration Notes

**Date:** 2026-01-29
**From:** Flat specs (11 files)
**To:** Modular SDD (6 features × 5 files = 30 files)

**Changes:**
- Distributed content from 11 flat specs into 6 logical features
- Each feature has SPEC, PLAN, TASKS, ADR, TESTPLAN
- All ADRs validated with ClaudeCode&OnlyMe 4-question filter
- Tasks broken down to 1-4hr granularity (50 total)
- Test plans target 80% coverage on critical paths
- Old specs archived to `_archive/` for reference
- Operational docs (deployment, runbook) moved to `ops/`

**Benefits:**
- Clearer feature boundaries
- Independent development (parallel work possible)
- Explicit architecture decisions (6 ADRs)
- Actionable tasks (1-4hr chunks)
- Testability built-in (TESTPLAN per feature)

---

**Last Updated:** 2026-01-29
**Version:** 2.0 (SDD modular format)
**Maintained by:** ClaudeCode&OnlyMe
