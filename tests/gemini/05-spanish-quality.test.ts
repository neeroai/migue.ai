import { GoogleGenerativeAI } from '@google/generative-ai';
import { describe, test, expect, beforeAll } from '@jest/globals';
import { measureLatency } from './utils/gemini-test-helper';

describe('Gemini Spanish Quality', () => {
  let genAI: GoogleGenerativeAI;

  beforeAll(() => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  });

  test('should use Colombian Spanish naturally', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Eres un asistente colombiano amigable. Usa español natural de Colombia.'
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      '¿Qué tal? ¿Cómo me puedes ayudar?'
    );

    const text = result.response.text();

    console.log('\n✓ Colombian Spanish test');
    console.log('Response:', text);

    // Debe contener español
    expect(text).toMatch(/[áéíóúñ]/i);

    // NO debe estar en inglés
    expect(text).not.toMatch(/^(I can|I am|I'm|Hello|Hi there)/i);

    // Debería usar lenguaje natural y amigable
    expect(text.length).toBeGreaterThan(20);
  });

  test('should understand Colombian slang and expressions', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Eres un asistente colombiano que entiende expresiones locales.'
    });

    const testCases = [
      {
        input: '¿Cuánto vale un tinto?',
        expectedUnderstanding: /café|tinto/i
      },
      {
        input: 'Voy a comprar arepas e\' huevo',
        expectedUnderstanding: /arepa/i
      },
      {
        input: 'Qué chimba tu ayuda',
        expectedUnderstanding: /gracias|agradec|gusto/i
      },
      {
        input: 'Me tocó madrugar un resto',
        expectedUnderstanding: /temprano|madrugada|mucho/i
      }
    ];

    console.log('\n✓ Colombian slang understanding test');

    for (const testCase of testCases) {
      const chat = model.startChat();
      const result = await chat.sendMessage(testCase.input);
      const text = result.response.text();

      console.log(`Input: "${testCase.input}"`);
      console.log('Response:', text);

      // Debería responder en español
      expect(text).toMatch(/[áéíóúñ]/i);

      // Debería demostrar que entendió el contexto
      expect(text).toMatch(testCase.expectedUnderstanding);
    }
  });

  test('should maintain conversational context in Spanish', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Eres Migue, un asistente personal colombiano.'
    });

    const chat = model.startChat();

    // Mensaje 1
    await chat.sendMessage('Hola, me llamo Juan');

    // Mensaje 2
    const result2 = await chat.sendMessage('¿Cómo me puedes ayudar?');

    // Mensaje 3 - debería recordar el nombre
    const result3 = await chat.sendMessage('¿Cuál es mi nombre?');

    const text3 = result3.response.text();

    console.log('\n✓ Conversational context test');
    console.log('Message 2:', result2.response.text());
    console.log('Message 3:', text3);

    // Debería recordar el nombre
    expect(text3).toMatch(/Juan/);

    // Todo en español
    expect(result2.response.text()).toMatch(/[áéíóúñ]/i);
    expect(text3).toMatch(/[áéíóúñ]/i);
  });

  test('should use appropriate formality level', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Eres un asistente amigable que usa "tú" (informal) en español colombiano.'
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      '¿Me ayudas a programar una cita?'
    );

    const text = result.response.text();

    console.log('\n✓ Formality level test');
    console.log('Response:', text);

    // Debería usar "tú" (informal)
    // Buscar patrones como: "puedes", "tienes", "necesitas", "quieres"
    const informalPatterns = /\b(puedes|tienes|necesitas|quieres|sabes|puedas)\b/i;

    expect(text).toMatch(informalPatterns);

    // NO debería usar "usted" (formal)
    expect(text).not.toMatch(/\b(puede usted|tiene usted|necesita usted)\b/i);
  });

  test('should handle accents and special characters correctly', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Repite exactamente: "Ñoño José comió ají en Bogotá"'
    );

    const text = result.response.text();

    console.log('\n✓ Accents and special characters test');
    console.log('Response:', text);

    // Debería mantener los acentos
    expect(text).toMatch(/Ñ|ñ/);
    expect(text).toMatch(/José|jose/i);
    expect(text).toMatch(/comió/i);
    expect(text).toMatch(/Bogotá/i);
  });

  test('should respond naturally to time-related queries', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Eres un asistente colombiano. Usa zona horaria America/Bogota (UTC-5).'
    });

    const testCases = [
      {
        input: '¿Qué hora es?',
        shouldMention: /hora|Colombia|Bogotá/i
      },
      {
        input: 'Recuérdame algo en la mañana',
        shouldMention: /mañana|7|8|9|10|11/
      },
      {
        input: 'Cita en la tarde',
        shouldMention: /tarde|2|3|4|5|6/
      }
    ];

    console.log('\n✓ Time-related queries test');

    for (const testCase of testCases) {
      const chat = model.startChat();
      const result = await chat.sendMessage(testCase.input);
      const text = result.response.text();

      console.log(`Input: "${testCase.input}"`);
      console.log('Response:', text);

      // Debería responder en español
      expect(text).toMatch(/[áéíóúñ]/i);
    }
  });

  test('should provide helpful error messages in Spanish', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Eres un asistente colombiano. Si no entiendes algo, pide aclaración en español.'
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Haz algo con la cosa esa'
    );

    const text = result.response.text();

    console.log('\n✓ Error message quality test');
    console.log('Response:', text);

    // Debería pedir aclaración en español
    expect(text).toMatch(/[áéíóúñ]/i);

    // Debería contener palabras clave de solicitud de aclaración
    expect(text).toMatch(/qué|cuál|específic|aclar|más información|detalles/i);

    // NO debería ser un mensaje genérico en inglés
    expect(text).not.toMatch(/^(I don't|I can't|I'm not|Sorry, I)/i);
  });

  test('should handle multi-turn conversations naturally', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Eres Migue, un asistente personal colombiano amigable.'
    });

    const chat = model.startChat();

    // Turno 1
    const r1 = await chat.sendMessage('Hola');
    console.log('\n✓ Multi-turn conversation test');
    console.log('Turn 1:', r1.response.text());

    // Turno 2
    const r2 = await chat.sendMessage('¿Qué sabes hacer?');
    console.log('Turn 2:', r2.response.text());

    // Turno 3
    const r3 = await chat.sendMessage('Cuéntame más sobre recordatorios');
    console.log('Turn 3:', r3.response.text());

    // Turno 4
    const r4 = await chat.sendMessage('Gracias');
    console.log('Turn 4:', r4.response.text());

    // Todos deben estar en español
    expect(r1.response.text()).toMatch(/[áéíóúñ]/i);
    expect(r2.response.text()).toMatch(/[áéíóúñ]/i);
    expect(r3.response.text()).toMatch(/[áéíóúñ]/i);
    expect(r4.response.text()).toMatch(/[áéíóúñ]/i);

    // El último debería ser una despedida cordial
    expect(r4.response.text()).toMatch(/nada|orden|servicio|cuenta|conmigo/i);
  });

  test('should maintain response quality under load', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Eres un asistente colombiano conciso y eficiente.'
    });

    const queries = [
      '¿Qué hora es?',
      'Recuérdame comprar pan',
      '¿Cómo está el clima?',
      'Ayúdame con algo',
      'Gracias'
    ];

    console.log('\n✓ Response quality under load test');

    const latencies: number[] = [];

    for (const query of queries) {
      const chat = model.startChat();

      const { result, latency } = await measureLatency(async () => {
        return await chat.sendMessage(query);
      });

      latencies.push(latency);

      const text = result.response.text();

      console.log(`Query: "${query}" (${latency}ms)`);
      console.log('Response:', text);

      // Todas las respuestas deben estar en español
      expect(text).toMatch(/[áéíóúñ]/i);

      // Todas deben ser relevantes (no vacías)
      expect(text.length).toBeGreaterThan(10);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`Average latency: ${avgLatency.toFixed(0)}ms`);

    // Latencia promedio debe ser razonable
    expect(avgLatency).toBeLessThan(3000);
  });

  test('should understand Colombian time zones and schedules', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Eres un asistente colombiano. La zona horaria es America/Bogota (UTC-5). El horario laboral es 7am-8pm.'
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      '¿A qué hora es mejor programar una reunión de trabajo?'
    );

    const text = result.response.text();

    console.log('\n✓ Colombian schedule understanding test');
    console.log('Response:', text);

    // Debería mencionar horario laboral colombiano
    expect(text).toMatch(/mañana|tarde|laboral|trabajo/i);

    // Debería estar en español
    expect(text).toMatch(/[áéíóúñ]/i);
  });
});
