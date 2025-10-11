# Deployment

Comprehensive guides for deploying migue.ai to production on Vercel.

## Overview

migue.ai is deployed on Vercel Edge Network with automatic deployments from the main branch.

## Documentation

### Edge Functions Best Practices (2024/2025)
- **[edge-functions-optimization.md](./edge-functions-optimization.md)** - Memory, cold starts, bundle optimization
- **[edge-security-guide.md](./edge-security-guide.md)** - HMAC validation, rate limiting, security
- **[edge-error-handling.md](./edge-error-handling.md)** - Timeout management, retry strategies
- **[edge-observability.md](./edge-observability.md)** - Monitoring, debugging, observability

### Getting Started
- **[vercel-edge-guide.md](./vercel-edge-guide.md)** - Edge Functions overview and setup
- **[best-practices.md](./best-practices.md)** - Deployment best practices (2025)
- **[pre-deployment-checklist.md](./pre-deployment-checklist.md)** - Pre-flight checklist

### Advanced Features
- **[streaming-setup.md](./streaming-setup.md)** - AI response streaming configuration
- **[supabase-integration.md](./supabase-integration.md)** - Supabase integration guide

### Architecture & Troubleshooting
- **[architecture.md](./architecture.md)** - Vercel architecture for WhatsApp bots
- **[troubleshooting.md](./troubleshooting.md)** - Common deployment issues

## Quick Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod

# Or push to main branch for auto-deployment
git push origin main
```

## Environment Variables

Required environment variables (set in Vercel dashboard):

```bash
# WhatsApp Business API
WHATSAPP_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_VERIFY_TOKEN=your_verify_token

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_key
```

## Deployment Checklist

Before deploying to production:

- [ ] All tests passing (`npm test`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Environment variables configured in Vercel
- [ ] Supabase database migrations applied
- [ ] WhatsApp webhook URL updated
- [ ] Edge runtime compatibility verified
- [ ] Pre-deployment checklist completed

See [pre-deployment-checklist.md](./pre-deployment-checklist.md) for full list.

## Monitoring

After deployment, monitor:
- **Vercel Observability** - CPU, memory, TTFB, cold starts (Oct 2024 release)
- **Supabase logs** - Database errors and slow queries
- **OpenAI dashboard** - API usage and rate limits
- **WhatsApp Business Manager** - Messaging status

See [edge-observability.md](./edge-observability.md) for comprehensive monitoring setup.

## Rollback

If deployment fails:
```bash
# Revert to previous deployment in Vercel dashboard
# Or redeploy last working commit
git revert HEAD
git push origin main
```

## Related Documentation

- [Architecture](../02-architecture/README.md) - System architecture
- [Getting Started](../01-getting-started/README.md) - Local setup
- [Features](../04-features/README.md) - Feature-specific deployment notes

---

**Last Updated**: 2025-10-03
**Production URL**: https://migue.app
