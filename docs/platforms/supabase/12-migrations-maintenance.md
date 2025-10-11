# Migrations & Maintenance

Idempotent SQL migration patterns and database maintenance for migue.ai.

## Overview

**8 production migrations** managing schema evolution from MVP to production:

1. `001_optimize_rls_indexes.sql` - RLS performance (100x improvement)
2. `002_whatsapp_v23_tables.sql` - WhatsApp v23.0 features
3. `003_user_memory_embeddings.sql` - pgvector semantic search
4. `004_ai_cost_tracking.sql` - Multi-provider analytics
5. `005_scheduled_messages.sql` - Future message delivery
6. `006_add_whatsapp_v23_message_types.sql` - Enum updates
7. `007_messaging_windows.sql` - 24h window tracking
8. `20251006_add_dlq.sql` - Dead letter queue

## Migration Principles

### 1. Idempotency

**All DDL must be idempotent** (safe to run multiple times):

```sql
-- ✅ Good: Idempotent
CREATE TABLE IF NOT EXISTS users (...);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB;

-- ❌ Bad: Fails on second run
CREATE TABLE users (...);
CREATE INDEX idx_users_phone ON users(phone_number);
ALTER TABLE users ADD COLUMN preferences JSONB;
```

### 2. Enum Handling

**Enums cannot use IF NOT EXISTS** → wrap in exception handler:

```sql
-- ✅ Good: Safe enum creation
DO $$ BEGIN
  CREATE TYPE msg_type AS ENUM ('text', 'image', 'audio', 'video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add enum values (PostgreSQL 9.1+)
ALTER TYPE msg_type ADD VALUE IF NOT EXISTS 'sticker';
ALTER TYPE msg_type ADD VALUE IF NOT EXISTS 'reaction';
```

**Warning**: Removing enum values requires recreating the type.

### 3. Drop-First Pattern

**For policies** (no IF NOT EXISTS support):

```sql
-- ✅ Good: Drop before create
DROP POLICY IF EXISTS "allow_all_users" ON public.users;
CREATE POLICY "allow_all_users" ON public.users
  FOR ALL USING (true) WITH CHECK (true);
```

### 4. Constraints

**Add constraints safely**:

```sql
-- Drop before adding
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_phone_e164;
ALTER TABLE users ADD CONSTRAINT chk_phone_e164
  CHECK (phone_number ~ '^[+][1-9][0-9]{7,14}$');
```

### 5. Functions

**Use CREATE OR REPLACE**:

```sql
-- ✅ Always safe
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

## Migration Workflow

### Production Deployment

**Supabase Dashboard SQL Editor:**

1. Open Dashboard → SQL Editor
2. Create new query
3. Paste migration SQL
4. Verify idempotency
5. Run migration
6. Check for errors
7. Verify with `SELECT` queries

**Why not CLI?**
- No local Supabase setup required
- Dashboard has better error handling
- Query history for rollback
- Team visibility

### Safety Checks

**Before running migration**:

```sql
-- 1. Check if table exists
SELECT * FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'users';

-- 2. Check if column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users';

-- 3. Check if index exists
SELECT * FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'users';

-- 4. Check enum values
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'msg_type'::regtype;
```

## Real Migration Examples

### Migration 001: RLS Optimization

**File**: `supabase/migrations/001_optimize_rls_indexes.sql`

```sql
-- Create B-tree indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_users_phone_btree
  ON public.users USING btree (phone_number);

CREATE INDEX IF NOT EXISTS idx_conversations_userid_btree
  ON public.conversations USING btree (user_id);

-- Optimized RLS policies with function wrapping
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (id = (SELECT auth.uid()));  -- Wrapped for initPlan
```

**Result**: 100x query performance improvement (500ms → 5ms)

### Migration 003: pgvector Setup

**File**: `supabase/migrations/003_user_memory_embeddings.sql`

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table with vector column
CREATE TABLE IF NOT EXISTS user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('fact', 'preference', 'conversation')),
  content TEXT NOT NULL,
  embedding VECTOR(1536),  -- text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS user_memory_embedding_idx
ON user_memory USING hnsw (embedding vector_ip_ops);
```

### Migration 006: Enum Values

**File**: `supabase/migrations/006_add_whatsapp_v23_message_types.sql`

```sql
-- Add WhatsApp v23.0 message types
ALTER TYPE msg_type ADD VALUE IF NOT EXISTS 'sticker';
ALTER TYPE msg_type ADD VALUE IF NOT EXISTS 'reaction';
ALTER TYPE msg_type ADD VALUE IF NOT EXISTS 'order';

-- Note: 'voice' was invalid (WhatsApp uses 'audio')
-- Cannot remove enum values without recreating type
```

**Lesson**: Validate enum values before adding (removals require full type recreation).

### Migration 007: Messaging Windows

**File**: `supabase/migrations/007_messaging_windows.sql`

```sql
-- Create messaging_windows table
CREATE TABLE IF NOT EXISTS messaging_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  window_opened_at TIMESTAMPTZ NOT NULL,
  window_expires_at TIMESTAMPTZ NOT NULL,
  proactive_messages_sent_today INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-reset daily counter trigger
CREATE OR REPLACE FUNCTION reset_daily_proactive_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_proactive_sent_at IS NOT NULL AND
     DATE(NEW.last_proactive_sent_at AT TIME ZONE 'America/Bogota') <
     DATE(NOW() AT TIME ZONE 'America/Bogota') THEN
    NEW.proactive_messages_sent_today = 0;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_messaging_windows_reset_daily ON messaging_windows;
CREATE TRIGGER t_messaging_windows_reset_daily
  BEFORE UPDATE ON messaging_windows
  FOR EACH ROW EXECUTE FUNCTION reset_daily_proactive_count();
```

## Rollback Strategies

### 1. Transaction Approach

**Not recommended for DDL** (most DDL auto-commits in PostgreSQL):

```sql
-- ❌ Doesn't work for most DDL
BEGIN;
CREATE TABLE test (...);
ROLLBACK;  -- Table still created
```

### 2. Manual Rollback

**Create reverse migration**:

```sql
-- Forward migration (001_add_column.sql)
ALTER TABLE users ADD COLUMN preferences JSONB;

-- Rollback migration (001_rollback.sql)
ALTER TABLE users DROP COLUMN IF EXISTS preferences;
```

### 3. Backup & Restore

**Database-level rollback**:

```bash
# Backup before migration
pg_dump -h db.PROJECT.supabase.co -U postgres -d postgres > backup.sql

# Restore if needed
psql -h db.PROJECT.supabase.co -U postgres -d postgres < backup.sql
```

## Common Pitfalls

### Pitfall 1: Non-Idempotent DDL

```sql
-- ❌ Fails on second run
CREATE TABLE users (...);
ALTER TABLE users ADD COLUMN name TEXT;

-- ✅ Safe to run multiple times
CREATE TABLE IF NOT EXISTS users (...);
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
```

### Pitfall 2: Enum Management

```sql
-- ❌ Can't remove enum values
ALTER TYPE msg_type DROP VALUE 'voice';  -- ERROR: not supported

-- ✅ Must recreate type
ALTER TYPE msg_type RENAME TO msg_type_old;
CREATE TYPE msg_type AS ENUM ('text', 'image', 'audio', 'video');  -- Exclude 'voice'
ALTER TABLE messages_v2 ALTER COLUMN type TYPE msg_type USING type::TEXT::msg_type;
DROP TYPE msg_type_old;
```

### Pitfall 3: Trigger Order

```sql
-- ❌ Bad: Trigger runs before constraint check
CREATE TRIGGER t_before_insert BEFORE INSERT ...

-- ✅ Good: Constraint validated first
CREATE TRIGGER t_after_insert AFTER INSERT ...
```

### Pitfall 4: Dependency Order

```sql
-- ❌ Fails: Function doesn't exist yet
CREATE TRIGGER t_users_updated BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION set_updated_at() ...  -- Created after trigger

-- ✅ Good: Create function first
CREATE OR REPLACE FUNCTION set_updated_at() ...

CREATE TRIGGER t_users_updated BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

## Maintenance Tasks

### Vacuum & Analyze

**Auto-vacuum** (enabled by default):
```sql
-- Check autovacuum status
SELECT schemaname, relname, last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public';
```

**Manual vacuum** (rarely needed):
```sql
VACUUM ANALYZE users;
VACUUM ANALYZE messages_v2;
```

### Reindex

**When to reindex:**
- Index bloat (check with `pg_stat_user_indexes`)
- After bulk deletes
- Query performance degradation

```sql
REINDEX INDEX idx_users_phone_btree;
REINDEX TABLE messages_v2;
REINDEX DATABASE postgres;  -- Full database (caution: locks tables)
```

### Update Statistics

**After large data changes**:
```sql
ANALYZE users;
ANALYZE messages_v2;
```

## Type Generation

**After migrations, regenerate TypeScript types:**

```bash
# Generate types from production database
supabase gen types typescript \
  --project-id pdliixrgdvunoymxaxmw \
  --schema public \
  > lib/database.types.ts

# Or use npm script
npm run db:types
```

**Commit updated types**:
```bash
git add lib/database.types.ts
git commit -m "chore: update database types after migration 007"
```

## Migration Checklist

**Before deploying migration:**

- [ ] Migration is idempotent (safe to run multiple times)
- [ ] Tested in local Supabase instance (if available)
- [ ] All DDL uses `IF NOT EXISTS` or `DROP IF EXISTS`
- [ ] Enums wrapped in `DO $$ EXCEPTION` blocks
- [ ] Functions use `CREATE OR REPLACE`
- [ ] Policies use `DROP POLICY IF EXISTS` first
- [ ] Constraints use `DROP CONSTRAINT IF EXISTS` first
- [ ] Indexes use `IF NOT EXISTS`
- [ ] Triggers use `DROP TRIGGER IF EXISTS` first
- [ ] Dependencies created before usage
- [ ] Rollback strategy documented
- [ ] Types regenerated and committed

**After migration:**

- [ ] Verify no errors in Supabase Dashboard
- [ ] Check affected tables with `SELECT` queries
- [ ] Run `ANALYZE` on modified tables
- [ ] Update TypeScript types
- [ ] Document changes in CHANGELOG
- [ ] Update related documentation

## Resources

- **Official**: [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- **Official**: [Supabase Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- **Project**: Migration files in `supabase/migrations/`

**Last Updated**: 2025-10-11
