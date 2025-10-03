# Lessons Learned

---

## Next.js 15 App Router Migration (2025-09-25)

**Challenge**: Routes not detected after migration
**Solution**:
- Move routes from `/api/` to `/app/api/`
- Use `route.ts` naming (not `index.ts`)
- Export named HTTP methods (GET, POST) not default
**Takeaway**: App Router requires strict file structure
**Applied to**: All API endpoints restructured

---

## Vercel Edge Functions Auto-Detection (2025-09-26)

**Challenge**: Deployment failed with "runtime not supported"
**Solution**:
- Remove `functions.runtime` from vercel.json
- Keep `export const runtime = 'edge'` in route files
- Vercel auto-detects from route exports
**Takeaway**: vercel.json should only have crons, headers, redirects
**Applied to**: Deployment configuration

---

## TypeScript noUncheckedIndexedAccess (2025-09-15)

**Challenge**: Type errors on array access (array[0] possibly undefined)
**Solution**:
- Use `array[0]!` when certain index exists
- Or check length first: `if (array.length > 0) { array[0] }`
- Add runtime validation for uncertain cases
**Takeaway**: Strict mode catches real bugs (empty arrays)
**Applied to**: All array access code

---

## WhatsApp Media API Authentication (2025-09-22)

**Challenge**: 401 errors when downloading media
**Solution**:
- Use app-level access token, not user token
- Include `Authorization: Bearer TOKEN` header
- Media URLs expire after 5 minutes (download immediately)
**Takeaway**: WhatsApp has different token types with different permissions
**Applied to**: Audio transcription media download

---

## OpenAI Whisper Timeout on Long Audio (2025-10-01)

**Challenge**: Edge Function timeout on 5+ minute audio
**Solution**:
- Process in background (async)
- Send "Transcribing..." message immediately
- Follow up with transcription when ready
- Set max audio duration (10 min)
**Takeaway**: Long operations need async processing in Edge
**Applied to**: Audio transcription pipeline

---

## Supabase RLS Performance (2025-09-18)

**Challenge**: Slow queries (200-500ms) on conversation history
**Solution**:
- Add index on (phone_number, created_at)
- Queries dropped to <50ms
**Takeaway**: RLS policies need supporting indexes
**Applied to**: All tables with RLS policies

---

## Context Window Optimization (2025-09-28)

**Challenge**: Hitting 8K token limit on long conversations
**Solution**:
- Limit history to last 10 messages (~2K tokens)
- Summarize older context if needed
- Prune system message for simple intents
**Takeaway**: Balance context vs token cost
**Applied to**: Conversation history retrieval

---

## Jest Edge Runtime Testing (2025-09-20)

**Challenge**: Standard Jest environment incompatible with Edge
**Solution**:
- Use @edge-runtime/jest-environment
- Configure in jest.config.js
- Mock fetch, crypto explicitly
**Takeaway**: Edge Runtime needs special test environment
**Applied to**: All test configuration

---

## WhatsApp Interactive Buttons Limit (2025-09-19)

**Challenge**: Error when sending 4+ buttons
**Solution**:
- Max 3 buttons per message
- Use List for 4+ options
- Button titles max 20 chars
**Takeaway**: WhatsApp has strict limits on interactive elements
**Applied to**: UI decision logic (buttons vs lists)

---

## CLAUDE-MASTER Session Management (2025-10-03)

**Challenge**: Lost context mid-feature development
**Solution**:
- Create .claude/ structure
- Checkpoint every 30 minutes
- Track progress in phases/current.md
**Takeaway**: Proactive context management prevents rework
**Applied to**: All future development sessions

---

**Last Updated**: 2025-10-03
