---
description: Safe automated deployment to Vercel with pre-validation and intelligent commit
allowed-tools: Bash, Read, Grep
---

# Deploy to Production

Automated deployment workflow to Vercel with comprehensive pre-flight validation. Enforces type safety, build verification, testing, and secret detection before creating intelligent commits and pushing to production. All safety checks must pass before deployment proceeds.

## Pre-Flight Validation

Run comprehensive validation before allowing deployment:

```bash
echo "Running pre-deployment validation..."

# Type safety check
npm run typecheck || {
  echo "ERROR: TypeScript validation failed. Fix type errors before deploying."
  exit 1
}

# Build verification
npm run build || {
  echo "ERROR: Build failed. Fix build errors before deploying."
  exit 1
}

# Unit tests
npm run test:unit || {
  echo "ERROR: Tests failed. Fix failing tests before deploying."
  exit 1
}

echo "Pre-deployment checks passed"
```

## Secret Detection

Prevent accidental commit of sensitive data:

```bash
echo "Scanning for secrets..."

# Check for .env files in staging
if git status --porcelain | grep -q "\.env"; then
  echo "ERROR: .env file detected in changes. Never commit environment files."
  echo "Run: git reset HEAD .env"
  exit 1
fi

# Check for credential files
if git status --porcelain | grep -qE "(credentials|secrets|\.pem|\.key|\.crt)"; then
  echo "WARNING: Potential credential files detected"
  git status --porcelain | grep -E "(credentials|secrets|\.pem|\.key|\.crt)"
  exit 1
fi

# Check staged content for API keys and secrets
if git diff --cached | grep -iE "API_KEY|SECRET|PASSWORD|TOKEN|sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36}" > /dev/null; then
  echo "ERROR: Potential secrets or API keys detected in staged changes"
  exit 1
fi

echo "No sensitive files detected"
```

## Git Workflow

### Status Check

```bash
echo "Checking git status..."
git status --short

# Exit if no changes
if [[ -z $(git status --porcelain) ]]; then
  echo "No changes to deploy. Working directory is clean."
  exit 0
fi

# Verify branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "WARNING: On branch '$CURRENT_BRANCH', not 'main'"
  echo "Vercel auto-deploys from 'main' only. Switch with: git checkout main"
  exit 1
fi
```

### Stage Changes

```bash
echo "Staging changes..."
git add .

STAGED_COUNT=$(git diff --cached --name-only | wc -l | xargs)
if [[ "$STAGED_COUNT" -eq 0 ]]; then
  echo "No staged changes to commit"
  exit 0
fi

echo "Staged $STAGED_COUNT files"
git diff --cached --name-only
```

### Generate Commit Message

Intelligent commit message based on changed files:

```bash
CHANGED_FILES=$(git status --short)

# Detect commit type from file patterns
if echo "$CHANGED_FILES" | grep -q "lib/.*\.ts"; then
  COMMIT_TYPE="feat(lib)"
elif echo "$CHANGED_FILES" | grep -q "app/api/"; then
  COMMIT_TYPE="feat(api)"
elif echo "$CHANGED_FILES" | grep -q "docs/"; then
  COMMIT_TYPE="docs"
elif echo "$CHANGED_FILES" | grep -q "tests/"; then
  COMMIT_TYPE="test"
elif echo "$CHANGED_FILES" | grep -q "\.md$"; then
  COMMIT_TYPE="docs"
else
  COMMIT_TYPE="chore"
fi

# Count changes
NUM_MODIFIED=$(echo "$CHANGED_FILES" | grep "^ M" | wc -l | xargs)
NUM_ADDED=$(echo "$CHANGED_FILES" | grep "^??" | wc -l | xargs)

COMMIT_MSG="$COMMIT_TYPE: deployment update ($NUM_MODIFIED modified, $NUM_ADDED added)"

echo "Proposed commit: $COMMIT_MSG"
echo "Proceed? (y/n)"
```

### Commit and Push

```bash
# Create commit with Claude co-authorship
COMMIT_MESSAGE="$COMMIT_MSG

Generated with Claude Code
https://claude.com/claude-code

Co-Authored-By: Claude <noreply@anthropic.com>"

git commit -m "$COMMIT_MESSAGE" || {
  echo "ERROR: Commit failed"
  exit 1
}

echo "Commit created successfully"

# Push to remote
echo "Pushing to remote..."
git push origin main || {
  echo "ERROR: Push failed"
  echo "Common issues:"
  echo "  - Network connectivity"
  echo "  - Authentication (check GitHub credentials)"
  echo "  - Pre-push hook failures"
  echo ""
  echo "To undo commit: git reset HEAD~1"
  exit 1
}

echo "Pushed to origin/main successfully"
```

## Deployment Status

Vercel will automatically deploy from the main branch via GitHub integration:

**Production URLs:**
- Production: https://migue.app
- Dashboard: https://vercel.com/neeroai/migue-ai
- Repository: https://github.com/neeroai/migue.ai

**Build Process:**
- Build time: ~2-3 minutes
- Edge Functions: Auto-detected from `export const runtime = edge`
- Cron Jobs: Configured in vercel.json
- Environment: Variables from Vercel dashboard

**Monitoring:**
1. Visit Vercel dashboard
2. Check Deployments tab
3. View real-time build logs
4. Verify Edge Functions deployment

## Troubleshooting

**Type Errors**: Fix TypeScript errors shown in output, run `npm run typecheck` to verify, then retry

**Build Failures**: Check build logs for missing dependencies or syntax errors, run `npm run build` locally

**Test Failures**: Review failing test output, run `npm run test:unit` to debug, fix issues

**Secret Detection**: Remove secrets from code, use environment variables in Vercel dashboard instead

**Git Conflicts**: Run `git pull --rebase`, resolve conflicts, then retry deployment

**Push Failures**: Run `git pull --rebase origin $CURRENT_BRANCH` to sync with remote

**Deployment Failures**: Check Vercel build logs for runtime errors or missing environment variables

## Rollback

If deployment causes production issues:

```bash
# Revert last commit locally (soft)
git reset --soft HEAD~1

# Revert on remote (creates new commit)
git revert HEAD
git push

# Or use Vercel dashboard to rollback to previous deployment
```

## Integration

This command integrates with existing project tools:

**Husky Hooks:**
- Pre-commit: Runs `npm run typecheck`
- Pre-push: Runs `npm run build && npm run test:unit`

**Vercel Configuration:**
- Auto-deployment from main branch
- Edge Functions auto-detected
- Cron jobs from vercel.json

**Git Workflow:**
- Conventional commit messages
- Branch protection on main
- Co-authorship with Claude

**Documentation:**
- See: `CLAUDE.md` for project guidelines
- See: `docs/platforms/vercel/` for Vercel configuration
- See: `vercel.json` for deployment settings

---

**Status**: Production Ready
**Execution Time**: ~4 minutes (including Vercel build)
**Last Updated**: 2025-10-16
