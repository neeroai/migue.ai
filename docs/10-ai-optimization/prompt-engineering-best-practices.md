# Prompt Engineering Best Practices (2025)

**Last Updated**: 2025-10-10
**Applied in**: `lib/openai.ts` (ProactiveAgent)
**Research Sources**: OpenAI GPT-4.1 Guide, OpenAI Community, Microsoft Learn

---

## Table of Contents

1. [GPT-4.1 System Prompt Structure](#gpt-41-system-prompt-structure)
2. [Anti-Repetition Strategies](#anti-repetition-strategies)
3. [Function Calling Best Practices](#function-calling-best-practices)
4. [Model Parameters Optimization](#model-parameters-optimization)
5. [Conversation History Management](#conversation-history-management)
6. [Examples & Templates](#examples--templates)

---

## GPT-4.1 System Prompt Structure

**Source**: [OpenAI Cookbook - GPT-4.1 Prompting Guide](https://cookbook.openai.com/examples/gpt4-1_prompting_guide)

### Recommended Template

GPT-4.1 is trained to follow instructions more closely and more literally than predecessors. The official structure is:

```
1. Role and Objective (who you are, what you do)
2. Response Rules (high-level behavior constraints)
3. Instructions (detailed workflow)
4. Reasoning Steps (how to think through problems)
5. Output Format (how to structure responses)
6. Examples (concrete demonstrations)
7. Context Awareness (use conversation history)
8. Critical Reminders (final emphasis on key rules)
```

### Key Principles

- **Be specific and clear**: GPT-4.1 is more literal - avoid ambiguity
- **Use delimiters**: Markdown headers (`#`), XML tags, or bullet points
- **Provide context examples**: Show concrete demonstrations
- **Allow creative flexibility**: Don't over-constrain
- **Iterate empirically**: "AI engineering is inherently an empirical discipline"

### System Prompt Reminders (Agentic Workflows)

For fully utilizing agentic capabilities, include these three reminders:

1. **Persistence**: "You are an agent - continue until the user's query is completely resolved"
2. **Tool-calling**: "Use available tools instead of guessing information"
3. **Planning** (optional): "Explicitly plan and reflect on your actions before proceeding"

---

## Anti-Repetition Strategies

**Problem**: AI chatbots often repeat themselves, especially in greetings and generic responses.

**Sources**: OpenAI Community, Microsoft Learn, Medium articles on chatbot design

### Root Causes

1. **Model training**: Language models trained on repetitive datasets
2. **Low temperature**: Makes outputs deterministic but risks repetition
3. **Missing context awareness**: Not using conversation history properly
4. **Generic system prompts**: Templates lead to template responses

### Solutions (Multi-Faceted Approach)

#### 1. Explicit Anti-Repetition Constraints

Add to system prompt:

```
❌ NEVER repeat the same greeting twice in a conversation
❌ NEVER use generic template responses
✅ ALWAYS read conversation history before responding
✅ ALWAYS respond to the specific message, not a generic intent
```

#### 2. Context Tracking & History Management

```
# CONTEXT AWARENESS
- You have access to conversation history in the messages array
- Use it to avoid repetition and maintain context
- Reference previous messages when relevant
- Build on the conversation naturally
```

**Implementation**:
- Increase history limit (10 → 15 messages minimum)
- Log last user message for debugging
- Pass full history to model in messages array

#### 3. Model Parameters for Diversity

```typescript
{
  temperature: 0.8,          // Higher for more variety (0.7 → 0.8)
  frequency_penalty: 0.3,    // Discourage token repetition
  presence_penalty: 0.2,     // Encourage topic diversity
}
```

**Parameter Guide**:
- `temperature`: 0.7-0.8 for conversational variety without randomness
- `frequency_penalty`: 0.2-0.4 to penalize repeated tokens
- `presence_penalty`: 0.1-0.3 to encourage new topics

#### 4. Dynamic Response Generation

Create protocols for different conversation states:

```
## Anti-Repetition Protocol
- IF already greeted → don't greet again
- IF similar question → acknowledge and build on previous answer
- IF conversation stale → ask engaging follow-up question
```

#### 5. Examples Demonstrate Variation

Show the model how to vary responses:

```
Example 1: Basic Greeting
User: "hola"
You: "¡Hola! ¿Cómo estás?"

Example 2: Greeting Follow-up (context-aware)
[Previous: User said "hola", You said "¡Hola! ¿Cómo estás?"]
User: "como estas?"
You: "¡Muy bien, gracias! ¿Y tú? ¿En qué te puedo ayudar hoy?"
(Note: NO repeat greeting - build on conversation)
```

---

## Function Calling Best Practices

**Source**: [OpenAI Platform Docs - Function Calling](https://platform.openai.com/docs/guides/function-calling)

### Core Principles

1. **Preserve conversation history** with function results
2. **Use `tool_choice: "auto"`** - let model decide when to use tools
3. **Natural integration** - don't force tools, use when clearly needed
4. **User confirmation** (optional) - for actions with real-world impact

### Conversation Flow with Tools

```typescript
// Tool calling loop (max 5 iterations to prevent infinite loops)
for (let i = 0; i < 5; i++) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    tools: getOpenAITools(),
    tool_choice: 'auto',  // Let model decide
  })

  const toolCalls = response.choices[0]?.message.tool_calls

  // No tool calls → return text response
  if (!toolCalls) {
    return response.choices[0]?.message.content || 'Default response'
  }

  // Execute tools and add results to conversation
  messages.push(response.choices[0]!.message)
  for (const toolCall of toolCalls) {
    const result = await executeTool(toolCall.function.name, args)
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: result
    })
  }
}
```

### Tool Descriptions

Be specific and include trigger keywords:

```typescript
{
  type: 'function',
  function: {
    name: 'create_reminder',
    description: 'Crea recordatorio cuando usuario dice: recuérdame, no olvides, tengo que, avísame',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Qué recordar' },
        datetimeIso: { type: 'string', description: 'ISO format: YYYY-MM-DDTHH:MM:SS-05:00' }
      },
      required: ['title', 'datetimeIso']
    }
  }
}
```

### Natural Tool Integration in System Prompt

```
# AVAILABLE TOOLS (use automatically when obvious)

## create_reminder
**Triggers**: "recuérdame", "no olvides", "avísame", "tengo que"
**Action**: Create reminder immediately, confirm naturally
**Example**: User: "recuérdame comprar pan mañana 8am" → [create_reminder] → "✅ Listo! Te recordaré mañana a las 8am"
```

**Key**: Include examples showing tool usage + natural confirmation message

---

## Model Parameters Optimization

### Temperature

**Purpose**: Controls randomness in token selection

- **0.0-0.3**: Deterministic, focused (good for code, data extraction)
- **0.4-0.6**: Balanced (general Q&A, factual responses)
- **0.7-0.9**: Creative, varied (conversations, brainstorming)
- **1.0+**: Highly random (experimental, creative writing)

**Recommendation for chatbots**: 0.7-0.8

### Frequency Penalty

**Purpose**: Penalizes tokens based on how often they appear in the output

- **Range**: -2.0 to 2.0
- **0**: No penalty (default)
- **0.2-0.5**: Mild discouragement of repetition (recommended for conversations)
- **1.0+**: Strong penalty (avoid unless needed)

**Recommendation for chatbots**: 0.3

### Presence Penalty

**Purpose**: Penalizes tokens based on whether they've appeared at all (encourages topic diversity)

- **Range**: -2.0 to 2.0
- **0**: No penalty (default)
- **0.1-0.3**: Encourage new topics (recommended for conversations)
- **0.5+**: Strong encouragement (can lead to topic drift)

**Recommendation for chatbots**: 0.2

### Max Tokens

**Purpose**: Limits response length

- **Conversations**: 512-1024 tokens (balance between detail and brevity)
- **WhatsApp**: 256-512 tokens (mobile-friendly)
- **Long-form**: 2048+ tokens (articles, explanations)

**Recommendation for WhatsApp chatbot**: 1024

### Combined Optimization

```typescript
{
  model: 'gpt-4o-mini',
  temperature: 0.8,          // Conversational variety
  max_tokens: 1024,          // WhatsApp-friendly length
  frequency_penalty: 0.3,    // Reduce token repetition
  presence_penalty: 0.2,     // Encourage topic diversity
}
```

---

## Conversation History Management

**Source**: Microsoft Learn - Chat History Management

### Why History Matters

1. **Context preservation**: Understand conversation flow
2. **Anti-repetition**: Avoid repeating information
3. **Coherence**: Maintain logical thread
4. **Personalization**: Reference previous exchanges

### Optimal History Length

**Tradeoffs**:
- Too short (5 messages): Loses context, may repeat
- Too long (50+ messages): Token waste, slower processing
- Sweet spot: **10-15 messages** for most conversations

### Implementation

```typescript
// Get last 15 messages, ordered chronologically (oldest first)
const history = await getConversationHistory(conversationId, 15)

// Convert to OpenAI format
const openaiHistory = history
  .filter((msg) => msg.content !== null)
  .map((msg) => ({
    role: msg.direction === 'inbound' ? 'user' : 'assistant',
    content: msg.content!,
  }))

// Add to messages array
const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  ...openaiHistory,  // Chronological history
  { role: 'user', content: userMessage }
]
```

### History Management Strategies

1. **Sliding window**: Keep last N messages (simple, effective)
2. **Importance-based**: Keep key messages + recent context (advanced)
3. **Summarization**: Condense old messages (reduces tokens)
4. **Semantic search**: Retrieve relevant past messages (RAG approach)

**For WhatsApp chatbot**: Sliding window (15 messages) is sufficient

### Debugging History

Log conversation context for monitoring:

```typescript
logger.debug('[AI] Conversation history retrieved', {
  conversationId,
  userId,
  metadata: {
    historyLength: openaiHistory.length,
    lastUserMessage: openaiHistory.slice(-3)
      .filter(m => m.role === 'user')
      .pop()?.content?.slice(0, 50)
  },
})
```

---

## Examples & Templates

### Complete System Prompt Template (GPT-4.1)

```
# ROLE AND OBJECTIVE
[Who you are and what you do - 1-2 sentences]

# RESPONSE RULES (Critical)
1. [Rule 1 - context awareness]
2. [Rule 2 - anti-repetition]
3. [Rule 3 - conversational tone]
4. [Rule 4 - brevity]
5. [Rule 5 - tool usage]

# INSTRUCTIONS - [Main Task]

## [Subtask 1]
- [Step 1]
- [Step 2]

## [Subtask 2]
- [Workflow]

# AVAILABLE TOOLS (if applicable)

## tool_name
**Triggers**: [Keywords]
**Action**: [What it does]
**Example**: User: "[example]" → [tool_name] → "[response]"

# OUTPUT FORMAT
- Language: [Language]
- Tone: [Tone]
- Length: [Length]
- Structure: [Structure]

# EXAMPLES - [Use Cases]

Example 1: [Scenario]
User: "[input]"
You: "[output]"
(Note: [explanation])

Example 2: [Scenario with context]
[Previous: [context]]
User: "[input]"
You: "[output]"
(Note: [explanation])

# CONTEXT AWARENESS
- [How to use conversation history]
- [When to reference previous messages]

# CRITICAL REMINDERS
❌ NEVER [prohibition 1]
❌ NEVER [prohibition 2]
✅ ALWAYS [requirement 1]
✅ ALWAYS [requirement 2]

[Final persistence reminder for agents]
```

### Before/After Example (Anti-Repetition)

**Before** (Generic, robotic):
```
User: "hola"
Bot: "¡Hola de nuevo! Estoy aquí para ayudarte. ¿En qué puedo asistirte hoy? 😊"

User: "como estas?"
Bot: "¡Estoy aquí y listo para ayudarte! ¿En qué puedo asistirte hoy? 😊"
```
❌ Issues: Identical responses, no context awareness, robotic tone

**After** (Natural, context-aware):
```
User: "hola"
Bot: "¡Hola! ¿Cómo estás?"

User: "como estas?"
Bot: "¡Muy bien, gracias! ¿Y tú? ¿En qué te ayudo?"
```
✅ Benefits: Varied responses, builds on conversation, natural flow

---

## Implementation Checklist

When implementing these best practices:

- [ ] Structure system prompt with GPT-4.1 template (7 sections)
- [ ] Add explicit anti-repetition constraints
- [ ] Include conversation flow examples
- [ ] Set temperature to 0.7-0.8 for variety
- [ ] Add frequency_penalty: 0.3
- [ ] Add presence_penalty: 0.2
- [ ] Increase conversation history to 15 messages
- [ ] Log conversation context for debugging
- [ ] Test greeting flow (no repetition)
- [ ] Test multi-turn conversations
- [ ] Test tool calling with natural confirmations
- [ ] Monitor logs for unexpected behavior

---

## References

### Official Documentation

- [OpenAI Platform - Prompt Engineering](https://platform.openai.com/docs/guides/prompt-engineering)
- [OpenAI Cookbook - GPT-4.1 Prompting Guide](https://cookbook.openai.com/examples/gpt4-1_prompting_guide)
- [OpenAI Platform - Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [OpenAI Help Center - Prompt Engineering Best Practices](https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-the-openai-api)

### Community Resources

- [OpenAI Community - Dealing with Repetition](https://community.openai.com/t/dealing-with-repetition-in-dialogue/18685)
- [OpenAI Community - Function Calling Best Practices](https://community.openai.com/t/prompting-best-practices-for-tool-use-function-calling/1123036)
- [Microsoft Learn - Chat History Management](https://learn.microsoft.com/en-us/semantic-kernel/concepts/ai-services/chat-completion/chat-history)

### Research Articles

- [Medium - Why AI Chatbots Repeat (and How to Fix It)](https://lightcapai.medium.com/stuck-in-the-loop-why-ai-chatbots-repeat-themselves-and-how-we-can-fix-it-cd93e2e784db)
- [Medium - Smart Chatbots: Tackling Repetition](https://medium.com/@verma.gauri/smart-chatbots-tackling-repetition-for-seamless-conversations-0134189f0e01)
- [Prompt Engineering Guide - Function Calling](https://www.promptingguide.ai/applications/function_calling)

---

**Revision History**:
- 2025-10-10: Initial document created based on GPT-4.1 research
- Applied in ProactiveAgent (`lib/openai.ts`) to fix robotic responses
