---
title: "Architecture Decisions"
summary: "ADR log for architecture decisions with rationale and consequences"
description: "Decision records for migue.ai tracking system and performance optimizations"
version: "1.0"
date: "2026-02-06 23:30"
updated: "2026-02-07 12:15"
---

# Architecture Decisions

## ADR-001: Mandatory Tracking Files Implementation

**Date**: 2026-02-06 23:30
**Status**: Approved
**Deciders**: User + enforcement rules validation

### Context

Project lacked mandatory tracking files (session.md, todo.md, decisions.md, status.md) required by enforcement rules in ~/.claude/rules/50-enforcement-hooks.md. This caused context loss between sessions and violated BLOCKING compliance requirements.

### Decision

Create 4 mandatory tracking files in .claude/ directory:
- session.md: Session log (start/end, operations, decisions)
- todo.md: Task list (pending/in_progress/completed/blocked)
- decisions.md: ADRs (architecture decision records)
- status.md: Project snapshot (metrics, milestones, risks)

### Rationale

- Enforcement rules: BLOCKING violation without these files
- Context preservation: Essential for multi-session work
- Decision rationale: Prevents re-litigating past decisions
- Progress visibility: Clear task status across sessions

### Consequences

**Positive**:
- No context loss between sessions
- Clear task visibility and progress tracking
- Decision history preserved with rationale
- Compliance with enforcement rules

**Negative**:
- Maintenance overhead (must update per session)
- File duplication risk (must keep current)

### Alternatives Considered

1. Manual notes in conversation - Rejected: context lost on /clear
2. External task tracker - Rejected: not accessible to Claude
3. Single tracking.md file - Rejected: too monolithic, violates modular rules

---

## ADR-002: Cache TTL Increases for Latency Optimization

**Date**: 2026-02-06 23:30
**Status**: Proposed (Phase 2)
**Deciders**: Phase 1 validation complete

### Context

Cold start latency 1350-3400ms unacceptable for WhatsApp UX. Memory cache (5min), history cache (60s), budget cache (30s) causing frequent DB queries on cache misses.

### Decision

Increase cache TTLs:
- Memory: 5min → 15min (lib/ai/memory.ts:29)
- History: 60s → 5min (lib/conversation-utils.ts:51)
- Budget: 30s → 60s (lib/ai-cost-tracker.ts:97)

### Rationale

- Memory facts stable: User preferences/info rarely change within 15min window
- History updates per message: 60s too aggressive for repeated access patterns
- Budget checked every request: 60s safe for $0.50/day limit enforcement

### Consequences

**Positive**:
- Memory: -50ms per semantic search on cache hits
- History: -30ms per conversation history fetch on cache hits
- Budget: -15ms per budget check on cache hits
- Total: 95ms reduction on cache hits

**Negative**:
- Memory may be stale up to 15min (acceptable - facts don't change rapidly)
- History may be stale up to 5min (acceptable - within conversation context)
- Budget display may lag 30s (acceptable - checked before every spend)

### Alternatives Considered

1. No caching (always fresh) - Rejected: latency unacceptable
2. Aggressive 30min TTL - Rejected: too stale for budget limits
3. Per-user cache tuning - Rejected: unnecessary complexity for 2-person use

---

## ADR-003: Parallelize WhatsApp API Calls

**Date**: 2026-02-06 23:30
**Status**: Proposed (Phase 2)
**Deciders**: Vercel Edge Runtime best practices validation

### Context

Sequential awaits for independent WhatsApp API calls (markAsRead, reactions) waste 90ms per message. Vercel best practice (async-parallel rule) recommends Promise.allSettled() for independent operations.

### Decision

Parallelize two patterns:
1. markAsRead + reactWithThinking (ai-processing-v2.ts:87-99)
2. sendTextAndPersist + reactWithCheck (ai-processing-v2.ts:171-172)

Use Promise.allSettled() for error isolation (one failure doesn't block other).

### Rationale

- Operations are independent: No shared state, no race conditions
- Failure isolation: Reaction failure shouldn't prevent message send
- Vercel best practice: Parallel async operations reduce latency
- Error handling: Promise.allSettled() prevents cascade failures

### Consequences

**Positive**:
- markAsRead + reactions: -50ms per message
- sendText + reactions: -40ms per response
- Total: 90ms reduction per message

**Negative**:
- Error handling complexity: Must handle Promise.allSettled() results individually
- Debugging: Parallel failures harder to trace (mitigated with detailed logging)

### Alternatives Considered

1. Promise.all() - Rejected: one failure kills all operations
2. Keep sequential - Rejected: unnecessary latency
3. Fire-and-forget reactions - Rejected: no error visibility

---

## ADR-004: WhatsApp API v23 Constraints Documentation

**Date**: 2026-02-06 23:30
**Status**: Approved
**Deciders**: User requirement

### Context

User requested validation: "guarda en tu memoria para futuras implementaciones que todo tiene que ser validado con whatsapp api business v23 que es la que tenemos ahora"

### Decision

Document WhatsApp API v23 constraints in CLAUDE.md:
- NO streaming response support
- 5s Edge Function timeout limit
- Rate limits: 250 msg/sec (token bucket)

### Rationale

- Prevents invalid implementations: No streaming attempts
- Clear constraints: Edge timeout budget enforcement
- Future reference: Constraints preserved across sessions

### Consequences

**Positive**:
- No wasted effort on unsupported features
- Clear boundaries for optimization work
- Reference for future development

**Negative**:
- Streaming response optimization not possible (must find alternatives)

### Alternatives Considered

1. No documentation - Rejected: risk of repeated mistakes
2. Separate doc file - Rejected: CLAUDE.md is authoritative reference

---

## ADR-005: CLAUDE.md Simplification to Orientation Card

**Date**: 2026-02-06 23:45
**Status**: Superseded by ADR-007
**Deciders**: User validation + token economy analysis

### Context

CLAUDE.md infrastructure designed for 5+ developer team with comprehensive module indexes, but actual team is 2 people (ClaudeCode&OnlyMe). User complaint: "CLAUDE.md no sirve para nada" (not useful). Research revealed:
- Automation scripts exist but NOT wired to pre-commit hooks
- File stale since 2026-02-01 (20 commits without updates)
- 250t/week reading 120-line file vs 100t/week for 50-line card (-58% savings)

### Decision

Simplify CLAUDE.md from 120-line comprehensive index to 71-line orientation card containing ONLY:

---

## ADR-008: AI Gateway Mandatory + Gemini Fallback

**Date**: 2026-02-07 12:15
**Status**: Approved
**Deciders**: User + implementation constraints

### Context

Project was using direct provider SDKs (OpenAI/Anthropic/Google) with local API keys. Requirement changed to **AI Gateway mandatory** for all chat models. Claude was deemed too expensive and removed.

### Decision

- Use AI Gateway model strings (e.g. `openai/gpt-4o-mini`, `google/gemini-2.5-flash-lite`).
- Configure Gateway fallback via `providerOptions.gateway.models`.
- Remove Anthropic/Claude from codebase.
- Keep `OPENAI_API_KEY` only for Whisper transcription.

### Rationale

- Centralized routing/auth (Gateway) with OIDC or API key.
- Consistent model selection without local provider SDKs.
- Lower cost fallback (Gemini Flash Lite) vs Claude.
- Simplified provider management and fewer secrets.

### Consequences

**Positive**:
- Single AI Gateway integration path across repo.
- Reduced dependency surface and cost exposure.
- Easier debugging via Gateway metadata.

**Negative**:
- Requires `AI_GATEWAY_API_KEY` or OIDC setup for local dev.
- Provider metadata format is Gateway-specific.

### Alternatives Considered

1. Keep direct OpenAI/Google providers - Rejected (Gateway mandatory requirement).
2. Use @ai-sdk/vercel provider - Rejected (targets v0 API, not AI Gateway).
- TL;DR (5 lines)
- Commands (5 lines)
- Key Files (3 lines)
- Critical Rules (8 lines)
- Stack (4 lines)
- Constraints (5 lines)
- Context Location (5 lines)

DELETE from CLAUDE.md:
- Module indexes (redundant with code)
- Recent security updates (goes to CHANGELOG.md)
- Feature lists (goes to docs/)
- Development workflows (goes to docs/)
- Documentation search order (obvious)

### Rationale

Decision Filter applied:
- Q1 (Real TODAY?): PARTIAL - Tracking files already provide context
- Q2 (Simplest?): NO - Infrastructure requires scripts + hooks + DevOps
- Q3 (2-person maintain?): NO - Automation overhead for 2-person team
- Q4 (Value if never scales?): NO - Only valuable at scale

Result: FAILS Q2 + Q3 - Too complex for 2-person team.

Token economy:
- Before: 250t/week (120 lines, stale)
- After: 100t/week (71 lines, fresh)
- Savings: -58% token cost

### Consequences

**Positive**:
- 58% token reduction per read (250t → 100t)
- Easy manual maintenance (5 min/month vs 30 min/month)
- No stale data (short enough to keep current)
- 2-person friendly (no DevOps overhead)

**Negative**:
- No comprehensive module index (mitigated: code is source of truth)
- Manual updates required (mitigated: rare - only on stack changes)

### Alternatives Considered

1. Keep 120-line CLAUDE.md - Rejected: stale, high token cost, no value
2. Fully automate with hooks - Rejected: overkill for 2-person team, fails Q2+Q3
3. Delete CLAUDE.md entirely - Rejected: orientation card still valuable

---

## ADR-006: CLAUDE.md Prescriptive + Acumulativo

**Date**: 2026-02-07 00:10
**Status**: Superseded by ADR-007
**Deciders**: User feedback + token economy analysis

### Context

ADR-005 simplified CLAUDE.md to 71 lines but user questioned value: "para que te sirve a ti este claude.md?" Critical analysis revealed 53% content was redundant (package.json, tracking files duplicates). User requested prescriptive format with `<must_follow>` blocks and cumulative learnings section.

### Decision

Redesign CLAUDE.md as prescriptive + acumulativo (max 100 lines):

**Structure**:
1. Objetivo (why project exists, <2s latency target)
2. `<must_follow>` block with BLOCKING rules (auto-update protocol, latency priority, API constraints)
3. Commands (npm scripts reference)
4. Stack (tech + budget context)
5. Key Files (architecture pattern)
6. Learnings (ACUMULATIVO - grows with best practices)
7. Non-Inferable Constraints (gotchas by platform)
8. Context Location (tracking files)

**Key Changes**:
- Added `<must_follow>` block (BLOCKING enforcement)
- Added "Auto-Update Protocol" rule (ALWAYS update tracking files + CLAUDE.md)
- Added "Learnings" section (cumulative best practices)
- Added "Objetivo" (why project exists, 2s target)
- Removed redundant info (test counts, versions already in package.json)

### Rationale

**Problem**: CLAUDE.md era descriptivo (decía lo que era) pero no prescriptivo (no decía lo que DEBO hacer)
**Solution**: `<must_follow>` convierte CLAUDE.md en enforcement tool, no solo documentación

**User insight**: "debe haber informacion estrategica que solucione tu amnesia"
- Amnesia causada por NO actualizar tracking files
- Solution: `<must_follow>` rule que me obliga a actualizarlos SIEMPRE

**Token economy**:
- Líneas: 71 → 163 (+130% expansion)
- Tokens: 170t → 390t (+129% expansion)
- BUT: 100% strategic value (no redundancy)
- Learnings section grows over time (cumulative knowledge)

**Decision Filter**:
- Q1 (Real TODAY?): YES - Amnesia es problema real, 2s latency es constraint real
- Q2 (Simplest?): YES - No automation, pure markdown, `<must_follow>` es estándar
- Q3 (2-person maintain?): YES - Append-only learnings, no scripts
- Q4 (Value if never scales?): YES - Prevents re-discovering constraints, cumulative learning

### Consequences

**Positive**:
- `<must_follow>` previene skip de tracking updates (auto-enforcement)
- Learnings section captura best practices descubiertas (no re-inventar)
- Objetivo claro (2s latency target) justifica optimizaciones
- Non-inferable constraints previenen architectural mistakes
- Auto-update reminder en BLOCKING rules (no más amnesia)

**Negative**:
- File más largo (163 líneas vs 71 líneas)
- Más tokens por lectura (390t vs 170t)
- Learnings section crecerá con tiempo (mitigated: max 100 líneas sugiere purge periódico)

### Alternatives Considered

1. Keep 71-line orientation card (ADR-005) - Rejected: no prescriptive, no auto-update enforcement
2. Delete CLAUDE.md use tracking files only - Rejected: tracking files are historical, CLAUDE.md is prescriptive
3. Separate RULES.md file - Rejected: split context, extra file to maintain

---

## ADR-007: CLAUDE.md Focus on "Lo Que OLVIDO" (Final)

**Date**: 2026-02-07 00:15
**Status**: Approved
**Deciders**: User critical feedback

### Context

ADR-006 created 163-line prescriptive CLAUDE.md with learnings section. User feedback: "no nos estamos entendiendo para que esas must_follow... lo del aprendizaje acumulativo te lo borre porque tampoco sirve... esto es una agente ia por whatsapp eso es lo que olvidas y me toca recordarte, para eso es que debe servir ese claude.md... son max 100 lineas".

**Core problem identified**: CLAUDE.md contenía reglas obvias (read files first, small changes) que ya están en global rules. El verdadero propósito es recordarme QUÉ es el proyecto cuando empiezo nueva sesión.

### Decision

CLAUDE.md debe contener SOLO lo que OLVIDO entre sesiones (73 líneas):

**`<must_follow>` block**:
1. Esto es un AGENTE IA POR WHATSAPP (no web app, no chatbot genérico)
2. Objetivo: <2 segundos respuesta
3. WhatsApp API NO soporta streaming
4. Edge Functions: 5s timeout máximo
5. SIEMPRE actualizar tracking files después de cambios

**DELETE**:
- Learnings acumulativos (no sirven según user)
- Reglas obvias (read files first, small changes - ya en global rules)
- Referencias a Bird.com (detalle implementación irrelevante)
- Comandos npm (obvios, están en package.json)
- Información redundante con tracking files

**KEEP**:
- Stack (contexto tech + budget)
- Key files (patrón arquitectónico)
- WhatsApp API constraints (no-inferables)
- Edge Runtime constraints (no-inferables)
- Tracking files reminder

### Rationale

**User insight crítico**: "esto es una agente ia por whatsapp eso es lo que olvidas"

Entre sesiones olvido:
- QUÉ es el proyecto (agente IA por WhatsApp)
- OBJETIVO (<2s latency)
- Constraints no-inferables (NO streaming, 5s timeout)
- Actualizar tracking files

NO necesito recordar:
- Reglas de código (ya en ~/.claude/rules/)
- npm commands (obvios)
- Learnings históricos (no aportan)

**Token economy**:
- ADR-006: 163 líneas, 390t
- ADR-007: 73 líneas, ~175t (-55% reduction)
- Dentro de límite: <100 líneas

**Decision Filter**:
- Q1 (Real TODAY?): YES - Olvido proyecto es agente WhatsApp
- Q2 (Simplest?): YES - Solo lo esencial, sin ruido
- Q3 (2-person maintain?): YES - 73 líneas fácil mantener
- Q4 (Value if never scales?): YES - Previene confusión sobre QUÉ es proyecto

### Consequences

**Positive**:
- 55% token reduction (390t → 175t)
- Foco en lo que REALMENTE olvido (QUÉ es proyecto)
- `<must_follow>` corto (5 puntos vs 12)
- Elimina reglas redundantes con global rules
- Cumple límite <100 líneas

**Negative**:
- No learnings históricos (mitigated: decisions.md tiene ADRs)
- No comandos npm reference (mitigated: obvios, están en package.json)

### Alternatives Considered

1. Keep 163-line ADR-006 - Rejected: learnings no sirven, must_follow con reglas obvias
2. Delete CLAUDE.md - Rejected: necesito recordar QUÉ es proyecto
3. Solo `<must_follow>` sin context - Rejected: necesito constraints no-inferables

---

## ADR-008: SDD Specs Reformation - Individual .md Files from Codebase Audit

**Date**: 2026-02-07 03:05
**Status**: Approved
**Deciders**: User explicit request

### Context

User requested "Inventario SDD Completo para migue.ai" - complete SDD inventory for the project. All 12 features were in production (Step 8) but bypassed Steps 1-7 of SDD lifecycle. Initial approach created directory-based structure with feature_list.json, but user rejected: "ese feature_list.json a mi no me sirve para nada" and explicitly requested "no quiero carpetas quiero un .md por cada spec, que hace, porque, cual es el status actual, logs, nex steps, si esta implementada o no, investiga las mejores practicas, reforma toda la carpeta specs, y crea un .md por cada spec con toda la informacion relevante del codedase, audita el codebase para realizar el inventario".

### Decision

Reformed specs/ folder with individual .md approach:
1. Audit entire codebase using Explore subagent (lib/, app/api/)
2. Create ONE .md file per feature (12 total)
3. Each spec contains: what it does, why it exists, current implementation, files, exports, dependencies, test coverage, ADRs, issues, logs, next steps
4. Extract information from ACTUAL CODE (not theoretical specs)
5. Remove superseded files (feature_list.json, SPEC-INVENTORY-REPORT.md)

### Rationale

**User insight**: "audita el codebase para realizar el inventario"
- Directory-based approach was theoretical (no code audit)
- feature_list.json was JSON structure without implementation details
- User needed REAL implementation details from actual code
- One .md per spec provides comprehensive view in single file

**Codebase audit findings**:
- 12 features identified: ai-processing (1,630 lines), whatsapp-integration (1,500+ lines), reminders (479 lines), calendar-integration (259 lines), memory-system (217 lines), message-processing (627 lines), cost-tracking (569 lines), audio-transcription (98 lines), rate-limiting (134 lines), error-recovery (105 lines), messaging-windows (805 lines), webhook-validation (154 lines)
- All features COMPLETE + SHIPPED (Step 8 - production)
- Test coverage documented per feature
- ADR references extracted from decisions.md
- Implementation details from actual code

### Consequences

**Positive**:
- Comprehensive specs based on REAL code (not theory)
- Single .md per feature (easy navigation)
- Implementation details: files, exports, external dependencies, test coverage
- Production logs and next steps documented
- Superseded files removed (clean structure)

**Negative**:
- Large files (3,675-5,767 lines per spec)
- Manual maintenance required when code changes
- No automation for keeping specs in sync

### Alternatives Considered

1. Directory-based with feature_list.json - Rejected: user stated "no me sirve para nada"
2. Theoretical specs without code audit - Rejected: user requested "audita el codebase"
3. Multiple small files per spec - Rejected: user wanted "un .md por cada spec"

### Implementation

**Specs created** (12 files):
- ai-processing.md (4,330 lines) - P0
- reminders.md (4,939 lines) - P0
- whatsapp-integration.md (5,574 lines) - P0
- calendar-integration.md (5,033 lines) - P1
- memory-system.md (4,431 lines) - P1
- message-processing.md (5,767 lines) - P1
- cost-tracking.md (4,415 lines) - P3
- audio-transcription.md (3,675 lines) - P3
- rate-limiting.md (3,949 lines) - P3
- error-recovery.md (4,351 lines) - P3
- messaging-windows.md (5,717 lines) - P3
- webhook-validation.md (4,797 lines) - P3

**Files removed**:
- specs/feature_list.json (268 lines) - Superseded
- specs/SPEC-INVENTORY-REPORT.md (273 lines) - Superseded

**Total documentation**: ~57,000 lines of comprehensive implementation details
