# API Quirks & Unexpected Behaviors

---

## WhatsApp Cloud API - Media URLs Expire

**Behavior**: Media download URLs expire after 5 minutes
**Workaround**:
- Download media immediately on webhook receive
- Store in Supabase storage for processing
- Never delay or queue media downloads
**Tested**: WhatsApp API v23.0 (2025-10-03)

---

## WhatsApp Cloud API - Rate Limiting by Conversation

**Behavior**: Rate limit is 250 msg/sec BUT per phone number
**Workaround**:
- Track sending rate per conversation
- Queue messages if sending too fast
- Wait 100ms between messages to same number
**Tested**: WhatsApp API v23.0 (2025-09-20)

---

## WhatsApp Cloud API - Typing Indicator Maximum

**Behavior**: Typing indicator auto-stops after 25 seconds
**Workaround**:
- Use `startWithDuration(5)` for predictable ops
- Never assume typing >25s
- Send progress messages for long operations
**Tested**: WhatsApp API v23.0 (2025-09-19)

---

## OpenAI Whisper - Inconsistent Timing

**Behavior**: Same audio length can vary 2-10s transcription time
**Workaround**:
- Don't rely on timing estimates
- Always use async processing
- Set conservative timeout (30s for 1 min audio)
**Tested**: Whisper API (2025-10-01)

---

## OpenAI GPT-4o - Token Count Estimation Off

**Behavior**: Actual tokens ~15% more than tiktoken estimate
**Workaround**:
- Add 20% buffer to token calculations
- Monitor actual usage via API response
- Set max_tokens conservatively
**Tested**: GPT-4o (2025-09-28)

---

## Supabase RLS - IN Operator Performance

**Behavior**: `IN` operator with >100 items very slow with RLS
**Workaround**:
- Use multiple queries instead
- Or temporary table approach
- Or batch in groups of 50
**Tested**: Supabase PostgreSQL 15 (2025-09-18)

---

## Vercel Edge Functions - Fetch Cache Behavior

**Behavior**: `fetch()` caches by default in Edge Runtime
**Workaround**:
- Add `cache: 'no-store'` for non-cacheable requests
- Or use unique URLs (timestamp query param)
**Tested**: Vercel Edge Runtime (2025-09-26)

---

## Next.js App Router - Dynamic Imports Edge

**Behavior**: `await import()` not supported in Edge Runtime
**Workaround**:
- Use static imports at top of file
- Or conditional exports in separate files
- Or use Node.js runtime for dynamic imports
**Tested**: Next.js 15.5.4 (2025-09-25)

---

## Supabase Storage - File Name Encoding

**Behavior**: Some special chars in filenames cause 400 errors
**Workaround**:
- Sanitize filenames: `name.replace(/[^a-zA-Z0-9.-]/g, '_')`
- Use UUIDs for filenames
- Keep original name in metadata
**Tested**: Supabase Storage (2025-10-01)

---

## OpenAI Embeddings - Batch Size Limit

**Behavior**: Max 100 texts per batch request (undocumented)
**Workaround**:
- Chunk into batches of 50 (safe)
- Parallel requests for large sets
- Add retry for partial failures
**Tested**: text-embedding-3-small (2025-10-02)

---

## WhatsApp Interactive Lists - Description Optional But Recommended

**Behavior**: Lists without descriptions look empty in some clients
**Workaround**:
- Always provide description for list items
- Use title for main text, description for details
- Test on multiple WhatsApp clients
**Tested**: WhatsApp API v23.0 (2025-09-19)

---

## Vercel Cron - Execution Time Variability

**Behavior**: Cron runs within ±1 minute of schedule (not exact)
**Workaround**:
- Don't rely on precise timing
- Check last_run timestamp in DB
- Deduplicate executions
**Tested**: Vercel Cron (2025-09-22)

---

## Supabase Auth - Service Role Bypasses RLS

**Behavior**: Service role key bypasses ALL RLS policies
**Workaround**:
- Never use service role for user queries
- Only use for admin/system operations
- Explicitly filter user-specific queries
**Tested**: Supabase Auth (2025-09-15)

---

## OpenAI Chat - Empty Messages Array Error

**Behavior**: API returns 400 if messages array empty
**Workaround**:
- Always validate messages.length > 0
- Include system message at minimum
- Catch and handle gracefully
**Tested**: GPT-4o (2025-09-28)

---

## WhatsApp Webhook - Duplicate Messages

**Behavior**: Same message can arrive 2+ times (rare)
**Workaround**:
- Use message.id for deduplication
- Store processed message IDs (24h TTL)
- Idempotent processing
**Tested**: WhatsApp API v23.0 (2025-09-21)

---

## Next.js Edge - process.env Runtime

**Behavior**: `process.env` available but frozen at build time
**Workaround**:
- Use Vercel env vars (injected at runtime)
- Don't mutate process.env
- Access via `process.env.VAR_NAME` directly
**Tested**: Next.js 15 Edge (2025-09-26)

---

**Last Updated**: 2025-10-03
**Note**: Add new quirks as discovered during development
