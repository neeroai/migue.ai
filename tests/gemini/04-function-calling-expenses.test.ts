import { GoogleGenerativeAI, FunctionDeclaration } from '@google/generative-ai';
import { describe, test, expect, beforeAll } from '@jest/globals';

// Tool definition matching migue.ai's track_expense
const trackExpenseTool: FunctionDeclaration = {
  name: 'track_expense',
  description: 'Registra un gasto o egreso',
  parameters: {
    type: 'object',
    properties: {
      amount: {
        type: 'number',
        description: 'Monto del gasto'
      },
      currency: {
        type: 'string',
        enum: ['COP', 'USD', 'EUR'],
        description: 'Moneda (por defecto COP para Colombia)'
      },
      category: {
        type: 'string',
        enum: [
          'alimentacion',
          'transporte',
          'servicios',
          'entretenimiento',
          'salud',
          'educacion',
          'compras',
          'otros'
        ],
        description: 'Categoría del gasto'
      },
      description: {
        type: 'string',
        description: 'Descripción del gasto'
      },
      date: {
        type: 'string',
        description: 'Fecha del gasto en formato ISO 8601 (zona horaria America/Bogota)'
      },
      payment_method: {
        type: 'string',
        enum: ['efectivo', 'tarjeta', 'transferencia', 'otro'],
        description: 'Método de pago utilizado'
      }
    },
    required: ['amount', 'category', 'description']
  }
};

describe('Gemini Function Calling - Expenses', () => {
  let genAI: GoogleGenerativeAI;

  beforeAll(() => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  });

  test('should track simple expense', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [trackExpenseTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Gasté $25,000 en el almuerzo'
    );

    const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

    console.log('\n✓ Simple expense test');
    console.log('Function call:', JSON.stringify(call, null, 2));

    expect(call).toBeDefined();
    expect(call?.name).toBe('track_expense');
    expect(call?.args.amount).toBe(25000);
    expect(call?.args.category).toBe('alimentacion');
    expect(call?.args.description).toMatch(/almuerzo/i);
  });

  test('should infer category from context', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [trackExpenseTool] }]
    });

    const testCases = [
      {
        input: 'Pagué $8,000 del taxi',
        expectedCategory: 'transporte',
        expectedAmount: 8000
      },
      {
        input: 'Compré medicamentos por $45,000',
        expectedCategory: 'salud',
        expectedAmount: 45000
      },
      {
        input: 'Netflix me cobró $35,000',
        expectedCategory: 'entretenimiento',
        expectedAmount: 35000
      },
      {
        input: 'Pagué la luz $120,000',
        expectedCategory: 'servicios',
        expectedAmount: 120000
      }
    ];

    console.log('\n✓ Category inference test');

    for (const testCase of testCases) {
      const chat = model.startChat();
      const result = await chat.sendMessage(testCase.input);
      const calls = result.response.functionCalls();
      expect(calls).toBeDefined();
      expect(calls!.length).toBeGreaterThan(0);

      const call = calls![0]!;

      console.log(`Input: "${testCase.input}"`);
      console.log('Category:', call?.args.category);
      console.log('Amount:', call?.args.amount);

      expect(call?.name).toBe('track_expense');
      expect(call?.args.category).toBe(testCase.expectedCategory);
      expect(call?.args.amount).toBe(testCase.expectedAmount);
    }
  });

  test('should handle Colombian currency expressions', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [trackExpenseTool] }]
    });

    const testCases = [
      {
        input: 'Gasté $50 mil en el mercado',
        expectedAmount: 50000,
        expectedCurrency: 'COP'
      },
      {
        input: 'Compré unos zapatos por 150 lucas',
        expectedAmount: 150000,
        expectedCurrency: 'COP'
      },
      {
        input: 'El almuerzo salió en 25 mil pesos',
        expectedAmount: 25000,
        expectedCurrency: 'COP'
      }
    ];

    console.log('\n✓ Colombian currency expressions test');

    for (const testCase of testCases) {
      const chat = model.startChat();
      const result = await chat.sendMessage(testCase.input);
      const calls = result.response.functionCalls();
      expect(calls).toBeDefined();
      expect(calls!.length).toBeGreaterThan(0);

      const call = calls![0]!;

      console.log(`Input: "${testCase.input}"`);
      console.log('Amount:', call?.args.amount);
      console.log('Currency:', call?.args.currency);

      expect(call?.name).toBe('track_expense');
      expect(call?.args.amount).toBe(testCase.expectedAmount);

      // Currency can be COP or undefined (default)
      if (call?.args.currency) {
        expect(call.args.currency).toBe(testCase.expectedCurrency);
      }
    }
  });

  test('should detect payment methods', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [trackExpenseTool] }]
    });

    const testCases = [
      {
        input: 'Pagué el café con tarjeta, $12,000',
        expectedMethod: 'tarjeta'
      },
      {
        input: 'Transferí $200,000 para el arriendo',
        expectedMethod: 'transferencia'
      },
      {
        input: 'Pagué en efectivo el bus, $2,800',
        expectedMethod: 'efectivo'
      }
    ];

    console.log('\n✓ Payment method detection test');

    for (const testCase of testCases) {
      const chat = model.startChat();
      const result = await chat.sendMessage(testCase.input);
      const calls = result.response.functionCalls();
      expect(calls).toBeDefined();
      expect(calls!.length).toBeGreaterThan(0);

      const call = calls![0]!;

      console.log(`Input: "${testCase.input}"`);
      console.log('Payment method:', call?.args.payment_method);

      expect(call?.name).toBe('track_expense');

      if (call?.args.payment_method) {
        expect(call.args.payment_method).toBe(testCase.expectedMethod);
      }
    }
  });

  test('should handle date references', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [trackExpenseTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Ayer gasté $80,000 en el supermercado'
    );

    const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

    console.log('\n✓ Date reference test');
    console.log('Function call:', JSON.stringify(call, null, 2));

    expect(call?.name).toBe('track_expense');

    if (call?.args.date) {
      const expenseDate = new Date(call.args.date);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Verificar que sea ayer (mismo día)
      expect(expenseDate.getDate()).toBe(yesterday.getDate());
    }
  });

  test('should parse multiple expenses in one message', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [trackExpenseTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Hoy gasté $15,000 en el almuerzo y $8,000 en el taxi'
    );

    const calls = result.response.functionCalls();

    console.log('\n✓ Multiple expenses test');
    console.log('Function calls:', JSON.stringify(calls, null, 2));

    // Puede devolver 2 llamadas o pedir que se hagan por separado
    if (calls && calls.length > 1) {
      expect(calls).toHaveLength(2);

      // Primera: almuerzo
      expect(calls[0]?.name).toBe('track_expense');
      expect(calls[0]?.args.amount).toBe(15000);
      expect(calls[0]?.args.category).toBe('alimentacion');

      // Segunda: taxi
      expect(calls[1]?.name).toBe('track_expense');
      expect(calls[1]?.args.amount).toBe(8000);
      expect(calls[1]?.args.category).toBe('transporte');
    } else {
      // Si no soporta múltiples llamadas, debería sugerir registrarlos por separado
      const text = result.response.text();
      expect(text).toMatch(/por separado|uno por uno/i);
    }
  });

  test('should handle foreign currency', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [trackExpenseTool] }]
    });

    const testCases = [
      {
        input: 'Compré en Amazon por 50 dólares',
        expectedAmount: 50,
        expectedCurrency: 'USD'
      },
      {
        input: 'Pagué 30 euros en la cena',
        expectedAmount: 30,
        expectedCurrency: 'EUR'
      }
    ];

    console.log('\n✓ Foreign currency test');

    for (const testCase of testCases) {
      const chat = model.startChat();
      const result = await chat.sendMessage(testCase.input);
      const calls = result.response.functionCalls();
      expect(calls).toBeDefined();
      expect(calls!.length).toBeGreaterThan(0);

      const call = calls![0]!;

      console.log(`Input: "${testCase.input}"`);
      console.log('Amount:', call?.args.amount);
      console.log('Currency:', call?.args.currency);

      expect(call?.name).toBe('track_expense');
      expect(call?.args.amount).toBe(testCase.expectedAmount);
      expect(call?.args.currency).toBe(testCase.expectedCurrency);
    }
  });

  test('should handle expense descriptions with Colombian slang', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [trackExpenseTool] }]
    });

    const testCases = [
      {
        input: 'Gasté $5,000 en el tinto',
        expectedCategory: 'alimentacion',
        expectedDescription: /tinto|café/i
      },
      {
        input: 'Compré la arepa e\' huevo por $8,000',
        expectedCategory: 'alimentacion',
        expectedDescription: /arepa/i
      },
      {
        input: 'Pagué $20,000 por la buseta',
        expectedCategory: 'transporte',
        expectedDescription: /buseta|bus/i
      }
    ];

    console.log('\n✓ Colombian slang test');

    for (const testCase of testCases) {
      const chat = model.startChat();
      const result = await chat.sendMessage(testCase.input);
      const calls = result.response.functionCalls();
      expect(calls).toBeDefined();
      expect(calls!.length).toBeGreaterThan(0);

      const call = calls![0]!;

      console.log(`Input: "${testCase.input}"`);
      console.log('Description:', call?.args.description);
      console.log('Category:', call?.args.category);

      expect(call?.name).toBe('track_expense');
      expect(call?.args.category).toBe(testCase.expectedCategory);
      expect(call?.args.description).toMatch(testCase.expectedDescription);
    }
  });

  test('should use Bogota timezone for expense dates', async () => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [trackExpenseTool] }]
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(
      'Ayer gasté $50,000 en medicinas'
    );

    const calls = result.response.functionCalls();
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThan(0);

    const call = calls![0]!;

    console.log('\n✓ Timezone test');
    console.log('Date:', call?.args.date);

    if (call?.args.date) {
      // Debe incluir timezone de Bogotá
      expect(call.args.date).toMatch(/-05:00|America\/Bogota/);
    }
  });
});
