# Troubleshooting Guide

---

## Build Fails: "Cannot find module '@/lib/...'"

**Symptom**: TypeScript build error, can't resolve imports
**Cause**: `lib/` directory gitignored (Python .gitignore conflict)
**Solution**:
1. Check `.gitignore` for `lib/` entry
2. Change to `lib/__pycache__/` instead
3. Commit lib/ directory
**Prevention**: Never gitignore TypeScript source directories

---

## Vercel Deployment: "Edge Runtime not supported"

**Symptom**: Deployment fails with runtime error
**Cause**: `functions.runtime` in vercel.json
**Solution**:
1. Remove entire `functions` section from vercel.json
2. Keep `export const runtime = 'edge'` in route files
3. Redeploy
**Prevention**: vercel.json = crons + headers only

---

## TypeScript Error: "Object is possibly undefined"

**Symptom**: Type error on array/object access
**Cause**: `noUncheckedIndexedAccess: true` in tsconfig
**Solution**:
- Use `array[0]!` when index certain
- Or check first: `if (array.length > 0)`
- Use optional chaining: `object?.property`
**Prevention**: Always validate array length before access

---

## WhatsApp Webhook: "Signature verification failed"

**Symptom**: 401/403 on webhook POST requests
**Cause**: Missing or incorrect WHATSAPP_APP_SECRET
**Solution**:
1. Verify env var in Vercel Dashboard
2. Check signature calculation in webhook handler
3. Test with Meta's webhook test tool
**Prevention**: Use Meta's example code for signature verification

---

## Database Query: "RLS policy violation"

**Symptom**: Query returns empty despite data existing
**Cause**: Row Level Security policy blocking access
**Solution**:
1. Check RLS policies in Supabase Dashboard
2. Verify user context (phone_number)
3. Test query as service role for debugging
**Prevention**: Test RLS policies with real user context

---

## OpenAI API: "Rate limit exceeded"

**Symptom**: 429 error from OpenAI
**Cause**: Too many requests in short time
**Solution**:
1. Implement exponential backoff retry
2. Add request queuing
3. Cache responses (1-hour TTL)
**Prevention**: Rate limiting + caching strategy

---

## Edge Function: "Function timeout"

**Symptom**: 504 error after 25 seconds
**Cause**: Long-running operation (Whisper, etc.)
**Solution**:
1. Move to background processing
2. Return immediate response
3. Follow up when done
**Prevention**: <5s target for Edge Functions

---

## Tests Fail: "fetch is not defined"

**Symptom**: Jest error, fetch not available
**Cause**: Standard Node.js doesn't have fetch
**Solution**:
1. Use @edge-runtime/jest-environment
2. Add to jest.config.js
3. Restart Jest
**Prevention**: Use Edge Runtime test environment from start

---

## WhatsApp Media: "Media URL expired"

**Symptom**: 404 when downloading media
**Cause**: Media URLs expire after 5 minutes
**Solution**:
1. Download immediately on webhook receive
2. Store in Supabase storage
3. Process from storage
**Prevention**: Never delay media downloads

---

## Supabase: "Database connection limit"

**Symptom**: "too many clients" error
**Cause**: Connection pooling exhausted
**Solution**:
1. Use single Supabase client instance
2. Don't create new client per request
3. Check for connection leaks
**Prevention**: Import from lib/supabase.ts (singleton)

---

## TypeScript: "Cannot use import statement"

**Symptom**: Error running TypeScript file
**Cause**: Wrong module type or tsconfig
**Solution**:
1. Set `"type": "module"` in package.json
2. Use `.ts` extension consistently
3. Check tsconfig moduleResolution
**Prevention**: Use ES modules everywhere

---

## Next.js: "Page not found" for API route

**Symptom**: 404 on /api/endpoint
**Cause**: Wrong file location (App Router)
**Solution**:
1. Move to `app/api/endpoint/route.ts`
2. Export named HTTP methods
3. Rebuild
**Prevention**: Use App Router structure from start

---

## Git: ".env.local committed by mistake"

**Symptom**: Secrets exposed in repository
**Cause**: .env.local not in .gitignore
**Solution**:
1. `git rm --cached .env.local`
2. Add to .gitignore
3. Rotate all secrets immediately
4. Force push (if not public)
**Prevention**: Verify .gitignore before first commit

---

## OpenAI: "Invalid API key"

**Symptom**: 401 from OpenAI
**Cause**: Wrong key format or expired
**Solution**:
1. Verify OPENAI_API_KEY in env
2. Check for spaces/newlines
3. Regenerate key if needed
**Prevention**: Use environment variable validation

---

## Streaming: "Headers already sent"

**Symptom**: Error when trying to set headers
**Cause**: Headers sent before streaming starts
**Solution**:
1. Set headers before first write
2. Use `new Response(stream, { headers })`
3. Don't call Response methods after streaming
**Prevention**: Structure response creation correctly

---

**Last Updated**: 2025-10-03
