# CLAUDE.md

**migue.ai** - WhatsApp AI Assistant (Fresh Start)

Version: 2.1 | Date: 2026-01-28 01:00 | Updated: 2026-01-29 15:50

---

<must_follow>
- ALL 4 DECISION questions = YES (Real TODAY? Simplest? 2-person? Value NOW?)
- NO CLAIMS WITHOUT CITATIONS (NO_INVENTAR protocol - 7 gates)
- DATETIME WITH TIME MANDATORY: YYYY-MM-DD HH:MM format REQUIRED (NOT date-only)
- FORMAT HIERARCHY MANDATORY: Table > YAML > List > Prose (NO prose when table possible)
- LLM_FORMAT MANDATORY: ALL files MUST follow token-optimized format (use /llm-format skill)
- EMOJIS ABSOLUTELY FORBIDDEN: NEVER use emoji in ANY file (BLOCKING violation)
</must_follow>

---

## Quick Reference

```bash
bun install          # Install dependencies
bun run dev          # Dev server (localhost:3000)
bun run build        # Production build
bun run lint         # Check code with Biome
bun run lint:fix     # Auto-fix with Biome
```

**Current State**: Landing page only
**Next**: Phase 1 MVP (WhatsApp webhook + AI agent + database)

---

## Stack

**Framework**: Next.js 15.1.6 (App Router, Edge Runtime)
**Runtime**: React 19.2.3 + TypeScript 5.7.3
**AI**: Vercel AI SDK 6.0.62 (Claude Sonnet 4.5 primary, GPT-4o fallback)
**Database**: Supabase PostgreSQL 15.8 + pgvector
**Validation**: Zod 4.3.6
**Styling**: Tailwind CSS 4.1.0
**Linting**: Biome 1.9.4
**Package Manager**: Bun 1.3.5

**Dependencies**:
- ai@6.0.62 - Vercel AI SDK core
- @ai-sdk/anthropic@3.0.31 - Claude provider
- @ai-sdk/openai@3.0.23 - OpenAI provider
- @supabase/supabase-js@2.93.3 - Database client
- zod@4.3.6 - Schema validation
- lucide-react@0.469.0 - Icons

---

## Project Structure

```
migue.ai/
├── app/
│   ├── components/         # 9 landing page components
│   ├── page.tsx            # Landing page
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Global styles
├── specs/                  # SDD-organized features (6 features)
│   ├── whatsapp-webhook/   # P0: Webhook + HMAC + normalization
│   ├── ai-agent-system/    # P0: Vercel AI SDK + tools
│   ├── database-foundation/# P0: Supabase + RLS + pgvector
│   ├── reminder-automation/# P1: Reminders + Calendar sync
│   ├── whatsapp-flows/     # P2: Interactive UX
│   ├── observability/      # P2: Monitoring + cost tracking
│   ├── ops/                # Deployment + runbook
│   └── _archive/           # Old flat specs
├── docs/                   # Technical research (13 files)
│   ├── architecture/       # AI agent system, multi-provider, memory/RAG
│   ├── features/           # Agentic patterns, flows, interactive
│   ├── patterns/           # Tool orchestration, edge optimization
│   └── research/           # molbot analysis, PRD gap analysis
├── public/
│   └── assets/             # Branding (logos, icons)
├── .backup/
│   └── 2026-01-28-full-archive/  # Previous implementation
└── .claude/                # Tracking files (plan, status, todo, etc.)
```

---

## Archived Code

Previous implementation (with API routes, AI providers, tests, etc.) archived in:
`.backup/2026-01-28-full-archive/`

**Reason**: Fresh start - previous version had critical errors
**Archived**: lib/, app/api/, tests/, supabase/, scripts/, docs/, types/

See `.backup/2026-01-28-full-archive/ARCHIVE-MANIFEST.md` for full details.

---

## Development

### Current Features
- Landing page with branding
- Responsive design (Tailwind CSS 4)
- TypeScript strict mode
- Biome linting

### Implementation Plan (SDD Format)

**Phase 1 - MVP** (specs/whatsapp-webhook, ai-agent-system, database-foundation):
- WhatsApp webhook with HMAC validation
- Vercel AI SDK with Claude Sonnet 4.5 + GPT-4o fallback
- Supabase database with 14 tables + RLS
- 20+ AI tools (reminders, calendar, expenses)
- 35 tasks total

**Phase 2 - Features** (specs/reminder-automation):
- Automated reminders with cron
- Google Calendar bidirectional sync
- 24h messaging window tracking
- 6 tasks total

**Phase 3 - Advanced** (specs/whatsapp-flows, observability):
- WhatsApp Flows v3 (interactive UX)
- Cost tracking per user
- Dead letter queue (DLQ)
- 9 tasks total

**Technical research** (docs/):
- Architecture patterns, tool orchestration, edge optimization
- molbot competitor analysis, PRD gap analysis

---

## Configuration

**Bun**: package.json has `"packageManager": "bun@1.3.5"`
**TypeScript**: moduleResolution set to "Bundler" for Bun compatibility
**Biome**: Unified linting + formatting (replaces ESLint + Prettier)

---

## Rules

**ONE TASK AT A TIME**:
- Execute ONLY explicit task requested
- NEVER propose next steps
- STOP after task, WAIT for approval

**MANDATORY**:
- Read files FIRST before edits
- Small changes: ≤300 LOC/file, ≤50 LOC/function
- TypeScript strict mode
- No secrets in code

---

## Next Steps

**Ready to start Phase 1 (MVP)**:

1. Database setup (specs/database-foundation/)
   - 6 tasks: Migrations, RLS policies, indexes

2. WhatsApp webhook (specs/whatsapp-webhook/)
   - 18 tasks: Edge Runtime, HMAC, normalization

3. AI agent system (specs/ai-agent-system/)
   - 11 tasks: Vercel AI SDK, tools, circuit breaker

**Total**: 35 tasks, SDD methodology

**References**:
- All specs: specs/README.md
- Task breakdown: specs/*/TASKS.md
- Architecture decisions: specs/*/ADR.md

---

**Last Updated**: 2026-01-29 15:50
**Maintained by**: ClaudeCode&OnlyMe
