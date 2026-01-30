---
title: "migue.ai Architecture Decision Records"
summary: "ADRs tracking architectural and technical decisions"
description: "Decision log following ADR format - includes context, decision, consequences"
version: "1.0"
date: "2026-01-28"
updated: "2026-01-28"
scope: "project"
---

# Architecture Decision Records

## ADR-001: Fresh Start Strategy

**Date**: 2026-01-28
**Status**: ACCEPTED
**Context**: Previous implementation had critical errors
**Decision**: Archive all code, start fresh with landing page only
**Consequences**:
- Clean slate for proper implementation
- Preserved previous work in .backup/
- Specs documented in specs/PRD.md

---

## ADR-002: Biome for Linting

**Date**: 2026-01-28
**Status**: ACCEPTED
**Context**: Need unified linting and formatting solution
**Decision**: Use Biome instead of ESLint + Prettier
**Consequences**:
- Single tool for linting + formatting
- Faster than ESLint + Prettier
- Zero config required
- Consistent code style

**Decision Filter**:
- Q1: Real problem TODAY? YES (style friction, slow linting)
- Q2: Simplest? YES (<20 lines config)
- Q3: 2-person maintain? YES (stable, clear docs)
- Q4: Valuable if never scales? YES (saves time NOW)

---

## ADR-003: Bun as Package Manager

**Date**: 2026-01-28
**Status**: ACCEPTED
**Context**: Need fast, modern package manager
**Decision**: Use Bun 1.3.5 as primary package manager
**Consequences**:
- Fast installs and builds
- Built-in TypeScript support
- Compatible with Node.js ecosystem
- Requires moduleResolution: "Bundler" in tsconfig

**Decision Filter**:
- Q1: Real problem TODAY? YES (npm/pnpm slower)
- Q2: Simplest? YES (drop-in replacement)
- Q3: 2-person maintain? YES (growing ecosystem)
- Q4: Valuable if never scales? YES (faster dev experience)

---

## ADR-004: Tailwind CSS 4

**Date**: 2026-01-28
**Status**: ACCEPTED
**Context**: Need modern CSS framework
**Decision**: Use Tailwind CSS 4.1 with PostCSS
**Consequences**:
- Utility-first CSS approach
- Fast development iteration
- Consistent design system
- Small production bundle

---

## ADR-005: Next.js 15 + React 19

**Date**: 2026-01-28
**Status**: ACCEPTED
**Context**: Security fix (CVE-2025-55182) required upgrade
**Decision**: Upgrade to Next.js 15.1.6 and React 19.2.3
**Consequences**:
- Security vulnerability patched
- Access to latest Next.js features
- React 19 performance improvements
- Breaking changes handled

---

## Template for Future ADRs

```markdown
## ADR-XXX: [Title]

**Date**: YYYY-MM-DD
**Status**: PROPOSED | ACCEPTED | REJECTED | DEPRECATED
**Context**: [What is the issue?]
**Decision**: [What we decided]
**Consequences**: [What happens as a result]

**Decision Filter** (if adding dependency):
- Q1: Real problem TODAY? [YES/NO - explain]
- Q2: Simplest? [YES/NO - explain]
- Q3: 2-person maintain? [YES/NO - explain]
- Q4: Valuable if never scales? [YES/NO - explain]
```

---

**Last Updated**: 2026-01-28
