import { GoogleGenerativeAI, FunctionDeclaration } from '@google/generative-ai';
import OpenAI from 'openai';
import { describe, test, expect, beforeAll } from '@jest/globals';
import { measureLatency } from './utils/gemini-test-helper';

// Shared tool definitions
const createReminderTool: FunctionDeclaration = {
  name: 'create_reminder',
  description: 'Crea un recordatorio para el usuario',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título del recordatorio' },
      datetime: { type: 'string', description: 'Fecha y hora en formato ISO 8601' },
      notes: { type: 'string', description: 'Notas adicionales' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'] }
    },
    required: ['title', 'datetime']
  }
};

const createReminderToolOpenAI = {
  type: 'function' as const,
  function: {
    name: 'create_reminder',
    description: 'Crea un recordatorio para el usuario',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título del recordatorio' },
        datetime: { type: 'string', description: 'Fecha y hora en formato ISO 8601' },
        notes: { type: 'string', description: 'Notas adicionales' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] }
      },
      required: ['title', 'datetime']
    }
  }
};

describe('Gemini vs GPT-4o-mini Comparison', () => {
  let genAI: GoogleGenerativeAI;
  let openai: OpenAI;

  beforeAll(() => {
    const geminiKey = process.env.GOOGLE_AI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!geminiKey || !openaiKey) {
      throw new Error('API keys not set');
    }

    genAI = new GoogleGenerativeAI(geminiKey);
    openai = new OpenAI({ apiKey: openaiKey });
  });

  test('compare function calling accuracy', async () => {
    const input = 'Recuérdame llamar a mi mamá el viernes que viene a las 3pm';

    // Gemini
    const geminiModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [createReminderTool] }]
    });

    const { result: geminiResult, latency: geminiLatency } = await measureLatency(
      async () => {
        const chat = geminiModel.startChat();
        return await chat.sendMessage(input);
      }
    );

    const geminiCalls = geminiResult.response.functionCalls();
    const geminiCall = geminiCalls && geminiCalls.length > 0 ? geminiCalls[0] : undefined;

    // GPT-4o-mini
    const { result: openaiResult, latency: openaiLatency } = await measureLatency(
      async () => {
        return await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: input }],
          tools: [createReminderToolOpenAI]
        });
      }
    );

    const openaiChoice = openaiResult.choices[0];
    const openaiCall = openaiChoice?.message.tool_calls && openaiChoice.message.tool_calls.length > 0
      ? openaiChoice.message.tool_calls[0]
      : undefined;

    console.log('\n=== Function Calling Comparison ===');
    console.log('\nGemini (gemini-2.5-flash):');
    console.log('Latency:', geminiLatency, 'ms');
    console.log('Call:', JSON.stringify(geminiCall, null, 2));
    console.log('\nGPT-4o-mini:');
    console.log('Latency:', openaiLatency, 'ms');
    console.log('Call:', JSON.stringify(openaiCall, null, 2));

    // Ambos deberían llamar la función
    expect(geminiCall).toBeDefined();
    expect(openaiCall).toBeDefined();

    // Verificar precisión de parámetros (viernes, 3pm)
    if (geminiCall) {
      const geminiDate = new Date(geminiCall.args.datetime);
      expect(geminiDate.getDay()).toBe(5); // Viernes
      expect(geminiCall.args.datetime).toMatch(/15:00/);
    }

    if (openaiCall && openaiCall.function.arguments) {
      const openaiArgs = JSON.parse(openaiCall.function.arguments);
      const openaiDate = new Date(openaiArgs.datetime);
      expect(openaiDate.getDay()).toBe(5);
      expect(openaiArgs.datetime).toMatch(/15:00/);
    }
  });

  test('compare Spanish language quality', async () => {
    const input = '¿Qué tal? ¿Cómo me puedes ayudar hoy?';

    // Gemini
    const geminiModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Eres un asistente colombiano amigable.'
    });

    const { result: geminiResult, latency: geminiLatency } = await measureLatency(
      async () => {
        const chat = geminiModel.startChat();
        return await chat.sendMessage(input);
      }
    );

    const geminiText = geminiResult.response.text();

    // GPT-4o-mini
    const { result: openaiResult, latency: openaiLatency } = await measureLatency(
      async () => {
        return await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Eres un asistente colombiano amigable.' },
            { role: 'user', content: input }
          ]
        });
      }
    );

    const openaiText = openaiResult.choices[0]?.message.content || '';

    console.log('\n=== Spanish Quality Comparison ===');
    console.log('\nGemini (gemini-2.5-flash):');
    console.log('Latency:', geminiLatency, 'ms');
    console.log('Response:', geminiText);
    console.log('\nGPT-4o-mini:');
    console.log('Latency:', openaiLatency, 'ms');
    console.log('Response:', openaiText);

    // Ambos deben responder en español
    expect(geminiText).toMatch(/[áéíóúñ]/i);
    expect(openaiText).toMatch(/[áéíóúñ]/i);

    // Ninguno en inglés
    expect(geminiText).not.toMatch(/^(I can|I am|Hello)/i);
    expect(openaiText).not.toMatch(/^(I can|I am|Hello)/i);
  });

  test('compare Colombian expression understanding', async () => {
    const inputs = [
      '¿Cuánto vale un tinto?',
      'Voy a comprar arepa e\' huevo',
      'Me tocó madrugar un resto'
    ];

    console.log('\n=== Colombian Expression Understanding ===');

    for (const input of inputs) {
      // Gemini
      const geminiModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: 'Eres un asistente colombiano que entiende expresiones locales.'
      });

      const geminiChat = geminiModel.startChat();
      const geminiResult = await geminiChat.sendMessage(input);
      const geminiText = geminiResult.response.text();

      // GPT-4o-mini
      const openaiResult = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Eres un asistente colombiano que entiende expresiones locales.' },
          { role: 'user', content: input }
        ]
      });

      const openaiText = openaiResult.choices[0]?.message.content || '';

      console.log(`\nInput: "${input}"`);
      console.log('Gemini:', geminiText.substring(0, 100) + '...');
      console.log('OpenAI:', openaiText.substring(0, 100) + '...');

      // Ambos deben responder en español
      expect(geminiText).toMatch(/[áéíóúñ]/i);
      expect(openaiText).toMatch(/[áéíóúñ]/i);
    }
  });

  test('compare latency across multiple requests', async () => {
    const queries = [
      'Hola',
      '¿Qué hora es?',
      'Recuérdame algo mañana',
      '¿Cómo está el clima?',
      'Gracias'
    ];

    const geminiLatencies: number[] = [];
    const openaiLatencies: number[] = [];

    console.log('\n=== Latency Comparison ===');

    for (const query of queries) {
      // Gemini
      const geminiModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash'
      });

      const { latency: geminiLatency } = await measureLatency(async () => {
        const chat = geminiModel.startChat();
        return await chat.sendMessage(query);
      });

      geminiLatencies.push(geminiLatency);

      // GPT-4o-mini
      const { latency: openaiLatency } = await measureLatency(async () => {
        return await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: query }]
        });
      });

      openaiLatencies.push(openaiLatency);

      console.log(`Query: "${query}"`);
      console.log(`  Gemini: ${geminiLatency}ms | GPT-4o-mini: ${openaiLatency}ms`);
    }

    const geminiAvg = geminiLatencies.reduce((a, b) => a + b, 0) / geminiLatencies.length;
    const openaiAvg = openaiLatencies.reduce((a, b) => a + b, 0) / openaiLatencies.length;

    console.log('\nAverage Latency:');
    console.log(`  Gemini: ${geminiAvg.toFixed(0)}ms`);
    console.log(`  GPT-4o-mini: ${openaiAvg.toFixed(0)}ms`);

    // Ambos deben tener latencia razonable
    expect(geminiAvg).toBeLessThan(5000);
    expect(openaiAvg).toBeLessThan(5000);
  });

  test('compare token efficiency', async () => {
    const input = 'Explica brevemente cómo crear un recordatorio';

    // Gemini
    const geminiModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });

    const geminiChat = geminiModel.startChat();
    const geminiResult = await geminiChat.sendMessage(input);
    const geminiUsage = geminiResult.response.usageMetadata;
    const geminiText = geminiResult.response.text();

    // GPT-4o-mini
    const openaiResult = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: input }]
    });

    const openaiUsage = openaiResult.usage;
    const openaiText = openaiResult.choices[0]?.message.content || '';

    console.log('\n=== Token Efficiency Comparison ===');
    console.log('\nGemini:');
    console.log('Input tokens:', geminiUsage?.promptTokenCount);
    console.log('Output tokens:', geminiUsage?.candidatesTokenCount);
    console.log('Total tokens:', geminiUsage?.totalTokenCount);
    console.log('Response length:', geminiText.length);

    console.log('\nGPT-4o-mini:');
    console.log('Input tokens:', openaiUsage?.prompt_tokens);
    console.log('Output tokens:', openaiUsage?.completion_tokens);
    console.log('Total tokens:', openaiUsage?.total_tokens);
    console.log('Response length:', openaiText.length);

    // Verificar que ambos tienen metadata
    expect(geminiUsage?.totalTokenCount).toBeGreaterThan(0);
    expect(openaiUsage?.total_tokens).toBeGreaterThan(0);
  });

  test('compare multi-turn conversation handling', async () => {
    console.log('\n=== Multi-turn Conversation Comparison ===');

    // Gemini
    const geminiModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Eres Migue, un asistente colombiano.'
    });

    const geminiChat = geminiModel.startChat();

    await geminiChat.sendMessage('Hola, me llamo Juan');
    await geminiChat.sendMessage('¿Qué sabes hacer?');
    const geminiR3 = await geminiChat.sendMessage('¿Cuál es mi nombre?');
    const geminiText = geminiR3.response.text();

    console.log('\nGemini conversation:');
    console.log('Response to "¿Cuál es mi nombre?":', geminiText);

    // GPT-4o-mini
    const openaiMessages = [
      { role: 'system' as const, content: 'Eres Migue, un asistente colombiano.' },
      { role: 'user' as const, content: 'Hola, me llamo Juan' },
      { role: 'assistant' as const, content: 'Hola Juan, ¿cómo estás?' },
      { role: 'user' as const, content: '¿Qué sabes hacer?' },
      { role: 'assistant' as const, content: 'Puedo ayudarte con recordatorios, citas y gastos.' },
      { role: 'user' as const, content: '¿Cuál es mi nombre?' }
    ];

    const openaiResult = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages
    });

    const openaiText = openaiResult.choices[0]?.message.content || '';

    console.log('\nGPT-4o-mini conversation:');
    console.log('Response to "¿Cuál es mi nombre?":', openaiText);

    // Ambos deberían recordar el nombre
    expect(geminiText).toMatch(/Juan/i);
    expect(openaiText).toMatch(/Juan/i);
  });

  test('compare cost estimation for typical usage', async () => {
    // Typical daily usage: 100 messages, avg 50 input + 100 output tokens

    const messagesPerDay = 100;
    const avgInputTokens = 50;
    const avgOutputTokens = 100;

    // Gemini 2.5 Flash pricing
    const geminiInputCost = 0.0; // Free tier: 250K tokens/day
    const geminiOutputCost = 0.0; // Free tier

    // GPT-4o-mini pricing (después del free tier)
    const openaiInputCost = (avgInputTokens * messagesPerDay) / 1_000_000 * 0.15; // $0.15 per 1M
    const openaiOutputCost = (avgOutputTokens * messagesPerDay) / 1_000_000 * 0.60; // $0.60 per 1M

    const geminiDailyCost = geminiInputCost + geminiOutputCost;
    const openaiDailyCost = openaiInputCost + openaiOutputCost;

    const geminiMonthlyCost = geminiDailyCost * 30;
    const openaiMonthlyCost = openaiDailyCost * 30;

    console.log('\n=== Cost Comparison (Estimated) ===');
    console.log('\nAssumptions:');
    console.log('- 100 messages/day');
    console.log('- 50 input tokens/message');
    console.log('- 100 output tokens/message');

    console.log('\nGemini 2.5 Flash:');
    console.log('Daily cost: $' + geminiDailyCost.toFixed(4));
    console.log('Monthly cost: $' + geminiMonthlyCost.toFixed(2));
    console.log('(Within free tier: 250K tokens/day)');

    console.log('\nGPT-4o-mini:');
    console.log('Daily cost: $' + openaiDailyCost.toFixed(4));
    console.log('Monthly cost: $' + openaiMonthlyCost.toFixed(2));

    console.log('\nSavings with Gemini: $' + (openaiMonthlyCost - geminiMonthlyCost).toFixed(2) + '/month');

    // Log costs for verification
    expect(geminiMonthlyCost).toBeLessThanOrEqual(openaiMonthlyCost);
  });

  test('compare error handling', async () => {
    const ambiguousInput = 'Haz algo';

    console.log('\n=== Error Handling Comparison ===');

    // Gemini
    const geminiModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Si no entiendes algo, pide aclaración en español.'
    });

    const geminiChat = geminiModel.startChat();
    const geminiResult = await geminiChat.sendMessage(ambiguousInput);
    const geminiText = geminiResult.response.text();

    console.log('\nGemini response:');
    console.log(geminiText);

    // GPT-4o-mini
    const openaiResult = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Si no entiendes algo, pide aclaración en español.' },
        { role: 'user', content: ambiguousInput }
      ]
    });

    const openaiText = openaiResult.choices[0]?.message.content || '';

    console.log('\nGPT-4o-mini response:');
    console.log(openaiText);

    // Ambos deberían pedir aclaración en español
    expect(geminiText).toMatch(/[áéíóúñ]/i);
    expect(openaiText).toMatch(/[áéíóúñ]/i);

    expect(geminiText).toMatch(/qué|cuál|específic|aclar/i);
    expect(openaiText).toMatch(/qué|cuál|específic|aclar/i);
  });
});
