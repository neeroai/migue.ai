# Claude Sonnet 4.5 - Emergency Fallback

Claude Sonnet 4.5 serves as **Emergency Fallback** when both Gemini and OpenAI are unavailable or for highest-quality Spanish conversations.

## Why Emergency Only?

**Cost Considerations:**
- 💸 **20x more expensive**: $3/$15 per 1M tokens vs GPT-4o-mini $0.15/$0.60
- 💰 **Monthly cost**: ~$9/month at 1,000 msg/day (vs $1.50 for GPT)
- 📈 **Annual cost**: ~$108/year (vs $18 for GPT)

**Quality Justification:**
- 🥇 **#1 Spanish quality**: 1,206 pts on Scale AI SEAL (7% better than Gemini)
- 🧠 **Best reasoning**: Excels at multi-step, complex conversations
- 🎯 **Highest accuracy**: Best for critical business interactions

## When to Use

Claude is automatically selected when:

1. 🚨 Gemini AND OpenAI both unavailable
2. 🚨 Critical conversation requiring highest quality
3. 🚨 Complex multi-turn reasoning needed
4. 🚨 Manual override via config

**Use Sparingly:** Only 1-2% of traffic should hit Claude to maintain low costs.

## Integration

### Environment Setup

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Code Usage

**Automatic Selection (Recommended):**
```typescript
import { processMessageWithAI } from '@/lib/ai-processing-v2';

const response = await processMessageWithAI(message, userId, history);
// → Uses Claude only if Gemini AND OpenAI unavailable
```

**Direct Usage:**
```typescript
import { ClaudeClient } from '@/lib/claude-client';

const client = new ClaudeClient();
const response = await client.generateResponse(message, history, {
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 500
});
```

### Function Calling

Claude supports parallel function calling (2+ tools simultaneously):

```typescript
import { CLAUDE_TOOLS } from '@/lib/claude-tools';

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  tools: CLAUDE_TOOLS,  // Pre-defined Zod-validated tools
  messages: [
    { role: "user", content: "Recuérdame comprar leche mañana a las 8am" }
  ]
});

// Handles tool calls automatically
if (response.stop_reason === 'tool_use') {
  const toolCalls = response.content.filter(block => block.type === 'tool_use');
  // Execute tools...
}
```

## Cost Analysis

### Pricing (2025)

| Metric | Claude Sonnet | GPT-4o-mini | Gemini (FREE) |
|--------|---------------|-------------|---------------|
| **Input** | $3.00 / 1M tokens | $0.15 / 1M tokens | $0.00 |
| **Output** | $15.00 / 1M tokens | $0.60 / 1M tokens | $0.00 |
| **Per message** | ~$0.0003 | ~$0.00005 | $0.00 |
| **Multiplier** | 6x more than GPT | 1x baseline | FREE |

### Cost Impact Scenarios

**10% Claude usage** (100 messages/day to Claude):
- Gemini: 900 msg/day = $0.00
- OpenAI: 0 msg/day = $0.00
- Claude: 100 msg/day = $0.90
- **Total: $0.90/day = $27/month** ⚠️

**1% Claude usage** (10 messages/day to Claude):
- Gemini: 990 msg/day = $0.00
- Claude: 10 msg/day = $0.09
- **Total: $0.09/day = $2.70/month** ✅ Acceptable

**Target:** Keep Claude usage < 1% of traffic

## Performance Benchmarks

### Latency (P95)

| Provider | Cold Start | Warm Start | With Function Calling |
|----------|-----------|------------|----------------------|
| Claude Sonnet | ~2.5s | ~1.6s | ~3.1s |
| GPT-4o-mini | ~1.8s | ~1.1s | ~2.2s |
| Gemini Flash | ~2.1s | ~1.4s | ~2.8s |

**Note:** Claude is slowest but highest quality

### Spanish Quality (Scale AI SEAL)

1. 🥇 **Claude Sonnet: 1,206 points** ← #1 Best
2. 🥈 GPT-4: 1,185 points
3. 🥉 Gemini Flash: 1,119 points
4. GPT-4 Turbo: 1,089 points
5. GPT-4o-mini: 1,052 points

**Quality Gap:** 7% better than Gemini, 15% better than GPT-4o-mini

## Migration from GPT-4 to Claude Sonnet

**Before (GPT-4):**
```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4",  // $30/$60 per 1M tokens 💸
  messages: [...]
});
// Cost: ~$18/month at 1,000 msg/day
```

**After (Claude Sonnet as fallback):**
```typescript
const response = await processMessageWithAI(message, userId, history);
// Cost: ~$0-2.70/month (only used when Gemini/GPT unavailable)
```

**Savings:** 85-100% cost reduction vs GPT-4

## Configuration

### System Prompt

Claude uses Colombian Spanish system prompt:

```typescript
const SYSTEM_PROMPT = `Eres un asistente personal de WhatsApp para usuarios colombianos.

Tu personalidad:
- Usas lenguaje colombiano natural: "parcero", "¿todo bien?", "dale"
- Eres proactivo con recordatorios y citas
- Confirmas acciones claramente

Capacidades:
- Crear recordatorios (create_reminder)
- Agendar citas (schedule_meeting)
- Registrar gastos (track_expense)

Usa las herramientas disponibles de forma autónoma.`;
```

### Model Parameters

```typescript
{
  model: "claude-sonnet-4-5-20250929",  // Latest snapshot
  max_tokens: 500,       // Average response length
  temperature: 0.7,      // Balanced creativity
  top_p: 0.9,
  top_k: 40
}
```

## Tool Calling Best Practices

### Autonomous Execution

Claude autonomously executes tools without confirmation:

```typescript
// User: "Recuérdame comprar leche mañana a las 8am"

// Claude automatically calls create_reminder
{
  "type": "tool_use",
  "name": "create_reminder",
  "input": {
    "title": "Comprar leche",
    "datetime": "2025-10-12T08:00:00-05:00"
  }
}

// Response: "✅ Listo! Te recuerdo mañana a las 8am"
```

### Parallel Tool Calling

Claude can call multiple tools simultaneously:

```typescript
// User: "Recuérdame la cita con el doctor y anota que gasté $50,000"

// Claude calls TWO tools in parallel
[
  {
    "type": "tool_use",
    "name": "schedule_meeting",
    "input": { "title": "Cita doctor", ... }
  },
  {
    "type": "tool_use",
    "name": "track_expense",
    "input": { "amount": 50000, ... }
  }
]
```

## Troubleshooting

### Common Issues

**1. Invalid Model ID**
```
Error: model_not_found: claude-sonnet-4-5
```
**Solution:** Use snapshot ID: `claude-sonnet-4-5-20250929`

**2. API Key Missing**
```
Error: authentication_error: invalid x-api-key
```
**Solution:** Set `ANTHROPIC_API_KEY` in `.env.local` and Vercel env vars

**3. Tool Calling Refused**
```
Response: "No puedo crear recordatorios"
```
**Solution:** Strengthen system prompt with explicit tool usage instructions

### Monitoring

```typescript
import { trackProviderUsage } from '@/lib/metrics';

// Check Claude usage
const stats = await trackProviderUsage('claude');
console.log(`Claude requests today: ${stats.requests}`);
console.log(`Claude cost today: $${stats.cost}`);

// Alert if exceeding budget
if (stats.cost > 1.00) {
  console.warn('⚠️ Claude cost exceeding $1/day target');
}
```

## Best Practices

1. **Use as Last Resort** - Only when Gemini AND OpenAI fail
2. **Monitor Cost** - Alert if Claude usage > 1% of traffic
3. **Quality Threshold** - Reserve for critical conversations only
4. **Automatic Fallback** - Never hardcode Claude as primary
5. **Test Regularly** - Ensure Claude works when needed

## Quality Comparison

### Example Conversation

**Input:** "Parcero, necesito que me ayudes a organizar las citas de esta semana"

**Claude Sonnet (1,206 pts):**
```
¡Dale parcero! Con gusto te ayudo a organizar tus citas.
Para darte la mejor ayuda, cuéntame:
- ¿Qué citas tenés pendientes?
- ¿Hay días u horarios que prefieras?

Así puedo agendar todo bien organizado y recordarte a tiempo 📅
```

**Gemini Flash (1,119 pts):**
```
¡Claro! Te ayudo con tus citas.
¿Qué citas necesitas organizar esta semana?
Puedo agendarlas y recordarte cuando sea necesario.
```

**GPT-4o-mini (1,052 pts):**
```
Con gusto te ayudo a organizar tus citas.
¿Cuáles tienes esta semana?
```

**Winner:** Claude (most natural Colombian Spanish, proactive)

## Related Documentation

- [Multi-Provider Architecture](../../README.md)
- [Gemini Primary Provider](../gemini/README.md)
- [OpenAI Fallback](../openai/README.md)
- [Cost Optimization Guide](../gemini/cost-optimization.md)

---

**Last Updated:** 2025-10-11
**Status:** Emergency Backup Only ⚠️
**Target Usage:** < 1% of traffic
**Cost:** $0.09/day @ 10 msg/day
