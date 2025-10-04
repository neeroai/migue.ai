# Supabase + Vercel Edge Functions Integration 2025

## 📖 Overview

Guía completa para integrar Supabase con Vercel Edge Functions, optimizada para chatbots, con RLS policies optimizadas y performance 100x mejorada.

---

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js
```

### 2. Environment Variables

```bash
# .env.local
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key # Solo para operaciones admin
```

### 3. Edge-Compatible Client

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

let cachedClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseServerClient() {
  if (!cachedClient) {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_ANON_KEY!;

    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false, // CRÍTICO para Edge Runtime
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-application-name': 'migue-ai-edge',
        },
      },
    });
  }

  return cachedClient;
}
```

---

## ⚡ RLS Performance Optimization

### Problem: Slow RLS Queries

RLS policies con `auth.uid()` pueden ser 100-1000x más lentos sin optimización.

### Solution: B-tree Indexes + Function Wrapping

```sql
-- 1. Crear índices B-tree optimizados
CREATE INDEX idx_users_phone_btree
  ON public.users USING btree (phone_number);

CREATE INDEX idx_conversations_userid_btree
  ON public.conversations USING btree (user_id);

CREATE INDEX idx_messages_conv_ts_btree
  ON public.messages_v2 USING btree (conversation_id, timestamp DESC);

-- 2. Optimizar RLS policies con function wrapping
-- ANTES (lento):
CREATE POLICY "messages_select" ON messages_v2
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

-- DESPUÉS (100x más rápido):
CREATE POLICY "messages_select_optimized" ON messages_v2
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = (SELECT auth.uid())
    )
  );
```

**Explicación**: Wrapping `auth.uid()` con `(SELECT auth.uid())` fuerza PostgreSQL a usar initPlan, "cacheando" el resultado en lugar de ejecutarlo por cada fila.

---

## 🔐 Row Level Security (RLS)

### 1. Enable RLS en Todas las Tablas

```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
```

### 2. Políticas Optimizadas

```sql
-- Users: SELECT own record
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (id = (SELECT auth.uid()));

-- Conversations: SELECT own conversations
DROP POLICY IF EXISTS "conversations_select_own" ON public.conversations;
CREATE POLICY "conversations_select_own" ON public.conversations
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- Messages: SELECT from own conversations (optimized)
DROP POLICY IF EXISTS "messages_v2_select_own" ON public.messages_v2;
CREATE POLICY "messages_v2_select_own" ON public.messages_v2
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- Reminders: SELECT own reminders
DROP POLICY IF EXISTS "reminders_select_own" ON public.reminders;
CREATE POLICY "reminders_select_own" ON public.reminders
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));
```

### 3. Service Role para Edge Functions

Edge Functions usan Service Role (bypassea RLS) para operaciones server-side:

```typescript
// lib/supabase-admin.ts
import { createClient } from '@supabase/supabase-js';

let adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdminClient() {
  if (!adminClient) {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY!; // Service role key

    adminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}

// Usar admin client para operaciones que bypasean RLS
export async function getUserByPhone(phone: string) {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, phone_number, name')
    .eq('phone_number', phone)
    .single();

  if (error) throw error;
  return data;
}
```

---

## 📊 Query Optimization

### 1. Limit & Pagination

```typescript
// ✅ BUENO: Siempre usar .limit()
export async function getConversationHistory(
  conversationId: string,
  limit = 10
) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('messages_v2')
    .select('id, direction, type, content, timestamp')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: false })
    .limit(limit); // ⚠️ SIEMPRE limitar

  if (error) throw error;
  return (data || []).reverse(); // Cronológico
}
```

### 2. Select Specific Columns

```typescript
// ❌ MAL: Select *
const { data } = await supabase
  .from('users')
  .select('*');

// ✅ BUENO: Select solo lo necesario
const { data } = await supabase
  .from('users')
  .select('id, phone_number, name');
```

### 3. Composite Indexes

```sql
-- Para queries frecuentes con múltiples condiciones
CREATE INDEX idx_messages_user_type_time
  ON messages_v2(user_id, type, timestamp DESC)
  WHERE direction = 'inbound';

-- Ahora esta query es 10x más rápida:
SELECT * FROM messages_v2
WHERE user_id = 'abc123'
  AND type = 'text'
  AND direction = 'inbound'
ORDER BY timestamp DESC
LIMIT 20;
```

---

## 🔄 Realtime Subscriptions (Edge Compatible)

### 1. Setup Realtime

```sql
-- Habilitar realtime en tabla
ALTER PUBLICATION supabase_realtime ADD TABLE messages_v2;

-- RLS policy para realtime (permitir a usuarios autenticados)
CREATE POLICY "realtime_messages" ON messages_v2
  FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = (SELECT auth.uid())
    )
  );
```

### 2. Subscribe in Edge Function

```typescript
// api/realtime/subscribe.ts
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const { conversationId } = await req.json();

  const supabase = getSupabaseServerClient();

  // Crear stream de eventos
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Subscribe a cambios en mensajes
      const channel = supabase
        .channel(`conversation:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages_v2',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            // Enviar al cliente vía SSE
            const data = JSON.stringify(payload.new);
            controller.enqueue(
              encoder.encode(`data: ${data}\n\n`)
            );
          }
        )
        .subscribe();

      // Cleanup al cerrar stream
      req.signal.addEventListener('abort', () => {
        channel.unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## 🗄️ Database Helpers

### 1. Upsert User (Idempotent)

```typescript
// lib/persist.ts
export async function upsertUserByPhone(phoneNumber: string): Promise<string> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('users')
    .upsert(
      { phone_number: phoneNumber },
      {
        onConflict: 'phone_number',
        ignoreDuplicates: false, // Actualizar si existe
      }
    )
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}
```

### 2. Get or Create Conversation

```typescript
export async function getOrCreateConversation(
  userId: string,
  waConversationId?: string
): Promise<string> {
  const supabase = getSupabaseServerClient();

  // Buscar existente
  if (waConversationId) {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('wa_conversation_id', waConversationId)
      .maybeSingle();

    if (data) return data.id as string;
  }

  // Crear nueva
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      wa_conversation_id: waConversationId || null,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}
```

### 3. Batch Insert Messages

```typescript
export async function insertMessagesBatch(
  messages: Array<{
    conversationId: string;
    direction: 'inbound' | 'outbound';
    content: string;
  }>
) {
  const supabase = getSupabaseServerClient();

  const rows = messages.map(msg => ({
    conversation_id: msg.conversationId,
    direction: msg.direction,
    type: 'text',
    content: msg.content,
    timestamp: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('messages_v2')
    .insert(rows);

  if (error) throw error;
}
```

---

## 🔍 Full-Text Search

### 1. Setup tsvector Column

```sql
-- Agregar columna para full-text search
ALTER TABLE messages_v2
ADD COLUMN content_search tsvector
GENERATED ALWAYS AS (to_tsvector('spanish', COALESCE(content, ''))) STORED;

-- Índice GIN para búsqueda rápida
CREATE INDEX idx_messages_content_search
  ON messages_v2 USING gin(content_search);
```

### 2. Search Implementation

```typescript
export async function searchMessages(
  conversationId: string,
  query: string,
  limit = 20
) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('messages_v2')
    .select('id, content, timestamp')
    .eq('conversation_id', conversationId)
    .textSearch('content_search', query, {
      type: 'websearch',
      config: 'spanish',
    })
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
```

---

## 📈 Connection Pooling

### 1. Supavisor (Supabase Connection Pooler)

```typescript
// Para conexiones directas a PostgreSQL (no REST API)
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Connection pooler URL
  max: 20, // Max connections
  idleTimeoutMillis: 30000,
});

export async function queryWithPool(sql: string, params: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}
```

### 2. REST API vs Direct Connection

| Método | Use Case | Pros | Cons |
|--------|----------|------|------|
| Supabase REST API | Edge Functions, simple queries | Auto-pooling, RLS integrado | Limitado a operaciones básicas |
| Direct Connection | Queries complejos, joins, transactions | Full SQL, performance | Requiere connection pooling manual |

---

## 🐛 Error Handling

### 1. Supabase Error Types

```typescript
import { PostgrestError } from '@supabase/supabase-js';

export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>
): Promise<T> {
  const { data, error } = await queryFn();

  if (error) {
    // Log error con contexto
    logger.error('Supabase query failed', new Error(error.message), {
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    // Errors específicos
    if (error.code === 'PGRST116') {
      throw new Error('Record not found');
    }

    if (error.code === '23505') {
      throw new Error('Duplicate record');
    }

    throw new Error(`Database error: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from query');
  }

  return data;
}

// Uso
const user = await safeQuery(() =>
  supabase
    .from('users')
    .select('*')
    .eq('phone_number', phone)
    .single()
);
```

### 2. Retry Logic

```typescript
export async function queryWithRetry<T>(
  queryFn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      const isRetryable =
        error instanceof Error &&
        (error.message.includes('timeout') ||
         error.message.includes('connection'));

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      await delay(Math.pow(2, attempt) * 100);
    }
  }

  throw new Error('Max retries exceeded');
}
```

---

## ✅ Best Practices Checklist

### Performance
- [ ] B-tree indexes en columnas de foreign keys
- [ ] Composite indexes para queries comunes
- [ ] RLS policies optimizadas con function wrapping
- [ ] `.limit()` en todas las queries
- [ ] Select solo columnas necesarias
- [ ] Connection pooling configurado

### Security
- [ ] RLS habilitado en todas las tablas
- [ ] Service role key solo en server-side
- [ ] Input validation antes de queries
- [ ] Prepared statements (supabase hace automático)
- [ ] Rate limiting en endpoints

### Edge Compatibility
- [ ] `persistSession: false` en auth config
- [ ] Client cacheado globalmente
- [ ] No usar filesystem APIs
- [ ] Timeout adecuados (< 25s)
- [ ] Error handling robusto

---

## 📚 Resources

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [RLS Performance Guide](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices)
- [Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)

---

**Última actualización**: 2025 - Supabase + Vercel Edge Functions Optimized
