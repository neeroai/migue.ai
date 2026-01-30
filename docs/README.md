---
title: migue.ai Documentation Index
summary: Central index for all migue.ai project documentation
description: Navigation guide to research findings, technical patterns, architecture decisions, and implementation guides for migue.ai WhatsApp AI assistant
version: 1.0
date: 2026-01-28
updated: 2026-01-28
scope: documentation
---

# migue.ai Documentation

**Project**: WhatsApp-based business automation assistant for LATAM
**Status**: Development (Phase 1 planning complete)
**Last Updated**: 2026-01-28

## Quick Links

| Document | Purpose | Status |
|----------|---------|--------|
| [PRD](/specs/PRD.md) | Complete product requirements | Approved |
| [CLAUDE.md](/CLAUDE.md) | Project context for Claude | Current |
| [README.md](/README.md) | Developer quickstart | Current |

## Documentation Structure

```
docs/
├── research/          # Market research, competitor analysis, compliance
├── decisions/         # Architecture Decision Records (ADRs)
├── patterns/          # Technical patterns and best practices
└── README.md          # This file
```

## Research

**Purpose**: Findings from market research, policy analysis, and competitive landscape

| Document | Summary | Date |
|----------|---------|------|
| [WhatsApp Compliance 2026](research/whatsapp-compliance-2026.md) | Critical policy changes banning general AI chatbots | 2026-01-28 |
| [Competitor Analysis](research/competitor-analysis.md) | Analysis of Zapia, Waply, TheLibrarian | 2026-01-28 |

**Key Findings**:
- WhatsApp banned general-purpose AI chatbots (Jan 15, 2026)
- Only business automation allowed (scheduling, reminders, tasks)
- migue.ai must be positioned as productivity tool, NOT chat assistant
- Competitors charge $19-29/month, target $5-10/month

## Architecture Decisions

**Purpose**: Record of key technical decisions with rationale and tradeoffs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](decisions/001-multi-provider-ai-strategy.md) | Multi-Provider AI Strategy | Accepted | 2026-01-28 |
| [002](decisions/002-vercel-edge-functions.md) | Vercel Edge Functions for Webhooks | Accepted | 2026-01-28 |

**Summary**:
- **AI**: OpenAI GPT-4o-mini primary ($0.03/user/month), Claude fallback
- **Runtime**: Vercel Edge Functions (<200ms latency), Serverless for AI processing
- **Database**: Supabase PostgreSQL with RLS
- **Pattern**: Fire-and-forget webhooks with background processing

## Technical Patterns

**Purpose**: Reusable implementation patterns learned from archived code and research

| Pattern | Summary | Complexity |
|---------|---------|------------|
| [Fire-and-Forget Webhook](patterns/fire-and-forget-webhook.md) | Immediate 200 response, async processing | Medium |
| [24h Window Management](patterns/24h-window-management.md) | Track and maintain WhatsApp messaging windows | Medium |

**Key Patterns**:
1. **Fire-and-Forget**: Prevents WhatsApp retry storms, enables long AI processing
2. **Window Management**: Proactive template messages to keep 24h window open
3. **Multi-Provider AI**: Auto-failover for reliability
4. **Message Queue**: Store messages when window expired, send when re-opened

## Implementation Phases

**Timeline**: 12 weeks (Q2 2026)

| Phase | Weeks | Focus | Status |
|-------|-------|-------|--------|
| 1: Foundation | 1-3 | Webhook, basic AI, fire-and-forget | Planned |
| 2: Core Features | 4-6 | Reminders, expenses, interactive messages | Planned |
| 3: Calendar | 7-9 | Google Calendar integration, scheduling | Planned |
| 4: Voice & Polish | 10-12 | Whisper transcription, onboarding, beta | Planned |
| 5: Scale | Post-launch | Performance, cost optimization, growth | Future |

**Current Phase**: Planning complete, ready for Phase 1 implementation

## Core Features

**P0 (Launch Critical)**:
1. Natural language reminders (Spanish NLP)
2. Text message processing (conversational AI)
3. Interactive buttons (max 3 per message)
4. Interactive lists (max 10 items)
5. 24h window management (proactive maintenance)

**P1 (Core Value)**:
1. Google Calendar integration (OAuth, event creation)
2. Meeting scheduling (availability sharing)
3. Voice transcription (OpenAI Whisper)
4. Expense tracking (multi-currency, receipts)
5. Window maintenance automation (cron-based)

**P2 (Future)**:
- Multi-user workspaces
- CRM integration (HubSpot, Pipedrive)
- Payment links
- Analytics dashboard
- Custom workflows

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 16.0.10 + React 19.2.3 | Landing page only (current) |
| **Runtime** | Vercel Edge Functions | <100ms global latency |
| **AI Primary** | OpenAI GPT-4o-mini | $0.15/$0.60 per 1M tokens |
| **AI Fallback** | Claude 3.5 Sonnet | Auto-failover reliability |
| **Database** | Supabase PostgreSQL 15.8 | RLS, pgvector, LATAM region |
| **Transcription** | OpenAI Whisper | $0.006/min audio |
| **Package Manager** | Bun 1.3.5 | 3x faster than npm |
| **Linting** | Biome 1.9.4 | Replaces ESLint + Prettier |

## Cost Targets

| Component | Target | Actual (Projected) |
|-----------|--------|-------------------|
| AI processing | <$0.05/user/month | $0.03/user/month ✅ |
| Infrastructure | <$0.10/user/month | $0.02/user/month ✅ |
| Voice transcription | <$0.05/user/month | $0.024/user/month ✅ |
| **Total** | **<$0.20/user/month** | **$0.074/user/month** ✅ |

**Pricing Strategy**: $5-10/month (vs competitors $19-29/month)

## Compliance Requirements

**WhatsApp Policy (Jan 2026)**:
- ✅ Appointment scheduling (reminders)
- ✅ Task management (expenses, todos)
- ✅ Calendar integration (Google Calendar)
- ✅ Document processing (receipts)
- ❌ General conversation (explicitly rejected)

**Enforcement**:
- System prompt rejects general queries
- Product positioning as business tool
- Onboarding message clarifies scope

## Sources & References

**Archived Code** (reference patterns):
- Fire-and-forget webhook: `.backup/2026-01-28-full-archive/app/api/whatsapp/webhook/route.ts`
- Window management: `.backup/2026-01-28-full-archive/lib/messaging-windows.ts`
- Interactive messages: `.backup/2026-01-28-full-archive/lib/message-builders/`

**Related Projects**:
- **molbot** (`/Users/mercadeo/neero/molbot`) - Multi-channel architecture, AI failover
- **docs-global** (`/Users/mercadeo/neero/docs-global`) - Shared technical standards

**External Documentation**:
- [WhatsApp Cloud API v23.0](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)

## Getting Started

**For Developers**:
1. Read [CLAUDE.md](/CLAUDE.md) for project context
2. Read [PRD](/specs/PRD.md) for complete requirements
3. Review [ADRs](decisions/) for technical decisions
4. Study [patterns](patterns/) for implementation guidance

**For Implementation**:
1. Start with Phase 1 (Foundation)
2. Reference archived code for proven patterns
3. Follow ADRs for technical decisions
4. Update docs as implementation progresses

## Maintenance

**Update Frequency**:
- Research docs: As new findings emerge
- ADRs: When architectural decisions made
- Patterns: When new patterns discovered or refined
- README: Monthly or on major changes

**Review Schedule**:
- Weekly during active development
- Monthly post-launch
- Quarterly for long-term docs

---

**Team**: ClaudeCode&OnlyMe
**Maintained by**: Javier Polo (CEO, Neero SAS)
**Region**: LATAM (Colombia primary market)
**Launch Target**: Q2 2026
