# Monitoring & Performance

Query optimization, index strategies, and performance monitoring for migue.ai's Supabase database.

## Overview

**95 indexes** across 14 tables ensure sub-10ms query times for all common operations.

**Key strategies:**
- B-tree indexes for primary/foreign keys
- Composite indexes for common query patterns
- Partial indexes for filtered queries
- HNSW index for vector search
- GIN indexes for JSONB fields

## Index Types

### B-tree Indexes (85)

**Purpose**: Primary keys, foreign keys, timestamps

**Example**:
```sql
CREATE INDEX idx_messages_v2_conversation ON messages_v2(conversation_id);
CREATE INDEX idx_messages_v2_timestamp ON messages_v2(timestamp DESC);
```

**Best for**:
- Equality (`=`) and range (`<`, `>`) queries
- Sorting (`ORDER BY`)
- Foreign key lookups

**Query pattern**:
```sql
-- Uses idx_messages_v2_conv_ts (composite)
SELECT * FROM messages_v2
WHERE conversation_id = '...'
ORDER BY timestamp DESC
LIMIT 50;
```

### Composite Indexes (12)

**Purpose**: Multi-column queries with sorting

**Example**:
```sql
CREATE INDEX idx_messages_v2_conv_ts
ON messages_v2(conversation_id, timestamp DESC);
```

**Why composite?**
- Single index covers both WHERE and ORDER BY
- Avoids additional sort step
- 2-3x faster than separate indexes

**Query plan**:
```
Index Scan using idx_messages_v2_conv_ts (cost=0.29..12.31 rows=50 width=...)
```

### Partial Indexes (7)

**Purpose**: Filtered indexes for common WHERE clauses

**Example**:
```sql
CREATE INDEX idx_reminders_status_time_btree
ON reminders(status, scheduled_time)
WHERE status = 'pending';
```

**Benefits**:
- Smaller index size (only pending reminders)
- Faster lookups (fewer rows to scan)
- Lower maintenance cost

**Query**:
```sql
-- Uses partial index
SELECT * FROM reminders
WHERE status = 'pending'
  AND scheduled_time <= NOW() + INTERVAL '5 minutes';
```

### GIN Indexes (2)

**Purpose**: JSONB full-text search

**Example**:
```sql
CREATE INDEX idx_docs_metadata_gin ON documents USING gin (metadata);
```

**Query**:
```sql
-- JSONB containment
SELECT * FROM documents
WHERE metadata @> '{"type": "invoice"}';
```

### HNSW Index (1)

**Purpose**: pgvector similarity search

**Example**:
```sql
CREATE INDEX user_memory_embedding_idx
ON user_memory USING hnsw (embedding vector_ip_ops);
```

**See**: [pgvector Semantic Search](./03-pgvector-semantic-search.md)

## Query Optimization

### EXPLAIN ANALYZE

**Check query plan**:
```sql
EXPLAIN ANALYZE
SELECT * FROM messages_v2
WHERE conversation_id = '123'
ORDER BY timestamp DESC
LIMIT 50;
```

**Good plan** (index scan):
```
Index Scan using idx_messages_v2_conv_ts (cost=0.29..12.31 rows=50)
  Index Cond: (conversation_id = '123'::uuid)
Planning Time: 0.123 ms
Execution Time: 1.456 ms
```

**Bad plan** (sequential scan):
```
Seq Scan on messages_v2 (cost=0.00..1834.00 rows=50)
  Filter: (conversation_id = '123'::uuid)
Planning Time: 0.089 ms
Execution Time: 45.678 ms
```

### RLS Performance

**Problem**: Unoptimized RLS causes sequential scans

**Solution**: Function wrapping triggers initPlan caching

```sql
-- ❌ Slow: auth.uid() called per row
CREATE POLICY "bad" ON users
FOR SELECT USING (id = auth.uid());

-- ✅ Fast: auth.uid() cached via initPlan
CREATE POLICY "good" ON users
FOR SELECT USING (id = (SELECT auth.uid()));
```

**See**: [RLS Security](./04-rls-security.md#performance-optimization)

### Join Optimization

**Prefer EXISTS over IN for large result sets**:

```sql
-- ❌ Slower: IN with subquery
SELECT * FROM messages_v2
WHERE conversation_id IN (
  SELECT id FROM conversations WHERE user_id = '...'
);

-- ✅ Faster: EXISTS (stops at first match)
SELECT * FROM messages_v2 m
WHERE EXISTS (
  SELECT 1 FROM conversations c
  WHERE c.id = m.conversation_id AND c.user_id = '...'
);
```

## Analytics Views

### conversation_stats

**Purpose**: Aggregate conversation metrics

```sql
CREATE VIEW conversation_stats AS
SELECT
  c.id,
  c.user_id,
  c.status,
  COUNT(m.id) AS message_count,
  MAX(m.timestamp) AS last_message_at,
  MIN(m.timestamp) AS first_message_at
FROM conversations c
LEFT JOIN messages_v2 m ON m.conversation_id = c.id
GROUP BY c.id, c.user_id, c.status;
```

**Query**:
```sql
SELECT * FROM conversation_stats
WHERE user_id = '...'
ORDER BY last_message_at DESC;
```

### user_activity_stats

**Purpose**: User engagement metrics

```sql
CREATE VIEW user_activity_stats AS
SELECT
  u.id,
  u.phone_number,
  COUNT(DISTINCT c.id) AS conversation_count,
  COUNT(m.id) AS total_messages,
  MAX(m.timestamp) AS last_activity
FROM users u
LEFT JOIN conversations c ON c.user_id = u.id
LEFT JOIN messages_v2 m ON m.conversation_id = c.id
GROUP BY u.id, u.phone_number;
```

### messaging_windows_stats

**Purpose**: Window health metrics

```sql
CREATE VIEW messaging_windows_stats AS
SELECT
  COUNT(*) AS total_windows,
  COUNT(*) FILTER (WHERE window_expires_at > NOW()) AS active_windows,
  COUNT(*) FILTER (WHERE window_expires_at > NOW() AND
                        window_expires_at <= NOW() + INTERVAL '4 hours') AS windows_near_expiration,
  SUM(proactive_messages_sent_today) AS total_proactive_today
FROM messaging_windows;
```

**Dashboard query**:
```sql
SELECT * FROM messaging_windows_stats;
-- Returns: { total_windows: 150, active_windows: 80, ... }
```

## Performance Monitoring

### pg_stat_statements

**Enable extension**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

**Top 10 slowest queries**:
```sql
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Index Usage

**Check if indexes are used**:
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

**Unused indexes** (candidates for removal):
```sql
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey';  -- Exclude primary keys
```

### Table Bloat

**Check table size**:
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS data_size,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Vacuum statistics**:
```sql
SELECT
  schemaname,
  relname,
  last_vacuum,
  last_autovacuum,
  n_dead_tup AS dead_tuples
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;
```

## Connection Pooling

### Supavisor

**Built-in connection pooler** (automatic):
- Transaction mode: Connection per query
- Session mode: Persistent connection
- Max connections: 15 (Free tier), 60 (Pro tier)

**Connection string**:
```
# Pooler (default)
postgres://postgres.[PROJECT]:password@aws-0-us-east-2.pooler.supabase.com:6543/postgres

# Direct (for migrations)
postgres://postgres.[PROJECT]:password@db.[PROJECT].supabase.co:5432/postgres
```

**TypeScript** (uses pooler automatically):
```typescript
const supabase = getSupabaseServerClient()  // Uses pooler
```

### Connection Limits

**Monitor active connections**:
```sql
SELECT COUNT(*) AS active_connections
FROM pg_stat_activity
WHERE datname = current_database();
```

**Max connections** (Free tier):
```sql
SHOW max_connections;  -- 60 total (15 reserved for pooler)
```

## Benchmarks

### Query Performance (migue.ai Production)

| Query | Index Used | Rows | Time |
|-------|-----------|------|------|
| Get user by phone | `idx_users_phone_btree` | 1 | 2ms |
| Get active conversation | `idx_conversations_user_status` | 1 | 3ms |
| Last 50 messages | `idx_messages_v2_conv_ts` | 50 | 5ms |
| Pending reminders | `idx_reminders_status_time_btree` | 10 | 4ms |
| Find near-expiring windows | `idx_messaging_windows_expiration` | 5 | 6ms |
| Semantic memory search | `user_memory_embedding_idx` | 10 | 12ms |

### Index Build Times

| Table | Rows | Index Type | Build Time |
|-------|------|------------|------------|
| users | 10K | B-tree | 50ms |
| messages_v2 | 100K | Composite | 200ms |
| user_memory | 10K | HNSW (vector) | 500ms |
| ai_usage_tracking | 50K | B-tree | 100ms |

## Optimization Checklist

### Query Optimization
- ✅ Use `EXPLAIN ANALYZE` to check query plans
- ✅ Add indexes for WHERE, JOIN, ORDER BY columns
- ✅ Use composite indexes for multi-column queries
- ✅ Prefer EXISTS over IN for subqueries
- ✅ Use LIMIT to reduce result sets

### Index Optimization
- ✅ Create indexes for foreign keys
- ✅ Use partial indexes for filtered queries
- ✅ Drop unused indexes (check `pg_stat_user_indexes`)
- ✅ Rebuild bloated indexes with `REINDEX`

### RLS Optimization
- ✅ Wrap `auth.uid()` in subquery: `(SELECT auth.uid())`
- ✅ Create indexes on RLS filter columns
- ✅ Use simple policies (avoid complex joins)

### Connection Optimization
- ✅ Use connection pooler (Supavisor)
- ✅ Close connections after queries
- ✅ Monitor connection count

## Common Issues

### Issue: Slow Queries

**Symptom**: Queries taking > 100ms

**Diagnosis**:
```sql
EXPLAIN ANALYZE [your query];
```

**Solution**:
- Add missing index
- Optimize WHERE clause
- Use composite index

### Issue: High Connection Count

**Symptom**: "too many connections" error

**Diagnosis**:
```sql
SELECT COUNT(*) FROM pg_stat_activity;
```

**Solution**:
- Use connection pooler
- Close idle connections
- Increase connection limit (Pro tier)

### Issue: Index Not Used

**Symptom**: Sequential scan despite index

**Diagnosis**:
```sql
EXPLAIN ANALYZE [your query];
```

**Solutions**:
- Run `ANALYZE table_name;` to update statistics
- Check for type mismatches (UUID vs TEXT)
- Ensure WHERE clause matches index column

## Next Steps

- **[RLS Security](./04-rls-security.md)** - Performance optimization
- **[Migrations](./12-migrations-maintenance.md)** - Index deployment

## Resources

- **Official**: [Supabase Performance Guide](https://supabase.com/docs/guides/platform/performance)
- **Official**: [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)

**Last Updated**: 2025-10-11
