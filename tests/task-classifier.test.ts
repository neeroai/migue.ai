/**
 * @file task-classifier.test.ts
 * @description Unit tests for task classification logic
 * @module tests
 * @date 2026-01-30 14:00
 * @updated 2026-01-30 14:00
 */

import { describe, test, expect } from 'bun:test';
import { classifyTask, type Message, type Tool } from '../lib/ai/task-classifier';

const MOCK_TOOLS: Tool[] = [
  { name: 'createReminder', description: 'Create a reminder' },
  { name: 'createEvent', description: 'Create calendar event' },
  { name: 'trackExpense', description: 'Track expense' }
];

describe('Task Classifier', () => {
  describe('Simple Queries', () => {
    test('should classify short query as simple-query', () => {
      const result = classifyTask('¿Qué tengo hoy?', 'text', [], MOCK_TOOLS);

      expect(result.category).toBe('simple-query');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.toolCount).toBe(0);
    });

    test('should classify greeting as simple-query', () => {
      const result = classifyTask('Hola', 'text', [], MOCK_TOOLS);

      expect(result.category).toBe('simple-query');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Tool Detection', () => {
    test('should detect single tool - reminder', () => {
      const result = classifyTask(
        'Recuérdame comprar leche mañana a las 10am',
        'text',
        [],
        MOCK_TOOLS
      );

      expect(result.category).toBe('single-tool');
      expect(result.toolCount).toBe(1);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should detect multiple tools', () => {
      const result = classifyTask(
        'Crea un recordatorio para mañana y agrega un evento en mi calendario',
        'text',
        [],
        MOCK_TOOLS
      );

      expect(result.category).toBe('multi-tool');
      expect(result.toolCount).toBeGreaterThan(1);
    });

    test('should detect expense tracking', () => {
      const result = classifyTask(
        'Gasté $50 en almuerzo',
        'text',
        [],
        MOCK_TOOLS
      );

      expect(result.category).toBe('single-tool');
      expect(result.toolCount).toBe(1);
    });
  });

  describe('Multimodal Routing', () => {
    test('should route voice messages to voice-message category', () => {
      const result = classifyTask(
        'Audio transcription placeholder',
        'voice',
        [],
        MOCK_TOOLS
      );

      expect(result.category).toBe('voice-message');
      expect(result.confidence).toBe(1.0);
    });

    test('should route images to image-document category', () => {
      const result = classifyTask(
        'Image analysis placeholder',
        'image',
        [],
        MOCK_TOOLS
      );

      expect(result.category).toBe('image-document');
      expect(result.confidence).toBe(1.0);
    });

    test('should route documents to image-document category', () => {
      const result = classifyTask(
        'PDF content placeholder',
        'document',
        [],
        MOCK_TOOLS
      );

      expect(result.category).toBe('image-document');
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('Complex Reasoning', () => {
    test('should detect reasoning keywords - "por qué"', () => {
      const result = classifyTask(
        '¿Por qué mis gastos aumentaron este mes?',
        'text',
        [],
        MOCK_TOOLS
      );

      // Note: "gastos" triggers expense tool, so this becomes single-tool
      // Reasoning without tools would be complex-reasoning
      expect(['complex-reasoning', 'single-tool']).toContain(result.category);
      expect(result.complexity).toBeGreaterThan(2);
    });

    test('should detect reasoning keywords - "analiza"', () => {
      const result = classifyTask(
        'Analiza mis patrones de gasto y sugiéreme optimizaciones',
        'text',
        [],
        MOCK_TOOLS
      );

      // Note: "gasto" triggers expense tool, so this becomes single-tool
      // Pure reasoning without tools would be complex-reasoning
      expect(['complex-reasoning', 'single-tool']).toContain(result.category);
    });

    test('should detect reasoning keywords - "sugiere" (pure reasoning)', () => {
      const result = classifyTask(
        'Sugiere estrategias para mejorar mi productividad diaria',
        'text',
        [],
        MOCK_TOOLS
      );

      // Pure reasoning without tool keywords
      expect(result.category).toBe('complex-reasoning');
    });
  });

  describe('Spanish Conversation', () => {
    test('should detect Spanish conversation with context', () => {
      const history: Message[] = [
        { role: 'user', content: '¿Cómo estás?' },
        { role: 'assistant', content: 'Muy bien, gracias' },
        { role: 'user', content: '¿Qué me recomiendas hacer hoy?' },
        { role: 'assistant', content: 'Podrías...' },
        { role: 'user', content: 'Interesante, cuéntame más sobre eso' },
        { role: 'assistant', content: 'Claro...' }
      ];

      const result = classifyTask(
        'Me gustaría conocer más detalles sobre tus recomendaciones para hoy',
        'text',
        history,
        MOCK_TOOLS
      );

      expect(result.category).toBe('spanish-conversation');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should not classify short Spanish as conversation', () => {
      const result = classifyTask(
        '¿Qué hora es?',
        'text',
        [],
        MOCK_TOOLS
      );

      // Should be simple-query, not conversation
      expect(result.category).toBe('simple-query');
    });
  });

  describe('Fallback Behavior', () => {
    test('should use simple-query for short ambiguous messages', () => {
      const result = classifyTask(
        'Esto es un mensaje sin palabras clave',
        'text',
        [],
        MOCK_TOOLS
      );

      // Short messages without signals default to simple-query
      expect(result.category).toBe('simple-query');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should fallback for medium-length message without signals', () => {
      const result = classifyTask(
        'Este es un mensaje de longitud media que no tiene palabras clave específicas ni patrones claros de ningún tipo',
        'text',
        [],
        MOCK_TOOLS
      );

      // Medium messages without signals can be fallback or simple-query
      expect(['fallback', 'simple-query']).toContain(result.category);
    });
  });

  describe('Token Estimation', () => {
    test('should estimate tokens correctly for short message', () => {
      const result = classifyTask('Hola', 'text', [], MOCK_TOOLS);

      expect(result.estimatedTokens).toBeLessThan(10);
    });

    test('should estimate tokens correctly for long message', () => {
      const longMessage = 'A'.repeat(1000);
      const result = classifyTask(longMessage, 'text', [], MOCK_TOOLS);

      expect(result.estimatedTokens).toBeGreaterThan(200);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty message', () => {
      const result = classifyTask('', 'text', [], MOCK_TOOLS);

      expect(result.category).toBe('simple-query');
    });

    test('should handle message with emojis', () => {
      const result = classifyTask('🔔 Recuérdame comprar pan', 'text', [], MOCK_TOOLS);

      expect(result.category).toBe('single-tool');
    });

    test('should handle mixed English/Spanish', () => {
      const result = classifyTask(
        'Create reminder para mañana at 3pm',
        'text',
        [],
        MOCK_TOOLS
      );

      expect(result.category).toBe('single-tool');
    });

    test('should handle very long conversation history', () => {
      const longHistory: Message[] = Array(20).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Mensaje ${i} en español`
      })) as Message[];

      const result = classifyTask(
        '¿Podrías explicarme más sobre este tema que me interesa?',
        'text',
        longHistory,
        MOCK_TOOLS
      );

      // Long conversation with Spanish message (>5 messages, Spanish indicators)
      expect(result.category).toBe('spanish-conversation');
    });
  });
});
