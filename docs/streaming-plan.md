# Streaming Responses Plan

## Context
Current responses wait for full GPT-4o completion before sending to WhatsApp, creating latency spikes for long answers. We want to adopt GPT-4o streaming so Edge Functions forward partial tokens and the user perceives near-real-time replies.

## Requirements
- Use OpenAI chat completions streaming (SSE) with GPT-4o.
- Buffer chunks into WhatsApp-compatible messages (<=4096 chars, no partial UTF-8).
- Respect WhatsApp rate limits; send at most one message per few seconds or aggregate tokens until completion.
- Maintain transcript by persisting the final aggregated message.
- Provide fallback for non-streaming clients or errors (default to existing path).

## Options Considered
1. **Single message after full stream**
   - Pros: Minimal change, just stream to reduce waiting for LLM completion.
   - Cons: User still waits until completion, limited benefit.
2. **Progressive messages per chunk**
   - Pros: Immediate feedback, better UX.
   - Cons: Risk of message spam, need to edit/replace (WhatsApp lacks edits).
3. **Progressive typing indicator + final message**
   - Pros: Balanced; simulate streaming via status updates, send final message once ready.
   - Cons: Requires typing indicators (WhatsApp template) support.

**Chosen Approach:** Start with Option 1. Use streaming to build the full response but begin assembly while reading the stream, enabling faster error detection and future progressive messaging. Later we can explore partial sends when WhatsApp supports them better.

## Deliverables
- Update `lib/openai.ts` with a `streamChatCompletion` helper returning async iterator of tokens.
- Modify `generateResponse` (or caller) to optionally consume stream and aggregate to string; maintain current sync default but use streaming path.
- Abstract WhatsApp send to support a final message after streaming (no change to API signature).
- Tests: unit test mocking streaming events, ensuring aggregation and fallback.
- Documentation: add streaming guide referencing `docs/VERCEL-STREAMING-AI-RESPONSES.md`.

## Constraints
- Edge runtime: must use fetch-based streaming; no Node-specific APIs.
- WhatsApp message must remain under 4096 chars; trim or chunk if necessary.
- Timeout: ensure stream aborted after ~25s to avoid hanging.

## Open Questions
- ¿Podemos habilitar typing indicator progresivo? (Ver `docs/typing-indicator.md` para primera iteración.)
- ¿Permitimos streaming en todos los intents o solo en respuestas largas?
- ¿Cómo exponer streaming para otros canales en el futuro?
