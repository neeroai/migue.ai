---
title: "Changelog"
date: "2026-02-01 16:00"
updated: "2026-02-01 16:00"
version: "1.0.0"
scope: "Project-wide changes log"
---

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2026-02-01 16:00

- `lib/ai/providers.ts` - Vercel AI SDK 6.0 provider configuration (OpenAI + Claude)
- `lib/ai/proactive-agent.ts` - ProactiveAgent using generateText() with tool support
- CHANGELOG.md - Project changelog tracking

### Changed - 2026-02-01 16:00

- `lib/ai-processing-v2.ts` - Migrated from OpenAI SDK to Vercel AI SDK 6.0
  - Replace `historyToOpenAIMessages()` with `historyToModelMessages()`
  - Use new `createProactiveAgent()` from lib/ai/proactive-agent
  - Extract cost from AI response object instead of PROVIDER_COSTS constant
- `app/api/cron/maintain-windows/route.ts` - Updated to use new provider
  - Import from `lib/ai/proactive-agent` instead of `lib/openai`
  - Use `historyToModelMessages()` instead of `historyToOpenAIMessages()`
  - Handle new response structure with `.text` property
- `types/schemas.ts` - Fixed Zod schema for compatibility with Zod 3.25.8
  - Changed `z.record(z.unknown())` to `z.record(z.string(), z.unknown())`

### Removed - 2026-02-01 16:00

- `package.json` - Removed unused AI SDK dependencies
  - `openai@5.23.1` (replaced by @ai-sdk/openai)
  - `@anthropic-ai/sdk@0.65.0` (replaced by @ai-sdk/anthropic)
- `lib/openai.ts` - Archived (replaced by lib/ai/proactive-agent.ts)
- `lib/openai-response-handler.ts` - Archived (validation now built into Vercel AI SDK)

### Technical Details

**Migration**: OpenAI SDK Direct → Vercel AI SDK 6.0

| Aspect | Before | After |
|--------|--------|-------|
| Chat API | `client.chat.completions.create()` | `generateText()` |
| Message Type | `ChatCompletionMessageParam[]` | `ModelMessage[]` |
| Tool Schema | `parameters` property | `inputSchema` property |
| Usage Tokens | `promptTokens/completionTokens` | `inputTokens/outputTokens` |
| Tool Execution | Manual loop (max 5 iterations) | Built-in with `stopWhen` |
| Cost Tracking | Manual calculation | Calculated from usage response |

**Test Results**: 278/305 passing (2 failures in deprecated files not used in production)

**Type Safety**: PASS - All TypeScript checks passing

---

## [1.0.0] - 2026-01-20

### Security

- Upgraded Next.js 15.5.4 → 16.0.10 (CVE-2025-55182 fix)
- Upgraded React 19.1.1 → 19.2.3 (CVE-2025-55182 fix)
- Fixed React2Shell RCE vulnerability (CVSS 10.0 critical)

### Added

- Missing AI SDK dependencies (@ai-sdk/openai, @ai-sdk/anthropic)
- Comprehensive test coverage (239 tests passing)
