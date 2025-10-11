# RLS Security

Row-Level Security (RLS) policies with 100x performance optimization for migue.ai.

## Overview

**RLS** restricts database row access at the PostgreSQL level, enforcing data isolation without application-layer checks.

**migue.ai Status**: All tables have RLS enabled with permissive policies (service role bypasses RLS).

## Performance Optimization

### The Problem

**Naive RLS policies cause sequential scans:**

```sql
-- ❌ Slow: auth.uid() called for every row
CREATE POLICY "bad_policy" ON users
FOR SELECT USING (id = auth.uid());
```

**Query plan**: Sequential scan → 100-500ms for 10K rows

### The Solution: Function Wrapping

**Wrap auth.uid() in subquery** to trigger initPlan caching:

```sql
-- ✅ Fast: auth.uid() cached via initPlan
CREATE POLICY "optimized_policy" ON users
FOR SELECT USING (id = (SELECT auth.uid()));
```

**Query plan**: Index scan → 5-10ms (100x improvement)

**Source**: [supabase/migrations/001_optimize_rls_indexes.sql](../../../supabase/migrations/001_optimize_rls_indexes.sql)

## Production Policies

### users Table

```sql
-- Self-access only
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (id = (SELECT auth.uid()));

CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
```

### conversations Table

```sql
-- User can see own conversations
CREATE POLICY "conversations_select_own" ON public.conversations
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));
```

### messages_v2 Table

```sql
-- Messages from user's conversations
CREATE POLICY "messages_v2_select_own" ON public.messages_v2
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user_id = (SELECT auth.uid())
    )
  );
```

**Key**: Subquery uses `idx_conversations_userid_btree` index → fast lookup.

### reminders Table

```sql
-- Full CRUD for own reminders
CREATE POLICY "reminders_select_own" ON public.reminders
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "reminders_by_owner_modify" ON public.reminders
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
```

### user_memory Table (pgvector)

```sql
-- Read own memories
CREATE POLICY "Users can read own memory" ON user_memory
  FOR SELECT
  USING (auth.uid() = user_id);

-- Insert own memories
CREATE POLICY "Users can insert own memory" ON user_memory
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role can manage all memory" ON user_memory
  FOR ALL
  USING (auth.role() = 'service_role');
```

## Helper Function

### auth_user_id()

```sql
-- supabase/security.sql
CREATE OR REPLACE FUNCTION auth_user_id() RETURNS UUID AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid;
$$ LANGUAGE sql STABLE;
```

**Usage**:
```sql
CREATE POLICY "policy_name" ON table_name
  FOR SELECT
  USING (user_id = (SELECT auth_user_id()));
```

**Note**: migue.ai doesn't use Supabase Auth, so this returns NULL. Service role bypasses RLS.

## Service Role Access

### Security Definer Functions

**For webhook ingestion** (bypass RLS):

```sql
-- supabase/security.sql
CREATE OR REPLACE FUNCTION svc_upsert_user_by_phone(p_phone TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user_id UUID; BEGIN
  INSERT INTO public.users(phone_number)
  VALUES (p_phone)
  ON CONFLICT (phone_number) DO UPDATE SET phone_number = excluded.phone_number
  RETURNING id INTO v_user_id;
  RETURN v_user_id;
END $$;
```

**SECURITY DEFINER**: Function runs with definer's privileges (bypasses RLS).

**Revoke public access**:
```sql
REVOKE ALL ON FUNCTION svc_upsert_user_by_phone(TEXT) FROM public;
```

### Service Role Key

**Environment**:
```bash
SUPABASE_KEY=eyJhbGci...  # Service role key (bypasses RLS)
```

**TypeScript usage**:
```typescript
const supabase = getSupabaseServerClient()  // Uses service role key
await supabase.from('users').select('*')  // Bypasses RLS
```

## Index Requirements

### Critical Indexes for RLS

**From migration 001_optimize_rls_indexes.sql**:

```sql
-- Users: phone number lookups
CREATE INDEX idx_users_phone_btree ON public.users USING btree (phone_number);

-- Conversations: user_id RLS policies
CREATE INDEX idx_conversations_userid_btree ON public.conversations USING btree (user_id);

-- Messages: conversation-based queries
CREATE INDEX idx_messages_conversation_btree ON public.messages_v2 USING btree (conversation_id);

-- Composite: conversation + timestamp (most common query)
CREATE INDEX idx_messages_conv_ts_btree ON public.messages_v2 USING btree (conversation_id, timestamp DESC);

-- Reminders: user_id + status filtering
CREATE INDEX idx_reminders_user_btree ON public.reminders USING btree (user_id);
CREATE INDEX idx_reminders_status_time_btree ON public.reminders USING btree (status, scheduled_time)
  WHERE status = 'pending';
```

**Without these indexes**: Sequential scans → 100-500ms queries
**With indexes**: Index scans → 5-15ms queries

## Performance Testing

### EXPLAIN ANALYZE

```sql
-- Check if RLS policy uses index
EXPLAIN ANALYZE
SELECT * FROM messages_v2
WHERE conversation_id IN (
  SELECT id FROM conversations WHERE user_id = '...'
);
```

**Good plan**:
```
→ Index Scan using idx_messages_conversation_btree
  → Index Scan using idx_conversations_userid_btree
```

**Bad plan**:
```
→ Seq Scan on messages_v2
  Filter: conversation_id IN (...)
```

### Benchmark Queries

```sql
-- Test user lookup (should use idx_users_phone_btree)
EXPLAIN ANALYZE SELECT * FROM users WHERE phone_number = '+573001234567';

-- Test conversation access (should use idx_conversations_userid_btree)
EXPLAIN ANALYZE SELECT * FROM conversations WHERE user_id = '...';

-- Test message access (should use idx_messages_conv_ts_btree)
EXPLAIN ANALYZE SELECT * FROM messages_v2
WHERE conversation_id = '...'
ORDER BY timestamp DESC LIMIT 50;
```

## Development vs Production

### Development (Current)

**Permissive policies**:
```sql
CREATE POLICY "allow_all_users" ON public.users
  FOR ALL USING (true) WITH CHECK (true);
```

**All operations allowed** - useful for rapid development with service role key.

### Production (Future)

**Restrictive policies** if adding Supabase Auth:

```sql
-- Users can only see themselves
CREATE POLICY "users_self_only" ON public.users
  FOR SELECT
  USING (id = (SELECT auth.uid()));

-- Prevent user impersonation
CREATE POLICY "users_no_update_id" ON public.users
  FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()) AND id = OLD.id);
```

## Common Pitfalls

### Pitfall 1: Missing Indexes

**Problem**: RLS policy references unindexed column

```sql
-- ❌ No index on user_id → sequential scan
CREATE POLICY "policy" ON table_name
  FOR SELECT USING (user_id = (SELECT auth.uid()));
```

**Fix**: Create index
```sql
CREATE INDEX idx_table_user ON table_name(user_id);
```

### Pitfall 2: Direct auth.uid() Call

**Problem**: auth.uid() called per row

```sql
-- ❌ Slow: function called for every row
USING (user_id = auth.uid())
```

**Fix**: Wrap in subquery
```sql
-- ✅ Fast: function cached via initPlan
USING (user_id = (SELECT auth.uid()))
```

### Pitfall 3: Complex Joins in Policies

**Problem**: Multi-table joins in RLS policy

```sql
-- ❌ Slow: nested loops
CREATE POLICY "complex" ON messages_v2
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversations c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = messages_v2.conversation_id
      AND u.id = auth.uid()
  ));
```

**Fix**: Simplify to single join
```sql
-- ✅ Faster: single subquery
CREATE POLICY "simple" ON messages_v2
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = (SELECT auth.uid())
    )
  );
```

## Monitoring

### Check RLS Status

```sql
-- List tables with RLS enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### List Policies

```sql
-- Show all RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Test Policy Bypass

```sql
-- Verify service role bypasses RLS
SET ROLE service_role;
SELECT COUNT(*) FROM users;  -- Should return all rows

-- Verify anon role sees nothing (if auth enabled)
SET ROLE anon;
SELECT COUNT(*) FROM users;  -- Should return 0 or only accessible rows
```

## Next Steps

- **[Custom Functions](./05-custom-functions-triggers.md)** - Security definer patterns
- **[Monitoring](./11-monitoring-performance.md)** - Query performance analysis
- **[Migrations](./12-migrations-maintenance.md)** - Safe policy updates

## Resources

- **Official**: [Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- **Official**: [RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices)

**Last Updated**: 2025-10-11
