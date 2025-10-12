# Agent Delegation Matrix

**Project**: migue.ai WhatsApp AI Assistant
**Framework**: CLAUDE-MASTER v2.0
**Last Updated**: 2025-10-03

---

## Agent Selection Strategy

### Model Economics
- **Claude Sonnet 4**: $3 per 1M input tokens, $15 per 1M output tokens
- **Claude Opus 4.1**: $15 per 1M input tokens, $75 per 1M output tokens
- **Cost Ratio**: Opus is 5x more expensive

**General Rule**: Use Sonnet for routine tasks, Opus for complex architecture/design

---

## Delegation Matrix

| Task Category | Agent | Model | Rationale | Trigger Keywords |
|--------------|-------|-------|-----------|-----------------|
| **Full-Stack Development** | senior-dev | Opus | Complete feature implementation end-to-end, 360° platform orchestration, roadmap execution | "implement feature", "end-to-end", "full-stack", "integrate platforms", "follow roadmap", "complete phase" |
| **Frontend Development** | frontend-developer | Sonnet | UI work is mostly routine | "React", "component", "UI", "CSS", "responsive" |
| **Backend API** | backend-developer | Sonnet | CRUD operations standard | "API", "endpoint", "route", "database query" |
| **Database Architecture** | database-architect | Opus | Complex architecture decisions, greenfield design | "database architecture", "schema design", "data modeling", "technology selection", "migration strategy", "sharding", "normalization" |
| **Edge Functions** | edge-functions-expert | Sonnet | Edge Runtime patterns established | "edge function", "edge runtime", "vercel edge", "cold start", "bundle size" |
| **WhatsApp Integration** | whatsapp-api-expert | Sonnet | WhatsApp API patterns well-documented | "whatsapp", "interactive message", "flows", "webhook", "media message" |
| **TypeScript Architecture** | typescript-pro | Opus | Complex type systems need deep reasoning | "type safety", "generics", "architecture", "refactor" |
| **AI/ML Features** | ai-engineer | Opus | LLM integration complex | "OpenAI", "RAG", "embeddings", "streaming", "Whisper" |
| **Testing** | general-purpose | Sonnet | Test writing mostly mechanical | "test", "spec", "coverage", "jest" |
| **Code Review** | code-reviewer | Opus | Deep analysis required | "/review", "security", "vulnerability" |
| **Documentation** | general-purpose | Sonnet | Writing docs straightforward | "README", "documentation", "guide" |
| **Deployment** | general-purpose | Sonnet | Following deployment checklist | "deploy", "Vercel", "build" |
| **Research** | research-analyst | Sonnet | Information gathering | "research", "analyze", "investigate" |
| **Prompt Engineering** | prompt-engineer | Opus | LLM optimization critical | "prompt", "system message", "context" |
| **Diagrams** | mermaid-expert | Sonnet | Technical diagramming | "flowchart", "diagram", "architecture diagram" |
| **Project Management** | claude-master | Opus | Strategic planning | "/clear", "roadmap", "phase planning" |

---

## Task-Specific Delegation

### Fase 2 Feature Development

#### Full-Stack Feature Implementation
**Agent**: `senior-dev` (Opus)
**Reason**: Complex end-to-end implementation requiring 360° platform orchestration
**Scope**:
- Complete feature development (backend + frontend + database + tests)
- Multi-platform integration (Next.js + Vercel + Supabase + WhatsApp + AI)
- Roadmap-driven execution (strict phase adherence)
- Personality-first implementation (Eficientemente Amigable, Proactivo con Límites, Colombianamente Natural)
- Production deployment with monitoring

**Use Cases**:
- Implementing Fase 2/3/4 features as per roadmap
- Features requiring all 5 platforms (e.g., Daily Briefings: Cron + WhatsApp + Supabase + AI)
- Features needing architectural decisions aligned with roadmap
- Complex integrations (e.g., Google Calendar OAuth + reminders + AI scheduling)

**Delegation Command**:
```
/task senior-dev "Implement Daily Briefings feature (Fase 3) end-to-end: Create SERVICE template, aggregate reminders/meetings/expenses from Supabase, generate brief message with Gemini, schedule cron 7am Bogotá, write 10+ tests, validate personality consistency, deploy with monitoring."
```

**When NOT to use**:
- Platform-specific optimization (use specialized agent: gemini-expert, whatsapp-api-expert, etc.)
- Routine tasks (use general-purpose)
- Research (use research-analyst)
- Code review (use code-reviewer)

---

#### Audio Transcription
**Agent**: `ai-engineer` (Opus)
**Reason**: Complex ML integration with Whisper API, Edge Runtime constraints
**Scope**:
- Whisper API integration
- WhatsApp Media API handling
- Supabase storage setup
- Error handling for audio formats
- Background processing design

**Delegation Command**:
```
/task ai-engineer "Implement audio transcription feature with Whisper API, WhatsApp audio download, and Supabase storage. Follow Edge Runtime constraints."
```

---

#### Streaming Responses
**Agent**: `ai-engineer` (Opus)
**Reason**: OpenAI streaming + Edge Functions require deep understanding
**Scope**:
- OpenAI streaming API implementation
- Edge Runtime SSE (Server-Sent Events)
- WhatsApp message chunking algorithm
- Backpressure management
- Connection error handling

**Delegation Command**:
```
/task ai-engineer "Implement streaming responses for OpenAI in Edge Functions with WhatsApp chunking (1600 char limit) and error recovery."
```

---

#### RAG Implementation
**Agent**: `ai-engineer` (Opus)
**Reason**: Vector search, embeddings, and LLM context injection complex
**Scope**:
- Supabase pgvector setup
- Document ingestion pipeline
- Semantic search optimization
- Context injection strategy
- Knowledge base management API

**Delegation Command**:
```
/task ai-engineer "Complete RAG implementation with pgvector, document ingestion, and semantic search. Target <200ms retrieval latency."
```

---

#### Edge Functions Development
**Agent**: `edge-functions-expert` (Sonnet)
**Reason**: Edge Runtime requires specific patterns and optimizations
**Scope**:
- Edge Function creation/modification
- Node.js to Edge Runtime migration
- Performance optimization (cold start, bundle size)
- Streaming responses implementation
- HMAC signature validation
- WhatsApp webhook optimization

**Delegation Command**:
```
/task edge-functions-expert "Optimize WhatsApp webhook Edge Function for <100ms cold start and implement streaming responses with chunking."
```

---

#### WhatsApp Integration Development
**Agent**: `whatsapp-api-expert` (Sonnet)
**Reason**: WhatsApp API v23.0 requires specific patterns and compliance
**Scope**:
- Interactive message implementation (buttons, lists, reactions)
- WhatsApp Flows (navigate and data exchange)
- Webhook processing with 5s timeout compliance
- Media message handling (audio, images, documents)
- Rate limiting (250 msg/sec) implementation
- Template message management
- Signature validation (HMAC-SHA256)
- Deduplication strategies

**Delegation Command**:
```
/task whatsapp-api-expert "Implement appointment booking WhatsApp Flow with real-time availability checks via data exchange endpoint."
```

---

#### UI Components (if needed)
**Agent**: `frontend-developer` (Sonnet)
**Reason**: React components straightforward
**Scope**:
- Admin dashboard components
- Document upload UI
- Settings page

**Delegation Command**:
```
/task frontend-developer "Create admin dashboard with document upload UI and settings page using Next.js 15 App Router."
```

---

### Code Quality & Review

#### Pre-Deployment Code Review
**Agent**: `code-reviewer` (Opus)
**Reason**: Security and production readiness critical
**Scope**:
- Security vulnerability scan
- Performance optimization review
- TypeScript type safety audit
- Edge Runtime compatibility check
- Best practices validation

**Delegation Command**:
```
/task code-reviewer "Review all Fase 2 code changes for security vulnerabilities, performance issues, and production readiness."
```

---

#### Unit Testing
**Agent**: `general-purpose` (Sonnet)
**Reason**: Test writing mostly mechanical
**Scope**:
- Unit tests for new features
- Edge Runtime test setup
- Mocking strategies
- Coverage reports

**Delegation Command**:
```
/task general-purpose "Write comprehensive unit tests for audio transcription, streaming, and RAG features using Jest + Edge Runtime."
```

---

### Documentation & Research

#### API Documentation
**Agent**: `api-documenter` (Sonnet)
**Reason**: API docs generation automated
**Scope**:
- OpenAPI schema updates
- Endpoint documentation
- Request/response examples
- Error code documentation

**Delegation Command**:
```
/task api-documenter "Generate OpenAPI documentation for all new Fase 2 API endpoints with examples and error codes."
```

---

#### Technical Research
**Agent**: `research-analyst` (Sonnet)
**Reason**: Information gathering straightforward
**Scope**:
- WhatsApp API updates research
- OpenAI new features analysis
- Vercel Edge Functions best practices
- Competitor analysis

**Delegation Command**:
```
/task research-analyst "Research WhatsApp API v23.0 new features and provide recommendations for integration."
```

---

### Architecture & Design

#### System Architecture Design
**Agent**: `typescript-pro` (Opus)
**Reason**: Complex type systems and architecture patterns
**Scope**:
- Type-safe architecture patterns
- Module dependency design
- Interface contracts
- Generics and advanced types

**Delegation Command**:
```
/task typescript-pro "Design type-safe architecture for RAG document ingestion with proper abstractions and error handling."
```

---

#### Database Architecture Design
**Agent**: `database-architect` (Opus)
**Reason**: Complex architecture decisions, technology selection, greenfield design
**Scope**:
- Technology selection (SQL vs NoSQL, database choice)
- Schema design from scratch
- Normalization strategy (1NF-5NF)
- Indexing strategy (B-tree, GIN, HNSW)
- Sharding/partitioning design
- Migration planning (zero-downtime strategies)
- Multi-tenancy architecture
- Scalability design (replication, caching)
- Data consistency patterns (ACID, eventual consistency)

**Delegation Command**:
```
/task database-architect "Design database architecture for multi-tenant SaaS platform with pgvector semantic search, 100K users, and global distribution requirements."
```

**When to use database-architect vs supabase-expert:**
- **database-architect**: Greenfield design, technology selection, major re-architecture
- **supabase-expert**: Implementing/optimizing existing migue.ai Supabase database

---

#### Database Implementation
**Agent**: `supabase-expert` (Sonnet)
**Reason**: Implementation and optimization of existing migue.ai database
**Scope**:
- Query optimization
- RLS policy tuning
- Adding indexes to existing tables
- Custom functions and triggers
- pgvector semantic search implementation

**Delegation Command**:
```
/task supabase-expert "Optimize RLS policies for messages_v2 table to reduce query latency from 200ms to <50ms."
```

---

## Parallel Execution Strategy

### When to Run Agents in Parallel
Use parallel execution when tasks are **independent** and can be completed simultaneously.

**Example: Fase 2 Development**
```
# Run 3 agents in parallel
/task ai-engineer "Implement audio transcription"
/task ai-engineer "Implement streaming responses"
/task backend-developer "Setup pgvector database schema"
```

**Benefits**:
- Faster completion (3x speed)
- Independent task isolation
- Parallel testing

**Caution**: Don't parallelize dependent tasks (e.g., tests before implementation)

---

### Sequential Execution
Use sequential when tasks have **dependencies**.

**Example: Deployment Pipeline**
```
1. /task code-reviewer "Review Fase 2 code"
2. Wait for review completion
3. /task general-purpose "Run all tests"
4. Wait for tests to pass
5. /task general-purpose "Deploy to production"
```

---

## Cost Optimization

### Session Budget Allocation
**Target**: <$0.50 per task (average)

**Sonnet Tasks**: $0.10-0.20 per task
- Frontend components
- Backend CRUD
- Unit tests
- Documentation

**Opus Tasks**: $0.30-0.80 per task
- Architecture design
- AI/ML integration
- Security review
- Complex refactoring

### Monthly Budget
**Total**: ~$45/month for development
- 150 Sonnet tasks @ $0.15 avg = $22.50
- 30 Opus tasks @ $0.50 avg = $15.00
- Ad-hoc sessions = $7.50
- **Total**: $45/month ✅ (well under budget)

---

## Decision Tree

```mermaid
graph TD
    A[New Task] --> B{Task Type?}

    B -->|UI/Frontend| C[frontend-developer<br/>Sonnet]
    B -->|API/Backend| D{Complex?}
    B -->|Database| DB{Greenfield or Major Re-arch?}
    B -->|Edge Functions| E1[edge-functions-expert<br/>Sonnet]
    B -->|WhatsApp| W1[whatsapp-api-expert<br/>Sonnet]
    B -->|AI/ML| E[ai-engineer<br/>Opus]
    B -->|Testing| F[general-purpose<br/>Sonnet]
    B -->|Review| G[code-reviewer<br/>Opus]
    B -->|Docs| H{Technical?}
    B -->|Architecture| I[typescript-pro<br/>Opus]

    D -->|No| J[backend-developer<br/>Sonnet]
    D -->|Yes| K[typescript-pro<br/>Opus]

    DB -->|Yes: New Schema/<br/>Technology Selection| DBA[database-architect<br/>Opus]
    DB -->|No: Existing Schema/<br/>Optimization| SBE[supabase-expert<br/>Sonnet]

    H -->|API| L[api-documenter<br/>Sonnet]
    H -->|General| M[general-purpose<br/>Sonnet]

    E --> N{RAG/Embeddings?}
    N -->|Yes| O[Opus Required]
    N -->|No| P{Streaming?}
    P -->|Yes| O
    P -->|No| O

    E1 --> Q{Edge Runtime?}
    Q -->|Migration| R[Node.js to Edge<br/>Migration]
    Q -->|Optimization| S[Cold Start/<br/>Bundle Size]
    Q -->|Streaming| T[SSE/Chunking]

    W1 --> U{WhatsApp Feature?}
    U -->|Interactive| V[Buttons/Lists/<br/>Reactions]
    U -->|Flows| X[Navigate/<br/>Data Exchange]
    U -->|Webhook| Y[5s Timeout/<br/>Deduplication]
    U -->|Media| Z[Audio/Image/<br/>Transcription]

    DBA --> DBA1{Database Decision?}
    DBA1 -->|Schema Design| DBA2[Normalization/<br/>Relationships]
    DBA1 -->|Technology| DBA3[SQL/NoSQL/<br/>Selection]
    DBA1 -->|Migration| DBA4[Zero-Downtime/<br/>Strategy]
    DBA1 -->|Scalability| DBA5[Sharding/<br/>Replication]
```

---

## Agent Specializations

### senior-dev (Opus)
**Expertise**:
- Full-stack feature implementation (backend + frontend + database + tests)
- 360° platform orchestration (Next.js 15, Vercel Edge, Supabase, WhatsApp v23, Gemini 2.5 Flash)
- Roadmap-driven development (strict phase-by-phase execution)
- Personality-first implementation (Eficientemente Amigable, Proactivo con Límites, Colombianamente Natural)
- Multi-platform integration (5 platforms working together)
- Production deployment with monitoring and cost validation

**Use For**:
- Complete feature development (end-to-end)
- Following roadmap phases (Fase 2, Fase 3, etc.)
- Integrating multiple platforms in single feature
- Features requiring all 5 platforms
- Architectural decisions aligned with roadmap
- Complex integrations (Google Calendar, payment systems, etc.)

**Avoid For**:
- Platform-specific optimizations (use specialized agent)
- Routine tasks (use general-purpose)
- Research or documentation (use research-analyst, api-documenter)
- Code reviews (use code-reviewer)

---

### ai-engineer (Opus)
**Expertise**:
- OpenAI API integration (GPT-4o, Whisper, Embeddings)
- RAG systems (vector search, chunking, retrieval)
- Streaming implementations
- LLM prompt engineering
- Edge Runtime ML optimizations

**Use For**:
- Audio transcription feature
- Streaming responses
- RAG implementation
- OpenAI API optimization
- Vector database setup

**Avoid For**:
- Simple API endpoints
- UI components
- Basic CRUD operations

---

### typescript-pro (Opus)
**Expertise**:
- Advanced TypeScript patterns
- Generics and conditional types
- Strict mode configurations
- Type-safe architecture
- Complex refactoring

**Use For**:
- Architecture design
- Type system refactoring
- Complex interface design
- Generic utilities
- Type safety audits

**Avoid For**:
- Simple type definitions
- Component props typing
- Basic interfaces

---

### frontend-developer (Sonnet)
**Expertise**:
- React 19 components
- Next.js 15 App Router
- Tailwind CSS
- Client-side state management
- Responsive design

**Use For**:
- UI components
- Dashboard pages
- Form handling
- Client-side logic
- CSS/styling

**Avoid For**:
- Backend logic
- Database operations
- Complex type systems

---

### backend-developer (Sonnet)
**Expertise**:
- API route handlers
- Database queries
- Supabase RLS
- Edge Functions
- Server-side logic

**Use For**:
- REST API endpoints
- Small database changes (add columns, simple tables)
- Query optimization
- Server middleware
- Cron jobs

**Avoid For**:
- Complex ML integration
- Advanced architecture
- UI development
- Greenfield database design (use database-architect)

---

### database-architect (Opus)
**Expertise**:
- Database technology selection (SQL/NoSQL/TimeSeries)
- Schema design from scratch (normalization, relationships)
- Indexing strategy (B-tree, GIN, HNSW, partial, composite)
- Scalability patterns (sharding, partitioning, replication)
- Migration planning (zero-downtime, large-scale)
- Multi-tenancy architecture
- Data consistency models (ACID, BASE, eventual consistency)
- Caching architecture (Redis, materialized views)
- Security design (RLS, encryption, audit logging)
- Compliance patterns (GDPR, HIPAA, PCI-DSS)

**Use For**:
- Designing database architecture from scratch
- Choosing database technology for new project
- Planning major re-architecture (monolith to microservices)
- Designing sharding/partitioning strategy
- Planning complex migrations
- Multi-tenancy architecture decisions
- Data modeling for new features
- Schema design for greenfield projects

**Avoid For**:
- Optimizing existing queries (use supabase-expert)
- Small schema changes (use backend-developer)
- Application logic (use backend-developer)
- Routine database operations

---

### edge-functions-expert (Sonnet)
**Expertise**:
- Vercel Edge Functions
- Edge Runtime APIs (Web APIs, Web Crypto)
- Performance optimization (cold start, bundle size, memory)
- Streaming responses (SSE, ReadableStream)
- Node.js to Edge migration patterns
- WhatsApp webhook optimization
- Security patterns (HMAC, rate limiting)

**Use For**:
- Creating/modifying Edge Functions
- Optimizing cold start performance
- Converting Node.js code to Edge Runtime
- Implementing streaming responses
- Fixing Edge Runtime compatibility issues
- Reducing bundle size
- WhatsApp 5s timeout compliance

**Avoid For**:
- Frontend UI components
- Complex database schema design
- Advanced TypeScript architecture

---

### whatsapp-api-expert (Sonnet)
**Expertise**:
- WhatsApp Business API v23.0 (Cloud API)
- Interactive messages (buttons, lists, reactions, typing indicators)
- WhatsApp Flows v3 (navigate and data exchange modes)
- Webhook processing (5s timeout, signature validation)
- Media handling (audio transcription, images, documents)
- Template messages and multi-product broadcasts
- Rate limiting (250 msg/sec) and retry strategies
- Error recovery and deduplication

**Use For**:
- Implementing interactive messaging features
- Creating WhatsApp Flows for forms/booking
- Optimizing webhook handlers
- Processing media messages (audio, images)
- Managing template broadcasts
- Rate limiting and API compliance
- Webhook signature validation
- Fixing WhatsApp API errors

**Avoid For**:
- Edge Runtime optimization (use edge-functions-expert)
- AI/ML integration (use ai-engineer)
- Database schema design (use backend-developer)

---

### code-reviewer (Opus)
**Expertise**:
- Security vulnerability detection
- Performance optimization
- Production readiness checks
- Best practices validation
- Code quality analysis

**Use For**:
- Pre-deployment reviews
- Security audits
- Performance analysis
- Refactoring recommendations
- Critical bug investigations

**Avoid For**:
- Routine code changes
- Simple bug fixes
- Documentation updates

---

### general-purpose (Sonnet)
**Expertise**:
- General development tasks
- Testing
- Documentation
- Research
- Deployment

**Use For**:
- Unit test writing
- README updates
- Simple research
- Deployment scripts
- Configuration changes

**Avoid For**:
- Complex architecture
- AI/ML integration
- Security-critical reviews

---

## Escalation Rules

### When to Escalate to Opus

1. **Complexity Threshold Exceeded**
   - Task requires >2 hours of Sonnet time
   - Multiple Sonnet attempts failed
   - Architecture decision needed

2. **High-Impact Changes**
   - Security-critical code
   - Database schema migrations
   - API breaking changes
   - Production deployment issues

3. **Deep Reasoning Required**
   - Complex debugging
   - Performance optimization
   - Algorithm design
   - System design decisions

### When to Downgrade to Sonnet

1. **Routine Implementation**
   - Architecture decided, just implement
   - Following established patterns
   - Repetitive tasks

2. **Low-Risk Changes**
   - Documentation updates
   - Test additions
   - UI tweaks
   - Config changes

---

## Session Management

### Handoff Protocol
When delegating to an agent, provide:

1. **Clear Objective**: What needs to be done
2. **Context**: Reference to current phase/feature
3. **Constraints**: Budget, time, technical limits
4. **Success Criteria**: How to know it's done
5. **Files to Focus**: Specific file paths

**Example Handoff**:
```
/task ai-engineer "
Objective: Implement audio transcription for WhatsApp voice messages

Context:
- Fase 2 feature development
- Part of core features milestone
- See .claude/phases/current.md for details

Constraints:
- Must work in Vercel Edge Runtime
- <3s transcription time target
- Budget: <$1/day for Whisper API

Success Criteria:
- Audio downloaded from WhatsApp Media API
- Stored in Supabase storage
- Transcribed with Whisper
- Text returned to user
- Tests passing

Files:
- lib/transcription.ts (exists, incomplete)
- app/api/whatsapp/webhook/route.ts (add audio handler)
- tests/unit/transcription.test.ts (create)
"
```

---

## Checkpoints & Recovery

### Checkpoint Before Delegation
Before delegating complex tasks, create checkpoint:

```bash
git add .
git commit -m "checkpoint: before audio transcription implementation"
git tag checkpoint-audio-transcription-$(date +%Y%m%d)
```

### Recovery After Failed Delegation
If agent fails or produces incorrect results:

1. Restore from checkpoint: `git reset --hard checkpoint-*`
2. Review agent output for lessons
3. Refine task description
4. Consider escalating to Opus (if was Sonnet)
5. Break task into smaller pieces

---

## Best Practices

### DO
✅ Use Sonnet for routine tasks (80% of work)
✅ Reserve Opus for complex/critical tasks (20% of work)
✅ Use **database-architect** for greenfield database design and major re-architecture
✅ Use **supabase-expert** for optimizing existing migue.ai Supabase database
✅ Provide clear context and constraints
✅ Checkpoint before major delegations
✅ Run independent tasks in parallel
✅ Review agent output before merging

### DON'T
❌ Use Opus for simple tasks (waste of budget)
❌ Use **database-architect** for small schema changes (use backend-developer or supabase-expert)
❌ Use **backend-developer** for complex database architecture (use database-architect)
❌ Delegate without clear success criteria
❌ Run dependent tasks in parallel
❌ Skip checkpoints on critical changes
❌ Blindly trust agent output (always review)

---

## Metrics & Optimization

### Track Delegation Success
- Agent selection accuracy (right agent for task)
- First-time success rate (no retries needed)
- Cost per task (vs budget)
- Time to completion
- Code quality of output

### Monthly Review
- Adjust delegation rules based on outcomes
- Update cost estimates
- Refine agent descriptions
- Add new agents if needed

---

**Last Updated**: 2025-10-03
**Next Review**: 2025-11-01
**Owner**: claude-master
