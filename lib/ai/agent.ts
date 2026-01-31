/**
 * @file agent.ts
 * @description Main AI agent handler with intelligent model routing and cost tracking
 * @module lib/ai
 * @exports processMessage, AIResponse
 * @date 2026-01-30 14:00
 * @updated 2026-01-30 14:00
 */

import { generateText } from 'ai';
import { classifyTask, type Message, type Tool } from './task-classifier';
import { selectModel, getModelInstance, getProvider } from './model-router';
import { circuitBreaker } from './circuit-breaker';
import { trackCost, calculateCost } from './cost-tracker';

export interface AIResponse {
  response: string;
  toolCalls?: any[];
  model: string;
  category: string;
  tokensUsed: {
    inputTokens: number;
    outputTokens: number;
  };
  cost: number;
  classification: {
    category: string;
    confidence: number;
    reasoning: string;
  };
}

/**
 * System prompt for migue.ai assistant
 */
const SYSTEM_PROMPT = `Eres Migue, un asistente personal inteligente para WhatsApp.

Personalidad:
- Amigable, cálido y conversacional
- Usa español natural de LATAM
- Proactivo en ayudar
- Personalidad desbordante sin perder profesionalismo

Capacidades:
- Crear recordatorios y eventos
- Rastrear gastos
- Buscar información
- Responder preguntas
- Analizar imágenes y documentos

Instrucciones:
- Responde en español de forma natural
- Sé conciso pero completo
- Usa herramientas cuando sea necesario
- Si necesitas más información, pregunta
- Si no puedes ayudar, explica por qué claramente`;

/**
 * Available tools for AI agent
 * TODO: Phase 2 - Import actual tool definitions
 */
const ALL_TOOLS: Tool[] = [
  { name: 'createReminder', description: 'Create a reminder for future time' },
  { name: 'createEvent', description: 'Create a calendar event' },
  { name: 'trackExpense', description: 'Track a spending or expense' },
  { name: 'searchWeb', description: 'Search the web for information' },
  { name: 'getWeather', description: 'Get weather forecast' }
];

/**
 * Process user message with intelligent model routing
 *
 * @param message - User message text
 * @param userId - User ID for cost tracking
 * @param conversationHistory - Previous messages
 * @param messageType - Message type (text, voice, image, document)
 * @returns AI response with model info and cost
 */
export async function processMessage(
  message: string,
  userId: string,
  conversationHistory: Message[] = [],
  messageType: 'text' | 'voice' | 'image' | 'document' = 'text'
): Promise<AIResponse> {
  // Step 1: Classify task
  const classification = classifyTask(message, messageType, conversationHistory, ALL_TOOLS);

  console.log('[AI Agent] Task classified:', {
    category: classification.category,
    confidence: classification.confidence,
    complexity: classification.complexity,
    reasoning: classification.reasoning
  });

  // Step 2: Select model based on classification
  const modelConfig = selectModel(classification.category);

  // Step 3: Check circuit breaker for primary provider
  const primaryProvider = getProvider(modelConfig.primary);
  const canUsePrimary = circuitBreaker.canRequest(primaryProvider);

  const selectedModelId = canUsePrimary ? modelConfig.primary : modelConfig.fallback;
  const model = getModelInstance(selectedModelId);

  console.log('[AI Agent] Model selected:', {
    category: classification.category,
    primary: modelConfig.primary,
    selected: selectedModelId,
    usedFallback: !canUsePrimary
  });

  // Step 4: Generate response
  try {
    // NOTE: This is a placeholder - actual implementation needs provider-specific imports
    // For now, we'll simulate the response structure
    const result = await simulateGenerateText({
      model,
      system: SYSTEM_PROMPT,
      messages: conversationHistory,
      maxTokens: modelConfig.maxTokens,
      temperature: modelConfig.temperature
    });

    // Record success
    circuitBreaker.recordSuccess(primaryProvider);

    // Step 5: Calculate and track cost
    const cost = calculateCost(result.usage, modelConfig.costPerToken);

    await trackCost({
      userId,
      model: selectedModelId,
      category: classification.category,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cost,
      timestamp: new Date()
    });

    return {
      response: result.text,
      toolCalls: result.toolCalls,
      model: selectedModelId,
      category: classification.category,
      tokensUsed: result.usage,
      cost,
      classification: {
        category: classification.category,
        confidence: classification.confidence,
        reasoning: classification.reasoning
      }
    };

  } catch (error) {
    console.error('[AI Agent] Primary model failed:', error);

    // Record failure
    circuitBreaker.recordFailure(primaryProvider);

    // Fallback to secondary model
    const fallbackModel = getModelInstance(modelConfig.fallback);
    const fallbackProvider = getProvider(modelConfig.fallback);

    console.log('[AI Agent] Falling back to:', modelConfig.fallback);

    try {
      const fallbackResult = await simulateGenerateText({
        model: fallbackModel,
        system: SYSTEM_PROMPT,
        messages: conversationHistory,
        maxTokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature
      });

      // Record fallback success
      circuitBreaker.recordSuccess(fallbackProvider);

      const fallbackCost = calculateCost(fallbackResult.usage, modelConfig.costPerToken);

      await trackCost({
        userId,
        model: modelConfig.fallback,
        category: 'fallback',
        inputTokens: fallbackResult.usage.inputTokens,
        outputTokens: fallbackResult.usage.outputTokens,
        cost: fallbackCost,
        timestamp: new Date()
      });

      return {
        response: fallbackResult.text,
        toolCalls: fallbackResult.toolCalls,
        model: modelConfig.fallback,
        category: 'fallback',
        tokensUsed: fallbackResult.usage,
        cost: fallbackCost,
        classification: {
          category: classification.category,
          confidence: classification.confidence,
          reasoning: classification.reasoning
        }
      };

    } catch (fallbackError) {
      console.error('[AI Agent] Fallback model also failed:', fallbackError);
      circuitBreaker.recordFailure(fallbackProvider);

      throw new Error('All AI providers failed. Please try again later.');
    }
  }
}

/**
 * Simulate generateText for Phase 1 (before provider setup)
 * TODO: Replace with actual Vercel AI SDK call in Phase 2
 */
async function simulateGenerateText(params: any): Promise<any> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Simulate token usage based on message length
  const inputTokens = Math.ceil(params.system.length / 4) + 50; // system + message
  const outputTokens = 150; // typical response

  return {
    text: `[Simulated response from ${params.model}]\n\nEsta es una respuesta simulada. La integración real con los modelos se implementará en la Fase 2.`,
    toolCalls: [],
    usage: {
      inputTokens,
      outputTokens
    }
  };
}
