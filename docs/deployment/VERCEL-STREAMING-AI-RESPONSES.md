# Streaming AI Responses con Vercel Edge Functions

## 📖 Overview

El streaming de respuestas de IA permite enviar datos progresivamente al cliente, mejorando la **percepción de velocidad 3x** y habilitando timeouts extendidos en Edge Functions.

### Beneficios del Streaming

- ⚡ **Latencia percibida reducida**: Usuario ve respuesta inmediatamente
- ⏱️ **Timeouts extendidos**: > 25s en Edge Functions (vs 25s estándar)
- 💰 **Eficiencia**: No bloquear conexión esperando respuesta completa
- 🎯 **UX mejorada**: Typing indicators, respuestas progresivas

---

## 🎯 Use Cases

### Ideal para:
- ✅ Chatbots con GPT-4o/Claude
- ✅ Generación de contenido largo
- ✅ Transcripción de audio (Whisper)
- ✅ Análisis de documentos
- ✅ Resúmenes progresivos

### No necesario para:
- ❌ Respuestas cortas (< 50 tokens)
- ❌ APIs con payloads pequeños
- ❌ Webhooks síncronos

---

## 🚀 Implementación Básica

### 1. ReadableStream API (Web Standard)

```typescript
// api/stream/basic.ts
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Enviar chunks progresivamente
        controller.enqueue(encoder.encode('data: Chunk 1\n\n'));
        await delay(100);

        controller.enqueue(encoder.encode('data: Chunk 2\n\n'));
        await delay(100);

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 2. Server-Sent Events (SSE) Pattern

```typescript
// api/stream/sse.ts
export const config = { runtime: 'edge' };

interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

function formatSSE(message: SSEMessage): string {
  let formatted = '';

  if (message.id) formatted += `id: ${message.id}\n`;
  if (message.event) formatted += `event: ${message.event}\n`;
  if (message.retry) formatted += `retry: ${message.retry}\n`;
  formatted += `data: ${message.data}\n\n`;

  return formatted;
}

export default async function handler(req: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Enviar evento de inicio
      controller.enqueue(
        encoder.encode(formatSSE({
          event: 'start',
          data: JSON.stringify({ status: 'connected' }),
        }))
      );

      // Enviar datos
      for (let i = 0; i < 5; i++) {
        controller.enqueue(
          encoder.encode(formatSSE({
            id: String(i),
            event: 'message',
            data: JSON.stringify({ text: `Message ${i}` }),
          }))
        );
        await delay(500);
      }

      // Finalizar stream
      controller.enqueue(
        encoder.encode(formatSSE({
          event: 'done',
          data: JSON.stringify({ status: 'completed' }),
        }))
      );

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
```

---

## 🤖 Streaming GPT-4o Responses

### 1. OpenAI Streaming Client (Edge-Compatible)

```typescript
// lib/openai-stream.ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  options: StreamOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || 'gpt-4o',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 500,
      stream: true, // Habilitar streaming
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let fullText = '';

  return new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                options.onComplete?.(fullText);
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                return;
              }

              try {
                const json = JSON.parse(data);
                const token = json.choices?.[0]?.delta?.content || '';

                if (token) {
                  fullText += token;
                  options.onToken?.(token);

                  // Enviar token al cliente
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
                  );
                }
              } catch (e) {
                // Ignorar errores de parsing
              }
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    }
  });
}
```

### 2. API Endpoint con Streaming

```typescript
// api/chat/stream.ts
export const config = { runtime: 'edge' };

import { streamChatCompletion, type ChatMessage } from '../../lib/openai-stream';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { messages } = await req.json() as { messages: ChatMessage[] };

  if (!messages || !Array.isArray(messages)) {
    return new Response('Invalid messages', { status: 400 });
  }

  try {
    const stream = await streamChatCompletion(messages, {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 500,
      onToken: (token) => {
        console.log('Token received:', token);
      },
      onComplete: (fullText) => {
        console.log('Complete response:', fullText);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

---

## 📱 WhatsApp Streaming Implementation

### Estrategia: Chunked Responses

WhatsApp no soporta streaming directo, pero podemos simular con mensajes múltiples:

```typescript
// api/whatsapp/chat-stream.ts
export const config = { runtime: 'edge' };

import { streamChatCompletion } from '../../lib/openai-stream';

async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
}

export default async function handler(req: Request): Promise<Response> {
  const { userPhone, userMessage } = await req.json();

  // Acumular tokens y enviar cada N caracteres
  let buffer = '';
  const CHUNK_SIZE = 100; // Enviar cada 100 caracteres

  const stream = await streamChatCompletion(
    [{ role: 'user', content: userMessage }],
    {
      onToken: async (token) => {
        buffer += token;

        // Enviar chunk cuando alcance tamaño mínimo
        if (buffer.length >= CHUNK_SIZE) {
          const toSend = buffer;
          buffer = '';

          // Fire and forget
          sendWhatsAppMessage(userPhone, toSend).catch(console.error);
        }
      },
      onComplete: async (fullText) => {
        // Enviar último fragmento si queda algo
        if (buffer.length > 0) {
          await sendWhatsAppMessage(userPhone, buffer);
        }
      },
    }
  );

  // Responder inmediatamente al webhook
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### Optimización: Single Message con Edits

```typescript
// Estrategia alternativa: Editar mensaje progresivamente
let messageId: string | null = null;
let accumulatedText = '';

const stream = await streamChatCompletion(messages, {
  onToken: async (token) => {
    accumulatedText += token;

    if (!messageId) {
      // Enviar primer mensaje
      messageId = await sendWhatsAppMessage(userPhone, accumulatedText);
    } else {
      // Editar mensaje existente (si API soporta)
      // WhatsApp no soporta edits aún, usar estrategia de chunks
    }
  },
});
```

---

## 🎨 Client-Side Consumption

### 1. JavaScript Client (Browser)

```javascript
// Frontend: Consumir stream con EventSource
const eventSource = new EventSource('/api/chat/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data === '[DONE]') {
    eventSource.close();
    return;
  }

  if (data.token) {
    // Agregar token al UI progresivamente
    document.getElementById('response').textContent += data.token;
  }
};

eventSource.onerror = (error) => {
  console.error('Stream error:', error);
  eventSource.close();
};
```

### 2. React Hook

```typescript
import { useEffect, useState } from 'react';

export function useStreamingChat(messages: ChatMessage[]) {
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (messages.length === 0) return;

    setIsStreaming(true);
    setResponse('');
    setError(null);

    const eventSource = new EventSource('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data === '[DONE]') {
        setIsStreaming(false);
        eventSource.close();
        return;
      }

      if (data.token) {
        setResponse(prev => prev + data.token);
      }
    };

    eventSource.onerror = (err) => {
      setError('Streaming failed');
      setIsStreaming(false);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [messages]);

  return { response, isStreaming, error };
}
```

---

## ⚙️ Advanced Patterns

### 1. Backpressure Handling

```typescript
const stream = new ReadableStream({
  async start(controller) {
    const reader = openaiStream.getReader();

    try {
      while (true) {
        // Respetar backpressure del consumidor
        if (controller.desiredSize && controller.desiredSize <= 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        const { done, value } = await reader.read();
        if (done) break;

        controller.enqueue(value);
      }
    } finally {
      reader.releaseLock();
      controller.close();
    }
  }
});
```

### 2. Error Recovery

```typescript
async function streamWithRetry(messages: ChatMessage[], maxRetries = 3): Promise<ReadableStream> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await streamChatCompletion(messages);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      // Exponential backoff
      await delay(Math.pow(2, attempt) * 1000);
    }
  }

  throw new Error('Max retries exceeded');
}
```

### 3. Metrics & Monitoring

```typescript
const stream = await streamChatCompletion(messages, {
  onToken: (token) => {
    // Track token count
    tokenCount++;
  },
  onComplete: (fullText) => {
    // Log completion metrics
    console.log(JSON.stringify({
      event: 'stream_complete',
      tokenCount,
      duration: Date.now() - startTime,
      messageLength: fullText.length,
    }));
  },
});
```

---

## 🐛 Troubleshooting

### Error: "Stream closed prematurely"

**Causa**: Cliente cerró conexión antes de finalizar stream
**Solución**: Implementar cleanup y error handling robusto

```typescript
const stream = new ReadableStream({
  async start(controller) {
    try {
      // ... streaming logic
    } catch (error) {
      if (!controller.closed) {
        controller.error(error);
      }
    }
  },
  cancel() {
    // Cleanup cuando cliente cancela
    console.log('Stream cancelled by client');
  }
});
```

### Error: "Buffering issues"

**Causa**: Nginx/proxy buffering streams
**Solución**: Agregar headers anti-buffering

```typescript
return new Response(stream, {
  headers: {
    'X-Accel-Buffering': 'no', // Nginx
    'Cache-Control': 'no-cache, no-transform',
  },
});
```

---

## 📊 Performance Benchmarks

| Método | Tiempo Primera Respuesta | Tiempo Total | UX Score |
|--------|-------------------------|--------------|----------|
| Sin streaming | 3.5s | 3.5s | ⭐⭐ |
| Con streaming | 0.3s | 3.5s | ⭐⭐⭐⭐⭐ |

**Mejora percibida**: 10x más rápido en primera interacción

---

## ✅ Best Practices

- [ ] Usar SSE para comunicación unidireccional
- [ ] Implementar timeout extendido (> 25s)
- [ ] Agregar error handling robusto
- [ ] Monitorear latencia de primera respuesta
- [ ] Implementar backpressure handling
- [ ] Usar chunking inteligente (100-200 caracteres)
- [ ] Logs estructurados para debugging
- [ ] Testing con diferentes velocidades de conexión

---

## 📚 References

- [Vercel Streaming Docs](https://vercel.com/docs/functions/edge-functions/streaming)
- [OpenAI Streaming Guide](https://platform.openai.com/docs/api-reference/streaming)
- [ReadableStream API](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

**Última actualización**: 2025 - GPT-4o Streaming on Vercel Edge Functions
