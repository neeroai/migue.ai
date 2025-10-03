# CLAUDE.md

**migue.ai** - WhatsApp AI Assistant on Vercel Edge + Supabase + OpenAI

## Quick Reference

### Essential Commands
```bash
npm run dev          # Start Vercel dev server
npm run build        # Compile TypeScript
npm run typecheck    # Type check without emit
npm run test         # Run all tests
```

### Key Files
- `app/api/whatsapp/webhook/route.ts` - Message reception & AI processing
- `app/api/cron/check-reminders/route.ts` - Daily reminders (9 AM UTC)
- `lib/whatsapp.ts` - WhatsApp API client (messages, typing, reactions)
- `lib/openai.ts` - OpenAI client (GPT-4o, Whisper, Embeddings)
- `lib/supabase.ts` - Database client
- `types/schemas.ts` - Zod validation schemas

### Environment Variables
See `.env.example` - Required: `WHATSAPP_*`, `SUPABASE_*`, `OPENAI_API_KEY`

---

## Development Rules

### MANDATORY Standards
- **Read Files First**: ALWAYS read complete files before edits
- **Small Changes**: ≤300 LOC/file, ≤50 LOC/function
- **Security**: NEVER commit secrets; validate inputs
- **Edge Runtime**: ALL routes export `export const runtime = 'edge'`
- **App Router**: Routes in `app/api/` with `route.ts` files

### Code Limits
- File: ≤300 LOC | Function: ≤50 LOC | Parameters: ≤5 | Complexity: ≤10

### TypeScript Strict
- `noUncheckedIndexedAccess: true` → use `array[i]!` when certain
- `exactOptionalPropertyTypes: true` → handle all nullable types
- NO `any` types - use `unknown`

---

## Code Patterns

### Next.js 15 API Route (Edge)
```typescript
// app/api/example/route.ts
export const runtime = 'edge';

export async function GET(req: Request): Promise<Response> {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' }
  });
}
```

### Database Access
```typescript
import { getSupabaseServerClient } from '@/lib/supabase';
const supabase = getSupabaseServerClient();
```

### Conventions
- ES modules only (`import`/`export`, NO `require`)
- Guard clauses first (early returns)
- One function = one task
- Specific error messages

---

## WhatsApp Features

All features in `lib/whatsapp.ts` - Edge Runtime compatible:
- **Interactive Buttons** - Up to 3 buttons: `sendInteractiveButtons(to, body, buttons)`
- **Interactive Lists** - 4+ options: `sendInteractiveList(to, body, buttonLabel, rows)`
- **Reactions** - Quick feedback: `reactWithCheck()`, `reactWithThinking()`, `sendReaction()`
- **Typing Indicators** - Show processing: `createTypingManager(phone).startWithDuration(5)`
- **Read Receipts** - Mark read: `markAsRead(messageId)`

**Best Practice**: Use buttons for ≤3 options, lists for 4+

---

## Testing

```bash
npm run test          # All tests (Jest + Playwright)
npm run test:unit     # Jest only
npm run test:e2e      # Playwright only
```

**Status**: 20 suites, 112 tests ✅ | Coverage disabled (Edge Runtime)

**Requirements**:
- ≥1 happy + ≥1 failure path per e2e test
- Bug fixes MUST include regression test (fail first)

---

## Common Tasks

### Add API Endpoint
1. Create `app/api/<name>/route.ts`
2. Export `export const runtime = 'edge'`
3. Implement HTTP methods: `GET`, `POST`, etc.
4. Add tests in `tests/unit/`

### Modify Database
1. Edit `supabase/schema.sql` or `supabase/security.sql`
2. Test in Supabase SQL Editor
3. Update TypeScript types

### Deploy
```bash
git add . && git commit -m "feat: description"
git push origin main  # Auto-deploys to Vercel
```

---

## Vercel Configuration

**CRITICAL**: Vercel auto-detects Edge Functions via `export const runtime = 'edge'`

DO NOT specify `runtime` in `vercel.json` - only crons, headers, redirects

```json
{
  "crons": [{"path": "/api/cron/check-reminders", "schedule": "0 9 * * *"}],
  "headers": [{"source": "/api/whatsapp/(.*)", "headers": [...]}]
}
```

---

## Troubleshooting

### TypeScript Errors
- Array access: `array[i]!` when index certain
- Nullable: `if (value) { ... }` before use
- Type assertions: `as Type` when needed

### Deployment Fails
- ✅ Routes in `app/api/` with `route.ts`
- ✅ Export `export const runtime = 'edge'`
- ✅ NO `functions.runtime` in `vercel.json`
- ✅ Static imports only (NO dynamic `await import()`)
- ✅ Named exports: `GET`, `POST` (NOT default)

### Database Issues
- Verify env: `SUPABASE_URL`, `SUPABASE_KEY`
- Use `getSupabaseServerClient()` server-side
- Check RLS policies in Dashboard

---

## Project Management

### Organization (.claude/)
- **[.claude/ROADMAP.md](./.claude/ROADMAP.md)** - Complete project roadmap & timeline
- **[.claude/phases/current.md](./.claude/phases/current.md)** - Fase 2 status (60% → 100%)
- **[.claude/metrics.md](./.claude/metrics.md)** - Cost tracking (<$10/day target)
- **[.claude/agents/delegation-matrix.md](./.claude/agents/delegation-matrix.md)** - Agent selection guide

### Documentation
- **[AGENTS.md](./AGENTS.md)** - Business blueprint & project context
- **[README.md](./README.md)** - Overview & quick start
- **[docs/SUPABASE.md](./docs/SUPABASE.md)** - Database schema & RLS
- **[docs/deployment/](./docs/deployment/)** - Vercel guides (6 docs)

### External References
- [WhatsApp API](https://developers.facebook.com/docs/whatsapp)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [OpenAI API](https://platform.openai.com/docs)
- [Supabase](https://supabase.com/docs)

---

## Project Info

**Stack**: Next.js 15 + Vercel Edge + Supabase + OpenAI
**TypeScript**: 5.9.2 (strict)
**Tests**: 112/112 ✅
**Production**: https://migue.app
**Status**: Fase 2 (60%) - Core Features Development

**Current Phase**: Audio transcription, streaming responses, RAG implementation
**Target**: Oct 10, 2025 - Fase 2 complete

---

## Recent Updates

### 2025-10-03
- ✅ CLAUDE-MASTER v2.0 structure initialized
- ✅ Created complete `.claude/` organization
- ✅ Compacted CLAUDE.md to <200 lines
- 🔄 Fase 2 development in progress

### Migration to Next.js 15 (Complete)
- ✅ App Router with Edge Functions
- ✅ All routes in `app/api/` with `route.ts`
- ✅ Named HTTP exports (GET, POST)
- ✅ 112 tests passing

---

**Last Updated**: 2025-10-03
**Owner**: claude-master
**Session Model**: Claude Opus 4.1
