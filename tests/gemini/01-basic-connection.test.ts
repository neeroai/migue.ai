import { GoogleGenerativeAI } from '@google/generative-ai';
import { describe, test, expect, beforeAll } from '@jest/globals';

describe('Gemini Basic Connection', () => {
  let genAI: GoogleGenerativeAI;

  beforeAll(() => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not set in .env.local');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  });

  test('should connect to Gemini API', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });

    const result = await model.generateContent('Hola');

    expect(result).toBeDefined();
    expect(result.response.text()).toBeTruthy();

    console.log('✓ Connection test passed');
    console.log('Response:', result.response.text());
  });

  test('should respond in Spanish', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });

    const result = await model.generateContent(
      '¿Cómo estás? Responde en español colombiano.'
    );

    const text = result.response.text();

    console.log('\n✓ Spanish test');
    console.log('Response:', text);

    // Debe contener español
    expect(text).toMatch(/[áéíóúñ]/i);

    // NO debe estar en inglés
    expect(text).not.toMatch(/^(I am|I'm|Hello)/);
  });

  test('should have acceptable latency', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });

    const start = Date.now();
    await model.generateContent('Di "test"');
    const latency = Date.now() - start;

    console.log(`\n✓ Latency test: ${latency}ms`);

    // Debe responder en menos de 3 segundos
    expect(latency).toBeLessThan(3000);
  });

  test('should return usage metadata', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });

    const result = await model.generateContent(
      'Cuenta del 1 al 10'
    );

    const usage = result.response.usageMetadata;

    console.log('\n✓ Usage metadata test');
    console.log('Token usage:', {
      input: usage?.promptTokenCount,
      output: usage?.candidatesTokenCount,
      total: usage?.totalTokenCount
    });

    expect(usage).toBeDefined();
    expect(usage?.promptTokenCount).toBeGreaterThan(0);
    expect(usage?.candidatesTokenCount).toBeGreaterThan(0);
    expect(usage?.totalTokenCount).toBeGreaterThan(0);
  });

  test('should maintain Spanish across conversation', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });

    const chat = model.startChat({
      history: []
    });

    // Mensaje 1
    await chat.sendMessage('Hola, ¿cómo estás?');

    // Mensaje 2
    const result2 = await chat.sendMessage('¿Qué puedes hacer?');

    // Mensaje 3
    const result3 = await chat.sendMessage('Cuéntame más');

    console.log('\n✓ Conversation test');
    console.log('Message 2:', result2.response.text());
    console.log('Message 3:', result3.response.text());

    // Todos deben estar en español
    expect(result2.response.text()).toMatch(/[áéíóúñ]/i);
    expect(result3.response.text()).toMatch(/[áéíóúñ]/i);

    // Ninguno en inglés
    expect(result2.response.text()).not.toMatch(/^I can|I am able/i);
    expect(result3.response.text()).not.toMatch(/^Let me|I will/i);
  });
});
