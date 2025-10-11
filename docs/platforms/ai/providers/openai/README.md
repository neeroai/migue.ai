# OpenAI GPT-4o-mini - Fallback Provider

OpenAI GPT-4o-mini serves as **Fallback #1** when Gemini's free tier is exhausted or unavailable.

## Why GPT-4o-mini?

**Cost Optimization:**
- 💰 **96% cheaper than Claude**: $0.15/$0.60 vs $3/$15 per 1M tokens
- 💵 **Monthly cost**: ~$1.50/month at 1,000 msg/day (vs $9 for Claude)
- 🆓 **Savings**: ~$90/year compared to GPT-4 standard

**Performance:**
- ⚡ **Fast**: ~1.1s warm start latency (vs 1.4s Gemini, 1.6s Claude)
- 🇪🇸 **Good Spanish**: #5 ranking on Scale AI SEAL
- 🔧 **Reliable**: Proven function calling support

## When to Use

GPT-4o-mini is automatically selected when:

1. ✅ Gemini free tier exhausted (> 1,400 req/day)
2. ✅ Gemini API error (rate limit, service down)
3. ✅ Spanish quality > cost priority
4. ✅ GOOGLE_AI_API_KEY not configured

## Integration

### Environment Setup

```bash
# .env.local
OPENAI_API_KEY=sk-proj-your-key-here
```

### Code Usage

**Automatic Selection (Recommended):**
```typescript
import { processMessageWithAI } from '@/lib/ai-processing-v2';

const response = await processMessageWithAI(message, userId, history);
// → Uses GPT-4o-mini if Gemini unavailable
```

**Direct Usage:**
```typescript
import { OpenAIAgent } from '@/lib/openai';

const agent = new OpenAIAgent();
const response = await agent.respond(message, userId, history);
```

### Function Calling

GPT-4o-mini supports all migue.ai functions:

```typescript
const tools = [
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a reminder for the user",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          datetime: { type: "string" }
        }
      }
    }
  }
];

const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ],
  tools: tools,
  tool_choice: "auto"
});
```

## Cost Tracking

### Current Pricing (2025)

| Metric | GPT-4o-mini | Gemini (FREE) | Claude Sonnet |
|--------|-------------|---------------|---------------|
| **Input** | $0.15 / 1M tokens | $0.00 | $3.00 / 1M tokens |
| **Output** | $0.60 / 1M tokens | $0.00 | $15.00 / 1M tokens |
| **Per message** | ~$0.00005 | $0.00 | $0.0003 |

### Monthly Projections

**1,000 messages/day:**
- **All Gemini**: $0/month (within free tier)
- **500 Gemini + 500 GPT**: $0.75/month
- **All GPT**: $1.50/month
- **All Claude**: $9.00/month ❌

**Strategy:** Maximize Gemini free tier, use GPT-4o-mini as overflow

## Performance Benchmarks

### Latency (P95)

| Provider | Cold Start | Warm Start | With Function Calling |
|----------|-----------|------------|----------------------|
| GPT-4o-mini | ~1.8s | ~1.1s | ~2.2s |
| Gemini Flash | ~2.1s | ~1.4s | ~2.8s |
| Claude Sonnet | ~2.5s | ~1.6s | ~3.1s |

**Winner:** GPT-4o-mini (fastest) ✅

### Spanish Quality (Scale AI SEAL)

1. 🥇 Claude Sonnet: 1,206 points
2. 🥈 GPT-4: 1,185 points
3. 🥉 Gemini Flash: 1,119 points
4. GPT-4 Turbo: 1,089 points
5. **GPT-4o-mini: 1,052 points** ← Fallback quality acceptable

## Migration from Claude

**Before (Claude Sonnet only):**
```typescript
const response = await claudeAgent.respond(message, userId, history);
// Cost: ~$9/month at 1,000 msg/day
```

**After (GPT-4o-mini fallback):**
```typescript
const response = await processMessageWithAI(message, userId, history);
// Cost: ~$1.50/month at 1,000 msg/day (83% savings)
```

**Benefits:**
- ✅ 83% cost reduction (vs Claude)
- ✅ Faster response times
- ✅ Same function calling support
- ✅ Automatic fallback chain

## Configuration

### System Prompt

GPT-4o-mini uses the same Colombian Spanish system prompt as Gemini:

```typescript
const SYSTEM_PROMPT = `Eres un asistente personal de WhatsApp para usuarios colombianos.
Usas lenguaje natural colombiano: "parcero", "¿todo bien?", "dale".
...`;
```

### Model Parameters

```typescript
{
  model: "gpt-4o-mini",
  temperature: 0.7,    // Conversational but consistent
  max_tokens: 500,     // Average response length
  top_p: 0.9,
  frequency_penalty: 0.3,  // Reduce repetition
  presence_penalty: 0.1
}
```

## Troubleshooting

### Common Issues

**1. API Key Invalid**
```
Error: Invalid API key provided
```
**Solution:** Verify `OPENAI_API_KEY` in `.env.local` and Vercel env vars

**2. Rate Limit Exceeded**
```
Error: Rate limit reached for gpt-4o-mini
```
**Solution:** OpenAI free tier: 3 req/min, 200 req/day. Upgrade to paid tier.

**3. Function Calling Failures**
```
Error: Tool calling not supported
```
**Solution:** Ensure `tools` array properly formatted with OpenAI schema

### Monitoring

```typescript
import { trackProviderUsage } from '@/lib/metrics';

// Check OpenAI usage
const stats = await trackProviderUsage('openai');
console.log(`OpenAI requests today: ${stats.requests}`);
console.log(`OpenAI cost today: $${stats.cost}`);
```

## Best Practices

1. **Use as Fallback** - Let Gemini handle free tier first
2. **Monitor Costs** - Track daily usage to avoid surprises
3. **Cache Responses** - Reduce redundant API calls
4. **Optimize Prompts** - Shorter prompts = lower costs
5. **Batch Requests** - Process multiple messages efficiently

## Related Documentation

- [Multi-Provider Architecture](../../README.md)
- [Gemini Primary Provider](../gemini/README.md)
- [Cost Optimization Guide](../gemini/cost-optimization.md)
- [Provider Selection Logic](../../provider-selection.md)

---

**Last Updated:** 2025-10-11
**Status:** Production Ready ✅
**Cost:** $1.50/month @ 1,000 msg/day
