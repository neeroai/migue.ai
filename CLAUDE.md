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
- `api/whatsapp/webhook.ts` - Message reception & verification
- `api/whatsapp/send.ts` - Message sending
- `api/cron/check-reminders.ts` - Daily reminders (9 AM UTC)
- `lib/supabase.ts` - Database client
- `lib/persist.ts` - Data persistence helpers
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
npm run test:unit      # Jest unit tests
npm run test:e2e       # Playwright e2e tests
npm run test:coverage  # Coverage report
npm run test:watch     # Watch mode
```

### Requirements
- ≥1 happy path + ≥1 failure path per e2e test
- Deterministic and independent tests
- Bug fixes MUST include regression test (write to fail first)
- Use Jest for unit, Supertest for integration, Playwright for e2e

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

For detailed information, see:
- **[AGENTS.md](./AGENTS.md)** - Complete project blueprint & business context
- **[docs/setup.md](./docs/setup.md)** - Detailed setup instructions
- **[docs/architecture.md](./docs/architecture.md)** - Architecture deep-dive
- **[docs/SUPABASE.md](./docs/SUPABASE.md)** - Database schema & RLS policies
- **[WhatsApp API Docs](https://developers.facebook.com/docs/whatsapp)** - Official API reference
- **[Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)** - Runtime documentation

---

## Project Info
- **Stack**: Vercel Edge + Supabase + OpenAI (GPT-4o/Whisper/Embeddings)
- **TypeScript**: 5.9.2 (strict mode)
- **Node.js**: 20.x required
- **Module Type**: ESM (ES Modules)
- **Testing**: Jest + Playwright + Supertest
- **Deployment**: ✅ Production ready on Vercel (https://migue.app)
- **Status**: Fase 2 - Core Features Development