# CLAUDE.md

**migue.ai** - WhatsApp AI Assistant (Vercel Edge + Supabase + Multi-Provider AI)

---

## Quick Reference

```bash
npm run dev          # Vercel dev server
npm run test         # All tests (239 passing)
/deploy              # Automated deployment (pre-deploy + push)
```

**Key Files**: `app/api/whatsapp/webhook/route.ts`, `lib/ai/providers.ts`, `lib/ai/proactive-agent.ts`
**Environment**: `.env.local` - `WHATSAPP_*`, `SUPABASE_*`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
**Production**: https://migue.app

---

## Critical Rules

**ONE TASK AT A TIME**:
- Execute ONLY explicit task requested | NEVER propose next steps
- STOP after task, WAIT for approval

**MANDATORY**:
- Read files FIRST before edits
- Small changes: ≤300 LOC/file, ≤50 LOC/function
- NEVER commit secrets | ALL routes: `export const runtime = 'edge'`
- TypeScript strict mode (use `!` when index certain)

---

## Stack

**Frontend**: WhatsApp Business API (Bird.com)
**Backend**: Next.js 16.0.10 + Vercel Edge Functions + Vercel AI SDK 6.0
**Database**: Supabase PostgreSQL + pgvector
**AI**: OpenAI GPT-4o-mini ($0.15/$0.60/1M) + Claude Sonnet fallback ($3/$15/1M)

**Status**: Vercel AI SDK 6.0 migration COMPLETE (2026-02-01)

---

## Recent Security Updates

**2026-01-20**: Upgraded to Next.js 16.0.10 & React 19.2.3
- Fixed CVE-2025-55182 (React2Shell) - CVSS 10.0 critical RCE
- Upgraded from Next.js 15.5.4 + React 19.1.1
- Added missing AI SDK dependencies (ai, @ai-sdk/openai, @ai-sdk/anthropic)
- All quality gates passing (239 tests)
- Deployed to Vercel (commit 0558915)

---

## Features

- Conversational AI (GPT-4o-mini primary, Claude fallback)
- Smart Reminders (24h window optimization, 90% free messages)
- Google Calendar integration + Audio transcription (Whisper) + OCR (Tesseract)

**Full reference**: [WhatsApp Features](./docs/whatsapp-features-reference.md)

---

## Development

### Add Endpoint
1. Create `app/api/<name>/route.ts` with `export const runtime = 'edge'`
2. Implement `GET`, `POST` (named exports only)
3. Add tests in `tests/unit/`

### Deploy
```bash
/deploy              # Automated workflow (runs pre-deploy + git push)
# OR: npm run pre-deploy && git push origin main
```

**Edge Runtime**: Max 5s timeout | Use streaming for long operations | 100% test coverage

---

## Project Tracking (/planning)

**MANDATORIOS** (auto-created on plan approval):
- `plan.md` (MAX 50 lines) - Stack, architecture, current phase
- `todo.md` (MAX 50 lines) - DOING/TODO/DONE tasks

**Optional**:
- `prd.md` (127 lines) - Product requirements (Vercel AI SDK migration)
- `ROADMAP.md` (194 lines) - 3-phase implementation (14-19 weeks)
- `bugs.md` (MAX 100 lines) - Bug tracking with priorities (CRITICAL/HIGH/MEDIUM/FIXED)

**Workflow**:
1. User approves plan → @claude-master auto-creates plan.md + todo.md in `/planning`
2. Every interaction → auto-updates tracking files (move tasks, update phase, add features)
3. Size limits enforced → oldest/least relevant content trimmed automatically

**Status**: Vercel AI SDK 6.0 LIVE | 278 tests | $90/month

---

## Documentation

**Search Order**: `/docs/` → Agents → MCP → WebFetch (last resort)

**Key Docs**:
- [Documentation Search Policy](./docs/documentation-search-policy.md)
- [Troubleshooting](./docs/troubleshooting-guide.md) | [CHANGELOG](./docs/CHANGELOG.md)
- [Capabilities Research](./docs/capabilities-research/) - Vercel AI SDK analysis

---

**Last Updated**: 2026-02-01 16:00 | **Maintained by**: @claude-master
