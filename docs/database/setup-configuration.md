# Setup & Configuration

Complete guide to configuring Supabase for migue.ai, including environment variables, TypeScript client setup, CLI installation, and Edge Runtime compatibility.

## Quick Start

### 1. Environment Variables

Add to `.env.local`:

```bash
# Supabase (Required)
SUPABASE_URL=https://pdliixrgdvunoymxaxmw.supabase.co
SUPABASE_KEY=your_service_role_key_here

# Database URL (for migrations)
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.pdliixrgdvunoymxaxmw.supabase.co:5432/postgres
```

**Security Note**: Use service role key for server-side operations. Never expose in client code.

### 2. TypeScript Client

migue.ai uses a typed Supabase client for all database operations:

```typescript
// File: lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Get Supabase server client with typed database schema
 * @returns Typed Supabase client for server-side operations
 */
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY')
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

**Key Features**:
- Full TypeScript type safety via `Database` type
- Edge Runtime compatible (no Node.js dependencies)
- No session persistence (stateless API)
- Service role authentication

### 3. Generate TypeScript Types

```bash
# Generate types from live database
npm run db:types

# Output: lib/database.types.ts (auto-generated, do not edit)
```

**Regenerate types after**:
- Database schema changes
- New migrations
- Enum updates

### 4. Install Supabase CLI

```bash
# Install globally
npm install -g supabase

# Or use via npx
npx supabase --version
```

### 5. Link to Project

```bash
# Login to Supabase
npx supabase login

# Link to migue.ai project
npx supabase link --project-ref pdliixrgdvunoymxaxmw

# Verify connection
npm run db:verify
```

## Edge Runtime Configuration

### Why Edge Runtime?

migue.ai runs 100% on Vercel Edge Functions for:
- **Sub-100ms cold starts** (vs 300-500ms Node.js)
- **Global deployment** (285 cities worldwide)
- **Lower costs** ($0.65/million requests)
- **Auto-scaling** (0 to millions instantly)

### Supabase SDK Compatibility

All Supabase features are Edge Runtime compatible:

```typescript
export const runtime = 'edge' // ✅ All API routes

import { getSupabaseServerClient } from '@/lib/supabase'

export async function GET(req: Request): Promise<Response> {
  const supabase = getSupabaseServerClient()

  // ✅ Database queries
  const { data, error } = await supabase.from('users').select('*')

  // ✅ Storage operations
  const { data: file } = await supabase.storage.from('audio-files').download('file.mp3')

  // ✅ Real-time subscriptions (via Server-Sent Events)
  const channel = supabase.channel('messages')

  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' }
  })
}
```

**Not Compatible**:
- Node.js `fs` module
- `child_process` module
- Synchronous crypto operations

### Connection Pooling

Supabase uses **Supavisor** for connection pooling:

```typescript
// Automatically handled by Supabase client
const supabase = getSupabaseServerClient()

// Each request gets a connection from the pool
// No manual connection management needed
```

**Benefits**:
- Up to 500 concurrent connections
- Sub-10ms connection acquisition
- Automatic connection recycling
- Zero cold start penalty

## MCP Server Configuration

migue.ai uses Model Context Protocol (MCP) for AI-powered database operations.

### Setup (Already Configured)

```json
// .mcp.json
{
  "supabase": {
    "url": "https://mcp.supabase.com/mcp",
    "transport": "http",
    "auth": { "type": "oauth" },
    "features": {
      "database": true,
      "functions": true,
      "storage": true,
      "debugging": true,
      "development": true,
      "docs": true
    },
    "projectRef": "pdliixrgdvunoymxaxmw"
  }
}
```

### Usage Examples

```bash
# Execute SQL queries from natural language
# "Show me all users created in the last 7 days"
# → Automatically generates and executes SELECT query

# AI-assisted table design
# "Add a column to track user timezone preferences"
# → Generates migration SQL with proper constraints

# Deploy Edge Functions
# "Deploy a function to handle webhook retries"
# → Creates and deploys Supabase Edge Function
```

**See**: [SUPABASE-ACCESS.md](../03-api-reference/SUPABASE-ACCESS.md) for MCP usage guide

## CLI Commands

### Database Operations

```bash
# Verify connection and show data
npm run db:verify

# Use Supabase CLI
npm run db:cli -- projects list

# Audit user interactions
npm run audit:users

# Generate TypeScript types
npm run db:types
```

### Migration Management

```bash
# Create new migration
npx supabase migration new migration_name

# Apply migrations
npx supabase db push --db-url $SUPABASE_DB_URL

# Reset local database (dev only)
npx supabase db reset
```

### Monitoring

```bash
# View database logs
npx supabase logs db --project-ref pdliixrgdvunoymxaxmw

# Check query performance
npx supabase db query "SELECT * FROM pg_stat_statements LIMIT 10"

# Analytics usage
npm run db:cli -- analytics usage --project-ref pdliixrgdvunoymxaxmw
```

## Security Configuration

### Service Role vs Anon Key

```typescript
// ✅ Server-side: Use service role key (bypasses RLS)
const supabase = getSupabaseServerClient() // SUPABASE_KEY

// ❌ Client-side: Use anon key (enforces RLS)
// migue.ai doesn't have client-side Supabase access
```

### RLS Policy Testing

```bash
# Test as authenticated user
npx supabase db query "SET request.jwt.claims = '{\"sub\":\"user-uuid-here\"}'::jsonb; SELECT * FROM users;"

# Test as service role (bypasses RLS)
npx supabase db query "SELECT * FROM users;" --db-url $SUPABASE_DB_URL
```

### Environment Variable Security

**Never commit**:
- `.env.local` (gitignored)
- Service role keys
- Database passwords

**Production secrets**:
- Stored in Vercel Environment Variables
- Auto-injected at runtime
- Encrypted at rest

## Type Generation Workflow

### Automatic Type Generation

```bash
# Generate types from live database
npm run db:types

# TypeScript output
# → lib/database.types.ts (1,300+ lines, auto-generated)
```

### Type Usage

```typescript
import type { Database, Tables } from '@/lib/database.types'

// Table row types
type User = Tables<'users'>
type Message = Tables<'messages_v2'>

// Insert types
type UserInsert = Database['public']['Tables']['users']['Insert']

// Update types
type UserUpdate = Database['public']['Tables']['users']['Update']

// Enum types
type MsgType = Database['public']['Enums']['msg_type']
type ReminderStatus = Database['public']['Enums']['reminder_status']

// Function return types
type WindowStats = Database['public']['Functions']['find_windows_near_expiration']['Returns'][0]
```

### Type Safety Example

```typescript
import { getSupabaseServerClient } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

const supabase = getSupabaseServerClient()

// ✅ Type-safe query
const { data, error } = await supabase
  .from('users')
  .select('id, phone_number, name')
  .eq('phone_number', '+573001234567')
  .single()

// data is typed as:
// { id: string; phone_number: string; name: string | null } | null

// ✅ Type-safe insert
const { error: insertError } = await supabase
  .from('messages_v2')
  .insert({
    conversation_id: 'uuid',
    direction: 'inbound', // ✅ Enum type
    type: 'text', // ✅ Enum type
    content: 'Hello',
    timestamp: new Date().toISOString(),
  })
```

## Common Pitfalls

### 1. Missing Environment Variables

```typescript
// ❌ Will throw at runtime
const supabase = getSupabaseServerClient() // Missing SUPABASE_URL

// ✅ Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error('Supabase environment variables not configured')
}
```

### 2. Using Anon Key Server-Side

```typescript
// ❌ RLS will block service operations
const supabase = createClient(url, ANON_KEY)

// ✅ Use service role key server-side
const supabase = createClient(url, SERVICE_ROLE_KEY)
```

### 3. Not Regenerating Types

```bash
# After schema changes, regenerate types
npm run db:types

# Otherwise TypeScript will show stale types
```

### 4. Edge Runtime Incompatibilities

```typescript
// ❌ Not compatible with Edge Runtime
import fs from 'fs'
import { exec } from 'child_process'

// ✅ Use Edge-compatible alternatives
const response = await fetch('https://api.example.com/data')
```

## See Also

- [02 - Database Schema](./02-database-schema.md) - Complete schema documentation
- [04 - RLS Security](./04-rls-security.md) - Row Level Security policies
- [SUPABASE-ACCESS.md](../03-api-reference/SUPABASE-ACCESS.md) - Quick access guide
- [Supabase Edge Runtime](https://supabase.com/docs/guides/functions/edge-runtime)

---

**Last Updated**: 2025-10-11
**See Also**: [README.md](./README.md)
