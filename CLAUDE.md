# CLAUDE.md

**migue.ai** - WhatsApp AI Assistant on Vercel Edge + Supabase + Multi-Provider AI (76% cost savings)

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
- `app/api/cron/check-reminders/route.ts` - Daily reminders (12pm UTC = 7am Bogotá)
- `app/api/cron/maintain-windows/route.ts` - WhatsApp window maintenance
- `lib/whatsapp.ts` - WhatsApp API client (messages, typing, reactions)
- `lib/messaging-windows.ts` - WhatsApp 24h window management
- `lib/ai-providers.ts` - Multi-provider AI system (Claude, Groq, Tesseract)
- `lib/claude-agents.ts` - Specialized AI agents
- `lib/groq-client.ts` - Audio transcription (93% cheaper)
- `lib/tesseract-ocr.ts` - Free OCR
- `lib/supabase.ts` - Database client
- `types/schemas.ts` - Zod validation schemas

**Timezone**: America/Bogota (UTC-5) - Horario laboral 7am-8pm

### Environment Variables
See `.env.local` - Required:
- `WHATSAPP_*` - WhatsApp Business API
- `SUPABASE_*` - Database
- `ANTHROPIC_API_KEY` - Claude SDK (primary)
- `GROQ_API_KEY` - Audio transcription
- `OPENAI_API_KEY` - Fallback only

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

### Type-Safe Message Builders (2025-10-06)
```typescript
import { ButtonMessage, ListMessage } from '@/lib/message-builders';

// Buttons (≤3 options) - Validates at construction time
const btn = new ButtonMessage('Choose', [
  { id: '1', title: 'Yes' },
  { id: '2', title: 'No' }
], {
  header: 'Quick Selection',
  footer: 'Powered by migue.ai'
});
await sendWhatsAppRequest(btn.toPayload(phone));

// Lists (4-10 options) - Validates at construction time
const list = new ListMessage('Select service', 'View Services', [
  { id: '1', title: 'Service A', description: '30 min - $150' },
  { id: '2', title: 'Service B', description: '45 min - $200' }
]);
await sendWhatsAppRequest(list.toPayload(phone));
```

**Benefits**: Validation at construction, type safety, prevents invalid payloads

### Messaging Window Management (2025-10-07)

**WhatsApp 24h Free Window System** - Mantiene conversaciones gratuitas automáticamente

```typescript
import {
  getMessagingWindow,
  shouldSendProactiveMessage,
  COLOMBIA_TZ,
  BUSINESS_HOURS
} from '@/lib/messaging-windows';

// Verificar estado de ventana
const window = await getMessagingWindow(phoneNumber);
// → { isOpen, isFreeEntry, expiresAt, hoursRemaining, canSendProactive }

// Validar si se puede enviar mensaje proactivo
const decision = await shouldSendProactiveMessage(userId, phoneNumber);
// → { allowed: true/false, reason, nextAvailableTime }
```

**Reglas de WhatsApp:**
- Ventana de 24h se abre cuando **usuario** envía mensaje
- Todos los mensajes dentro de ventana: **GRATIS** (ilimitados)
- Free entry point: **72h gratis** para nuevos usuarios
- Fuera de ventana: solo template messages (pagados $0.0667 c/u)

**Sistema Automático:**
- ✅ Horario laboral: 7am-8pm Bogotá (UTC-5)
- ✅ Máximo 4 mensajes proactivos/usuario/día
- ✅ Mínimo 4h entre mensajes proactivos
- ✅ NO interrumpe usuarios activos (< 30 min)
- ✅ Cron jobs: 7am, 10am, 1pm, 4pm Bogotá (12pm, 3pm, 6pm, 9pm UTC)
- ✅ Mensajes personalizados con ProactiveAgent + historial

**Archivos clave:**
- `lib/messaging-windows.ts` - Core logic
- `app/api/cron/maintain-windows/route.ts` - Mantenimiento automático
- `lib/template-messages.ts` - Fallback (ventana cerrada)
- `lib/metrics.ts` - Monitoreo y costos
- `supabase/migrations/003_messaging_windows.sql` - Tablas

**Beneficio**: 90%+ conversaciones gratis (vs $0.0667 por template)

---

## Testing

```bash
npm run test          # All tests (Jest + Playwright)
npm run test:unit     # Jest only
npm run test:e2e      # Playwright only
```

**Status**: 25 suites, 225 tests ✅ | Coverage disabled (Edge Runtime)

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

### Work with Supabase
```bash
npm run db:verify              # Verify connection & show data
npm run db:cli -- projects list  # Use Supabase CLI
npm run audit:users            # Audit user interactions & message persistence
```
See [SUPABASE-ACCESS.md](./docs/SUPABASE-ACCESS.md) for complete guide

### Deploy

**IMPORTANT**: Always validate before deploying to prevent build failures

#### Pre-Deploy Validation (MANDATORY)
```bash
# Quick validation (recommended before every push)
npm run pre-deploy

# Full automated verification
npm run verify-deploy
```

#### Manual Deploy Process
```bash
# 1. Validate locally
npm run typecheck    # Type safety
npm run build        # Build validation
npm run test:unit    # Unit tests

# 2. Commit and push
git add .
git commit -m "feat: description"
git push origin main  # Auto-deploys to Vercel
```

#### Automated Protections
- **Pre-commit hook**: Type check (fast)
- **Pre-push hook**: Full build + tests (prevents Vercel failures)
- **GitHub Actions**: CI pipeline on PRs
- **Vercel**: Build validation before deployment

**See**: [Deploy Checklist](./docs/05-deployment/DEPLOY-CHECKLIST.md)

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
- **[docs/README.md](./docs/README.md)** - Complete documentation index
- **[docs/01-getting-started/](./docs/01-getting-started/)** - Setup & installation
- **[docs/02-architecture/](./docs/02-architecture/)** - System design & data models
- **[docs/03-api-reference/](./docs/03-api-reference/)** - API documentation (WhatsApp, Supabase, OpenAI)
- **[docs/04-features/](./docs/04-features/)** - Feature implementation guides
- **[docs/05-deployment/](./docs/05-deployment/)** - Vercel deployment guides
- **[docs/06-whatsapp/](./docs/06-whatsapp/)** - WhatsApp API integration
- **[docs/08-project-management/](./docs/08-project-management/)** - PRD, roadmap, planning

### External References
- [WhatsApp API](https://developers.facebook.com/docs/whatsapp)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [OpenAI API](https://platform.openai.com/docs)
- [Supabase](https://supabase.com/docs)

---

## Project Info

**Stack**: Next.js 15 + Vercel Edge + Supabase + Multi-Provider AI
**AI Providers**:
- Primary: Claude Sonnet 4.5 (75% cheaper than GPT-4o)
- Audio: Groq Whisper (93% cheaper than OpenAI)
- OCR: Tesseract (100% free)
- Fallback: OpenAI (backwards compatibility)

**AI SDKs** (Edge Runtime Compatible):
- ✅ `@anthropic-ai/sdk` v0.65.0 - Anthropic Messages API (primary)
- ✅ `groq-sdk` v0.33.0 - Audio transcription
- ✅ `openai` v5.23.1 - Fallback only
- ✅ `tesseract.js` v6.0.1 - Free OCR
- ❌ `@anthropic-ai/claude-agent-sdk` - NOT compatible (requires Node.js fs/child_process)

**TypeScript**: 5.9.2 (strict)
**Tests**: 239/239 ✅
**Production**: https://migue.app
**Status**: Fase 2 (95%) - Production Ready

**Current Phase**: WhatsApp v23.0 full support, message type fixes
**Target**: Oct 8, 2025 - Fase 2 complete (adelantado)
**Cost Savings**: 76% reduction ($55/month → $13/month) - ACTIVO

---

## Recent Updates

### 2025-10-08 - Claude Model ID Fix 🔧
- ✅ **Root Cause Identified**: Model ID `'claude-sonnet-4-5'` was invalid
  - API calls to Anthropic failed silently
  - Triggered fallback to OpenAI without tool calling
  - Bot responded "no puedo crear recordatorios" despite feature being implemented
- ✅ **Fix Applied**:
  - Updated all model IDs to official snapshot format: `'claude-sonnet-4-5-20250929'`
  - Fixed 6 locations: `lib/claude-client.ts` (3), `lib/claude-agents.ts` (3)
  - Updated system prompt to Spanish with stronger tool usage enforcement
  - Enhanced debugging: detects when Claude refuses to use tools
- ✅ **Testing**:
  - All 252 unit tests passing
  - Type check ✅ | Build ✅ | Pre-push validation ✅
  - Updated tests to match Spanish system prompt
- ✅ **Deployment**: Pushed to production, Vercel auto-deployment triggered
- ✅ **Expected Result**: Tool calling now functional - bot creates reminders autonomously

### 2025-10-07 - WhatsApp v23.0 Message Types Fix 🔧
- ✅ **User Interaction Audit**:
  - Created diagnostic script: `npm run audit:users`
  - Identified root cause: PostgreSQL enum `msg_type` missing v23.0 types
  - 2 of 4 users affected (0 messages persisted due to enum constraint violations)
- ✅ **Message Persistence Fix**:
  - Added WhatsApp v23.0 types: `sticker`, `reaction`, `order`
  - Removed invalid `voice` type (voice messages arrive as `type='audio'`)
  - Implemented type-safe validation with fallback to `'unknown'`
  - Enhanced error logging for enum violations and type mismatches
- ✅ **Database Migration**:
  - Created `supabase/migrations/002_add_whatsapp_v23_message_types.sql`
  - Executed in Supabase Dashboard (production)
  - Verified all v23.0 types now supported
- ✅ **Code Updates**:
  - `lib/persist.ts`: Type-safe VALID_MSG_TYPES array with validation
  - `lib/message-normalization.ts`: Fixed voice handling, added sticker/reaction/order
  - `types/schemas.ts`: Updated MessageTypeSchema, added OrderContentSchema
  - `app/api/whatsapp/webhook/route.ts`: Corrected audio/voice conditional
- ✅ **Diagnostic Tools**:
  - `scripts/audit-users.ts`: Complete interaction analysis tool
  - `audit-report.json`: Exportable metrics per user
- ✅ **Status**: Code ready, pending deployment to validate fix

### 2025-10-07 - Supabase MCP Integration 🚀
- ✅ **MCP Server Configuration** - Direct Supabase access from Claude Code:
  - Configured Supabase MCP at `https://mcp.supabase.com/mcp`
  - OAuth authentication (automatic browser login)
  - 20+ AI-powered tools: database, edge functions, storage, debugging
  - Scoped to project: `pdliixrgdvunoymxaxmw`
  - Feature groups enabled: database, functions, debugging, development, docs, storage
- ✅ **Documentation Updated**:
  - Enhanced `docs/SUPABASE-ACCESS.md` with MCP section
  - Usage examples for natural language queries
  - Comparison matrix: MCP vs CLI vs TypeScript API
- ✅ **Benefits**:
  - Execute SQL queries from natural language
  - AI-assisted table design and migrations
  - Deploy Edge Functions without CLI
  - Real-time debugging with logs
  - Auto-generate TypeScript types

### 2025-10-06 - Tool Calling & Security Audit ⚡
- ✅ **Tool Calling Implementation** - Manual loop with Claude SDK:
  - Created `lib/claude-tools.ts` with Zod-validated schemas
  - Implemented manual tool calling loop in ProactiveAgent (max 5 iterations)
  - Integrated tools: create_reminder, schedule_meeting, track_expense
  - Type-safe tool execution with proper error handling
  - Bot now autonomously executes actions: "Recuérdame X" → creates reminder
  - Confirms with "✅ Listo! Guardé tu recordatorio..." (no manual confirmation)
- ✅ **Triple Agent Security Audit** - Production validation:
  - @whatsapp-api-expert: 0 critical errors (v23.0 compliant)
  - @edge-functions-expert: 0 critical errors (Edge Runtime verified)
  - @typescript-pro: 0 critical errors (strict mode passing)
- ✅ **Production Hardening** - Security fixes implemented:
  - Flow token expiration validation (1-hour default, customizable)
  - Unicode escape in flow signatures (HMAC-SHA256)
  - Type safety across all tool inputs/outputs
- ✅ **Testing**: 239 tests passing (+14 tool calling tests)
- ✅ **Status**: PRODUCTION READY for Vercel deployment

### 2025-10-06 - Autonomous AI Actions & Error Recovery ⚡
- ✅ **Autonomous AI Execution** - ProactiveAgent ejecuta acciones automáticamente:
  - Creates reminders and meetings without manual confirmation
  - Responds with "✅ Listo, ya lo guardé" vs "Puedes agregarlo manualmente"
  - Integrated with `createReminder()` and `scheduleMeetingFromIntent()`
- ✅ **Intelligent Follow-ups** - Context-aware messaging:
  - Uses conversation history for natural messages
  - Detects user activity (< 30 min) to avoid interruptions
  - ProactiveAgent generates personalized follow-up messages
  - Scheduled at 9am and 6pm (optimized from 6h intervals)
- ✅ **Error Recovery System** - Production-ready error handling:
  - Retry logic with exponential backoff (500ms → 1s)
  - Duplicate detection (PostgreSQL + code-level)
  - Transient error classification (connection, timeout, 503)
  - Enhanced logging with error type metadata
- ✅ **Testing**: 225 tests passing (+13 new tests for persist failures)
- ✅ **Documentation**: 2 research guides (2,337 lines on AI processing)

### 2025-10-06 - Edge Runtime Optimization ⚡
- ✅ **Confirmed Edge Runtime Compatibility** - All AI SDKs verified:
  - Using `@anthropic-ai/sdk` v0.65.0 (Edge-compatible)
  - Removed unused `@anthropic-ai/claude-agent-sdk` (requires Node.js)
  - All routes running on Vercel Edge Functions ✅
- ✅ **Documentation Cleanup**:
  - Updated SDK compatibility matrix
  - Clarified Edge Runtime constraints
  - Verified fire-and-forget webhook pattern

### 2025-10-05 - Multi-Provider AI System ⚡
- ✅ **76% Cost Reduction**:
  - Claude Sonnet 4.5: Primary chat ($3/$15 vs $15/$60)
  - Groq Whisper: Audio transcription ($0.05/hr vs $0.36/hr)
  - Tesseract: Free OCR (vs $0.002/image)
  - OpenAI: Fallback only
- ✅ **Specialized AI Agents**:
  - ProactiveAgent: Main conversational assistant
  - SchedulingAgent: Autonomous appointment management
  - FinanceAgent: Proactive expense tracking
- ✅ **Edge-Compatible SDKs**:
  - @anthropic-ai/sdk: v0.65.0 (Messages API)
  - groq-sdk: v0.33.0 (Audio transcription)
  - tesseract.js: v6.0.1 (OCR)
  - @modelcontextprotocol/sdk: v1.19.1 (MCP integration)
- ✅ Webhook updated to use V2 AI processing
- ✅ Cost tracking and budget management system

### 2025-10-03
- ✅ CLAUDE-MASTER v2.0 structure initialized
- ✅ Created complete `.claude/` organization
- ✅ Compacted CLAUDE.md to <200 lines
- ✅ Reorganized `/docs` into numbered categories (01-10)
- ✅ Consolidated documentation (56 files → 35 files)
- ✅ Created main documentation index
- ✅ **Deploy Validation System** - Prevents Vercel build failures:
  - Pre-commit hooks (Husky) - type checking
  - Pre-push hooks - full build + tests
  - GitHub Actions CI pipeline
  - Automated verification script
  - Deploy checklist documentation

### Migration to Next.js 15 (Complete)
- ✅ App Router with Edge Functions
- ✅ All routes in `app/api/` with `route.ts`
- ✅ Named HTTP exports (GET, POST)
- ✅ 225 tests passing

---

**Last Updated**: 2025-10-08
**Owner**: claude-master
**Session Model**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
