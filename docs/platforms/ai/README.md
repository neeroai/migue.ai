# AI Providers - Multi-Provider Architecture

migue.ai uses a multi-provider AI system optimized for **cost** (100% free within limits) and **reliability** (automatic fallbacks).

## Provider Chain

```
Gemini 2.5 Flash (FREE) → GPT-4o-mini (Cheap) → Claude Sonnet (Emergency)
      Primary                Fallback #1           Fallback #2
```

**Selection Logic** (`lib/ai-providers.ts:85-110`):
1. **Gemini 2.5 Flash** - If within free tier (< 1,400 req/day) ✅ FREE
2. **OpenAI GPT-4o-mini** - If Gemini limit reached ✅ 96% cheaper than Claude
3. **Claude Sonnet 4.5** - Emergency fallback only ✅ Highest quality

---

## Providers

### 🥇 [Gemini 2.5 Flash](./providers/gemini/README.md) - Primary

**Why Primary:**
- 🆓 **FREE**: 1,500 requests/day ($0 cost)
- 🌎 **Large Context**: 1M tokens (8x larger than GPT-4o-mini)
- 🇪🇸 **Spanish Quality**: #3 ranking (Scale AI SEAL: 1,119 pts)
- 🎨 **Multi-modal**: Text, audio, video, images

**Use Cases:**
- Normal conversational AI (Colombian Spanish)
- Image analysis for expense tracking
- Large context scenarios (>128K tokens)

**Cost:** $0.00/message (within free tier)

**Docs:** [API](./providers/gemini/api.md) | [Function Calling](./providers/gemini/function-calling.md) | [Context Caching](./providers/gemini/context-caching.md) | [Cost Optimization](./providers/gemini/cost-optimization.md)

---

### 🥈 [OpenAI GPT-4o-mini](./providers/openai/README.md) - Fallback #1

**Why Fallback:**
- 💰 **Cheap**: $0.15/$0.60 per 1M tokens (96% cheaper than Claude)
- ⚡ **Fast**: ~1.1s warm start latency
- 🇪🇸 **Good Spanish**: #5 ranking
- 🔧 **Reliable**: Function calling support

**Use Cases:**
- Gemini free tier exhausted (> 1,400 req/day)
- Gemini API errors (rate limit, downtime)
- Spanish quality critical but cost-conscious

**Cost:** $0.00005/message (~$1.50/month at 1,000 msg/day)

**Docs:** [README](./providers/openai/README.md)

---

### 🥉 [Claude Sonnet 4.5](./providers/claude/README.md) - Emergency

**Why Emergency Only:**
- 💎 **Highest Quality**: #1 Spanish ranking (Scale AI SEAL: 1,206 pts)
- 💸 **Expensive**: $3/$15 per 1M tokens (20x more than GPT-4o-mini)
- 🧠 **Complex Reasoning**: Best for multi-step tasks

**Use Cases:**
- Both Gemini and OpenAI unavailable
- Highest quality required (critical conversations)
- Complex multi-turn reasoning

**Cost:** $0.0003/message (~$9/month at 1,000 msg/day)

**Docs:** [README](./providers/claude/README.md)

---

### 🎤 [Groq Whisper](./providers/groq/README.md) - Audio Transcription

**Specialized Use:**
- 🎯 **Audio Only**: Transcription of WhatsApp voice messages
- 💰 **93% Cheaper**: $0.05/hour vs OpenAI Whisper $0.36/hour
- ⚡ **Fast**: ~500ms latency

**Cost:** $0.000014/second of audio

**Docs:** [README](./providers/groq/README.md)

---

## Cost Comparison

### Scenario: 1,000 messages/day

| Provider Mix | Daily Cost | Monthly Cost | Annual Cost | Savings vs Claude |
|--------------|-----------|--------------|-------------|-------------------|
| **Gemini only** (within tier) | $0.00 | $0.00 | $0.00 | 100% 💚 |
| **Gemini + GPT mix** | $0.025 | $0.75 | $9.00 | 90% 💚 |
| **GPT-4o-mini only** | $0.05 | $1.50 | $18.00 | 80% 💚 |
| **Claude only** | $0.30 | $9.00 | $108.00 | 0% ❌ |

**Current Target:** Stay within Gemini free tier → $0/month

---

## When to Use Which Provider?

### Decision Matrix

| Scenario | Provider | Reason |
|----------|----------|--------|
| **Normal chat** | Gemini | FREE + good quality |
| **High volume** (> 1,500/day) | Gemini → GPT | Free tier first, cheap fallback |
| **Complex reasoning** | Claude | Highest quality (#1 Spanish) |
| **Audio transcription** | Groq Whisper | 93% cheaper |
| **Image analysis** | Gemini Vision | 95% accuracy + free |
| **Large context** (>128K) | Gemini | 1M token window |
| **Emergency** | Claude | Most reliable |

### Provider Selection Code

```typescript
// lib/ai-providers.ts:85-110
export function selectProvider(options: { freeOnly?: boolean }): AIProvider {
  // 1. Try Gemini if free tier available
  if (process.env.GOOGLE_AI_API_KEY && canUseFreeTier()) {
    return 'gemini';
  }

  // 2. Fallback to GPT-4o-mini (96% cheaper than Claude)
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }

  // 3. Emergency fallback to Claude
  return 'claude';
}
```

---

## Implementation Files

**Core Logic:**
- `lib/ai-providers.ts` - Provider selection and management
- `lib/ai-processing-v2.ts` - Message processing with multi-provider support
- `lib/gemini-client.ts` - Gemini API client
- `lib/gemini-agents.ts` - Gemini-specific agents
- `lib/openai.ts` - OpenAI client and agents
- `lib/claude-client.ts` - Claude API client
- `lib/groq-client.ts` - Groq Whisper audio transcription

**Tests:**
- `tests/gemini/*.test.ts` - Gemini integration tests
- `tests/unit/ai-providers.test.ts` - Provider selection tests

---

## Migration Guide

### From Single Provider to Multi-Provider

**Before (OpenAI only):**
```typescript
const response = await openaiAgent.respond(message, userId, history);
```

**After (Multi-provider):**
```typescript
const response = await processMessageWithAI(message, userId, history);
// → Automatically selects best provider: Gemini → GPT → Claude
```

### Provider-Specific Features

**Gemini-Specific:**
```typescript
import { analyzeImageWithGemini } from '@/lib/gemini-client';
const analysis = await analyzeImageWithGemini(imageUrl, prompt);
```

**OpenAI-Specific:**
```typescript
import { OpenAIAgent } from '@/lib/openai';
const agent = new OpenAIAgent();
const response = await agent.respond(message, userId, history);
```

---

## Monitoring & Cost Tracking

**Check Usage:**
```typescript
import { getGeminiUsageStats, trackProviderUsage } from '@/lib/metrics';

// Gemini free tier usage
const stats = getGeminiUsageStats();
console.log(`Used ${stats.dailyRequests}/1400 free requests`);

// All providers cost
const costs = await trackProviderUsage();
console.log(`Total cost today: $${costs.total}`);
```

**Alerts:**
- ⚠️ 80% of Gemini free tier (1,200 requests)
- 🚨 100% of Gemini free tier (1,400 requests)
- 💰 Daily cost exceeds $1.00

---

## Best Practices

1. **Maximize Free Tier** - Stay under 1,400 Gemini requests/day
2. **Monitor Costs** - Track provider usage daily
3. **Test Fallbacks** - Ensure OpenAI/Claude work when Gemini fails
4. **Cache Contexts** - Use Gemini context caching for 75% savings
5. **Quality Check** - Compare provider outputs periodically

---

## Future Enhancements

**Phase 3 (Q1 2026):**
- [ ] Streaming responses for long outputs
- [ ] Video summarization (YouTube, Instagram, TikTok)
- [ ] Advanced image understanding (product recognition)
- [ ] Parallel function calling (multiple tools simultaneously)

**Phase 4 (Q2 2026):**
- [ ] A/B testing framework (Gemini vs GPT quality)
- [ ] Cost analytics dashboard
- [ ] Context caching optimization (>50% hit rate)
- [ ] Provider-specific performance profiling

---

**Related Documentation:**
- [Provider Selection Logic](./provider-selection.md)
- [Cost Optimization Guide](./providers/gemini/cost-optimization.md)
- [Multi-Provider Testing](../../guides/testing-ai-providers.md)
