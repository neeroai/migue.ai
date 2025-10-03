# Vercel Edge Functions Deployment Fix

## Issue Summary

### Problem
Vercel deployments were failing with the following errors:

```
Build Failed
Error: The Edge Function "api/cron/check-reminders" is referencing unsupported modules:
- __vc__ns__/0/api/cron/check-reminders.js: ../../lib/supabase
- __vc__ns__/2/api/whatsapp/webhook.js: ../../lib/persist

TypeScript errors TS2307: Cannot find module '../../../lib/supabase' or its corresponding type declarations
```

### Root Cause Analysis

The deployment failures were caused by **dynamic imports in Edge Functions**, which are incompatible with Vercel's build-time bundler:

1. **Dynamic imports prevent proper dependency resolution**: Vercel's esbuild-based bundler analyzes all imports at build time to create optimized Edge Function bundles. Dynamic imports (`await import('../../lib/...')`) break this analysis because:
   - The bundler cannot statically determine which modules need to be included
   - Relative paths in dynamic imports confuse the dependency graph
   - The bundler treats them as external/unsupported modules

2. **TypeScript compilation vs. Vercel bundling**:
   - Local TypeScript compilation (`npm run typecheck`) passes because TypeScript's `moduleResolution: "bundler"` can resolve the types
   - Vercel's actual runtime bundler (esbuild) has different resolution behavior and fails on dynamic imports
   - This creates a disconnect where code type-checks locally but fails in production

3. **Edge Runtime constraints**:
   - Edge Functions run in a V8 isolate with limited module loading capabilities
   - All dependencies must be bundled at build time
   - Dynamic imports are not fully supported in this constrained environment

## The Solution

### What Was Changed

We converted all **dynamic imports to static imports** in Edge Functions:

#### Before (Broken)
```typescript
// api/cron/check-reminders.ts
async function getDueReminders() {
  const { getSupabaseServerClient } = await import('../../lib/supabase') // ❌ Dynamic import
  const supabase = getSupabaseServerClient()
  // ...
}
```

#### After (Fixed)
```typescript
// api/cron/check-reminders.ts
import { getSupabaseServerClient } from '../../lib/supabase'; // ✅ Static import at top

async function getDueReminders() {
  const supabase = getSupabaseServerClient()
  // ...
}
```

### Files Modified

1. **api/cron/check-reminders.ts**
   - Added: `import { getSupabaseServerClient } from '../../lib/supabase'`
   - Removed 3 dynamic imports from: `getDueReminders()`, `getUserPhone()`, `markReminderSent()`

2. **api/whatsapp/webhook.ts**
   - Added: `import { upsertUserByPhone, getOrCreateConversation, insertInboundMessage } from '../../lib/persist'`
   - Removed 1 dynamic import from: `persistNormalizedMessage()`
   - Removed unnecessary "Lazy import" comment

### Why This Works

1. **Static imports are fully analyzed at build time**: Vercel's bundler can trace all dependencies and create a complete bundle
2. **Relative paths work correctly**: Static imports resolve relative paths properly through the project structure
3. **No runtime overhead**: Static imports are more performant (no runtime module loading)
4. **Same functionality**: The code behaves identically - only the timing of imports changes (build-time vs runtime)
5. **Edge Runtime compatible**: All imported code (`lib/supabase.ts`, `lib/persist.ts`) only uses Web APIs and is fully compatible with Edge Runtime

## Best Practices for Vercel Edge Functions

### ✅ DO: Use Static Imports

```typescript
// At the top of the file
import { getSupabaseServerClient } from '../../lib/supabase';
import { someFunction } from '../../lib/utils';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const supabase = getSupabaseServerClient();
  // Use imported functions directly
}
```

### ❌ DON'T: Use Dynamic Imports with Relative Paths

```typescript
// This will break Vercel's bundler
async function myFunction() {
  const { getSupabaseServerClient } = await import('../../lib/supabase'); // ❌
  // ...
}
```

### Edge Runtime Compatibility Checklist

When writing Edge Functions, ensure:

- ✅ **No Node.js APIs**: Don't use `fs`, `path`, `process.cwd()`, etc.
- ✅ **Web APIs only**: Use `fetch`, `Request`, `Response`, `URL`, `crypto`, etc.
- ✅ **Static imports**: Always use top-level `import` statements
- ✅ **Relative paths**: Use relative imports (`../../lib/...`) for local modules
- ✅ **Edge-compatible packages**: Ensure all npm packages support Edge Runtime (e.g., `@supabase/supabase-js`, `openai`)
- ✅ **Environment variables**: Access via `process.env` (this is allowed)
- ✅ **Size limits**: Keep bundle size under Edge Function limits (~1MB)

### Module Resolution in Vercel

Vercel's Edge Functions bundler:
- Follows ES module semantics
- Resolves relative imports (`./`, `../`)
- Can bundle npm packages if they're Edge-compatible
- Cannot handle dynamic imports with relative paths
- Requires all dependencies to be analyzable at build time

### Common Patterns

#### Database Access (Supabase)
```typescript
import { getSupabaseServerClient } from '../../lib/supabase';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('table')
    .select('*');

  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' }
  });
}
```

#### External API Calls
```typescript
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const token = process.env.API_TOKEN;

  const response = await fetch('https://api.example.com/data', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  return response;
}
```

#### Shared Utilities
```typescript
// lib/utils.ts
export function formatDate(date: Date): string {
  return date.toISOString();
}

// api/endpoint.ts
import { formatDate } from '../../lib/utils'; // ✅ Static import

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const now = formatDate(new Date());
  return new Response(now);
}
```

## Troubleshooting Guide

### Issue: "Cannot find module" errors

**Symptoms:**
```
error TS2307: Cannot find module '../../lib/supabase' or its corresponding type declarations
```

**Solutions:**
1. Verify the import path is correct relative to the file location
2. Ensure you're using a static `import` statement at the top of the file
3. Check that the imported file exists and exports the expected functions
4. Run `npm run typecheck` locally to catch type errors before deployment

### Issue: "Referencing unsupported modules"

**Symptoms:**
```
Error: The Edge Function "api/..." is referencing unsupported modules:
- __vc__ns__/0/api/.../file.js: ../../lib/module
```

**Solutions:**
1. Convert any `await import('...')` to static `import` statements
2. Ensure imported modules don't use Node.js APIs
3. Verify all dependencies are Edge Runtime compatible

### Issue: Build succeeds locally but fails on Vercel

**Symptoms:**
- `npm run build` works
- `npm run typecheck` passes
- Vercel deployment fails

**Solutions:**
1. Check for dynamic imports - replace with static imports
2. Look for Node.js-specific APIs in your code
3. Verify environment variables are set in Vercel dashboard
4. Review Vercel build logs for specific error messages
5. Test with `npx vercel --prod` to simulate production build locally

### Issue: "Module not found" after deployment

**Symptoms:**
- Build succeeds
- Runtime errors about missing modules

**Solutions:**
1. Ensure all imports use relative paths, not absolute
2. Check that file extensions are omitted in imports (use `'./module'` not `'./module.ts'`)
3. Verify case-sensitivity in file names and imports
4. Make sure all files are committed to git (Vercel only deploys committed files)

## Performance Considerations

### Static Imports = Better Performance

Static imports provide:
- **Faster cold starts**: No runtime module loading overhead
- **Better tree-shaking**: Bundler can eliminate unused code
- **Smaller bundle sizes**: Dead code elimination is more effective
- **Predictable behavior**: No async import failures at runtime

### Bundle Size Optimization

Keep Edge Functions lean:
- Import only what you need: `import { specific } from 'module'` not `import * as all from 'module'`
- Avoid importing large libraries if you only need small parts
- Consider code splitting for different endpoints
- Monitor bundle sizes in Vercel deployment logs

## Additional Resources

- [Vercel Edge Functions Documentation](https://vercel.com/docs/functions/edge-functions)
- [Edge Runtime API](https://edge-runtime.vercel.app/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)

## Summary

The Vercel deployment issues were resolved by:
1. Converting dynamic imports to static imports
2. Ensuring all dependencies are analyzable at build time
3. Maintaining Edge Runtime compatibility

This fix improves performance, reliability, and aligns with Vercel Edge Functions best practices. All functionality remains the same - only the import mechanism changed.