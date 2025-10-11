import { GoogleGenerativeAI, FunctionDeclaration } from '@google/generative-ai';
import { describe, test, expect, beforeAll } from '@jest/globals';

// Tool definition matching migue.ai's schedule_meeting
const scheduleMeetingTool: FunctionDeclaration = {
  name: 'schedule_meeting',
  description: 'Programa una cita o reunión',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Título de la cita'
      },
      datetime: {
        type: 'string',
        description: 'Fecha y hora en formato ISO 8601 (zona horaria America/Bogota)'
      },
      duration_minutes: {
        type: 'number',
        description: 'Duración en minutos'
      },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'Lista de asistentes (nombres o correos)'
      },
      location: {
        type: 'string',
        description: 'Ubicación (dirección o link de videollamada)'
      },
      notes: {
        type: 'string',
        description: 'Notas adicionales (opcional)'
      }
    },
    required: ['title', 'datetime', 'duration_minutes']
  }
};

describe('Gemini Function Calling - Appointments', () => {
  let genAI: GoogleGenerativeAI;

  beforeAll(() => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  });

  test('should schedule simple appointment', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [scheduleMeetingTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Programa una reunión con Juan mañana a las 10am por 1 hora'
    );

    const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

    console.log('\n✓ Simple appointment test');
    console.log('Function call:', JSON.stringify(call, null, 2));

    expect(call.name).toBe('schedule_meeting');
    expect(call.args.title).toMatch(/Juan|reunión/i);
    expect(call.args.datetime).toMatch(/10:00/);
    expect(call.args.duration_minutes).toBe(60);
  });

  test('should extract attendees from natural language', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [scheduleMeetingTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Agenda una reunión con María, Pedro y Ana el viernes a las 2pm, 30 minutos'
    );

    const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

    console.log('\n✓ Multiple attendees test');
    console.log('Function call:', JSON.stringify(call, null, 2));

    expect(call?.name).toBe('schedule_meeting');
    expect(call?.args.attendees).toBeDefined();
    expect(call?.args.attendees).toHaveLength(3);
    expect(call?.args.attendees).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/María/i),
        expect.stringMatching(/Pedro/i),
        expect.stringMatching(/Ana/i)
      ])
    );
    expect(call?.args.duration_minutes).toBe(30);
  });

  test('should detect virtual meeting locations', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [scheduleMeetingTool] }]
    });

    const testCases = [
      {
        input: 'Reunión por Zoom mañana a las 3pm, 45 minutos',
        expectedLocation: /zoom/i
      },
      {
        input: 'Video llamada por Google Meet el lunes a las 9am, 1 hora',
        expectedLocation: /meet|google/i
      },
      {
        input: 'Llamada por Teams pasado mañana a las 11am, 30 minutos',
        expectedLocation: /teams/i
      }
    ];

    console.log('\n✓ Virtual meeting detection test');

    for (const testCase of testCases) {
      const chat = model.startChat();
      const result = await chat.sendMessage(testCase.input);
      const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

      console.log(`Input: "${testCase.input}"`);
      console.log('Location:', call?.args.location);

      expect(call?.name).toBe('schedule_meeting');
      if (call?.args.location) {
        expect(call.args.location).toMatch(testCase.expectedLocation);
      }
    }
  });

  test('should handle Colombian time expressions', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [scheduleMeetingTool] }]
    });

    const testCases = [
      {
        input: 'Cita con el doctor el jueves en la mañana',
        expectedHour: { min: 7, max: 11 } // Mañana: 7am-11am
      },
      {
        input: 'Reunión el martes en la tarde',
        expectedHour: { min: 14, max: 18 } // Tarde: 2pm-6pm
      },
      {
        input: 'Llamada el viernes en la noche a las 7',
        expectedHour: { min: 19, max: 19 } // 7pm = 19:00
      }
    ];

    console.log('\n✓ Colombian time expressions test');

    for (const testCase of testCases) {
      const chat = model.startChat();
      const result = await chat.sendMessage(testCase.input);
      const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

      console.log(`Input: "${testCase.input}"`);
      console.log('Datetime:', call?.args.datetime);

      expect(call?.name).toBe('schedule_meeting');

      if (call?.args.datetime) {
        const datetime = new Date(call.args.datetime);
        const hour = datetime.getHours();

        expect(hour).toBeGreaterThanOrEqual(testCase.expectedHour.min);
        expect(hour).toBeLessThanOrEqual(testCase.expectedHour.max);
      }
    }
  });

  test('should understand duration from context', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [scheduleMeetingTool] }]
    });

    const testCases = [
      {
        input: 'Reunión rápida con el equipo mañana a las 10am',
        expectedDuration: { min: 15, max: 30 }
      },
      {
        input: 'Entrevista de trabajo el viernes a las 2pm',
        expectedDuration: { min: 45, max: 90 }
      },
      {
        input: 'Almuerzo con cliente el miércoles al mediodía',
        expectedDuration: { min: 60, max: 120 }
      }
    ];

    console.log('\n✓ Duration inference test');

    for (const testCase of testCases) {
      const chat = model.startChat();
      const result = await chat.sendMessage(testCase.input);
      const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

      console.log(`Input: "${testCase.input}"`);
      console.log('Duration:', call?.args.duration_minutes);

      expect(call?.name).toBe('schedule_meeting');

      if (call?.args.duration_minutes) {
        expect(call.args.duration_minutes).toBeGreaterThanOrEqual(
          testCase.expectedDuration.min
        );
        expect(call.args.duration_minutes).toBeLessThanOrEqual(
          testCase.expectedDuration.max
        );
      }
    }
  });

  test('should handle physical locations', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [scheduleMeetingTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Reunión en la oficina de la Calle 100 con Carrera 15 mañana a las 4pm, 1 hora'
    );

    const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

    console.log('\n✓ Physical location test');
    console.log('Function call:', JSON.stringify(call, null, 2));

    expect(call?.name).toBe('schedule_meeting');
    expect(call?.args.location).toMatch(/Calle 100|Carrera 15/i);
  });

  test('should ask for missing required information', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [scheduleMeetingTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Quiero agendar una reunión con Carlos'
    );

    const calls = result.response.functionCalls();
    const text = result.response.text();

    console.log('\n✓ Missing information test');
    console.log('Response:', text);

    // NO debería llamar la función sin fecha/hora
    expect(calls).toBeUndefined();

    // Debería preguntar por fecha/hora
    expect(text).toMatch(/cuándo|qué día|qué hora|fecha/i);
  });

  test('should handle recurring meeting expressions', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [scheduleMeetingTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Reunión semanal con el equipo todos los lunes a las 9am, 30 minutos'
    );

    const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

    console.log('\n✓ Recurring meeting test');
    console.log('Function call:', JSON.stringify(call, null, 2));

    expect(call?.name).toBe('schedule_meeting');

    // Debería detectar que es el próximo lunes
    if (call?.args.datetime) {
      const datetime = new Date(call.args.datetime);
      expect(datetime.getDay()).toBe(1); // Lunes = 1
      expect(call.args.datetime).toMatch(/09:00/);
    }

    // Debería mencionar "semanal" o "recurrente" en notas
    if (call?.args.notes) {
      expect(call.args.notes).toMatch(/semanal|recurrente|lunes/i);
    }
  });

  test('should use Bogota timezone for appointments', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [scheduleMeetingTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Cita con el dentista mañana a las 3pm, 45 minutos'
    );

    const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

    console.log('\n✓ Timezone test');
    console.log('Datetime:', call?.args.datetime);

    // Debe incluir timezone de Bogotá
    expect(call?.args.datetime).toMatch(/-05:00|America\/Bogota/);
  });
});
