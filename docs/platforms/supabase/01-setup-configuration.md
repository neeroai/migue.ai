# Setup & Configuration

Complete guide for setting up Supabase in migue.ai with TypeScript, MCP, and Edge Runtime.

## Environment Variables

### Required Variables

Add to `.env.local`:

```bash
# Supabase Connection
SUPABASE_URL=https://pdliixrgdvunoymxaxmw.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Supabase CLI
SUPABASE_ACCESS_TOKEN=sbp_...  # For CLI authentication
```

### Variable Details

| Variable | Type | Description |
|----------|------|-------------|
| `SUPABASE_URL` | **Required** | Project API URL from Supabase Dashboard |
| `SUPABASE_KEY` | **Required** | Service role key (bypasses RLS) |
| `SUPABASE_ACCESS_TOKEN` | Optional | Personal access token for CLI |

**Security Note**: Use service role key server-side only. Never expose to client.

## TypeScript Client

### Client Implementation

```typescript
// lib/supabase.ts
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

### Usage Example

```typescript
import { getSupabaseServerClient } from '@/lib/supabase'

// In API route or server component
const supabase = getSupabaseServerClient()

// Type-safe queries
const { data: users, error } = await supabase
  .from('users')
  .select('*')
  .eq('phone_number', '+573001234567')

if (error) {
  console.error('Query failed:', error.message)
  return
}

// data is typed as Database['public']['Tables']['users']['Row'][]
console.log(users[0]?.name)
```

### Client Configuration

**Authentication Disabled:**
- `persistSession: false` - No session cookies (server-side only)
- `autoRefreshToken: false` - No token refresh (service role never expires)

**Why?** migue.ai uses service role key for all operations, bypassing Supabase Auth entirely. Users are identified by phone number via WhatsApp API.

## Edge Runtime Configuration

### Compatibility

**Supabase client is Edge Runtime compatible:**
- ✅ No Node.js dependencies (fs, path, crypto)
- ✅ Uses fetch API (available in Edge)
- ✅ No global state
- ✅ Stateless connections

### Vercel Edge Function Example

```typescript
// app/api/example/route.ts
export const runtime = 'edge'

import { getSupabaseServerClient } from '@/lib/supabase'

export async function GET(req: Request): Promise<Response> {
  const supabase = getSupabaseServerClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, phone_number, created_at')
    .limit(10)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ users: data }), {
    headers: { 'content-type': 'application/json' }
  })
}
```

**Key Points:**
- Always create fresh client per request (no singleton)
- Use service role key (bypasses RLS)
- Handle errors gracefully
- Return proper Response objects

## MCP Server Setup

### Configuration File

Add to `.mcp.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

### Authentication

MCP server uses OAuth authentication:

1. First connection opens browser
2. Login with Supabase account
3. Authorize Claude Code access
4. Token stored automatically

### Available Features

**Enabled Feature Groups:**
- `database` - SQL queries, table design, migrations
- `functions` - Edge Functions deployment
- `debugging` - Logs, error tracking
- `development` - Type generation, testing
- `docs` - Documentation search
- `storage` - File uploads, buckets

### Usage Examples

```bash
# Natural language queries via Claude Code
"Show me all users created in the last 7 days"
→ SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '7 days'

# AI-assisted table design
"Create a table for tracking user sessions with TTL"
→ Generates CREATE TABLE with expiration logic

# Deploy Edge Function
"Deploy this function as 'process-webhook'"
→ Deploys to Supabase Edge Functions
```

**See**: [Supabase MCP Documentation](../../reference/supabase-access.md#mcp-server)

## CLI Installation

### Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# npm (any OS)
npm install -g supabase
```

### Authenticate

```bash
# Option 1: Login (opens browser)
supabase login

# Option 2: Access token
export SUPABASE_ACCESS_TOKEN=sbp_...
```

### Link to Project

```bash
supabase link --project-ref pdliixrgdvunoymxaxmw
```

### Common Commands

```bash
# List tables
supabase db dump --data-only --schema public

# Generate TypeScript types
supabase gen types typescript --project-id pdliixrgdvunoymxaxmw > lib/database.types.ts

# Run migration
supabase db push

# View logs
supabase functions logs process-webhook
```

## Type Generation Workflow

### Auto-Generate Types

```bash
# Generate from production database
npm run db:types

# Or manually
supabase gen types typescript \
  --project-id pdliixrgdvunoymxaxmw \
  --schema public \
  > lib/database.types.ts
```

### Type Usage

```typescript
import type { Database } from '@/lib/database.types'

// Table row type
type User = Database['public']['Tables']['users']['Row']

// Insert type (optional fields are optional)
type UserInsert = Database['public']['Tables']['users']['Insert']

// Update type (all fields optional)
type UserUpdate = Database['public']['Tables']['users']['Update']

// Enum type
type MsgType = Database['public']['Enums']['msg_type']

// Use in function
async function createUser(user: UserInsert): Promise<User | null> {
  const { data } = await supabase.from('users').insert(user).select().single()
  return data
}
```

### Keep Types in Sync

**After schema changes:**
1. Apply migration in Supabase Dashboard
2. Regenerate types: `npm run db:types`
3. Fix TypeScript errors
4. Commit updated types

## Connection Pooling

### Supavisor (Automatic)

Supabase uses Supavisor for connection pooling:

- **Transaction mode**: Each query gets a connection from pool
- **Session mode**: Connection persists for session
- **Max connections**: 15 (Free tier), 60 (Pro tier)

**No configuration needed** - automatic for all connections.

### Connection String Format

```bash
# Pooler (Transaction mode) - recommended
postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# Direct connection (Session mode) - for migrations
postgres://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Use pooler** for application queries, **direct connection** for migrations/admin tasks.

## Common Pitfalls

### Error: Missing Environment Variables

```typescript
// ❌ Bad: Crashes on missing env
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

// ✅ Good: Explicit error message
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY')
  }
  return createClient<Database>(url, key, { ... })
}
```

### Error: Client-Side Usage

```typescript
// ❌ Bad: Service role key exposed to client
'use client'
import { getSupabaseServerClient } from '@/lib/supabase'

// ✅ Good: Use anon key for client
import { createBrowserClient } from '@supabase/ssr'
const supabase = createBrowserClient(url, anonKey)
```

**Note**: migue.ai doesn't use client-side Supabase. All queries server-side.

### Error: Singleton Pattern

```typescript
// ❌ Bad: Singleton breaks in Edge Runtime
let supabaseInstance: SupabaseClient | null = null
export function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(...)
  }
  return supabaseInstance
}

// ✅ Good: Fresh client per request
export function getSupabaseServerClient() {
  return createClient<Database>(url, key, { ... })
}
```

## Next Steps

1. **[Database Schema](./02-database-schema.md)** - Explore all 14 tables
2. **[RLS Security](./04-rls-security.md)** - Understand security policies
3. **[Migrations](./12-migrations-maintenance.md)** - Apply schema changes

## Resources

- **Official**: [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- **Official**: [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- **Project**: [Supabase Access Guide](../../reference/supabase-access.md)

**Last Updated**: 2025-10-11
