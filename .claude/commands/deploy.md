---
description: Safe automated deployment to Vercel with pre-validation and intelligent commit
allowed-tools: Bash, Read, Grep
---

# 🚀 Deploy to Production

Deployment automatizado y seguro a Vercel con validaciones completas.

## Overview

Este comando ejecuta un deployment completo siguiendo todas las políticas de seguridad y best practices del proyecto. Integra validaciones automáticas, commit inteligente, y push a Vercel.

**Flujo de Deployment:**
```
Pre-validation → Stage Changes → Generate Commit → Push to Main → Auto-Deploy Vercel
```

---

## Safety Checks (Automatic)

✅ **TypeScript Strict Mode** - `npm run typecheck`
✅ **Build Validation** - `npm run build` (Next.js 15)
✅ **Unit Tests** - `npm run test:unit` (239 tests)
✅ **Secret Detection** - Verifica .env, credentials, tokens
✅ **Git Hooks** - Husky pre-commit/pre-push automáticos

---

## Deployment Workflow

### Step 1: Pre-Validation

Ejecuta validaciones completas antes de permitir deployment:

```bash
echo "🔍 Running pre-deployment validation..."

# 1. TypeScript type checking
npm run typecheck || {
  echo "❌ TypeScript validation failed. Fix type errors before deploying."
  exit 1
}

# 2. Build validation
npm run build || {
  echo "❌ Build failed. Fix build errors before deploying."
  exit 1
}

# 3. Unit tests
npm run test:unit || {
  echo "❌ Tests failed. Fix test errors before deploying."
  exit 1
}

echo "✅ All pre-deployment checks passed!"
```

---

### Step 2: Git Status Check

Verifica el estado actual del repositorio:

```bash
echo ""
echo "📊 Git Status:"
git status --short

# Check for uncommitted changes
if [[ -z $(git status --porcelain) ]]; then
  echo "✅ No changes to deploy."
  echo "ℹ️  Working directory is clean."
  exit 0
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "⚠️  Warning: You're on branch '$CURRENT_BRANCH', not 'main'"
  echo "❓ Deploy from this branch? (Vercel auto-deploys from 'main' only)"
  echo "   You can switch with: git checkout main"
  exit 1
fi
```

---

### Step 3: Secret Detection

Previene accidental commit de secretos:

```bash
echo ""
echo "🔒 Checking for sensitive files..."

# Check for .env files
if git status --porcelain | grep -q "\.env"; then
  echo "❌ ERROR: .env file detected in staged changes!"
  echo "   NEVER commit .env files. They contain secrets."
  echo "   Run: git reset HEAD .env"
  exit 1
fi

# Check for credential files
if git status --porcelain | grep -qE "(credentials|secrets|\.pem|\.key|\.crt)"; then
  echo "⚠️  WARNING: Potential credential files detected!"
  echo "   Review carefully before proceeding."
  git status --porcelain | grep -E "(credentials|secrets|\.pem|\.key|\.crt)"
  exit 1
fi

echo "✅ No sensitive files detected."
```

---

### Step 4: Generate Commit Message

Genera mensaje de commit inteligente basado en archivos modificados:

```bash
echo ""
echo "📝 Generating commit message..."

# Analyze changed files to determine commit type
CHANGED_FILES=$(git status --short)

# Detect commit type based on file patterns
if echo "$CHANGED_FILES" | grep -q "lib/.*\.ts"; then
  COMMIT_TYPE="feat"
  SCOPE="lib"
elif echo "$CHANGED_FILES" | grep -q "app/api/"; then
  COMMIT_TYPE="feat"
  SCOPE="api"
elif echo "$CHANGED_FILES" | grep -q "docs/"; then
  COMMIT_TYPE="docs"
  SCOPE=""
elif echo "$CHANGED_FILES" | grep -q "tests/"; then
  COMMIT_TYPE="test"
  SCOPE=""
elif echo "$CHANGED_FILES" | grep -q "\.md$"; then
  COMMIT_TYPE="docs"
  SCOPE=""
else
  COMMIT_TYPE="chore"
  SCOPE=""
fi

# Count changes
NUM_MODIFIED=$(echo "$CHANGED_FILES" | grep "^ M" | wc -l | xargs)
NUM_ADDED=$(echo "$CHANGED_FILES" | grep "^??" | wc -l | xargs)
NUM_DELETED=$(echo "$CHANGED_FILES" | grep "^ D" | wc -l | xargs)

# Generate summary
COMMIT_SUMMARY="$COMMIT_TYPE"
[[ -n "$SCOPE" ]] && COMMIT_SUMMARY="$COMMIT_SUMMARY($SCOPE)"
COMMIT_SUMMARY="$COMMIT_SUMMARY: deployment update"

# Show proposed message
echo ""
echo "📋 Proposed Commit Message:"
echo "   Type: $COMMIT_TYPE"
echo "   Summary: $COMMIT_SUMMARY"
echo "   Changes: $NUM_MODIFIED modified, $NUM_ADDED added, $NUM_DELETED deleted"
echo ""
echo "❓ Use this message? (or provide your own)"
```

**Note:** El usuario puede aceptar el mensaje generado o proporcionar uno custom.

---

### Step 5: Stage and Commit

Agrega archivos y crea commit:

```bash
echo ""
echo "📦 Staging changes..."

# Stage all changes (excluding .env and secrets)
git add .

# Verify staging
STAGED_COUNT=$(git diff --cached --name-only | wc -l | xargs)
echo "✅ Staged $STAGED_COUNT files"

# Show what will be committed
echo ""
echo "Files to be committed:"
git diff --cached --name-only

# Create commit
echo ""
echo "💾 Creating commit..."

# Use the generated or user-provided message
COMMIT_MESSAGE="${COMMIT_SUMMARY}

🤖 Generated with Claude Code
https://claude.com/claude-code

Co-Authored-By: Claude <noreply@anthropic.com>"

git commit -m "$COMMIT_MESSAGE" || {
  echo "❌ Commit failed. Check error messages above."
  exit 1
}

echo "✅ Commit created successfully"
```

---

### Step 6: Push to Main

Push a GitHub, triggering auto-deployment en Vercel:

```bash
echo ""
echo "🚀 Pushing to GitHub..."

# Push to origin main
git push origin main || {
  echo "❌ Push failed. Check error messages above."
  echo ""
  echo "Common issues:"
  echo "  - Network connectivity"
  echo "  - Authentication (check GitHub credentials)"
  echo "  - Pre-push hook failures (typecheck/build/tests)"
  echo ""
  echo "🔄 To undo the commit: git reset HEAD~1"
  exit 1
}

echo "✅ Pushed to origin/main successfully!"
```

---

### Step 7: Deployment Status

Muestra información sobre el deployment en Vercel:

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Deployment Initiated!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Production URL: https://migue.app"
echo "📊 Vercel Dashboard: https://vercel.com/neeroai/migue-ai"
echo "🔗 GitHub Repository: https://github.com/neeroai/migue.ai"
echo ""
echo "⏳ Deployment Status:"
echo "   - Vercel will auto-deploy from the 'main' branch"
echo "   - Build time: ~2-3 minutes"
echo "   - Edge Functions: Auto-detected from 'export const runtime = edge'"
echo "   - Cron Jobs: Configured in vercel.json"
echo ""
echo "📈 Monitor Deployment:"
echo "   1. Visit Vercel Dashboard (link above)"
echo "   2. Check 'Deployments' tab"
echo "   3. View real-time build logs"
echo "   4. Verify Edge Functions deployment"
echo ""
echo "✅ What happens next:"
echo "   • Vercel builds Next.js app"
echo "   • Deploys Edge Functions globally"
echo "   • Updates production environment"
echo "   • Applies cron job schedules"
echo "   • Routes traffic to new deployment"
echo ""
echo "⚠️  If deployment fails:"
echo "   • Check Vercel build logs"
echo "   • Verify environment variables"
echo "   • Rollback: git revert HEAD && git push"
echo "   • Contact: Vercel support or check docs/platforms/vercel/"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

## Error Handling

### Pre-Deployment Failures

Si las validaciones fallan, el script termina antes de commit:

```bash
# TypeScript errors
❌ TypeScript validation failed. Fix type errors before deploying.
   → Run: npm run typecheck
   → Fix errors in reported files
   → Re-run /deploy

# Build errors
❌ Build failed. Fix build errors before deploying.
   → Run: npm run build
   → Check Next.js build output
   → Fix import/export errors

# Test failures
❌ Tests failed. Fix test errors before deploying.
   → Run: npm run test:unit
   → Check failing test cases
   → Fix implementation bugs
```

### Commit/Push Failures

Si commit o push fallan:

```bash
# Commit failed
❌ Commit failed. Check error messages above.
   → Review git error messages
   → Fix commit message format
   → Try again

# Push failed
❌ Push failed. Check error messages above.
   → Check network connectivity
   → Verify GitHub authentication
   → Check pre-push hook output

# Rollback commit if needed
🔄 To undo the commit: git reset HEAD~1
```

### Deployment Failures

Si el deployment en Vercel falla:

```bash
⚠️  Deployment failed on Vercel
   → Check build logs in Vercel dashboard
   → Common issues:
     • Missing environment variables
     • Edge Runtime incompatibility
     • Build timeout

   → Rollback steps:
     1. git revert HEAD
     2. git push origin main
     3. Previous deployment auto-restores
```

---

## Quick Reference

### Full Deployment (Happy Path)

```bash
/deploy
# → Pre-validation (typecheck + build + tests)
# → Git status check
# → Secret detection
# → Generate commit message
# → Stage changes
# → Commit
# → Push to main
# → Vercel auto-deploy
# → Monitor in dashboard
```

### Deployment Time

- Pre-validation: ~30-60s
- Commit/Push: ~5-10s
- Vercel Build: ~2-3 minutes
- **Total: ~3-4 minutes**

### Required Permissions

- Git push access to `origin main`
- Vercel project linked to GitHub repo
- Environment variables configured in Vercel dashboard

---

## Integration with Existing Tools

Este comando respeta e integra todas las herramientas existentes:

✅ **Husky Hooks**
- Pre-commit: Ejecuta `npm run typecheck` (automatic)
- Pre-push: Ejecuta `npm run build && npm run test:unit` (automatic)

✅ **NPM Scripts**
- `npm run pre-deploy`: Ejecutado explícitamente
- `npm run verify-deploy`: Disponible para verificación post-deploy

✅ **Vercel Configuration**
- Auto-deployment desde `main` branch
- Edge Functions auto-detected
- Cron jobs en `vercel.json`

✅ **Git Workflow**
- Conventional commit messages
- Branch protection (main)
- Co-authorship with Claude

---

## Best Practices

1. **Always run /deploy from a clean working directory**
   - Commit or stash unrelated changes first
   - Review `git status` before deploying

2. **Monitor deployments in Vercel dashboard**
   - Check build logs for errors
   - Verify Edge Functions deployment
   - Test production endpoint

3. **Use conventional commit messages**
   - `feat:` - New features
   - `fix:` - Bug fixes
   - `refactor:` - Code refactoring
   - `docs:` - Documentation updates
   - `chore:` - Maintenance tasks

4. **Never commit secrets**
   - .env files are auto-blocked
   - Review staged files before commit
   - Use Vercel dashboard for env vars

5. **Test locally before deploying**
   - Run `npm run dev` and test manually
   - Run `npm run test:unit` to verify
   - Check TypeScript with `npm run typecheck`

---

## Related Documentation

- **[CLAUDE.md](../../CLAUDE.md)** - Project guidelines and deployment policies
- **[docs/platforms/vercel/README.md](../../docs/platforms/vercel/README.md)** - Vercel deployment guide
- **[vercel.json](../../vercel.json)** - Vercel configuration
- **[.husky/](../../.husky/)** - Git hooks configuration

---

**Last Updated**: 2025-10-10
**Status**: Production Ready
**Execution Time**: ~4 minutes (including Vercel build)
