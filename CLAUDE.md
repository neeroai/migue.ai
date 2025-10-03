# CLAUDE.md

**migue.ai** - WhatsApp AI Assistant on Vercel Edge Functions + Supabase + OpenAI

## Quick Reference

### Essential Commands
```bash
npm run dev           # Start Vercel dev server
npm run build         # Compile TypeScript
npm run typecheck     # Type check without emit
npm run test          # Run all tests (Jest + Playwright)
npm run clean         # Clean build artifacts
```

### Key Files
- `api/whatsapp/webhook.ts` - Message reception & verification + AI processing
- `api/whatsapp/send.ts` - Message sending
- `api/cron/check-reminders.ts` - Daily reminders (9 AM UTC)
- `lib/supabase.ts` - Database client
- `lib/persist.ts` - Data persistence helpers
- `lib/openai.ts` - OpenAI client (Edge-compatible)
- `lib/intent.ts` - Intent classification with GPT-4o
- `lib/response.ts` - Contextual response generation
- `lib/context.ts` - Conversation history management
- `types/schemas.ts` - Zod validation schemas for WhatsApp webhooks
- `vercel.json` - Deployment config (crons + headers)

### Environment Variables
See `.env.example` - Required: `WHATSAPP_*`, `SUPABASE_*`, `OPENAI_API_KEY`

---

## Development Rules

### IMPORTANT: Mandatory Standards
- **Read Complete Files**: ALWAYS read files fully before modifications
- **Small Changes**: Keep commits small and safe (≤300 LOC/file, ≤50 LOC/function)
- **Security First**: NEVER commit secrets; validate inputs, encode outputs
- **Test Coverage**: Minimum 80% for critical modules
- **Edge Runtime**: ALL api routes MUST export `export const config = { runtime: 'edge' }`
- **⚠️ CRITICAL: NEVER delete `.bmad-core/` directory** - Contains essential project configuration

### Code Limits (Enforced)
- File: ≤ 300 LOC
- Function: ≤ 50 LOC
- Parameters: ≤ 5
- Cyclomatic Complexity: ≤ 10

If exceeded → divide/refactor immediately

### TypeScript Strict Mode
- Target: ES2022, module: ES2022, moduleResolution: bundler
- `noUncheckedIndexedAccess: true` → validate array access with `!` when certain
- `exactOptionalPropertyTypes: true` → handle all nullable types explicitly
- NO `any` types - use proper typing or `unknown`

---

## Code Style

### Edge Functions Pattern
```typescript
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  // Edge-compatible code only (no Node.js APIs)
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' }
  });
}
```

### Database Access
```typescript
import { getSupabaseServerClient } from '../../lib/supabase';
const supabase = getSupabaseServerClient(); // Server-side, no session
// Always respect RLS policies
```

### Conventions
- Use ES modules: `import`/`export` (NO `require`)
- Destructure imports when possible
- Guard clauses first (early returns)
- One function = one task
- Constants over magic numbers
- Specific error messages

---

## Testing

### Commands
```bash
npm run test           # Run all tests
npm run test:unit      # Jest unit tests only
npm run test:e2e       # Playwright e2e tests
npm run test:watch     # Watch mode
```

### Current Status (Week 1 - Complete ✅)
- **Test Suites**: 4 passed, 4 total
- **Tests**: 39 passed, 39 total
- **Unit Tests**: intent.test.ts (10), response.test.ts (10), context.test.ts (5), schemas.test.ts (14)
- **Infrastructure**: Jest + @edge-runtime/jest-environment + Zod validation

### Test Files
- `tests/setup.ts` - Global test configuration with mocked env vars
- `tests/unit/intent.test.ts` - Intent classification tests (10 tests)
- `tests/unit/response.test.ts` - Response generation tests (10 tests)
- `tests/unit/context.test.ts` - Conversation history tests (5 tests)
- `tests/unit/schemas.test.ts` - Zod validation tests (14 tests)

### Requirements
- ≥1 happy path + ≥1 failure path per e2e test
- Deterministic and independent tests
- Bug fixes MUST include regression test (write to fail first)
- Use Jest for unit, Supertest for integration, Playwright for e2e
- **Note**: Coverage disabled for Edge Runtime (doesn't support code generation)

---

## Common Tasks

### Add New API Endpoint
1. Create `api/<module>/<endpoint>.ts`
2. Add `export const config = { runtime: 'edge' }`
3. Implement handler with proper error handling
4. Add unit tests in `tests/unit/`
5. Update this file if needed (commands/routes)

### Modify Database Schema
1. Edit `supabase/schema.sql` (tables) or `supabase/security.sql` (RLS)
2. Test in Supabase SQL Editor
3. Update TypeScript types if needed
4. Add migration notes in commit message

### Deploy to Vercel
```bash
git add . && git commit -m "feat: description"
git push origin main
# Vercel auto-deploys main branch
# Edge Functions detected automatically via export config
```

---

## Vercel Configuration

### IMPORTANT: Edge Functions Auto-Detection
- Vercel detects Edge Functions via `export const config = { runtime: 'edge' }`
- DO NOT specify `runtime` in `vercel.json` (causes deployment errors)
- `vercel.json` should ONLY contain: crons, headers, redirects, rewrites

### Current vercel.json Structure
```json
{
  "crons": [
    { "path": "/api/cron/check-reminders", "schedule": "0 9 * * *" }
  ],
  "headers": [
    {
      "source": "/api/whatsapp/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    }
  ]
}
```

---

## Troubleshooting

### TypeScript Errors
- **Array access**: Use `array[i]!` when certain index exists
- **Nullable checks**: Validate before use: `if (value) { ... }`
- **Type assertions**: Be explicit with `as Type` when needed

### Vercel Deployment Fails
- ✅ Check all API routes export `export const config = { runtime: 'edge' }`
- ✅ Remove `functions.runtime` from `vercel.json` if present
- ✅ Verify no Node.js-specific APIs (fs, path, etc.) in Edge Functions
- ✅ Check env vars are set in Vercel Dashboard
- ✅ Use **static imports** at top of file (NOT dynamic `await import()`)
- ✅ Ensure `lib/` files are NOT gitignored (check .gitignore for Python/TypeScript conflicts)

### Database Connection Issues
- Verify `SUPABASE_URL` and `SUPABASE_KEY` in env
- Use `getSupabaseServerClient()` for server-side operations
- Check RLS policies in Supabase Dashboard

### WhatsApp Webhook Not Working
- Verify `WHATSAPP_VERIFY_TOKEN` matches Meta App config
- Check webhook URL is correct: `https://your-domain.vercel.app/api/whatsapp/webhook`
- Test with Postman using GET for verification, POST for messages

---

## References

### Project Documentation
- **[AGENTS.md](./AGENTS.md)** - Complete project blueprint & business context
- **[README.md](./README.md)** - Project overview and quick start
- **[docs/setup.md](./docs/setup.md)** - Detailed setup instructions
- **[docs/architecture.md](./docs/architecture.md)** - Architecture deep-dive
- **[docs/SUPABASE.md](./docs/SUPABASE.md)** - Database schema & RLS policies

### Vercel Deployment Documentation (2025)
- **[docs/deployment/README.md](./docs/deployment/README.md)** - Complete deployment index
- **[docs/VERCEL-EDGE-FUNCTIONS-GUIDE.md](./docs/VERCEL-EDGE-FUNCTIONS-GUIDE.md)** - Edge Functions guide
- **[docs/VERCEL-DEPLOYMENT-BEST-PRACTICES-2025.md](./docs/VERCEL-DEPLOYMENT-BEST-PRACTICES-2025.md)** - Best practices
- **[docs/VERCEL-STREAMING-AI-RESPONSES.md](./docs/VERCEL-STREAMING-AI-RESPONSES.md)** - Streaming implementation
- **[docs/VERCEL-MONITORING-ANALYTICS.md](./docs/VERCEL-MONITORING-ANALYTICS.md)** - Monitoring & analytics
- **[docs/VERCEL-WHATSAPP-BOT-ARCHITECTURE.md](./docs/VERCEL-WHATSAPP-BOT-ARCHITECTURE.md)** - WhatsApp architecture
- **[docs/VERCEL-SUPABASE-INTEGRATION.md](./docs/VERCEL-SUPABASE-INTEGRATION.md)** - Supabase integration

### External APIs
- **[WhatsApp API Docs](https://developers.facebook.com/docs/whatsapp)** - Official API reference
- **[Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)** - Runtime documentation
- **[OpenAI API](https://platform.openai.com/docs)** - GPT-4o, Whisper, Embeddings
- **[Supabase Docs](https://supabase.com/docs)** - PostgreSQL, Auth, Storage

---

## Project Info
- **Stack**: Vercel Edge + Supabase + OpenAI (GPT-4o/Whisper/Embeddings)
- **TypeScript**: 5.9.2 (strict mode)
- **Node.js**: 20.x required
- **Module Type**: ESM (ES Modules)
- **Testing**: Jest + Playwright + Supertest
- **Deployment**: ✅ Production ready on Vercel (https://migue.app)
- **Status**: Fase 2 - Core Features Development

## Recent Updates

### Week 1 - Testing Infrastructure (Complete ✅)
- ✅ **Testing Infrastructure**: Jest + Edge Runtime + 39 unit tests passing
- ✅ **Zod Validation**: Complete WhatsApp webhook schemas (types/schemas.ts)
- ✅ **Webhook Validation**: Integrated Zod validation in webhook.ts
- ✅ **Type Safety**: WhatsAppMessage types with 13 message formats supported

### Previous Updates
- ✅ **AI System Implemented**: GPT-4o intent classification + contextual responses
- ✅ **Comprehensive Vercel Docs**: 6 guides + deployment index (2025 best practices)
- ✅ **Database Optimization**: RLS indexes for 100x query improvement
- ✅ **Edge Functions**: All endpoints optimized for < 100ms latency

### Next Steps (Week 2)
- 🔄 **Audio Transcription**: Whisper API integration for voice messages
- 🔄 **Media Download**: WhatsApp media download module
- 🔄 **Refactoring**: Extract sendWhatsAppMessage to lib/whatsapp.ts
- 🔄 **Error Handling**: Custom error classes + structured logging
- 🔄 **Integration Tests**: Webhook flow with mocks