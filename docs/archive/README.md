# Documentation Archive

Historical documentation archived for reference. Content here represents completed work, past research, or superseded implementations.

## Purpose

This archive preserves:
- ✅ Research and decision-making context
- ✅ Completed technical audits and optimizations
- ✅ Historical implementation notes
- ✅ Lessons learned for future reference

**Note:** Content here is **not actively maintained** and may be outdated.

---

## Contents

### [research/](./research/) - Pre-Implementation Research (Sept 2025)

**Status:** ✅ Archived - All decisions made and implemented

Research conducted during initial project planning phase:

| Document | Topic | Decision Made | Implementation |
|----------|-------|---------------|----------------|
| **Investigación Asistente WhatsApp AWS.md** | AWS vs Vercel comparison | **Vercel chosen** | ✅ Production on Vercel |
| **Asistentes IA WhatsApp para Citas_.md** | WhatsApp scheduling patterns | **Custom integration** | ✅ Implemented in Phase 2 |
| **GITHUB-WHATSAPP-AI-RESEARCH.md** | Open-source WhatsApp solutions | **Direct API approach** | ✅ No SDK dependencies |
| **CONVERSATION-FLOW-SIMULATION.md** | Conversation design | **Multi-turn context** | ✅ Implemented in `lib/ai-processing-v2.ts` |
| **GUIA-SISTEMA-AI-AUTOMATIZACION.md** | AI automation architecture | **Multi-provider system** | ✅ Gemini + GPT + Claude |

**Key Decisions:**
- ✅ **Hosting:** Vercel Edge Functions (over AWS Lambda)
- ✅ **Database:** Supabase PostgreSQL (over AWS RDS)
- ✅ **AI Provider:** Multi-provider (Gemini primary, GPT/Claude fallback)
- ✅ **WhatsApp:** Direct Business API (no third-party SDK)

**Why Archived:** All architectural decisions implemented and validated in production.

---

### [technical/](./technical/) - Completed Technical Audits (Oct 2025)

**Status:** ✅ Archived - Work completed

Technical audits and optimizations performed during Phase 2:

| Document | Topic | Date Completed | Outcome |
|----------|-------|----------------|---------|
| **EDGE-RUNTIME-OPTIMIZATION.md** | Edge Runtime compatibility | **Oct 5, 2025** | ✅ All routes Edge-compatible |
| **TYPESCRIPT-AUDIT-REPORT.md** | TypeScript strict mode audit | **Oct 6, 2025** | ✅ 239 tests passing |

**Edge Runtime Optimization (Oct 5):**
- ✅ Verified all AI SDKs Edge-compatible
- ✅ Removed Node.js-only dependencies
- ✅ Confirmed fire-and-forget webhook pattern
- ✅ Optimized cold start performance

**TypeScript Audit (Oct 6):**
- ✅ Fixed `noUncheckedIndexedAccess` violations
- ✅ Resolved `exactOptionalPropertyTypes` issues
- ✅ Eliminated all `any` types
- ✅ Added strict null checks

**Why Archived:** Optimizations complete, passing all quality gates. Documented here for historical reference.

---

## How to Use Archived Content

### Referencing Past Decisions

When facing similar architectural decisions, review archived research:

```bash
# Search for specific topics
grep -r "AWS Lambda" docs/archive/research/

# Review decision rationale
cat docs/archive/research/Investigación\ Asistente\ WhatsApp\ AWS.md
```

### Learning from Past Work

Use completed audits as templates for future optimization work:

```bash
# Review Edge Runtime optimization approach
cat docs/archive/technical/EDGE-RUNTIME-OPTIMIZATION.md

# Reference TypeScript strict mode fixes
cat docs/archive/technical/TYPESCRIPT-AUDIT-REPORT.md
```

---

## Archive Policy

### What Gets Archived?

✅ **Research documents** - After decisions implemented
✅ **Completed audits** - After fixes merged
✅ **Historical comparisons** - After technology choices finalized
✅ **Superseded implementations** - After migrations complete

### What Stays in Active Docs?

❌ **Current guides** - Actively used how-to documentation
❌ **Reference docs** - API specs, schema definitions
❌ **Architecture docs** - Current system design
❌ **Platform docs** - WhatsApp, Vercel, Supabase integrations

### Archival Process

1. **Review** - Ensure content is truly completed/superseded
2. **Move** - `git mv docs/XX-folder/ docs/archive/folder/`
3. **Update README** - Add entry to this file with context
4. **Link** - Reference from active docs if relevant
5. **Commit** - `git commit -m "chore(docs): archive completed research"`

---

## Related Documentation

- [Project Roadmap](../../.claude/ROADMAP.md) - Current project status
- [Decision Log](../../.claude/memory/decisions.md) - Active decisions
- [Lessons Learned](../../.claude/memory/lessons-learned.md) - Ongoing insights

---

**Archive Created:** 2025-10-11
**Total Size:** 212 KB (research 192KB, technical 20KB)
**Last Updated:** 2025-10-11
