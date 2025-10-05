# migue.ai - Documentation

WhatsApp AI Assistant built with Next.js 15, Vercel Edge, Supabase, and OpenAI.

## Quick Navigation

### New to migue.ai?
1. [Getting Started](./01-getting-started/README.md) - Setup and local development
2. [Architecture Overview](./02-architecture/README.md) - System design
3. [Deployment Guide](./05-deployment/README.md) - Deploy to production

### Building Features?
- [Features Documentation](./04-features/README.md) - Audio, streaming, RAG, calendar
- [API Reference](./03-api-reference/README.md) - WhatsApp, Supabase, OpenAI
- [WhatsApp Integration](./06-whatsapp/README.md) - API v23, flows, interactive

### Edge Functions & Performance?
- [Edge Functions Optimization](./05-deployment/edge-functions-optimization.md) - Memory, cold starts, bundle size
- [Edge Security Guide](./05-deployment/edge-security-guide.md) - HMAC validation, rate limiting
- [Edge Error Handling](./05-deployment/edge-error-handling.md) - Timeouts, retry strategies
- [Edge Observability](./05-deployment/edge-observability.md) - Monitoring, debugging
- [Edge Runtime API](./03-api-reference/edge-runtime-api.md) - Web APIs, compatibility
- [API Performance Guide](./03-api-reference/api-performance-guide.md) - Optimization strategies

### Deploying & Monitoring?
- [Deployment](./05-deployment/README.md) - Vercel Edge Functions, best practices
- [Troubleshooting](./05-deployment/troubleshooting.md) - Common issues
- [Pre-Deployment Checklist](./05-deployment/pre-deployment-checklist.md)

### Project Management?
- [Project Roadmap](../.claude/ROADMAP.md) - Complete project plan
- [Current Phase](../.claude/phases/current.md) - Fase 2 (60% complete)
- [PRD](./08-project-management/prd.md) - Product requirements
- [Feature Expansion](./08-project-management/feature-expansion.md)

### Testing & QA?
- [QA Documentation](./09-qa-testing/README.md)
- [PO Checklist](./09-qa-testing/po-checklist.md)

## Documentation Structure

```
docs/
├── 01-getting-started/    # Setup, installation, quick start
├── 02-architecture/       # System design, data models, security
├── 03-api-reference/      # API documentation, Edge Runtime, performance
├── 04-features/           # Feature-specific implementation guides
├── 05-deployment/         # Edge Functions, monitoring, best practices (2024/2025)
├── 06-whatsapp/           # WhatsApp API v23.0 integration
├── 08-project-management/ # PRD, roadmap, planning
├── 09-qa-testing/         # Testing strategies, checklists
└── 10-research/           # Research notes, investigations
```

## Quick Links

- **Production**: https://migue.app
- **CLAUDE.md**: [Project instructions](../CLAUDE.md)
- **Main README**: [../README.md](../README.md)

## Phase Alignment

**Current**: Fase 2 - Core Features (60% complete)
- Audio Transcription
- Streaming Responses
- RAG Implementation
- Calendar Integration

See [Roadmap](../.claude/ROADMAP.md) for complete timeline.

## Contributing

When adding documentation:
1. Place in appropriate numbered folder
2. Update folder README.md
3. Link from this main index
4. Follow existing patterns (code examples, TypeScript)
5. Keep files <300 lines (split if needed)

---

**Last Updated**: 2025-10-03
**Version**: 2.0.0 (CLAUDE-MASTER reorganization)
