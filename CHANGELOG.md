# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased] - 2026-02-05 12:20

### Removed
- **lib/openai.ts** - Obsolete ProactiveAgent class (557 lines) replaced by Vercel AI SDK
- Direct OpenAI API health check from app/api/health/route.ts
- 8 debugging scripts archived to .archive/

### Added
- **lib/audio-transcription.ts** - Dedicated Whisper transcription module (96 lines)
- AI providers check in health endpoint (validates env vars only)

### Changed
- lib/ai-processing-v2.ts - Import transcribeAudio from audio-transcription.ts
- app/api/health/route.ts - Simplified health checks

### Architecture
- All chat AI now uses Vercel AI SDK gateway exclusively (lib/ai/)
- Direct OpenAI SDK usage limited to Whisper transcription only
- Eliminated dual ProactiveAgent implementations

### Impact
- Codebase: -470 lines
- Complexity: Single AI system (was: 2 parallel)
- Tests: 254 passing, 26 skipped

### Rationale
- WhatsApp bot not responding due to expired API keys
- Root cause: Direct API usage bypassed gateway
- Solution: Centralize all AI through Vercel AI SDK gateway
