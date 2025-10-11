import { GoogleGenerativeAI, FunctionDeclaration } from '@google/generative-ai';
import { describe, test, expect, beforeAll } from '@jest/globals';

// Tool definition matching migue.ai's create_reminder
const createReminderTool: FunctionDeclaration = {
  name: 'create_reminder',
  description: 'Crea un recordatorio para el usuario',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Título del recordatorio'
      },
      datetime: {
        type: 'string',
        description: 'Fecha y hora en formato ISO 8601 (zona horaria America/Bogota)'
      },
      notes: {
        type: 'string',
        description: 'Notas adicionales (opcional)'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Prioridad del recordatorio'
      }
    },
    required: ['title', 'datetime']
  }
};

describe('Gemini Function Calling - Reminders', () => {
  let genAI: GoogleGenerativeAI;

  beforeAll(() => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  });

  test('should create simple reminder', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [createReminderTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Recuérdame comprar leche mañana a las 5pm'
    );

    const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

    console.log('\n✓ Simple reminder test');
    console.log('Function call:', JSON.stringify(call, null, 2));

    expect(call.name).toBe('create_reminder');
    expect(call.args.title).toMatch(/leche/i);
    expect(call.args.datetime).toMatch(/17:00/); // 5pm
  });

  test('should parse "el viernes que viene"', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [createReminderTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Recuérdame llamar a mi mamá el viernes que viene a las 3 de la tarde'
    );

    const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

    console.log('\n✓ Natural date parsing test');
    console.log('Function call:', JSON.stringify(call, null, 2));

    expect(call.name).toBe('create_reminder');
    expect(call.args.title).toMatch(/mamá|mama/i);

    // Verificar que detectó viernes
    const datetime = new Date(call.args.datetime);
    expect(datetime.getDay()).toBe(5); // Viernes = 5

    // Verificar 3pm
    expect(call.args.datetime).toMatch(/15:00/);
  });

  test('should infer priority from context', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [createReminderTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'URGENTE: Recuérdame enviar el informe antes de las 6pm hoy'
    );

    const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

    console.log('\n✓ Priority inference test');
    console.log('Function call:', JSON.stringify(call, null, 2));

    expect(call.name).toBe('create_reminder');
    expect(call.args.priority).toBe('high');
  });

  test('should understand Colombian expressions', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [createReminderTool] }]
    });

    const testCases = [
      {
        input: 'Recuérdame comprar la arepa e\' huevo mañana',
        expectedTitle: /arepa.*huevo/i
      },
      {
        input: 'Poneme un recordatorio para comprar tinto en la tarde',
        expectedTitle: /tinto/i
      },
      {
        input: 'Que no se me olvide comprar el mercado el finde',
        expectedTitle: /mercado/i
      }
    ];

    console.log('\n✓ Colombian expressions test');

    for (const testCase of testCases) {
      const chat = model.startChat();
      const result = await chat.sendMessage(testCase.input);

      const calls = result.response.functionCalls();
      expect(calls).toBeDefined();
      expect(calls!.length).toBeGreaterThan(0);

      const call = calls![0]!;

      console.log(`Input: "${testCase.input}"`);
      console.log('Title:', call.args.title);

      expect(call.name).toBe('create_reminder');
      expect(call.args.title).toMatch(testCase.expectedTitle);
    }
  });

  test('should ask for clarification when date is ambiguous', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [createReminderTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Recuérdame comprar flores'
    );

    const calls = result.response.functionCalls();
    const text = result.response.text();

    console.log('\n✓ Ambiguity handling test');
    console.log('Response:', text);

    // NO debería llamar la función sin fecha
    expect(calls).toBeUndefined();

    // Debería preguntar por la fecha
    expect(text).toMatch(/cuándo|qué día|qué hora/i);
  });

  test('should use Bogota timezone', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [createReminderTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Recuérdame algo mañana a las 8am'
    );

    const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

    console.log('\n✓ Timezone test');
    console.log('Datetime:', call.args.datetime);

    // Debe incluir timezone
    expect(call.args.datetime).toMatch(/-05:00|America\/Bogota/);
  });
});
