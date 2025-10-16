# URGENT: Fix Production Bot Failure

**Status**: CRITICAL - Bot failing for all users
**Impact**: 100% of WhatsApp messages return error: "Disculpa, tuve un problema al procesar tu mensaje"
**Root Cause**: Incorrect RLS policy blocks Gemini AI (primary provider)
**ETA to Fix**: ~5 minutes

---

## Quick Fix Steps

### Step 1: Apply Database Migration (2 minutes)

1. **Open Supabase Dashboard**:
   ```
   https://supabase.com/dashboard/project/pdliixrgdvunoymxaxmw
   ```

2. **Navigate to SQL Editor**:
   - Left sidebar → "SQL Editor"
   - Click "New query"

3. **Copy & Paste Migration**:
   ```bash
   cat supabase/migrations/014_fix_gemini_usage_rls.sql
   ```

   Or copy from:
   `/Users/mercadeo/neero/migue.ai/supabase/migrations/014_fix_gemini_usage_rls.sql`

4. **Execute Query**:
   - Click "Run" (or press Cmd+Enter)
   - Should see: "Success. No rows returned"

5. **Verify Fix**:
   ```sql
   SELECT policyname, cmd, roles, qual, with_check
   FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'gemini_usage';
   ```

   Expected output:
   ```
   policyname: service_role_gemini_usage_all
   cmd: *
   roles: {service_role}
   qual: true
   with_check: true
   ```

---

### Step 2: Test Bot (1 minute)

1. **Send WhatsApp Message**:
   - Open WhatsApp
   - Message: "hola" to bot number

2. **Expected Response**:
   - ✅ Bot should respond normally (e.g., "¡Qué más parce!")
   - ❌ NOT: "Disculpa, tuve un problema..."

---

### Step 3: Monitor Logs (2 minutes)

**Option A: Vercel Dashboard**
1. Open: https://vercel.com/neeroai/migue-ai/logs
2. Filter: "Production" environment
3. Look for: `[gemini-client] Free tier check` → should show success

**Option B: Local CLI** (if available)
```bash
npm run logs:prod
# or
vercel logs --prod --follow
```

**What to look for**:
- ✅ `[gemini-client] Free tier check` with `canUse: true`
- ✅ `[AI] Using Gemini with conversation history`
- ✅ `[gemini-agent] Response generated`
- ❌ `[AI processing error]` or `[gemini-client] Failed to check free tier`

---

## Understanding the Fix

### What Was Broken

**File**: `supabase/migrations/009_gemini_usage_idempotent.sql:66-68`

```sql
-- ❌ BROKEN POLICY
CREATE POLICY service_role_full_access ON gemini_usage
  FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
```

**Why it failed**:
- `auth.role()` returns role of authenticated user session
- Edge Functions have NO user session (use service role key directly)
- `auth.role()` returns `NULL` → policy check fails
- All queries blocked by Row Level Security (RLS)

### What Was Fixed

**File**: `supabase/migrations/014_fix_gemini_usage_rls.sql:20-25`

```sql
-- ✅ CORRECT POLICY
CREATE POLICY service_role_gemini_usage_all ON gemini_usage
  FOR ALL
  TO service_role      -- Target role directly (not via auth.role())
  USING (true)         -- Unconditional access
  WITH CHECK (true);
```

**Why it works**:
- `TO service_role` targets the role directly
- No dependency on user session or auth context
- Edge Functions use service_role key → policy allows access
- Queries succeed → bot works

---

## Failure Chain (Before Fix)

1. User sends WhatsApp message → webhook received
2. System tries to use Gemini (primary AI, free tier)
3. Calls `canUseFreeTier()` → queries `gemini_usage` table
4. RLS blocks query (broken policy) → error caught
5. Function returns `false` (fail-closed for safety)
6. System skips Gemini → tries OpenAI (fallback #1)
7. OpenAI also fails (likely same DB permission issue)
8. All providers exhausted → sends error to user:
   ```
   "Disculpa, tuve un problema al procesar tu mensaje.
    ¿Podrías intentarlo de nuevo?"
   ```

---

## Success Chain (After Fix)

1. User sends WhatsApp message → webhook received
2. System tries to use Gemini (primary AI, free tier)
3. Calls `canUseFreeTier()` → queries `gemini_usage` table
4. ✅ RLS allows query (fixed policy)
5. Function returns `true` (within 1,500 req/day limit)
6. System uses Gemini 2.5 Flash (FREE)
7. Bot responds normally → user happy!

---

## Rollback Plan (If Issues Persist)

If bot still fails after applying fix:

### Emergency Kill Switch

1. **Open Vercel Dashboard**:
   ```
   https://vercel.com/neeroai/migue-ai/settings/environment-variables
   ```

2. **Add Environment Variable**:
   - Key: `AI_EMERGENCY_STOP`
   - Value: `true`
   - Environments: Production

3. **Redeploy** (or wait ~30s for auto-reload)

4. **Result**: Bot will respond:
   ```
   "El sistema está temporalmente deshabilitado por mantenimiento.
    Por favor intenta más tarde."
   ```

### Investigate Further

If emergency stop is needed, investigate:
1. Check other database migrations were applied (009, 010, 013)
2. Verify `SUPABASE_KEY` in Vercel is service_role key (not anon key)
3. Check network connectivity between Vercel Edge and Supabase
4. Review Supabase logs for RLS errors

---

## Additional Migrations (Optional - If Not Applied)

If migration 010 was never applied to production, also run:

```sql
-- File: supabase/migrations/010_add_service_role_policies.sql
-- This adds RLS bypass policies for ALL tables
-- Safe to run even if already applied (uses IF EXISTS checks)
```

**How to check**:
```sql
SELECT COUNT(*)
FROM pg_policies
WHERE policyname LIKE 'service_role_%';
```

Expected: 15-20 policies (one per table)

---

## Contact

If issues persist after fix:
- Check Vercel logs (link above)
- Check Supabase logs: Dashboard → Logs → Postgres Logs
- Review `.claude/phases/current.md` for known issues

**Estimated Downtime**: 0-5 minutes (just DB migration execution)
