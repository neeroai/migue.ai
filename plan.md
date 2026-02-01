---
title: "Project Plan - Migue.ai"
date: "2026-02-01 11:30"
updated: "2026-02-01 11:30"
version: "1.0"
status: "in-progress"
summary: "Vercel AI SDK migration plan - transitioning from custom OpenAI implementation to AI SDK 4.1+"
description: "3-phase migration to Vercel AI SDK: Phase 1 (Provider abstraction), Phase 2 (Core features), Phase 3 (Advanced capabilities). Currently 60% through Phase 1."
scope: "Project-level migration and feature development"
---

# Plan: Vercel AI SDK Migration

## Context

Migrating from custom OpenAI/Anthropic implementations to Vercel AI SDK 4.1+ for better maintainability, cost optimization, and feature capabilities. See `/planning/prd.md` and `/planning/ROADMAP.md` for complete details.

## Current Phase: Phase 1 (60% Complete)

| Step | Status | Verification |
|------|--------|--------------|
| Provider abstraction | DONE | lib/ai-providers.ts implemented |
| Token tracking | DONE | Database schema includes token counts |
| Streaming support | DONE | SSE streaming via AI SDK |
| Test coverage | IN_PROGRESS | 239 tests passing |
| Edge runtime migration | BLOCKED | Node.js dependencies identified |

## Files Modified (Recent)

| File | Change Type | Description |
|------|-------------|-------------|
| lib/ai-providers.ts | create | AI SDK provider abstraction |
| app/api/whatsapp/webhook/route.ts | modify | Integrated AI SDK streaming |
| package.json | modify | Added AI SDK dependencies |

## Verification

**End-to-end test**:
```bash
npm run test        # 239 tests passing
npm run build       # Edge runtime validation
```

**Expected outcome**: All tests pass, edge runtime compatible

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Node.js deps in edge | Deployment failure | Audit and replace with edge-compatible alternatives |
| Cost increase | Budget overrun | Token tracking and provider fallback |
| Breaking changes | Service disruption | Phased rollout with testing |

## Next Steps

1. Complete Phase 1: Edge runtime migration
2. Begin Phase 2: Conversation management
3. Implement cost optimization features

---

**Approval Required**: NO (approved in /planning/prd.md)
**Estimated Effort**: 14-19 weeks total (Phase 1: 60% complete)
