# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

migue.ai is a personal AI assistant that operates through WhatsApp Business API, providing advanced productivity features, appointment management, content analysis, and daily task automation. The project targets the Latin American market and combines the utility of Zapia with the technical sophistication of Martin.

## Development Commands

### Building and Type Checking
```bash
npm run build          # Compile TypeScript to dist/
npm run typecheck      # Type check without emitting files
npm run lint           # Type check without emitting (alias)
```

### Development and Deployment
```bash
npm run dev            # Start Vercel development server
npm run start          # Start Vercel development server (alias)
vercel dev             # Direct Vercel development command
```

### Testing
```bash
npm run test           # Run all tests with Jest
npm run test:unit      # Run unit tests only
npm run test:e2e       # Run e2e tests with Playwright
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate test coverage report
```

### Utilities
```bash
npm run clean          # Clean build artifacts (dist, .vercel, coverage)
npm run setup          # Install dependencies and run type check
npm install            # Install deps (runs playwright install automatically)
```

## Architecture Overview

### Technology Stack
- **Runtime**: Vercel Edge Functions (serverless, Node.js 20.x)
- **Database**: Supabase PostgreSQL with RLS (Row Level Security)
- **AI/LLM**: OpenAI API (GPT-4o, Whisper, Embeddings)
- **Storage**: Supabase Storage for multimedia files
- **Scheduling**: Vercel Cron Jobs for reminders
- **Type System**: TypeScript 5.9.2 with strict configuration
- **Testing**: Jest (unit), Playwright (e2e), Supertest (integration)
- **Validation**: Zod for runtime type validation

### Core Architecture Pattern
```
WhatsApp Business API → Vercel Edge Functions → Supabase → OpenAI API
```

### Message Processing Flow
1. **Reception**: Webhook at Vercel Edge Function (orquestación)
2. **Processing**: Intent recognition with OpenAI (NLP ligero)
3. **Persistence**: Supabase with RLS (contexto de sesión)
4. **Generation**: OpenAI API → Respuesta
5. **Sending**: WhatsApp Business API delivery

### Directory Structure
```
migue.ai/
├── api/                    # Vercel Edge Functions
│   ├── whatsapp/          # WhatsApp webhook and messaging
│   └── cron/              # Scheduled tasks (daily reminders)
├── lib/                   # Shared utilities
│   ├── supabase.ts        # Supabase client configuration
│   └── persist.ts         # Data persistence utilities
├── types/                 # TypeScript type definitions
│   └── env.d.ts          # Environment variable types
├── docs/                  # Project documentation
├── supabase/             # Database schema and migrations
│   ├── schema.sql        # Tables, types, and extensions
│   └── security.sql      # RLS policies
├── tests/                # Test suites
│   ├── unit/            # Unit tests (Jest)
│   └── e2e/             # End-to-end tests (Playwright)
├── .cursor/              # IDE rules and configuration
├── jest.config.js        # Jest configuration
├── jest.setup.js         # Jest global setup
├── playwright.config.ts  # Playwright configuration
└── .env.example          # Environment variables template
```

### Key API Endpoints
- `/api/whatsapp/webhook` - Receives WhatsApp messages and verification
- `/api/whatsapp/send` - Sends WhatsApp messages
- `/api/cron/check-reminders` - Daily cron job (9 AM UTC)

### Environment Variables
Required environment variables are typed in `types/env.d.ts`:
- `WHATSAPP_TOKEN` - WhatsApp Business API token
- `WHATSAPP_PHONE_ID` - WhatsApp phone number ID
- `WHATSAPP_VERIFY_TOKEN` - Webhook verification token
- `WHATSAPP_APP_SECRET` - App secret for signature validation
- `SUPABASE_URL` - Supabase project URL (https://pdliixrgdvunoymxaxmw.supabase.co)
- `SUPABASE_KEY` - Supabase service role key
- `SUPABASE_ANON_KEY` - Supabase public anon key for client operations
- `OPENAI_API_KEY` - OpenAI API key for GPT-4o/Whisper/Embeddings
- `TIMEZONE` - User timezone (e.g., America/Mexico_City)
- `NODE_ENV` - Environment mode (development/production)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

## Code Architecture

### Edge Functions Pattern
All API routes are Vercel Edge Functions with `export const config = { runtime: 'edge' }`. They use:
- Strict TypeScript configuration with advanced type checking
- Server-side Supabase client without session persistence
- Environment variable validation at runtime

### Database Access
- Use `getSupabaseServerClient()` from `lib/supabase.ts` for server-side operations
- All database access should respect Row Level Security (RLS) policies
- Session context is stored in Supabase for conversation persistence

### TypeScript Configuration
- Target: ES2022 with bundler module resolution
- Strict mode enabled with additional checks:
  - `noUncheckedIndexedAccess: true` (requires array access validation)
  - `exactOptionalPropertyTypes: true`
- Includes: `api/**/*`, `lib/**/*`, `types/**/*`
- Output directory: `dist/`

## Key Features Implementation

### WhatsApp Integration
- Webhook verification and message handling in `/api/whatsapp/webhook.ts`
- Message sending functionality in `/api/whatsapp/send.ts`
- Cache control headers prevent caching for real-time messaging

### Multimodal Content Processing
- Audio transcription via OpenAI Whisper
- PDF analysis using RAG with OpenAI embeddings
- Image interpretation for product/information identification
- Video summarization from YouTube content

### Automation Features
- Daily reminder checks via Vercel cron (9 AM UTC)
- Appointment scheduling and management
- Deferred message sending through WhatsApp
- Real-time information search (news, weather, data)

## Database Schema

### Core Tables
- `sessions` - User phone sessions with UUID primary keys
- `messages` - Conversation history with direction enum (inbound/outbound)
- `reminders` - Scheduled reminders with status tracking

### Database Features
- **Extensions**: pgcrypto, pg_trgm (optional: vector for embeddings)
- **Types**: Custom enums for msg_direction, conv_status, msg_type, reminder_status
- **Domains**: E.164 phone number validation
- **Security**: RLS enabled on all tables

### Message Types Supported
- text, image, audio, video, document, location
- interactive, button, contacts, system, unknown

## Development Standards (from AGENTS.md)

### Mandatory Rules
- **Read Completely**: Read files from start to finish before modifications, including all call paths/references
- **Small Changes**: Keep tasks, commits, and PRs small and safe
- **Document Assumptions**: Register all assumptions in Issues/PRs/ADRs
- **Security First**: Never commit secrets; validate inputs, encode outputs
- **Intentional Naming**: Use names that reveal intention, avoid premature abstractions

### Code Limits (Enforced)
- **File**: ≤ 300 LOC
- **Function**: ≤ 50 LOC
- **Parameters**: ≤ 5
- **Cyclomatic Complexity**: ≤ 10
- If exceeded, divide/refactor

### Testing Requirements
- **Coverage**: Minimum 80% for critical modules
- **Deterministic**: Tests must be deterministic and independent
- **Regression**: Bug fixes must include regression tests (write to fail first)
- **Paths**: Include ≥1 happy path and ≥1 failure path in e2e tests
- **Tools**: Jest for unit tests, Supertest for integration, Playwright for e2e

### Test Configuration Files
- **jest.config.js**: ES modules support, coverage settings, test patterns
- **jest.setup.js**: Global mocks, environment variables, test timeout
- **playwright.config.ts**: Browser configs, base URL, parallel execution
- **Test Structure**: `tests/unit/` for unit tests, `tests/e2e/` for end-to-end

### Security Guidelines
- **No Secrets**: Never leave secrets in code/logs/tickets
- **Input Validation**: Validate, normalize, and encode all inputs
- **Least Privilege**: Apply principle of least privilege
- **RLS**: Use Row Level Security for all database access
- **Webhook Validation**: Implement proper signature validation for WhatsApp endpoints

### Clean Code Principles
- **One Function, One Task**: Each function should do one thing
- **Effects at Boundary**: Keep side effects at the boundary
- **Guard Clauses**: Prefer guard clauses first
- **Symbolize Constants**: No hardcoded values
- **Input → Process → Return**: Structure code flow clearly
- **Specific Errors**: Report failures with specific error messages

## Performance Requirements

### Latency Targets
- **Average Response**: < 1.5 seconds
- **Maximum Response**: < 2 seconds
- **Throughput**: 1000+ messages/hour
- **Availability**: 99.9% uptime

### Quality Metrics
- **Intent Recognition**: > 95% accuracy
- **Task Completion**: > 80% success rate
- **Error Rate**: < 1%
- **User Retention**: > 70% after 30 days

## WhatsApp Cost Optimization

### Pricing Strategy (Post-July 2025)
- **Service Messages**: Free within Customer Service Window (CSW) - 24 hours
- **Utility Templates**: Billable outside CSW
- **Marketing Templates**: Always billable
- **Entry Point Window**: 72h free with Click-to-WhatsApp

### Cost Optimization Tactics
- **Maximize CSW**: High utility to keep window active
- **Minimize Templates**: Strategic use of asynchronous reminders
- **Continuous Monitoring**: Track utility template costs
- **Cache Responses**: Cache frequent responses to reduce OpenAI calls

## Development Guidelines

### Type Safety
- All environment variables must be properly typed in `types/env.d.ts`
- Use strict TypeScript configuration - handle all nullable types explicitly
- Validate environment variables at runtime in Edge Functions

### Database Operations
- Always use RLS-compliant queries through the Supabase client
- Store conversation context for session persistence
- Use Supabase Storage for multimedia file handling

### API Development
- Implement proper webhook verification for WhatsApp endpoints using WHATSAPP_APP_SECRET
- Use Edge Runtime for optimal performance and global distribution
- Handle errors gracefully and provide meaningful responses
- Follow the existing pattern of helper functions for common operations
- Implement rate limiting with Vercel Edge Middleware
- Use structured logging with request/correlation IDs
- Consider timezones and DST in all time-related operations

### OpenAI Integration
- **GPT-4o**: Primary model for chat responses and intent recognition
- **Whisper**: Audio transcription for WhatsApp voice messages
- **Embeddings**: RAG implementation for document analysis
- **Rate Limits**: Respect OpenAI API limits and implement timeouts
- **Context Management**: Store conversation context in Supabase with RLS
- **Prompt Optimization**: Optimize prompts for intent recognition and response generation

## Quick Setup

### Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd migue.ai

# Install dependencies (includes Playwright browsers)
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
# Required: WhatsApp, Supabase, and OpenAI keys

# Verify TypeScript configuration
npm run typecheck

# Start development server
npm run dev
```

### Database Setup
1. Create a new Supabase project at https://supabase.com
2. Execute `supabase/schema.sql` in Supabase SQL editor
3. Execute `supabase/security.sql` for RLS policies
4. Copy the URL and keys to `.env.local`
5. Configure environment variables in Vercel for production

### Available Endpoints
- `GET /api/whatsapp/webhook` - Webhook verification
- `POST /api/whatsapp/webhook` - Message reception
- `POST /api/whatsapp/send` - Message sending
- `GET /api/cron/check-reminders` - Daily cron job (9 AM UTC)

## Project Resources

### Documentation Links
- [AGENTS.md](./AGENTS.md) - Complete project blueprint and development standards
- [docs/setup.md](./docs/setup.md) - Detailed setup instructions
- [docs/architecture.md](./docs/architecture.md) - Architecture documentation
- [docs/SUPABASE.md](./docs/SUPABASE.md) - Database documentation

### External APIs
- **WhatsApp Business API**: https://developers.facebook.com/docs/whatsapp
- **Vercel Edge Functions**: https://vercel.com/docs/functions/edge-functions
- **Supabase Documentation**: https://supabase.com/docs
- **OpenAI API Documentation**: https://platform.openai.com/docs

## Cursor Rules Integration

This repository includes extensive Cursor IDE rules in `.cursor/rules/` covering various development roles and best practices. These rules provide context-aware assistance for frontend development, API design, TypeScript programming, and AI engineering specific to this project's architecture.

## Anti-Patterns to Avoid

- **Don't modify without context**: Never modify code without reading the complete file and understanding all references
- **Don't expose secrets**: Never expose secrets in code, logs, or commits
- **Don't ignore failures**: Never ignore failures or warnings
- **Don't optimize prematurely**: Avoid unjustified optimization or abstraction
- **Don't use broad exceptions**: Avoid excessive use of broad exception handling

## Troubleshooting

### NVM Configuration Issue
If you see the error about `.npmrc` and nvm incompatibility:
```bash
# Option 1: Use nvm with delete-prefix
nvm use --delete-prefix v20.19.0 --silent

# Option 2: Unset conflicting variables
unset npm_config_prefix && unset npm_config_globalconfig
```

### TypeScript Strict Mode Errors
The project uses strict TypeScript configuration. Common fixes:
- **Array access**: Use `!` operator when certain: `array[i]!`
- **Nullable checks**: Always validate before use: `if (value) { ... }`
- **Type assertions**: Be explicit with types when needed

### Edge Function Issues
- Ensure all API routes export: `export const config = { runtime: 'edge' }`
- Use Edge-compatible APIs (no Node.js specific modules)
- Check environment variables are properly typed in `types/env.d.ts`

## Dependencies

### Production Dependencies
- `@supabase/supabase-js`: ^2.58.0 - Database client
- `openai`: ^5.23.1 - OpenAI API client
- `zod`: ^3.25.8 - Runtime type validation

### Development Dependencies
- `typescript`: ^5.9.2 - TypeScript compiler
- `@types/node`: ^24.5.2 - Node.js type definitions
- `vercel`: ^48.1.6 - Vercel CLI and dev server
- `jest`: ^30.2.0 - Unit testing framework
- `@types/jest`: ^30.0.0 - Jest type definitions
- `playwright`: ^1.55.1 - E2E testing framework
- `supertest`: ^7.1.4 - API integration testing
- `dotenv-cli`: ^10.0.0 - Environment variable management

## Project Information

- **Version**: 1.0.0
- **Node.js**: 20.x required
- **Package Manager**: npm 10.x
- **Module Type**: ESM (ES Modules)
- **Current Phase**: Core features development (Phase 2)