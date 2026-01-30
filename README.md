# migue.ai - Personal AI Assistant

> Un asistente personal de inteligencia artificial que opera a través de WhatsApp Business API, proporcionando funcionalidades avanzadas de productividad, gestión de citas, análisis de contenido y automatización de tareas diarias.

## Objetivo

Desarrollar un asistente personal de IA disponible 24/7 a través de WhatsApp Business API, que combine la utilidad de Zapia con la sofisticación técnica de Martin, enfocado en el mercado latinoamericano.

## Características Principales

### Gestión de Citas y Reservas
- **Agendamiento 24/7**: Disponibilidad continua para reservas
- **Confirmaciones Automáticas**: Reducción de no-shows
- **Integración Calendario**: Sincronización con Google Calendar/Outlook
- **Recuperación de Cancelaciones**: Reprogramación automática

### Análisis de Contenido Multimodal
- **Transcripción de Audio**: WhatsApp audios a texto
- **Resumen de Videos**: YouTube a resumen textual
- **Análisis de PDFs**: RAG con embeddings + metadata en Supabase
- **Interpretación de Imágenes**: Identificación de productos/información

### Productividad Personal
- **Recordatorios Inteligentes**: Programación con Vercel Cron + Supabase
- **Gestión de Tareas**: Listas y seguimiento
- **Programación de Mensajes**: Envío diferido en WhatsApp
- **Búsqueda de Información**: Noticias, clima, datos en tiempo real

## Arquitectura Técnica

### Stack Tecnológico
- **Frontend/Comunicación**: WhatsApp Business API
- **Backend**: Vercel Edge Functions (serverless)
- **Base de Datos**: Supabase PostgreSQL + Auth (RLS)
- **IA/LLM**: Vercel AI SDK 6.0 (Claude Sonnet 4.5 primary, GPT-4o fallback)
- **OCR**: Tesseract.js (free)
- **Almacenamiento**: Supabase Storage (archivos multimedia)
- **Programación**: Vercel Cron Jobs (recordatorios)
- **Seguridad**: Variables de entorno en Vercel + RLS en Supabase

### Arquitectura Recomendada
```
WhatsApp Business API → Vercel Edge Functions → Supabase → Vercel AI SDK
```

## Análisis de Mercado

- **Mercado Objetivo**: 10K usuarios iniciales en Latinoamérica
- **Competidores**: Zapia (1M+ usuarios), Martin (premium), Meta AI
- **Propuesta de Valor**: Alta utilidad gratuita + latencia ultra-baja (1-2 segundos)

## Estado del Proyecto

**CURRENT STATE**: Landing page only (fresh start 2026-01-29)
**NEXT**: Phase 1 MVP implementation (35 tasks)

### Previous Implementation (Archived)
- DONE: Documentation and analysis
- DONE: Vercel + Supabase architecture
- DONE: Production deployment
- DONE: Edge Functions configured
- ARCHIVED: Previous code in .archive/2026-01-28-full-archive/

### Fresh Start Approach (SDD Methodology)
**Status**: Specifications 100% complete, code 1% (landing page)
**Reason**: Previous implementation had critical errors (ADR-001)
**Strategy**: Spec-first, test-driven, incremental implementation

See specs/README.md for implementation plan.

## Vercel AI SDK Integration

**Status:** Core dependency installed (v6.0.62)
**Provider:** Claude Sonnet 4.5 (primary), GPT-4o (fallback)
**Goal:** Multi-provider AI with tool orchestration, streaming, caching

### Benefits
- **Multi-provider**: Automatic fallback Claude to OpenAI
- **Streaming**: Real-time responses (<1s perceived latency)
- **Tool orchestration**: 20+ tools (calendar, reminders, expenses)
- **Cost tracking**: Per-user token budget enforcement
- **Caching**: Prompt caching reduces costs 60-70%

### Implementation Status
- INSTALLED: ai@6.0.62, @ai-sdk/anthropic@3.0.31, @ai-sdk/openai@3.0.23
- PENDING: Tool definitions, circuit breaker, cost tracking
- REFERENCE: specs/ai-agent-system/

## Estructura del Proyecto

```
migue.ai/
├── app/                            # Next.js App Router
│   ├── components/                 # Landing page components (9 files)
│   ├── page.tsx                    # Landing page
│   └── layout.tsx                  # Root layout
├── specs/                          # SDD specifications (6 features)
│   ├── whatsapp-webhook/           # P0: Webhook + HMAC + normalization
│   ├── ai-agent-system/            # P0: Vercel AI SDK + tools
│   ├── database-foundation/        # P0: Supabase + RLS + pgvector
│   ├── reminder-automation/        # P1: Reminders + Calendar sync
│   ├── whatsapp-flows/             # P2: Interactive UX
│   └── observability/              # P2: Monitoring + cost tracking
├── docs/                           # Technical documentation
│   ├── architecture/               # System design docs
│   ├── features/                   # Feature specifications
│   ├── patterns/                   # Implementation patterns
│   └── research/                   # Market analysis
├── .claude/                        # Claude tracking files
│   ├── plan.md                     # Current plan
│   ├── status.md                   # Project status
│   ├── todo.md                     # Task list
│   ├── decisions.md                # ADRs
│   └── CHANGELOG.md                # Granular changelog
├── .archive/                       # Archived implementations
│   └── 2026-01-28-full-archive/    # Previous code
├── public/                         # Static assets
├── CLAUDE.md                       # Claude Code guide
└── README.md                       # This file
```

## Modelo de Costos Estimado

### Costos Fijos (Mensual)
- **Vercel Pro**: $20/mes (Edge Functions, Analytics, Cron)
- **Supabase Pro**: $25/mes (PostgreSQL + Auth + Storage)
- **Total Fijo**: $45/mes

### Costos Variables (10K usuarios activos)
- **Anthropic API**: $15-25/mes (Claude Sonnet 4.5)
  - Input: $3/1M tokens
  - Output: $15/1M tokens
  - Caching: 90% discount on cached tokens
- **OpenAI API (fallback)**: $5-10/mes (GPT-4o)
  - Input: $2.50/1M tokens
  - Output: $10/1M tokens
- **WhatsApp Templates**: $10-30/mes (outside messaging windows)
  - Marketing: $0.005-$0.08 per message
  - Service: Free within 24h window

### Estrategia de Optimización
- **Customer Service Window**: 24h free per conversation
- **Entry Point Window**: 72h free with Click-to-WhatsApp
- **Prompt caching**: 60-70% cost reduction
- **Multi-provider failover**: Use cheaper provider when possible
- **Template monitoring**: Track billable messages

**Total Estimado**: $75-120/mes (all services included)

## Métricas de Éxito

### Técnicas
- **Latency p95**: <3s AI response
- **Availability**: >99.9%
- **Error rate**: <1%
- **Throughput**: 1000+ messages/hour

### De Negocio
- **Active users**: Growth targets
- **Retention**: >70% after 30 days
- **Satisfaction**: >4.5/5 in feedback
- **Cost per user**: <$2/mes

## Quick Start

### 1. Installation
```bash
bun install  # or npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and configure:
```bash
# WhatsApp Business API
WHATSAPP_TOKEN=your_token
WHATSAPP_PHONE_ID=your_phone_id
WHATSAPP_VERIFY_TOKEN=your_verify_token
WHATSAPP_APP_SECRET=your_app_secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# AI Providers
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key

# Configuration
TIMEZONE=America/Mexico_City
NODE_ENV=development
```

### 3. Database Setup
```bash
# Initialize Supabase project
npx supabase init

# Run migrations
npx supabase db push
```

### 4. Development
```bash
bun run dev        # Development server
bun run build      # Production build
bun run lint       # Check code with Biome
bun run lint:fix   # Auto-fix with Biome
```

### 5. Available Endpoints (Future)
- `GET /api/whatsapp/webhook` - Webhook verification
- `POST /api/whatsapp/webhook` - Message reception
- `POST /api/whatsapp/send` - Message sending
- `GET /api/cron/check-reminders` - Daily cron (9 AM UTC)

## Roadmap

### Phase 1: MVP (Weeks 1-3) - PENDING
- [ ] Database foundation (14 tables, RLS, pgvector)
- [ ] WhatsApp webhook (HMAC, normalization, fire-forget)
- [ ] AI agent system (Vercel AI SDK, 20+ tools, circuit breaker)
- [ ] Basic reminders (create, list, delete)
- [ ] Calendar integration (Google Calendar OAuth)

See specs/whatsapp-webhook/TASKS.md for detailed breakdown (35 tasks).

### Phase 2: Features (Weeks 4-5) - PENDING
- [ ] Automated reminders (cron jobs)
- [ ] Calendar bidirectional sync
- [ ] 24h messaging window tracking
- [ ] Expense tracking
- [ ] Task management

See specs/reminder-automation/TASKS.md for details (6 tasks).

### Phase 3: Advanced (Weeks 6-8) - PENDING
- [ ] WhatsApp Flows v3 (interactive UX)
- [ ] Cost tracking per user
- [ ] Dead letter queue (DLQ)
- [ ] Observability (metrics, alerts)
- [ ] RAG system (pgvector semantic search)

See specs/whatsapp-flows/, specs/observability/ for details (9 tasks).

## Configuration

### Stack Versions
- Next.js: 15.1.6
- React: 19.2.3
- TypeScript: 5.7.3
- Vercel AI SDK: 6.0.62
- Anthropic SDK: 3.0.31
- OpenAI SDK: 3.0.23
- Supabase: 2.93.3
- Biome: 1.9.4
- Bun: 1.3.5

### Decision Log
See .claude/decisions.md for all architectural decisions (ADRs):
- ADR-001: Fresh start strategy
- ADR-002: Biome for linting
- ADR-003: Bun as package manager
- ADR-004: Vercel AI SDK multi-provider

## Testing & Security

### Testing Strategy
- **Unit Tests**: Vitest for business logic
- **Integration Tests**: API route testing
- **E2E Tests**: Playwright for complete flows
- **Coverage**: Minimum 80% for critical modules

See specs/*/TESTPLAN.md for test specifications.

### Security Features
- **RLS**: Row Level Security on all user-facing tables
- **HMAC validation**: Webhook signature verification
- **Input sanitization**: Zod validation on all endpoints
- **Environment**: Secure variables in Vercel (never in code)
- **Rate limiting**: Vercel Edge middleware

See specs/whatsapp-webhook/SPEC.md L47-89 for security details.

## Documentation

### Project Documentation
- [CLAUDE.md](./CLAUDE.md) - Claude Code guide
- [specs/README.md](./specs/README.md) - SDD specifications index
- [.claude/status.md](./.claude/status.md) - Current project status
- [.claude/decisions.md](./.claude/decisions.md) - Architecture decisions

### Technical Research
- [docs/architecture/](./docs/architecture/) - System design
- [docs/features/](./docs/features/) - Feature specifications
- [docs/patterns/](./docs/patterns/) - Implementation patterns
- [docs/research/](./docs/research/) - Market analysis

### External APIs
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [Supabase Documentation](https://supabase.com/docs)
- [Anthropic API](https://docs.anthropic.com)
- [OpenAI API](https://platform.openai.com/docs)

## Contributing

This project follows best practices defined in CLAUDE.md and docs-global standards.

### Development Standards
1. **Read first**: Read complete files before modifying
2. **Small commits**: Keep changes small and safe
3. **Document decisions**: Record decisions in .claude/decisions.md
4. **Testing**: Include tests for new code
5. **Security**: Never commit secrets
6. **Format**: Use Biome for linting and formatting

### Code Limits
- File: ≤300 LOC
- Function: ≤50 LOC
- Parameters: ≤5
- Cyclomatic complexity: ≤10

### Commit Message Format
```
type(scope): brief description

- Detailed change 1
- Detailed change 2

Generated with Neero.ai & Claude Code
```

## License

[To be defined]

## Contact

- **Project**: migue.ai Personal Assistant
- **Status**: Fresh start - Specifications complete, ready for Phase 1
- **Version**: 2.0
- **Team**: ClaudeCode&OnlyMe (2-person team)
- **Last updated**: 2026-01-30

### Recent Changes
- DONE: Fresh start strategy (ADR-001)
- DONE: Biome linting setup (ADR-002)
- DONE: Bun package manager (ADR-003)
- DONE: Core dependencies installed
- DONE: SDD specifications (6 features, 2360 LOC)
- DONE: Landing page implementation
- PENDING: Phase 1 MVP (35 tasks)

---

**Developed for optimizing personal productivity through conversational AI**
