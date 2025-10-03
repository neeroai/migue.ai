# Code Patterns & Best Practices

---

## Edge Function API Route Pattern

**Use Case**: All API endpoints in migue.ai
**Example**:
```typescript
// app/api/example/route.ts
export const runtime = 'edge';

export async function POST(req: Request): Promise<Response> {
  try {
    // 1. Validate request
    const body = await req.json();
    const validated = schema.parse(body);

    // 2. Process
    const result = await processData(validated);

    // 3. Return response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (error) {
    // 4. Handle errors
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
```

**Gotchas**:
- MUST export `runtime = 'edge'` at top level
- NO Node.js APIs (fs, path, etc.)
- Use static imports only (no dynamic `await import()`)
- Return Web API Response object
- Set content-type header explicitly

---

## WhatsApp Interactive Response Pattern

**Use Case**: When user needs to select from options
**Example**:
```typescript
import { sendInteractiveButtons, sendInteractiveList } from '@/lib/whatsapp';

// 1-3 options → Use buttons
if (options.length <= 3) {
  await sendInteractiveButtons(phone, message, options);
}

// 4+ options → Use list
else {
  await sendInteractiveList(phone, message, 'Select option', options);
}
```

**Gotchas**:
- Button titles max 20 characters
- List can have descriptions
- Both return message ID (check for null = error)

---

## Typing Indicator Pattern

**Use Case**: Show processing status for AI responses
**Example**:
```typescript
import { createTypingManager } from '@/lib/whatsapp';

const typing = createTypingManager(phone);

// For predictable operations (<5s)
await typing.startWithDuration(3);
const response = await quickOperation();
// Auto-stops after 3s

// For unpredictable operations
await typing.start();
try {
  const response = await longOperation();
} finally {
  await typing.stop(); // ALWAYS stop in finally
}
```

**Gotchas**:
- Max 25 seconds per WhatsApp limit
- Use `startWithDuration` when timing known
- Always stop in finally block (manual mode)

---

## Supabase RLS Query Pattern

**Use Case**: All database queries with Row Level Security
**Example**:
```typescript
import { getSupabaseServerClient } from '@/lib/supabase';

const supabase = getSupabaseServerClient();

// RLS automatically filters by user
const { data, error } = await supabase
  .from('conversations')
  .select('*')
  .eq('phone_number', phone)
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('DB error:', error);
  return null;
}

return data;
```

**Gotchas**:
- RLS policies enforced automatically
- Check `error` before using `data`
- Use `.single()` for one result (throws if multiple)
- Use `.limit(1)` + array access for optional single

---

## OpenAI Error Handling Pattern

**Use Case**: Graceful degradation for API failures
**Example**:
```typescript
import { openai } from '@/lib/openai';

try {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [...],
    max_tokens: 500,
  });

  return response.choices[0]?.message.content ?? 'No response';
} catch (error) {
  console.error('OpenAI error:', error);

  // Fallback to simpler model
  try {
    const fallback = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [...],
    });
    return fallback.choices[0]?.message.content ?? 'Error';
  } catch {
    return 'Sorry, I'm having trouble responding right now.';
  }
}
```

**Gotchas**:
- Always provide fallback message
- Log errors for monitoring
- Check `choices[0]` exists before accessing
- Use `?.` optional chaining
- Consider cost of retries

---

## Zod Validation Pattern

**Use Case**: Validate all external inputs (WhatsApp, API)
**Example**:
```typescript
import { z } from 'zod';

const schema = z.object({
  phone: z.string().regex(/^\d{10,15}$/),
  message: z.string().min(1).max(5000),
  type: z.enum(['text', 'audio', 'image']).optional(),
});

// Validate and get typed data
const result = schema.safeParse(input);
if (!result.success) {
  return { error: result.error.format() };
}

const { phone, message, type } = result.data;
// Now TypeScript knows exact types
```

**Gotchas**:
- Use `.safeParse()` to avoid throwing
- Check `success` before accessing `data`
- Error has `.format()` for structured errors
- Define schema at module level (not in function)

---

## Conversation History Pattern

**Use Case**: Retrieve last N messages for context
**Example**:
```typescript
import { getConversationHistory } from '@/lib/context';

const history = await getConversationHistory(phone, 10);

const messages = [
  { role: 'system', content: 'You are a helpful assistant' },
  ...history.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.content,
  })),
  { role: 'user', content: currentMessage },
];

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages,
});
```

**Gotchas**:
- Limit history to save tokens (10 messages = ~2K tokens)
- History ordered newest first from DB
- Map to OpenAI message format
- Include system message first

---

## RAG Query Pattern (In Progress)

**Use Case**: Retrieve relevant documents for context
**Example**:
```typescript
import { searchSimilarDocuments } from '@/lib/rag/search';

const query = "How do I reset my password?";

// 1. Generate embedding for query
const embedding = await generateEmbedding(query);

// 2. Search similar documents
const docs = await searchSimilarDocuments(embedding, 5);

// 3. Inject into context
const context = docs.map(d => d.content).join('\n\n');

const messages = [
  { role: 'system', content: `Use this context:\n${context}` },
  { role: 'user', content: query },
];
```

**Gotchas**:
- Limit to top-k results (5-10) to save tokens
- Filter by similarity threshold (>0.7)
- Include document metadata in response
- Cache embeddings when possible

---

## Error Response Pattern

**Use Case**: Consistent error responses across API
**Example**:
```typescript
// Helper function
function errorResponse(
  message: string,
  status: number = 500
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { 'content-type': 'application/json' },
    }
  );
}

// Usage in route
if (!isValid) {
  return errorResponse('Invalid input', 400);
}
```

**Gotchas**:
- Include timestamp for debugging
- Use appropriate status codes
- Don't expose internal errors to users
- Log detailed error server-side

---

**Last Updated**: 2025-10-03
