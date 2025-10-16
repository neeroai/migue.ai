# Quick Fix Check - Bot Status Verification

**Update**: Migration 010 already created the correct policy. The bot might already be working!

---

## Step 1: Test Bot Now (30 seconds)

**Action**: Send WhatsApp message to bot
- Message: `hola`
- Number: Your bot's WhatsApp number

**Expected Results**:

### ✅ If Bot Responds Normally
Example: "¡Qué más parce! Todo bien por acá. ¿En qué te ayudo?"

→ **Bot is already fixed!** Migration 010 already applied the correct policy.

**Next**: Clean up the broken policy from migration 009:
```sql
-- Run in Supabase Dashboard → SQL Editor
DROP POLICY IF EXISTS service_role_full_access ON gemini_usage;
```

### ❌ If Bot Still Returns Error
Example: "Disculpa, tuve un problema al procesar tu mensaje..."

→ **Different issue**. Proceed to Step 2.

---

## Step 2: Check Active Policies

**Run in Supabase Dashboard → SQL Editor**:
```sql
SELECT
  policyname,
  cmd,
  roles::text as roles,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'gemini_usage'
ORDER BY policyname;
```

**Expected Output**:

### Scenario A: Both policies exist (most likely)
```
policyname                      | cmd | roles          | using_clause                                      | with_check_clause
--------------------------------|-----|----------------|--------------------------------------------------|-------------------
service_role_full_access        | *   | {public}       | (auth.role() = 'service_role'::text) OR ...      | NULL
service_role_gemini_usage_all   | *   | {service_role} | true                                              | true
```

**Action**: Run cleanup migration (Step 3A)

### Scenario B: Only correct policy exists
```
policyname                      | cmd | roles          | using_clause | with_check_clause
--------------------------------|-----|----------------|-------------|-------------------
service_role_gemini_usage_all   | *   | {service_role} | true        | true
```

**Status**: Already fixed! Bot should be working.

### Scenario C: Only broken policy exists
```
policyname                      | cmd | roles    | using_clause                              | with_check_clause
--------------------------------|-----|----------|------------------------------------------|-------------------
service_role_full_access        | *   | {public} | (auth.role() = 'service_role'::text) ... | NULL
```

**Action**: Run migration 014 with fix (Step 3B)

---

## Step 3A: Clean Up (If Both Policies Exist)

**Run in Supabase Dashboard → SQL Editor**:
```sql
-- Migration 014 (Simplified - Just cleanup)
-- Drop the broken policy from migration 009
DROP POLICY IF EXISTS service_role_full_access ON gemini_usage;

-- Verify correct policy remains
SELECT policyname FROM pg_policies
WHERE tablename = 'gemini_usage';
-- Should show: service_role_gemini_usage_all
```

**Result**: Bot continues working, broken policy removed ✅

---

## Step 3B: Apply Fix (If Only Broken Policy Exists)

**Run in Supabase Dashboard → SQL Editor**:
```sql
-- Migration 014 (Fixed - Idempotent version)
-- Drop both old policies
DROP POLICY IF EXISTS service_role_full_access ON gemini_usage;
DROP POLICY IF EXISTS service_role_gemini_usage_all ON gemini_usage;

-- Create correct policy
CREATE POLICY service_role_gemini_usage_all ON gemini_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify
SELECT policyname FROM pg_policies
WHERE tablename = 'gemini_usage';
-- Should show: service_role_gemini_usage_all
```

**Result**: Bot starts working ✅

---

## Step 4: Verify Fix (After any changes)

**Option A: Quick Test**
Send WhatsApp message "hola" → should get normal response

**Option B: Detailed Verification**
```bash
npx tsx scripts/verify-gemini-rls-fix.ts
```

Should show:
```
✅ RLS policy exists: service_role_gemini_usage_all
✅ Table accessible
✅ Free tier check passed
✅ Write permission working
```

---

## Why Migration 014 Failed

**Error**: `policy "service_role_gemini_usage_all" for table "gemini_usage" already exists`

**Reason**: Migration 010 (line 224) already created this policy conditionally when the `gemini_usage` table was created.

**Timeline**:
1. Migration 009: Created table + BROKEN policy (`service_role_full_access`)
2. Migration 010: Created CORRECT policy (`service_role_gemini_usage_all`)
3. Migration 014: Tried to create same policy → ERROR (already exists)

**Why it still worked**: PostgreSQL RLS uses OR logic. Even with the broken policy, if ANY policy grants access, access is granted. So the correct policy from migration 010 was sufficient.

---

## What to Do Next

1. **Test bot** (Step 1) → Takes 30 seconds
2. If working → Run cleanup SQL (Step 3A)
3. If not working → Check for different issue

**Most likely outcome**: Bot is already working, just needs cleanup of broken policy.

---

## If Bot Still Fails After Fix

Check these:

### 1. Verify Supabase Key
```bash
# In Vercel Dashboard → Environment Variables
# SUPABASE_KEY should be service_role key (starts with eyJ...)
# NOT anon key
```

### 2. Check Other Migrations
```sql
-- Verify all critical tables have service_role policies
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'service_role_%'
GROUP BY tablename
ORDER BY tablename;
```

Should show 15-20 tables with policies.

### 3. Check Vercel Logs
```bash
vercel logs --prod --follow | grep -E "(gemini|error|AI)"
```

Look for specific error messages.

---

## Emergency Stop (If Needed)

**Vercel Dashboard** → Environment Variables:
- Key: `AI_EMERGENCY_STOP`
- Value: `true`
- Environment: Production

Bot will respond: "Sistema en mantenimiento..."
