# Deployment Instructions - Supabase Database Fixes

**Date**: 2025-10-11
**Issue**: Database writes failing due to missing RLS policies and expenses table
**Severity**: CRITICAL - Data loss occurring

---

## Summary of Changes

1. ✅ Created migration `010_add_service_role_policies.sql` - Service role RLS bypass
2. ✅ Created migration `011_add_expenses_table.sql` - Expense tracking persistence
3. ✅ Updated `lib/claude-tools.ts` - Expense persistence implementation
4. ✅ Updated `lib/persist.ts` - RLS error detection
5. ✅ Updated `.env.example` - Clarified service_role key requirement

---

## Pre-Deployment Checklist

### 1. Verify Environment Configuration

**CRITICAL**: Ensure production uses service_role key (not anon key)

```bash
# Check current Vercel environment variables
npx vercel env ls

# Pull production environment to verify
npx vercel env pull .env.vercel

# Decode SUPABASE_KEY to verify it's service_role
# Visit https://jwt.io and paste the key value
# Check payload.role === "service_role" (not "anon")
```

**If using anon key**:
1. Get service_role key from Supabase Dashboard > Settings > API > service_role (secret)
2. Update Vercel environment variable:
   ```bash
   npx vercel env rm SUPABASE_KEY production
   npx vercel env add SUPABASE_KEY production
   # Paste service_role key when prompted
   ```

---

## Deployment Steps

### Step 1: Apply Database Migrations

**Option A: Via Supabase Dashboard (Recommended)**

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/pdliixrgdvunoymxaxmw)
2. Navigate to: SQL Editor
3. Apply Migration 010:
   ```sql
   -- Copy entire contents of supabase/migrations/010_add_service_role_policies.sql
   -- Paste and execute
   ```
4. Apply Migration 011:
   ```sql
   -- Copy entire contents of supabase/migrations/011_add_expenses_table.sql
   -- Paste and execute
   ```
5. Verify migrations applied:
   ```sql
   -- Check RLS policies created
   SELECT policyname, tablename, cmd, roles
   FROM pg_policies
   WHERE policyname LIKE 'service_role%'
   ORDER BY tablename;

   -- Should return 18+ policies with roles = '{service_role}'

   -- Check expenses table created
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'expenses';

   -- Should return: id, user_id, amount, currency, category, description, expense_date, created_at, updated_at
   ```

**Option B: Via Supabase CLI**

```bash
# Authenticate
npx supabase login

# Link project
npx supabase link --project-ref pdliixrgdvunoymxaxmw

# Push migrations
npx supabase db push
```

---

### Step 2: Regenerate TypeScript Types

After migrations are applied to production database:

```bash
# Generate new types
npx supabase gen types typescript --project-id pdliixrgdvunoymxaxmw > lib/database.types.ts

# Verify expenses table is in types
grep -A 10 "expenses:" lib/database.types.ts

# Expected output should include:
# expenses: {
#   Row: { id: string; user_id: string; amount: number; ... }
#   Insert: { ... }
#   Update: { ... }
# }
```

---

### Step 3: Deploy Code Changes

```bash
# Run pre-deployment validation
npm run pre-deploy

# Expected output:
# ✅ Type check passed
# ✅ Build successful
# ✅ Tests passed

# If validation passes, deploy
git add .
git commit -m "fix: critical Supabase RLS policies + expenses table

- Add service role bypass policies for all tables (migration 010)
- Create expenses table for expense tracking (migration 011)
- Implement actual expense persistence in claude-tools.ts
- Add RLS error detection in persist.ts
- Update .env.example with service_role key documentation

Fixes data loss issues where:
- Messages not persisting (RLS blocking writes)
- Expenses not saved (table missing)
- Silent failures in production

Impact: Resolves 100% data loss in expense tracking
"

git push origin main
```

Vercel will automatically deploy to production.

---

### Step 4: Verify Deployment

#### A. Check Vercel Deployment

```bash
# Monitor deployment logs
npx vercel logs --follow

# Look for successful deployment message
# URL: https://migue.app
```

#### B. Test Database Writes

```sql
-- Test 1: Verify RLS policies allow service_role writes
-- Run in Supabase SQL Editor (authenticated as service_role)

-- Insert test user
INSERT INTO public.users (phone_number)
VALUES ('+573001234567')
RETURNING id;

-- Insert test expense
INSERT INTO public.expenses (user_id, amount, currency, category, description)
VALUES (
  'USER_ID_FROM_ABOVE',
  50000,
  'COP',
  'Alimentación',
  'Test expense'
)
RETURNING *;

-- Cleanup test data
DELETE FROM public.users WHERE phone_number = '+573001234567';
```

#### C. Test via WhatsApp

1. Send test message: "Hola"
   - Expected: Message persists in `messages_v2` table
   - Verify: `SELECT * FROM messages_v2 ORDER BY created_at DESC LIMIT 5;`

2. Create test reminder: "Recuérdame llamar a mi mamá en 1 hora"
   - Expected: AI responds "✅ Listo! Guardé tu recordatorio..."
   - Verify: `SELECT * FROM reminders ORDER BY created_at DESC LIMIT 5;`

3. Track test expense: "Gasté $50,000 en el supermercado"
   - Expected: AI responds "✅ Listo! Registré tu gasto de COP 50,000 en Alimentación"
   - Verify: `SELECT * FROM expenses ORDER BY created_at DESC LIMIT 5;`

#### D. Check Production Logs

```bash
# Check for RLS errors (should be ZERO after deployment)
npx vercel logs --follow | grep -E "42501|RLS POLICY DENIED"

# Expected: No matches

# Check for successful database operations
npx vercel logs --follow | grep -E "Expense persisted|Reminder created"

# Expected: Success messages when users create expenses/reminders
```

---

## Rollback Plan

If issues occur after deployment:

### Rollback Code
```bash
git revert HEAD
git push origin main
```

### Rollback Database (if needed)
```sql
-- Remove service role policies
DROP POLICY IF EXISTS "service_role_users_all" ON public.users;
DROP POLICY IF EXISTS "service_role_conversations_all" ON public.conversations;
-- ... (drop all service_role_* policies)

-- Remove expenses table
DROP TABLE IF EXISTS public.expenses CASCADE;
```

---

## Expected Results

### Before Deployment
- ❌ Messages may not persist (RLS blocks)
- ❌ Reminders may not save (RLS blocks)
- ❌ Expenses never saved (table missing)
- ❌ Silent failures in production
- ❌ Users think data is saved but it's lost

### After Deployment
- ✅ Messages persist correctly
- ✅ Reminders save to database
- ✅ Expenses tracked and retrievable
- ✅ RLS errors logged with diagnostics
- ✅ All database writes functional

---

## Monitoring

### Key Metrics to Watch

1. **Database Write Success Rate**
   ```sql
   -- Monitor daily message count
   SELECT DATE(created_at) as date, COUNT(*) as messages
   FROM messages_v2
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

2. **Expense Tracking Adoption**
   ```sql
   -- Monitor expense tracking usage
   SELECT DATE(created_at) as date, COUNT(*) as expenses, SUM(amount) as total
   FROM expenses
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

3. **Error Rates**
   ```bash
   # Monitor for RLS errors in production
   npx vercel logs --since 1h | grep "error" | wc -l
   ```

---

## Support

If issues persist after deployment:

1. Check Vercel logs: `npx vercel logs --follow`
2. Check Supabase logs: Dashboard > Logs
3. Verify environment variables: `npx vercel env ls`
4. Review RLS policies: Run verification queries above

---

**Last Updated**: 2025-10-11
**Author**: Claude Code (database-architect + supabase-expert audit)
