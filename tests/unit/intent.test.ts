import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { classifyIntent, type IntentResult } from '../../lib/intent';
import * as openaiModule from '../../lib/openai';

// Mock OpenAI chatCompletion
jest.mock('../../lib/openai', () => ({
  chatCompletion: jest.fn(),
}));

const mockedChatCompletion = openaiModule.chatCompletion as jest.MockedFunction<
  typeof openaiModule.chatCompletion
>;

describe('classifyIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should classify casual chat correctly', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'casual_chat',
        confidence: 'high',
        reasoning: 'Simple greeting',
      })
    );

    const result = await classifyIntent('Hola, cómo estás?');

    expect(result).toEqual({
      intent: 'casual_chat',
      confidence: 'high',
      reasoning: 'Simple greeting',
    });
    expect(mockedChatCompletion).toHaveBeenCalledTimes(1);
  });

  it('should classify set_reminder intent correctly', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'set_reminder',
        confidence: 'high',
        reasoning: 'User wants to set a reminder',
      })
    );

    const result = await classifyIntent('Recuérdame mañana a las 3pm llamar a Juan');

    expect(result.intent).toBe('set_reminder');
    expect(result.confidence).toBe('high');
  });

  it('should classify ask_info intent correctly', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'ask_info',
        confidence: 'high',
      })
    );

    const result = await classifyIntent('¿Qué clima hay hoy?');

    expect(result.intent).toBe('ask_info');
    expect(result.confidence).toBe('high');
  });

  it('should classify manage_tasks intent correctly', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'manage_tasks',
        confidence: 'high',
      })
    );

    const result = await classifyIntent('Agregar leche a mi lista de compras');

    expect(result.intent).toBe('manage_tasks');
    expect(result.confidence).toBe('high');
  });

  it('should classify schedule_meeting intent correctly', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'schedule_meeting',
        confidence: 'high',
      })
    );

    const result = await classifyIntent('Agenda una reunión con María el viernes a las 10am');

    expect(result.intent).toBe('schedule_meeting');
    expect(result.confidence).toBe('high');
  });

  it('should classify analyze_document intent correctly', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'analyze_document',
        confidence: 'medium',
      })
    );

    const result = await classifyIntent('Resume este PDF que te envié');

    expect(result.intent).toBe('analyze_document');
    expect(result.confidence).toBe('medium');
  });

  it('should use conversation history for context', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'casual_chat',
        confidence: 'high',
      })
    );

    const history = [
      { role: 'user' as const, content: 'Hola' },
      { role: 'assistant' as const, content: 'Hola! ¿En qué puedo ayudarte?' },
      { role: 'user' as const, content: 'Cómo estás?' },
    ];

    await classifyIntent('Y tú?', history);

    const callArgs = mockedChatCompletion.mock.calls[0]!;
    const messages = callArgs[0]!;

    // Should include system prompt + last 3 history messages + current message
    expect(messages.length).toBeGreaterThan(2);
  });

  it('should fallback to "other" on parsing error', async () => {
    mockedChatCompletion.mockResolvedValueOnce('Invalid JSON response');

    const result = await classifyIntent('Test message');

    expect(result.intent).toBe('other');
    expect(result.confidence).toBe('low');
  });

  it('should fallback to "other" on API error', async () => {
    mockedChatCompletion.mockRejectedValueOnce(new Error('API Error'));

    const result = await classifyIntent('Test message');

    expect(result.intent).toBe('other');
    expect(result.confidence).toBe('low');
    expect(result.reasoning).toContain('Classification failed');
  });

  it('should handle missing confidence and reasoning fields', async () => {
    mockedChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'casual_chat',
      })
    );

    const result = await classifyIntent('Hola');

    expect(result.intent).toBe('casual_chat');
    expect(result.confidence).toBe('medium'); // Default fallback
    expect(result.reasoning).toBeUndefined();
  });
});
