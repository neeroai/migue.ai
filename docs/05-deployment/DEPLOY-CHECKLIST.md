# Deploy Checklist - migue.ai

## Pre-Deploy Validation (MANDATORY)

### 1. Code Quality ✅
- [ ] `git status` shows no uncommitted changes
- [ ] All modified files are committed and pushed
- [ ] No debug console.log statements in production code
- [ ] No commented-out code blocks

### 2. Type Safety ✅
```bash
npm run typecheck
```
- [ ] TypeScript compilation successful
- [ ] No type errors in terminal output
- [ ] All `any` types have been reviewed

### 3. Build Validation ✅
```bash
npm run build
```
- [ ] Next.js build completes successfully
- [ ] No webpack errors
- [ ] No missing module errors
- [ ] Build output shows all routes compiled

### 4. Testing ✅
```bash
npm run test:unit
```
- [ ] All unit tests pass
- [ ] No failing test suites
- [ ] Tests cover new/modified code

### 5. Environment Variables 🔐
- [ ] All required env vars in `.env.local` are documented in `.env.example`
- [ ] Vercel environment variables are up to date
- [ ] No secrets in code or git history
- [ ] Environment-specific configs verified

### 6. Dependencies 📦
- [ ] No `npm WARN` messages for missing peer dependencies
- [ ] `package.json` version numbers are correct
- [ ] No conflicting dependency versions

### 7. Git Status 🔄
```bash
git status
git log -1
git diff origin/main
```
- [ ] Current branch is up to date with main
- [ ] Latest commit includes descriptive message
- [ ] No untracked files that should be committed

### 8. Vercel Configuration ⚙️
- [ ] `vercel.json` has correct function configurations
- [ ] Cron schedules are accurate
- [ ] Edge runtime exports present in all API routes
- [ ] No `functions.runtime` in vercel.json (auto-detected)

## Quick Command (Automated)

Run all checks at once:

```bash
npm run pre-deploy
```

This executes:
1. `npm run typecheck` - Type safety
2. `npm run build` - Build validation
3. `npm run test:unit` - Unit tests

## Post-Deploy Verification

### 1. Deployment Status 🚀
- [ ] Vercel deployment succeeded
- [ ] No build errors in Vercel logs
- [ ] All functions deployed successfully

### 2. Health Checks 🏥
```bash
curl https://migue.app/api/health
```
- [ ] Health endpoint returns 200 OK
- [ ] Response includes all required services

### 3. WhatsApp Integration 📱
- [ ] Webhook receiving messages
- [ ] Typing indicators working
- [ ] Reactions sending correctly
- [ ] Interactive buttons/lists functional

### 4. Database Connection 🗄️
- [ ] Supabase connection established
- [ ] Queries executing successfully
- [ ] RLS policies enforced

### 5. OpenAI Integration 🤖
- [ ] GPT-4o responses generating
- [ ] Whisper transcription working
- [ ] Embeddings being created

### 6. Monitoring 📊
- [ ] Vercel Analytics showing data
- [ ] Error tracking active
- [ ] Logs accessible in dashboard

## Emergency Rollback 🚨

If deployment fails or critical issues arise:

```bash
# Rollback to previous deployment
vercel rollback

# Or redeploy previous commit
git revert HEAD
git push origin main
```

## Common Issues & Solutions

### Build Fails with "Module not found"
- **Cause**: File not committed to git
- **Fix**: `git status`, commit missing files, push

### TypeScript Errors in Vercel
- **Cause**: Local and Vercel TypeScript versions differ
- **Fix**: Run `npm run typecheck` locally first

### Tests Pass Locally but Fail in Vercel
- **Cause**: Environment variables missing
- **Fix**: Verify all env vars in Vercel dashboard

### Edge Function Timeout
- **Cause**: Function exceeds maxDuration
- **Fix**: Increase timeout in `vercel.json` or optimize code

## Pre-Deploy Script

For automated validation, run:

```bash
npm run verify-deploy
```

This script checks:
- Git status is clean
- Build succeeds
- Tests pass
- Environment variables are set

---

**Last Updated**: 2025-10-03
**Owner**: claude-master
**Status**: Active
