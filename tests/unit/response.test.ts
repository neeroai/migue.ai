import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { generateResponse, type ResponseOptions } from '../../lib/response';
import * as openaiModule from '../../lib/openai';

jest.mock('../../lib/openai', () => ({
  chatCompletion: jest.fn(),
  streamChatCompletion: jest.fn(),
}));

const mockedChatCompletion = openaiModule.chatCompletion as jest.MockedFunction<
  typeof openaiModule.chatCompletion
>;
const mockedStreamChatCompletion = openaiModule.streamChatCompletion as jest.MockedFunction<
  typeof openaiModule.streamChatCompletion
>;

describe('generateResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStreamChatCompletion.mockResolvedValue('streamed response');
    mockedChatCompletion.mockResolvedValue('fallback response');
  });

  it('should generate casual_chat response correctly', async () => {
    mockedStreamChatCompletion.mockResolvedValueOnce('¡Hola! ¿En qué puedo ayudarte hoy?');

    const options: ResponseOptions = {
      intent: 'casual_chat',
      userMessage: 'Hola',
    };

    const response = await generateResponse(options);

    expect(response).toBe('¡Hola! ¿En qué puedo ayudarte hoy?');
    expect(mockedStreamChatCompletion).toHaveBeenCalledTimes(1);

    const callArgs = mockedStreamChatCompletion.mock.calls[0]!;
    const messages = callArgs[0]!;

    // Should include system prompt for casual_chat
    expect(messages[0]!.role).toBe('system');
    expect(messages[0]!.content).toContain('asistente personal amigable');
  });

  it('should generate set_reminder response correctly', async () => {
    mockedStreamChatCompletion.mockResolvedValueOnce('Perfecto, te recordaré llamar a Juan mañana a las 3pm');

    const options: ResponseOptions = {
      intent: 'set_reminder',
      userMessage: 'Recuérdame llamar a Juan mañana a las 3pm',
    };

    const response = await generateResponse(options);

    expect(response).toContain('recordaré');

    const callArgs = mockedStreamChatCompletion.mock.calls[0]!;
    const messages = callArgs[0]!;
    expect(messages[0]!.content).toContain('recordatorio');
  });

  it('should generate ask_info response correctly', async () => {
    mockedStreamChatCompletion.mockResolvedValueOnce('Hoy está soleado con 25°C');

    const options: ResponseOptions = {
      intent: 'ask_info',
      userMessage: '¿Qué clima hay hoy?',
    };

    const response = await generateResponse(options);

    expect(response).toBe('Hoy está soleado con 25°C');
  });

  it('should generate schedule_meeting response correctly', async () => {
    mockedStreamChatCompletion.mockResolvedValueOnce('¡Entendido! Quieres agendar reunión con María el viernes.');

    const options: ResponseOptions = {
      intent: 'schedule_meeting',
      userMessage: 'Agenda una reunión con María el viernes',
    };

    const response = await generateResponse(options);

    expect(response).toContain('agendar');
  });

  it('should include userName in system prompt when provided', async () => {
    mockedStreamChatCompletion.mockResolvedValueOnce('¡Hola Carlos! ¿Cómo estás?');

    const options: ResponseOptions = {
      intent: 'casual_chat',
      userMessage: 'Hola',
      userName: 'Carlos',
    };

    await generateResponse(options);

    const callArgs = mockedStreamChatCompletion.mock.calls[0]!;
    const messages = callArgs[0]!;

    // System prompt should include user name
    expect(messages[0]!.content).toContain('Carlos');
  });

  it('should include conversation history (last 5 messages)', async () => {
    mockedStreamChatCompletion.mockResolvedValueOnce('Sí, claro que sí');

    const history = [
      { role: 'user' as const, content: 'Hola' },
      { role: 'assistant' as const, content: 'Hola! ¿En qué puedo ayudarte?' },
      { role: 'user' as const, content: 'Puedes ayudarme con algo?' },
      { role: 'assistant' as const, content: 'Por supuesto' },
      { role: 'user' as const, content: 'Genial' },
      { role: 'assistant' as const, content: '¿Qué necesitas?' },
    ];

    const options: ResponseOptions = {
      intent: 'casual_chat',
      userMessage: '¿Me entiendes?',
      conversationHistory: history,
    };

    await generateResponse(options);

    const callArgs = mockedStreamChatCompletion.mock.calls[0]!;
    const messages = callArgs[0]!;

    // Should include: system + last 5 history + current message = 7 total
    expect(messages.length).toBe(7);
  });

  it('should trim whitespace from response', async () => {
    mockedStreamChatCompletion.mockResolvedValueOnce('  Respuesta con espacios  \n\n');

    const options: ResponseOptions = {
      intent: 'casual_chat',
      userMessage: 'Test',
    };

    const response = await generateResponse(options);

    expect(response).toBe('Respuesta con espacios');
  });

  it('should use GPT-4o with correct parameters', async () => {
    mockedStreamChatCompletion.mockResolvedValueOnce('Test response');

    const options: ResponseOptions = {
      intent: 'casual_chat',
      userMessage: 'Test',
    };

    await generateResponse(options);

    const callArgs = mockedStreamChatCompletion.mock.calls[0]!;
    const config = callArgs[1]!;

    expect(config.model).toBe('gpt-4o');
    expect(config.temperature).toBe(0.7);
    expect(config.maxTokens).toBe(300);
  });

  it('should return fallback message on API error', async () => {
    mockedStreamChatCompletion.mockRejectedValueOnce(new Error('API Error'));
    mockedChatCompletion.mockRejectedValueOnce(new Error('API Error'));

    const options: ResponseOptions = {
      intent: 'casual_chat',
      userMessage: 'Test',
    };

    const response = await generateResponse(options);

    expect(response).toContain('Disculpa');
    expect(response).toContain('problema');
  });

  it('should use "other" system prompt for unknown intents', async () => {
    mockedStreamChatCompletion.mockResolvedValueOnce('Puedo ayudarte con eso');

    const options: ResponseOptions = {
      intent: 'other',
      userMessage: 'Algo raro',
    };

    await generateResponse(options);

    const callArgs = mockedStreamChatCompletion.mock.calls[0]!;
    const messages = callArgs[0]!;

    expect(messages[0]!.content).toContain('asistente personal amigable');
  });
});
