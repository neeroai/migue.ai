# Manual Migration Instructions

## Pending Migrations (Require Supabase Dashboard)

### 1. Gemini Usage Tracking (CRITICAL - $90/month savings)

**File**: `supabase/migrations/004_gemini_usage_tracking.sql`

**Steps**:
1. Go to https://supabase.com/dashboard/project/pdliixrgdvunoymxaxmw
2. Navigate to SQL Editor
3. Copy contents of `supabase/migrations/004_gemini_usage_tracking.sql`
4. Execute query
5. Verify table created: `SELECT * FROM gemini_usage;`

**Why**: Enables Gemini free tier tracking (1,500 req/day limit enforcement)

---

### 2. RLS Security Fix (CRITICAL - Security Vulnerability)

**File**: `supabase/migrations/008_fix_rls_messaging_windows.sql` (created below)

**Steps**:
1. Go to https://supabase.com/dashboard/project/pdliixrgdvunoymxaxmw
2. Navigate to SQL Editor
3. Copy contents of `supabase/migrations/008_fix_rls_messaging_windows.sql`
4. Execute query
5. Verify policy: Check Authentication > Policies > messaging_windows

**Why**: Fixes permissive RLS policy (current allows all access)

---

### 3. After Applying Migrations

**Regenerate TypeScript types**:
```bash
npx supabase gen types typescript --project-id pdliixrgdvunoymxaxmw > lib/database.types.ts
```

**Verify**:
```bash
npm run typecheck  # Should pass with 0 errors
npm run test       # All tests should pass
```

---

## Optional: Upstash Redis Configuration

**For Gemini context caching** (75% additional savings when exceeding free tier):

1. Create free Upstash account: https://upstash.com
2. Create Redis database
3. Add to `.env.local`:
```env
UPSTASH_REDIS_REST_URL=https://YOUR-DATABASE.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN_HERE
```

**Impact**: Context caching will work (currently disabled without Redis)

---

## Deployment Checklist

- [ ] Apply migration 004 (Gemini usage tracking)
- [ ] Apply migration 008 (RLS security fix)
- [ ] Regenerate TypeScript types
- [ ] Configure Upstash Redis (optional but recommended)
- [ ] Run `npm run typecheck`
- [ ] Run `npm run test`
- [ ] Deploy to Vercel (`git push origin main`)
- [ ] Monitor Gemini usage in logs

---

**Expected Outcome**:
- ✅ Gemini functioning in production ($90/month savings)
- ✅ Security vulnerability fixed
- ✅ 0 TypeScript errors
- ✅ All tests passing
