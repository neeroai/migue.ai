import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getConversationHistory, historyToChatMessages, type ConversationMessage } from '../../lib/context';
import * as supabaseModule from '../../lib/supabase';

// Mock Supabase client
jest.mock('../../lib/supabase', () => ({
  getSupabaseServerClient: jest.fn(),
}));

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();

const mockedGetSupabaseServerClient = supabaseModule.getSupabaseServerClient as jest.MockedFunction<
  typeof supabaseModule.getSupabaseServerClient
>;

describe('getConversationHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock chain
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });

    mockedGetSupabaseServerClient.mockReturnValue({
      from: () => ({ select: mockSelect }),
    } as any);
  });

  it('should fetch and return conversation history in chronological order', async () => {
    const mockData = [
      { id: '3', direction: 'inbound', type: 'text', content: 'Third', timestamp: '2025-01-03' },
      { id: '2', direction: 'outbound', type: 'text', content: 'Second', timestamp: '2025-01-02' },
      { id: '1', direction: 'inbound', type: 'text', content: 'First', timestamp: '2025-01-01' },
    ];

    mockLimit.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await getConversationHistory('conv-123', 10);

    expect(result).toEqual([
      { id: '1', direction: 'inbound', type: 'text', content: 'First', timestamp: '2025-01-01' },
      { id: '2', direction: 'outbound', type: 'text', content: 'Second', timestamp: '2025-01-02' },
      { id: '3', direction: 'inbound', type: 'text', content: 'Third', timestamp: '2025-01-03' },
    ]);

    expect(mockEq).toHaveBeenCalledWith('conversation_id', 'conv-123');
    expect(mockOrder).toHaveBeenCalledWith('timestamp', { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('should return empty array when no data', async () => {
    mockLimit.mockResolvedValueOnce({ data: null, error: null });

    const result = await getConversationHistory('conv-123');

    expect(result).toEqual([]);
  });

  it('should throw error on Supabase error', async () => {
    const mockError = new Error('Database error');
    mockLimit.mockResolvedValueOnce({ data: null, error: mockError });

    await expect(getConversationHistory('conv-123')).rejects.toThrow('Database error');
  });
});

describe('historyToChatMessages', () => {
  it('should convert conversation history to ChatMessage format', () => {
    const history: ConversationMessage[] = [
      { id: '1', direction: 'inbound', type: 'text', content: 'Hello', timestamp: '2025-01-01' },
      { id: '2', direction: 'outbound', type: 'text', content: 'Hi there!', timestamp: '2025-01-02' },
      { id: '3', direction: 'inbound', type: 'text', content: 'How are you?', timestamp: '2025-01-03' },
    ];

    const result = historyToChatMessages(history);

    expect(result).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ]);
  });

  it('should filter out messages without content', () => {
    const history: ConversationMessage[] = [
      { id: '1', direction: 'inbound', type: 'text', content: 'Hello', timestamp: '2025-01-01' },
      { id: '2', direction: 'inbound', type: 'image', content: null, timestamp: '2025-01-02' },
      { id: '3', direction: 'outbound', type: 'text', content: 'Hi!', timestamp: '2025-01-03' },
    ];

    const result = historyToChatMessages(history);

    expect(result).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ]);
  });
});
